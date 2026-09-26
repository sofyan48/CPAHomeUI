<template>
  <div class="grid gap-2">
    <p class="text-sm font-medium">{{ title }}</p>
    <div v-if="items.length" class="grid max-h-44 gap-2 overflow-y-auto rounded-md border border-[var(--ui-border)] p-2">
      <label v-for="item in items" :key="item.value" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--ui-bg-muted)]">
        <UCheckbox :model-value="selected.includes(item.value)" @update:model-value="$emit('toggle', item.value)" />
        <span class="truncate">{{ item.label }}</span>
      </label>
    </div>
    <div v-else class="rounded-md border border-[var(--ui-border)] px-3 py-3 text-sm text-[var(--ui-text-muted)]">{{ emptyLabel }}</div>
  </div>
</template>

<script>
export default {
  props: ['title', 'emptyLabel', 'items', 'selected'],
  emits: ['toggle']
}
</script>
