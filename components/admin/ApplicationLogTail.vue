<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  rows: Record<string, any>[]
  following: boolean
  pendingCount: number
  busy: boolean
  canLoadOlder: boolean
  disabled: boolean
  truncated: boolean
}>()
const emit = defineEmits(['following', 'accept', 'older', 'detail'])
const viewport = ref<HTMLElement | null>(null)
const chronologicalRows = computed(() => [...props.rows].reverse())
watch(() => props.rows, async (rows, previous) => {
  const element = viewport.value
  if (!element) return
  const height = element.scrollHeight
  const top = element.scrollTop
  const prepended = rows.at(-1)?.id !== previous?.at(-1)?.id && rows[0]?.id === previous?.[0]?.id
  await nextTick()
  if (props.following) element.scrollTop = element.scrollHeight
  else if (prepended) element.scrollTop = top + element.scrollHeight - height
})
watch(() => props.following, async following => {
  await nextTick()
  if (following && viewport.value) viewport.value.scrollTop = viewport.value.scrollHeight
})
const onScroll = () => {
  const element = viewport.value
  if (props.following && element && element.scrollHeight - element.scrollTop - element.clientHeight > 24) emit('following', false)
}
</script>

<template>
  <div class="space-y-3 p-4">
    <div class="flex flex-wrap items-center gap-2">
      <AppButton color="neutral" variant="outline" :aria-pressed="following" :disabled="disabled" @click="emit('following', !following)">
        Follow bottom {{ following ? 'on' : 'off' }}
      </AppButton>
      <AppButton color="neutral" variant="outline" :disabled="disabled || !canLoadOlder" :loading="busy" @click="emit('older')">Load older</AppButton>
      <AppButton v-if="pendingCount" color="primary" variant="outline" :disabled="disabled" @click="emit('accept')">Show {{ pendingCount }} new lines</AppButton>
      <span role="status" class="text-xs text-[var(--ui-text-muted)]">{{ rows.length }} loaded · oldest first · {{ following ? 'following latest' : 'reading position preserved' }}</span>
    </div>
    <p class="text-xs text-[var(--ui-text-muted)]">Live refresh polls a recent window every 15 seconds. It may miss lines during bursts or late arrivals; use pages and Refresh for history.</p>
    <p v-if="truncated" role="status" class="text-xs text-amber-600 dark:text-amber-400">The recent window or 2,000-line viewer limit was exceeded. Some lines may be missing; use pages or restart from latest logs.</p>
    <div ref="viewport" tabindex="0" role="region" aria-label="Application log tail, oldest first" class="h-96 overflow-auto rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] [overflow-anchor:none]" @scroll.passive="onScroll">
      <p v-if="!rows.length" class="p-4 text-sm text-[var(--ui-text-muted)]">{{ busy ? 'Loading application logs…' : 'No application logs match these filters.' }}</p>
      <div v-for="row in chronologicalRows" :key="String(row.id)" class="border-b border-[var(--ui-border)] p-3 last:border-0">
        <div class="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ui-text-muted)]">
          <span>{{ row.timestamp }}</span>
          <UBadge color="neutral" variant="subtle" size="sm">{{ row.level || 'unknown' }}</UBadge>
          <span>{{ row.home_ip || 'Unknown Home' }} · {{ row.request_id || 'No request ID' }}</span>
          <AppButton size="sm" color="neutral" variant="ghost" @click="emit('detail', row)">Details</AppButton>
        </div>
        <p class="whitespace-pre-wrap break-words font-mono text-xs">{{ row.line || '—' }}</p>
      </div>
    </div>
  </div>
</template>
