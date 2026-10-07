<template>
  <AppCard class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40" aria-labelledby="token-trend-title">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div class="flex items-center gap-2.5">
          <UIcon name="i-tabler-gauge" class="size-5 text-[var(--ui-text-muted)]" />
          <h2 id="token-trend-title" class="text-lg font-semibold text-[var(--ui-text-highlighted)]">Overall consumption trend</h2>
        </div>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ points.length }} intervals · {{ compact(totalTokens) }} tokens total</p>
      </div>
    </template>

    <div v-if="points.length">
      <div
        class="relative h-56 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-64"
        role="group"
        tabindex="0"
        aria-label="Token consumption trend. Use left and right arrow keys to inspect intervals."
        @keydown="onKeydown"
        @pointermove="onPointerMove"
        @pointerleave="activeIndex = null"
      >
        <svg viewBox="0 0 720 240" class="size-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#50c7bd" stop-opacity="0.2" />
              <stop offset="100%" stop-color="#50c7bd" stop-opacity="0.04" />
            </linearGradient>
          </defs>

          <line v-for="y in gridLines" :key="y" x1="12" x2="708" :y1="y" :y2="y" stroke="var(--ui-border)" stroke-opacity="0.65" stroke-dasharray="3 5" vector-effect="non-scaling-stroke" />
          <path v-if="areaPath" :d="areaPath" :fill="`url(#${gradientId})`" />
          <path v-if="linePath" :d="linePath" fill="none" stroke="#50c7bd" stroke-width="2.75" stroke-linecap="round" vector-effect="non-scaling-stroke" />

          <line v-if="selectedPoint" :x1="selectedPoint.x" :x2="selectedPoint.x" y1="18" y2="202" stroke="var(--ui-border)" stroke-opacity="0.8" vector-effect="non-scaling-stroke" />
          <circle v-if="selectedPoint" :cx="selectedPoint.x" :cy="selectedPoint.y" r="5" fill="#50c7bd" stroke="var(--ui-bg)" stroke-width="2.5" vector-effect="non-scaling-stroke" />

        </svg>

        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-7 text-xs text-[var(--ui-text-muted)]" aria-hidden="true">
          <span
            v-for="label in dateLabels"
            :key="label.index"
            class="absolute whitespace-nowrap"
            :style="{ left: `${label.x / 720 * 100}%`, transform: label.anchor === 'end' ? 'translateX(-100%)' : label.anchor === 'middle' ? 'translateX(-50%)' : undefined }"
          >{{ formatDate(label.value) }}</span>
        </div>

        <div
          v-if="selectedPoint"
          class="pointer-events-none absolute z-10 w-56 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-3 shadow-2xl"
          :style="tooltipStyle"
        >
          <p class="font-semibold text-[var(--ui-text-highlighted)]">{{ formatDate(selectedPoint.bucket_start) }}</p>
          <dl class="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
            <dt class="text-[var(--ui-text-muted)]">Token consumption</dt>
            <dd class="text-right font-semibold tabular-nums">{{ compact(selectedPoint.tokens) }} tokens</dd>
            <dt class="text-[var(--ui-text-muted)]">Requests</dt>
            <dd class="text-right font-semibold tabular-nums">{{ number.format(selectedPoint.requests) }}</dd>
          </dl>
        </div>
      </div>
    </div>

    <p v-else class="flex min-h-56 items-center justify-center text-center text-sm text-[var(--ui-text-muted)]">No token trend is available for this range.</p>
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
const chartBounds = { left: 12, right: 708, top: 18, bottom: 202, width: 696, height: 184 }
const gridLines = [18, 79.33, 140.67, 202]
const safeCount = (value: number | null | undefined) => Number.isFinite(value) ? Math.max(0, Number(value)) : 0
const points = computed(() => (Array.isArray(props.trend) ? props.trend : [])
  .filter(point => point && point.bucket_start)
  .map(point => ({
    bucket_start: point.bucket_start!,
    bucket_end: point.bucket_end,
    tokens: safeCount(point.token_breakdown?.total_tokens),
    requests: safeCount(point.request_count)
  }))
  .sort((a, b) => Date.parse(a.bucket_start) - Date.parse(b.bucket_start)))
const totalTokens = computed(() => points.value.reduce((sum, point) => sum + point.tokens, 0))
const coordinates = computed(() => {
  const maximum = Math.max(1, ...points.value.map(point => point.tokens))
  return points.value.map((point, index) => ({
    x: points.value.length === 1 ? chartBounds.left + chartBounds.width / 2 : chartBounds.left + (index / (points.value.length - 1)) * chartBounds.width,
    y: chartBounds.bottom - (point.tokens / maximum) * chartBounds.height
  }))
})

// Monotone cubic Hermite interpolation keeps the curve inside observed values.
const linePath = computed(() => {
  const coords = coordinates.value
  if (!coords.length) return ''
  if (coords.length === 1) return `M ${coords[0]!.x} ${coords[0]!.y}`
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
const areaPath = computed(() => linePath.value ? `${linePath.value} L ${coordinates.value.at(-1)!.x} ${chartBounds.bottom} L ${coordinates.value[0]!.x} ${chartBounds.bottom} Z` : '')
const selectedPoint = computed(() => {
  const index = activeIndex.value
  if (index === null || index < 0 || index >= points.value.length) return null
  return { ...points.value[index]!, ...coordinates.value[index]!, index }
})
const dateLabels = computed(() => {
  if (!points.value.length) return []
  const indexes = points.value.length < 3 ? points.value.map((_, index) => index) : [0, Math.floor((points.value.length - 1) / 2), points.value.length - 1]
  return [...new Set(indexes)].map((index, position, items) => ({
    index,
    value: points.value[index]!.bucket_start,
    x: coordinates.value[index]!.x,
    anchor: position === 0 ? 'start' : position === items.length - 1 ? 'end' : 'middle'
  }))
})
const tooltipStyle = computed(() => {
  if (!selectedPoint.value) return {}
  const percentage = selectedPoint.value.x / 720 * 100
  return {
    left: percentage > 68 ? `calc(${percentage}% - 15rem)` : `calc(${percentage}% + 0.75rem)`,
    top: '2.5rem'
  }
})

function compact(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
}
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
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
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
