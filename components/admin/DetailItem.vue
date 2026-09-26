<template>
  <div class="min-w-0">
    <dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ label }}</dt>
    <dd class="mt-1 break-words text-sm" :class="mono ? 'font-mono text-xs' : ''">{{ displayValue }}</dd>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ label?: string; value?: string | number | null; mono?: boolean }>()
const displayValue = computed(() => props.value === null || props.value === undefined || props.value === '' ? '—' : props.value)
</script>
