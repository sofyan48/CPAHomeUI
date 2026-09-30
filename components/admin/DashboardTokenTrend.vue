<template>
  <AppCard class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40" aria-labelledby="token-trend-title">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="token-trend-title" class="font-semibold text-[var(--ui-text-highlighted)]">Overall consumption trend</h2>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ points.length }} intervals · {{ number.format(points.reduce((sum, point) => sum + point.tokens, 0)) }} tokens total</p>
        </div>
        <span v-if="rangeLabel" class="text-xs text-[var(--ui-text-muted)]">{{ rangeLabel }}</span>
      </div>
    </template>

    <div v-if="points.length">
      <div
        class="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
        role="group"
        tabindex="0"
        aria-label="Token trend chart. Use left and right arrow keys to inspect time buckets."
        @keydown="onKeydown"
        @pointermove="onPointerMove"
        @pointerleave="activeIndex = null"
      >
        <svg viewBox="0 0 720 220" class="h-48 w-full overflow-visible sm:h-56" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
              <stop offset="100%" stop-color="currentColor" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          <path d="M 24 184 H 696" fill="none" stroke="currentColor" stroke-opacity="0.22" stroke-width="1" vector-effect="non-scaling-stroke" />
          <path v-if="areaPath" :d="areaPath" :fill="`url(#${gradientId})`" />
          <path v-if="linePath" :d="linePath" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          <circle v-if="points.length === 1" :cx="coordinates[0]!.x" :cy="coordinates[0]!.y" r="4" fill="currentColor" vector-effect="non-scaling-stroke" />
          <circle v-if="selectedPoint" :cx="selectedPoint.x" :cy="selectedPoint.y" r="5" fill="currentColor" stroke="var(--ui-bg)" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
      <div class="mt-2 flex justify-between gap-4 text-xs text-[var(--ui-text-muted)]">
        <span>{{ formatDate(points[0]?.bucket_start) }}</span>
        <span v-if="points.length > 1">{{ formatDate(points[points.length - 1]?.bucket_end) }}</span>
      </div>
      <p class="mt-3 min-h-10 text-sm text-[var(--ui-text-muted)]" aria-live="polite" aria-atomic="true">
        <template v-if="selectedPoint">
          <span class="font-medium text-[var(--ui-text-highlighted)]">{{ formatDate(selectedPoint.bucket_start) }}–{{ formatDate(selectedPoint.bucket_end) }}</span>
          · {{ number.format(selectedPoint.tokens) }} tokens · {{ number.format(selectedPoint.requests) }} requests
        </template>
        <template v-else>Hover or use the arrow keys to inspect a bucket.</template>
      </p>
    </div>
    <p v-else class="flex min-h-48 items-center justify-center text-center text-sm text-[var(--ui-text-muted)]">No token trend is available for this range.</p>
  </AppCard>
</template>

<script setup lang="ts">
interface TrendEntry {
  bucket_start?: string
  bucket_end?: string
  token_breakdown?: { total_tokens?: number | null } | null
  request_count?: number | null
}
interface Range { from?: string; to?: string; timezone?: string; interval?: string }

const props = withDefaults(defineProps<{ trend?: TrendEntry[] | null; range?: Range | null }>(), { trend: () => [] })
const gradientId = `token-trend-${useId().replace(/:/g, '')}`
const number = new Intl.NumberFormat()
const activeIndex = ref<number | null>(null)
const safeCount = (value: number | null | undefined) => Number.isFinite(value) ? Math.max(0, Number(value)) : 0
const points = computed(() => (Array.isArray(props.trend) ? props.trend : []).filter(point => point && point.bucket_start).map(point => ({
  bucket_start: point.bucket_start!,
  bucket_end: point.bucket_end,
  tokens: safeCount(point.token_breakdown?.total_tokens),
  requests: safeCount(point.request_count)
})).sort((a, b) => Date.parse(a.bucket_start) - Date.parse(b.bucket_start)))
const coordinates = computed(() => {
  const maximum = Math.max(1, ...points.value.map(point => point.tokens))
  return points.value.map((point, index) => ({
    x: points.value.length === 1 ? 360 : 24 + (index / (points.value.length - 1)) * 672,
    y: 184 - (point.tokens / maximum) * 160
  }))
})

// Monotone cubic Hermite interpolation prevents the curve from overshooting bucket values.
const linePath = computed(() => {
  const coords = coordinates.value
  if (!coords.length) return ''
  if (coords.length === 1) return ''
  const slopes = coords.slice(1).map((point, index) => (point.y - coords[index]!.y) / (point.x - coords[index]!.x))
  const tangents = coords.map((_, index) => {
    if (index === 0) return slopes[0]!
    if (index === coords.length - 1) return slopes[index - 1]!
    const left = slopes[index - 1]!
    const right = slopes[index]!
    return left * right <= 0 ? 0 : 2 * left * right / (left + right)
  })
  let path = `M ${coords[0]!.x} ${coords[0]!.y}`
  for (let index = 1; index < coords.length; index++) {
    const previous = coords[index - 1]!
    const current = coords[index]!
    const third = (current.x - previous.x) / 3
    path += ` C ${previous.x + third} ${previous.y + tangents[index - 1]! * third}, ${current.x - third} ${current.y - tangents[index]! * third}, ${current.x} ${current.y}`
  }
  return path
})
const areaPath = computed(() => linePath.value ? `${linePath.value} L ${coordinates.value.at(-1)!.x} 184 L ${coordinates.value[0]!.x} 184 Z` : '')
const selectedPoint = computed(() => {
  const index = activeIndex.value
  if (index === null || index < 0 || index >= points.value.length) return null
  return { ...points.value[index]!, ...coordinates.value[index]! }
})
const rangeLabel = computed(() => props.range?.from && props.range?.to ? `${formatDate(props.range.from)}–${formatDate(props.range.to)}` : '')

function formatDate(value?: string) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: props.range?.timezone || 'UTC' }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(date)
  }
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
  event.preventDefault()
  if (event.key === 'Home') activeIndex.value = 0
  else if (event.key === 'End') activeIndex.value = points.value.length - 1
  else activeIndex.value = Math.max(0, Math.min(points.value.length - 1, (activeIndex.value ?? (event.key === 'ArrowLeft' ? points.value.length : -1)) + (event.key === 'ArrowRight' ? 1 : -1)))
}
function onPointerMove(event: PointerEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (!bounds.width) return
  const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
  activeIndex.value = Math.round(fraction * (points.value.length - 1))
}
</script>
