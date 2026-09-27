<template>
  <section class="rounded-xl border border-white/40 bg-white/40 app-surface p-4 dark:border-white/10 dark:bg-neutral-900/40 sm:p-5" aria-labelledby="request-health-title">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 id="request-health-title" class="font-semibold text-[var(--ui-text-highlighted)]">Request health</h2>
        <p class="text-xs text-[var(--ui-text-muted)]">{{ buckets.filter(bucket => bucket.requests > 0).length }} / {{ buckets.length }} active intervals · {{ number.format(buckets.reduce((sum, bucket) => sum + bucket.requests, 0)) }} requests</p>
      </div>
      <span v-if="rangeLabel" class="text-xs text-[var(--ui-text-muted)]">{{ rangeLabel }}</span>
    </div>

    <template v-if="buckets.length">
      <div class="mt-5 overflow-x-auto pb-2">
        <div
          class="w-full min-w-max rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
          role="group"
          tabindex="0"
          aria-label="Request health activity matrix. Use left and right arrow keys to inspect time buckets."
          @keydown="onKeydown"
          @pointerleave="activeIndex = null"
        >
          <div class="flex gap-2 sm:gap-3">
            <div v-for="day in days" :key="day.key" class="min-w-0 flex-1">
              <p class="mb-2 text-center text-xs text-[var(--ui-text-muted)]">{{ day.label }}</p>
              <div class="grid grid-cols-4 gap-1 sm:gap-1.5" :aria-label="day.label">
                <span
                  v-for="bucket in day.buckets"
                  :key="bucket.index"
                  class="block size-4 rounded-sm ring-offset-2 ring-offset-[var(--ui-bg)] sm:size-5"
                  :class="[colors[bucket.status], activeIndex === bucket.index ? 'ring-2 ring-primary' : '']"
                  :title="description(bucket)"
                  :aria-label="description(bucket)"
                  @pointerenter="activeIndex = bucket.index"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <p class="mt-2 min-h-10 text-sm text-[var(--ui-text-muted)]" aria-live="polite" aria-atomic="true">
        <template v-if="selectedBucket">{{ description(selectedBucket) }}</template>
        <template v-else>Hover or use the arrow keys to inspect a bucket.</template>
      </p>
      <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--ui-text-muted)]" aria-label="Request health legend">
        <span v-for="item in legend" :key="item.status" class="inline-flex items-center gap-1.5">
          <span class="size-3 rounded-sm" :class="colors[item.status]" aria-hidden="true" />{{ item.label }}
        </span>
      </div>
    </template>
    <p v-else class="flex min-h-48 items-center justify-center text-center text-sm text-[var(--ui-text-muted)]">No request activity is available for this range.</p>
  </section>
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
const colors: Record<Health, string> = {
  healthy: 'bg-emerald-500', degraded: 'bg-amber-500', unavailable: 'bg-rose-500', empty: 'bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]', unknown: 'bg-slate-400'
}
const safeCount = (value: number | null | undefined) => Number.isFinite(value) ? Math.max(0, Number(value)) : 0
const buckets = computed<Bucket[]>(() => (Array.isArray(props.activity) ? props.activity : [])
  .filter(point => point && point.bucket_start)
  .sort((a, b) => Date.parse(a.bucket_start!) - Date.parse(b.bucket_start!))
  .map((point, index) => ({
    index,
    bucket_start: point.bucket_start!, bucket_end: point.bucket_end,
    requests: safeCount(point.request_count), successes: safeCount(point.success_count),
    status: (['healthy', 'degraded', 'unavailable', 'empty'].includes(point.status || '') ? point.status : 'unknown') as Health
  })))
const selectedBucket = computed(() => activeIndex.value === null ? null : buckets.value[activeIndex.value] || null)
const timezone = computed(() => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: props.range?.timezone || 'UTC' })
    return props.range?.timezone || 'UTC'
  } catch { return 'UTC' }
})
function date(value: string | undefined, options: Intl.DateTimeFormatOptions) {
  if (!value) return 'Unknown time'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Unknown time' : new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone.value }).format(parsed)
}
const days = computed(() => {
  const groups: { key: string; label: string; buckets: Bucket[] }[] = []
  for (const bucket of buckets.value) {
    const key = date(bucket.bucket_start, { year: 'numeric', month: '2-digit', day: '2-digit' })
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: date(bucket.bucket_start, { month: 'short', day: 'numeric' }), buckets: [] }
      groups.push(group)
    }
    group.buckets.push(bucket)
  }
  return groups
})
const rangeLabel = computed(() => props.range?.from && props.range?.to
  ? `${date(props.range.from, { month: 'short', day: 'numeric' })}–${date(props.range.to, { month: 'short', day: 'numeric' })}` : '')
function description(bucket: Bucket) {
  const label = legend.find(item => item.status === bucket.status)!.label
  return `${date(bucket.bucket_start, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}–${date(bucket.bucket_end, { hour: 'numeric', minute: '2-digit' })}: ${label} · ${number.format(bucket.requests)} requests · ${number.format(bucket.successes)} successful`
}
function onKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') activeIndex.value = 0
  else if (event.key === 'End') activeIndex.value = buckets.value.length - 1
  else activeIndex.value = Math.max(0, Math.min(buckets.value.length - 1, (activeIndex.value ?? (event.key === 'ArrowLeft' ? buckets.value.length : -1)) + (event.key === 'ArrowRight' ? 1 : -1)))
}
</script>
