<template>
  <div class="grid gap-2 rounded-md border border-[var(--ui-border)] px-3 py-2.5">
    <div class="flex items-center justify-between gap-3">
      <span class="text-sm font-medium">{{ window.label }}</span>
      <UBadge :color="window.status === 'Exhausted' ? 'error' : window.status === 'Active' ? 'success' : window.status === 'Not started' ? 'info' : 'neutral'" variant="subtle">{{ window.status }}</UBadge>
    </div>
    <template v-if="window.enabled">
      <div v-if="window.progress != null" class="h-1.5 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]" role="progressbar" :aria-label="window.label + ' usage'" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="window.progress">
        <div class="h-full rounded-full" :class="window.status === 'Exhausted' ? 'bg-[var(--ui-error)]' : window.progress >= 80 ? 'bg-[var(--ui-warning)]' : 'bg-[var(--ui-success)]'" :style="{ width: window.progress + '%' }" />
      </div>
      <p class="text-xs tabular-nums">{{ window.used }} / {{ window.limit }} used · {{ window.remaining }} remaining</p>
      <p class="text-xs text-[var(--ui-text-muted)]">{{ window.description }}</p>
    </template>
    <p v-else class="text-xs text-[var(--ui-text-muted)]">No limit configured for this window.</p>
  </div>
</template>

<script>
export default {
  props: ['window']
}
</script>
