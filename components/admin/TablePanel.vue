<template>
  <div class="space-y-4">
    <div v-if="$slots.filters || $slots.actions" class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div v-if="$slots.filters" class="min-w-0 flex-1">
        <slot name="filters" />
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.bulk" class="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] px-3 py-2.5">
      <slot name="bulk" />
    </div>

    <AdminDataPanel :title="title" :description="description">
      <template v-if="$slots.panelActions" #actions>
        <slot name="panelActions" />
      </template>
      <slot />
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
    </AdminDataPanel>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: '',
  description: ''
})
</script>
