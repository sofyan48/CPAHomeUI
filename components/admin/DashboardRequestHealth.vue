<template>
  <AppCard class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40" aria-labelledby="request-health-title">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div class="flex items-center gap-2.5">
          <UIcon name="i-tabler-activity-heartbeat" class="size-5 text-[var(--ui-text-muted)]" />
          <h2 id="request-health-title" class="text-lg font-semibold text-[var(--ui-text-highlighted)]">Request health</h2>
        </div>
        <p class="text-sm text-[var(--ui-text-muted)]">
          {{ activeCount }} / {{ buckets.length }} active intervals · {{ number.format(totalRequests) }} requests · {{ overallSuccessRate }} success
        </p>
      </div>
    </template>

    <template v-if="buckets.length">
      <div
        class="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
        role="group"
        tabindex="0"
        aria-label="Request health activity. Use left and right arrow keys to inspect intervals."
        @keydown="onKeydown"
      >
        <p class="text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ rangeLabel }} · {{ intervalLabel }}</p>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="bucket in buckets"
            :key="bucket.index"
            type="button"
            class="size-6 rounded ring-offset-2 ring-offset-[var(--ui-bg)] transition-[opacity,transform] hover:scale-105 hover:opacity-85"
            :class="[colors[bucket.status], selectedBucket?.index === bucket.index ? 'ring-2 ring-primary' : '']"
            :title="description(bucket)"
            :aria-label="description(bucket)"
            @click="activeIndex = bucket.index"
            @focus="activeIndex = bucket.index"
            @pointerenter="activeIndex = bucket.index"
          />
        </div>

        <p class="mt-3 min-h-6 text-sm text-[var(--ui-text-muted)]" aria-live="polite" aria-atomic="true">
          <template v-if="selectedBucket">
            {{ statusLabel(selectedBucket.status) }} · {{ bucketRange(selectedBucket) }}: {{ number.format(selectedBucket.requests) }} requests · {{ successRate(selectedBucket) }} success
          </template>
        </p>
      </div>

      <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--ui-text-muted)]" aria-label="Request health legend">
        <span v-for="item in visibleLegend" :key="item.status" class="inline-flex items-center gap-2">
          <span class="size-3 rounded-sm" :class="colors[item.status]" aria-hidden="true" />{{ item.label }}
        </span>
      </div>
    </template>

    <p v-else class="flex min-h-48 items-center justify-center text-center text-sm text-[var(--ui-text-muted)]">No request activity is available for this range.</p>
  </AppCard>
</template>

<script setup lang="ts">
interface ActivityEntry {
  bucket_start?: string
  bucket_end?: string
  request_count?: number | null
  success_count?: number | null
  status?: string | null
}
interface Range { from?: string; to?: string; timezone?: string; interval?: string }
type Health = 'healthy' | 'degraded' | 'unavailable' | 'empty' | 'unknown'
interface Bucket { index: number; bucket_start: string; bucket_end?: string; requests: number; successes: number; status: Health }

const props = withDefaults(defineProps<{ activity?: ActivityEntry[] | null; range?: Range | null }>(), { activity: () => [] })
const activeIndex = ref<number | null>(null)
const number = new Intl.NumberFormat()
const legend: { status: Health; label: string }[] = [
  { status: 'healthy', label: 'Healthy' },
  { status: 'degraded', label: 'Degraded' },
  { status: 'unavailable', label: 'Unavailable' },
  { status: 'empty', label: 'No traffic' },
  { status: 'unknown', label: 'Unknown' }
]
const visibleLegend = legend.filter(item => item.status !== 'unknown')
const colors: Record<Health, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  unavailable: 'bg-rose-500',
  empty: 'border border-[var(--ui-border)] bg-[var(--ui-bg-muted)]',
  unknown: 'bg-slate-400'
}
const safeCount = (value: number | null | undefined) => Number.isFinite(value) ? Math.max(0, Number(value)) : 0
const buckets = computed<Bucket[]>(() => (Array.isArray(props.activity) ? props.activity : [])
  .filter(point => point && point.bucket_start)
  .sort((a, b) => Date.parse(a.bucket_start!) - Date.parse(b.bucket_start!))
  .map((point, index) => ({
    index,
    bucket_start: point.bucket_start!,
    bucket_end: point.bucket_end,
    requests: safeCount(point.request_count),
    successes: safeCount(point.success_count),
    status: (['healthy', 'degraded', 'unavailable', 'empty'].includes(point.status || '') ? point.status : 'unknown') as Health
  })))
const defaultIndex = computed(() => {
  const noteworthy = buckets.value.findIndex(bucket => bucket.status !== 'healthy' && bucket.status !== 'empty')
  return noteworthy >= 0 ? noteworthy : buckets.value.length ? 0 : null
})
const selectedBucket = computed(() => {
  const index = activeIndex.value ?? defaultIndex.value
  return index == null ? null : buckets.value[index] || null
})
const activeCount = computed(() => buckets.value.filter(bucket => bucket.requests > 0).length)
const totalRequests = computed(() => buckets.value.reduce((sum, bucket) => sum + bucket.requests, 0))
const totalSuccesses = computed(() => buckets.value.reduce((sum, bucket) => sum + bucket.successes, 0))
const overallSuccessRate = computed(() => totalRequests.value ? `${Math.min(100, totalSuccesses.value / totalRequests.value * 100).toFixed(1)}%` : '—')
const timezone = computed(() => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: props.range?.timezone || 'UTC' })
    return props.range?.timezone || 'UTC'
  } catch { return 'UTC' }
})
const rangeLabel = computed(() => props.range?.from && props.range?.to
  ? `${date(props.range.from, { month: 'short', day: 'numeric' })}–${date(props.range.to, { month: 'short', day: 'numeric' })}`
  : buckets.value.length
    ? `${date(buckets.value[0]?.bucket_start, { month: 'short', day: 'numeric' })}–${date(buckets.value.at(-1)?.bucket_end || buckets.value.at(-1)?.bucket_start, { month: 'short', day: 'numeric' })}`
    : 'Selected range')
const intervalLabel = computed(() => {
  const interval = String(props.range?.interval || '').trim().toLowerCase()
  if (interval) return interval[0]!.toUpperCase() + interval.slice(1)
  if (buckets.value.length < 2) return 'Interval'
  const duration = Date.parse(buckets.value[0]!.bucket_end || '') - Date.parse(buckets.value[0]!.bucket_start)
  if (duration >= 86_400_000) return 'Daily'
  if (duration >= 3_600_000) return 'Hourly'
  return 'Interval'
})

function date(value: string | undefined, options: Intl.DateTimeFormatOptions) {
  if (!value) return 'Unknown time'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Unknown time' : new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone.value }).format(parsed)
}
function statusLabel(status: Health) { return legend.find(item => item.status === status)?.label || 'Unknown' }
function bucketRange(bucket: Bucket) {
  return `${date(bucket.bucket_start, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} – ${date(bucket.bucket_end, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
}
function successRate(bucket: Bucket) {
  if (!bucket.requests) return '—'
  return `${Math.min(100, Math.max(0, bucket.successes / bucket.requests * 100)).toFixed(1)}%`
}
function description(bucket: Bucket) {
  return `${statusLabel(bucket.status)} · ${bucketRange(bucket)}: ${number.format(bucket.requests)} requests · ${successRate(bucket)} success`
}
function onKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') activeIndex.value = 0
  else if (event.key === 'End') activeIndex.value = buckets.value.length - 1
  else activeIndex.value = Math.max(0, Math.min(buckets.value.length - 1, (activeIndex.value ?? defaultIndex.value ?? (event.key === 'ArrowLeft' ? buckets.value.length : -1)) + (event.key === 'ArrowRight' ? 1 : -1)))
}
</script>
