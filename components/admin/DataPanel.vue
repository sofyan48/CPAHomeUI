<template>
  <AppCard :ui="{ body: 'p-0' }" :aria-label="title || 'Data table'">
    <template v-if="title || description || $slots.actions" #header>
      <div class="flex min-h-8 items-center gap-3">
        <div class="min-w-0 flex-1">
          <h2 v-if="title" class="truncate text-sm font-semibold text-highlighted">{{ title }}</h2>
          <p v-if="description" class="mt-0.5 truncate text-xs text-muted">{{ description }}</p>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5">
          <slot name="actions" />
        </div>
      </div>
    </template>

    <div v-if="$slots.toolbar" class="border-b border-[var(--ui-border)] px-4 py-3">
      <slot name="toolbar" />
    </div>

    <div v-if="$slots.bulk" class="border-b border-[var(--ui-border)] bg-[var(--ui-bg-muted)] px-4 py-3">
      <slot name="bulk" />
    </div>

    <div class="min-w-0 overflow-x-auto" :class="contentClass">
      <slot />
    </div>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AppCard>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string; contentClass?: string }>(), {
  title: '',
  description: '',
  contentClass: ''
})
</script>
