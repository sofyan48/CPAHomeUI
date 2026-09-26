<template>
  <div class="grid gap-2">
    <p class="text-sm font-medium">{{ kind === 'credential' ? 'Account credential' : 'Model' }}</p>
    <UInput
      :model-value="search"
      icon="i-tabler-search"
      :disabled="mutating || pending"
      :placeholder="kind === 'credential' ? 'Search credential name, provider, or ID' : 'Search model name, provider, channel, or ID'"
      @update:model-value="$emit('update:search', $event)"
      @keydown.enter.prevent.stop="selectFirst($event)"
    />
    <div class="flex flex-col gap-2 rounded-md border border-[var(--ui-border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div v-if="kind === 'model'" class="flex flex-wrap items-center gap-1.5">
        <span class="mr-1 text-xs text-[var(--ui-text-muted)]">Source</span>
        <UButton
          v-for="filter in [{ label: 'All', value: 'all' }, { label: 'Runtime', value: 'available' }, { label: 'Static', value: 'static' }]"
          :key="filter.value"
          type="button"
          size="xs"
          color="neutral"
          :variant="sourceFilter === filter.value ? 'soft' : 'outline'"
          :disabled="mutating || pending"
          @click="$emit('update:source-filter', filter.value)"
        >
          {{ filter.label }}
        </UButton>
      </div>
      <span v-else class="text-xs text-[var(--ui-text-muted)]">{{ visible.length }} current results</span>
      <span class="text-xs text-[var(--ui-text-muted)]">{{ selected.length }} {{ kind === 'credential' ? 'credentials' : 'models' }} selected</span>
    </div>
    <div v-if="pending" class="grid gap-2 rounded-md border border-[var(--ui-border)] p-2">
      <USkeleton v-for="row in 3" :key="row" class="h-14" />
    </div>
    <div v-else-if="errorMessage" class="rounded-md border border-red-300 bg-red-50 px-3 py-3 dark:border-red-900 dark:bg-red-950">
      <p class="text-sm text-red-700 dark:text-red-300">{{ errorMessage }}</p>
      <UButton type="button" size="sm" color="neutral" variant="outline" icon="i-tabler-refresh" class="mt-3" @click="$emit('retry')">Retry</UButton>
    </div>
    <div v-else-if="!visible.length" class="rounded-md border border-[var(--ui-border)] px-3 py-6 text-center text-sm text-[var(--ui-text-muted)]">
      {{ search.trim() ? (kind === 'credential' ? 'No account credentials match your search.' : 'No models match your search.') : (kind === 'credential' ? 'No account credentials are available for selection.' : 'No models are available for selection.') }}
    </div>
    <div v-else class="grid gap-2">
      <div v-if="issueMessage" class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{{ issueMessage }}</div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton type="button" size="xs" color="neutral" variant="outline" :disabled="mutating || !enabledVisible.length || allEnabledVisibleSelected" @click="selectResults">Select results</UButton>
          <UButton type="button" size="xs" color="neutral" variant="outline" :disabled="mutating || !enabledVisible.length" @click="invert">Invert results</UButton>
          <UButton type="button" size="xs" color="neutral" variant="ghost" :disabled="mutating || !selected.length" @click="$emit('update:selected', []); $emit('clear-error')">Clear selection</UButton>
        </div>
        <span class="text-xs text-[var(--ui-text-muted)]">{{ visible.length }} current results</span>
      </div>
      <div class="grid max-h-72 gap-1 overflow-y-auto rounded-md border border-[var(--ui-border)] p-1.5">
        <label
          v-for="item in visible"
          :key="item.id"
          :class="['flex min-w-0 items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors', selected.includes(item.value) ? 'bg-[var(--ui-primary)]/10 ring-1 ring-[var(--ui-primary)]/35' : 'hover:bg-[var(--ui-bg-muted)]', (mutating || item.disabled) ? 'cursor-not-allowed opacity-55' : '']"
        >
          <UCheckbox class="mt-0.5" :model-value="selected.includes(item.value)" :disabled="mutating || item.disabled" @update:model-value="toggle(item.value)" />
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-1.5">
              <span class="truncate text-sm font-medium">{{ item.label }}</span>
              <UBadge v-for="badge in item.badges" :key="badge" :color="badge === 'Available' || badge === 'Bound' ? 'success' : 'neutral'" variant="subtle" size="sm">{{ badge }}</UBadge>
            </span>
            <span class="mt-1 block truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ item.description }}</span>
          </span>
        </label>
      </div>
    </div>
    <p class="text-xs leading-5 text-[var(--ui-text-muted)]">{{ kind === 'credential' ? 'Select one or more credentials. Only credentials with an explicit Auth ID are listed. Bound or unavailable credentials cannot be selected again.' : 'Select one or more models. Runtime-available models are shown first, with the static catalog as fallback. Bound models cannot be selected again.' }}</p>
  </div>
</template>

<script>
export default {
  props: ['kind', 'items', 'selected', 'search', 'sourceFilter', 'pending', 'issueMessage', 'errorMessage', 'mutating'],
  emits: ['update:search', 'update:source-filter', 'update:selected', 'retry', 'clear-error'],
  computed: {
    visible() {
      const query = String(this.search || '').trim().toLowerCase()
      return this.items.filter(item => (this.kind !== 'model' || this.sourceFilter === 'all' || item.scopes.includes(this.sourceFilter)) && (!query || (this.kind === 'model' ? [item.label, item.modelId, item.ownedBy, item.type, item.channel, ...(item.scopes || [])] : [item.label, item.value, item.provider, item.type, item.status]).some(value => String(value || '').toLowerCase().includes(query))))
    },
    enabledVisible() {
      return this.visible.filter(item => !item.disabled)
    },
    allEnabledVisibleSelected() {
      return this.enabledVisible.length > 0 && this.enabledVisible.every(item => this.selected.includes(item.value))
    }
  },
  methods: {
    toggle(value) {
      const item = this.items.find(candidate => candidate.value === value)
      if (this.mutating || item?.disabled) return
      const next = this.selected.includes(value) ? this.selected.filter(item => item !== value) : [...this.selected, value]
      this.$emit('update:selected', next)
      this.$emit('clear-error')
    },
    selectResults() {
      if (!this.enabledVisible.length || this.allEnabledVisibleSelected) return
      this.$emit('update:selected', [...new Set([...this.selected, ...this.enabledVisible.map(item => item.value)])])
      this.$emit('clear-error')
    },
    invert() {
      if (!this.enabledVisible.length) return
      const next = new Set(this.selected)
      for (const item of this.enabledVisible) next.has(item.value) ? next.delete(item.value) : next.add(item.value)
      this.$emit('update:selected', [...next])
      this.$emit('clear-error')
    },
    selectFirst(event) {
      if (event?.isComposing) return
      const first = this.enabledVisible[0]
      if (first) this.toggle(first.value)
    }
  }
}
</script>
