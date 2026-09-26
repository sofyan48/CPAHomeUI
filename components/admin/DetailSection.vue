<template>
  <div class="rounded-md border border-[var(--ui-border)] p-4">
    <p class="mb-3 text-sm font-semibold">{{ title }}</p>
    <dl class="space-y-2">
      <div v-for="item in items" :key="item.label" class="flex items-start justify-between gap-4 text-sm">
        <dt class="text-[var(--ui-text-muted)]">{{ item.label }}</dt>
        <dd class="break-all text-right">{{ item.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title?: string; items?: Array<{ label: string; value: unknown }> }>()
</script>
