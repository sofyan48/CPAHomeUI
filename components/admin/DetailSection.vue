<template>
  <section class="min-w-0 border-t border-[var(--ui-border)] pt-3" :aria-label="title">
    <h3 v-if="title" class="mb-2 text-sm font-semibold text-highlighted">{{ title }}</h3>
    <dl class="divide-y divide-[var(--ui-border)]">
      <div v-for="item in items" :key="item.label" class="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-x-4 py-2 text-sm">
        <dt class="min-w-0 text-muted [overflow-wrap:anywhere]">{{ item.label }}</dt>
        <dd class="min-w-0 text-right text-default [overflow-wrap:anywhere]">{{ item.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string; items?: Array<{ label: string; value: unknown }> }>()
</script>
