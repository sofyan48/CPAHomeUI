<template>
  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
    <span class="truncate text-[var(--ui-text-muted)]">{{ label }}</span>
    <span :class="['text-right font-medium tabular-nums', warning ? 'text-amber-600 dark:text-amber-400' : '']">{{ value }}</span>
  </div>
</template>

<script>
export default {
  props: ['label', 'value', 'warning']
}
</script>
