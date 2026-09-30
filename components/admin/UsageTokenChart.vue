<template>
  <div>
    <div
      v-if="entries.length"
      ref="chartElement"
      class="relative h-[22rem] w-full select-none overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-[26rem]"
      role="group"
      tabindex="0"
      aria-label="Token usage over time. Use the left and right arrow keys to inspect buckets."
      @keydown="onKeydown"
      @pointerleave="activeIndex = null"
    >
      <svg :viewBox="`0 0 ${width} ${height}`" class="size-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
        <g class="text-[var(--ui-text-muted)]">
          <template v-for="tick in tokenTicks" :key="`token-${tick.value}`">
            <line :x1="plot.left" :x2="plot.right" :y1="tick.y" :y2="tick.y" stroke="currentColor" stroke-opacity="0.16" stroke-dasharray="4 6" vector-effect="non-scaling-stroke" />
            <text :x="plot.left - 12" :y="tick.y + 4" text-anchor="end" fill="currentColor" font-size="13">{{ compact(tick.value) }}</text>
          </template>
          <template v-for="tick in overlayTicks" :key="`overlay-${tick.value}`">
            <text :x="plot.right + 12" :y="tick.y + 4" text-anchor="start" fill="currentColor" font-size="13">{{ overlayLabel(tick.value) }}</text>
          </template>
          <template v-for="label in xLabels" :key="label.index">
            <text :x="label.x" :y="height - 10" :text-anchor="label.anchor" fill="currentColor" font-size="13">{{ formatBucket(label.point.bucket_start, true) }}</text>
          </template>
        </g>

        <g v-for="(entry, index) in entries" :key="entry.key">
          <rect
            v-for="segment in entry.segments"
            :key="segment.key"
            :x="barX(index)"
            :y="segment.y"
            :width="barWidth"
            :height="segment.height"
            :fill="segment.color"
            :opacity="activeIndex == null || activeIndex === index ? 0.92 : 0.48"
          />
        </g>

        <path v-if="overlayPath" :d="overlayPath" fill="none" stroke="var(--ui-text-highlighted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        <g v-for="(entry, index) in entries" :key="`point-${entry.key}`">
          <circle :cx="centerX(index)" :cy="overlayY(entry.overlay)" r="4.5" fill="var(--ui-bg)" stroke="var(--ui-text-highlighted)" stroke-width="2.5" vector-effect="non-scaling-stroke" />
        </g>

        <line v-if="activeEntry" :x1="centerX(activeIndex!)" :x2="centerX(activeIndex!)" :y1="plot.top" :y2="plot.bottom" stroke="var(--ui-text-muted)" stroke-opacity="0.32" vector-effect="non-scaling-stroke" />
        <rect
          v-for="(_, index) in entries"
          :key="`hit-${index}`"
          :x="hitX(index)"
          :y="plot.top"
          :width="hitWidth(index)"
          :height="plot.height"
          fill="transparent"
          @pointerenter="activeIndex = index"
        />
      </svg>

      <div
        v-if="activeEntry"
        class="pointer-events-none absolute z-10 w-72 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-4 shadow-2xl"
        :style="tooltipStyle"
      >
        <p class="font-semibold text-[var(--ui-text-highlighted)]">{{ formatBucket(activeEntry.point.bucket_start) }}</p>
        <div class="mt-3 flex items-center justify-between gap-4 text-sm">
          <span class="font-semibold">Total</span>
          <span class="font-semibold tabular-nums">{{ compact(activeEntry.total) }}</span>
        </div>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ overlayName }}: {{ overlayValue(activeEntry.overlay) }}</p>

        <div class="mt-3 border-t border-[var(--ui-border)] pt-3">
          <div class="flex items-center justify-between gap-4 text-sm font-semibold"><span>Input composition</span><span class="tabular-nums">{{ compact(activeEntry.inputTotal) }}</span></div>
          <div v-for="item in activeEntry.input" :key="item.key" class="mt-2 flex items-center gap-2 text-sm">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
            <span class="min-w-0 flex-1">{{ item.label }}</span>
            <span class="tabular-nums">{{ compact(item.value) }}</span>
          </div>
        </div>

        <div class="mt-3 border-t border-[var(--ui-border)] pt-3">
          <div class="flex items-center justify-between gap-4 text-sm font-semibold"><span>Output composition</span><span class="tabular-nums">{{ compact(activeEntry.outputTotal) }}</span></div>
          <div v-for="item in activeEntry.output" :key="item.key" class="mt-2 flex items-center gap-2 text-sm">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
            <span class="min-w-0 flex-1">{{ item.label }}</span>
            <span class="tabular-nums">{{ compact(item.value) }}</span>
          </div>
          <div v-if="activeEntry.unclassified.value" class="mt-2 flex items-center gap-2 text-sm">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: activeEntry.unclassified.color }" />
            <span class="min-w-0 flex-1">{{ activeEntry.unclassified.label }}</span>
            <span class="tabular-nums">{{ compact(activeEntry.unclassified.value) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="flex h-80 items-center justify-center text-sm text-[var(--ui-text-muted)]">No canonical token trend is available.</div>
  </div>
</template>

<script setup lang="ts">
interface TokenPoint {
  bucket_start?: string
  token_breakdown?: {
    input?: { uncached_tokens?: number; cache_read_tokens?: number; cache_write_tokens?: number }
    output?: { non_reasoning_tokens?: number; reasoning_tokens?: number }
    unclassified_tokens?: number
  }
}

const props = withDefaults(defineProps<{
  points?: TokenPoint[]
  overlay?: Array<number | null | undefined>
  overlayType?: 'requests' | 'spend'
}>(), {
  points: () => [],
  overlay: () => [],
  overlayType: 'requests'
})

const width = 1000
const height = 360
const plot = { left: 66, right: 930, top: 20, bottom: 310, width: 864, height: 290 }
const activeIndex = ref<number | null>(null)
const chartElement = ref<HTMLElement | null>(null)
const colors = {
  uncached: '#65baf0',
  cacheRead: '#50c7bd',
  cacheWrite: '#e8ae45',
  output: '#6dcc91',
  reasoning: '#f49a45',
  unclassified: '#9aa6b2'
}
const definitions = [
  { key: 'uncached', label: 'Uncached input', color: colors.uncached, group: 'input' },
  { key: 'cacheRead', label: 'Cache read', color: colors.cacheRead, group: 'input' },
  { key: 'cacheWrite', label: 'Cache write', color: colors.cacheWrite, group: 'input' },
  { key: 'output', label: 'Regular output', color: colors.output, group: 'output' },
  { key: 'reasoning', label: 'Reasoning', color: colors.reasoning, group: 'output' },
  { key: 'unclassified', label: 'Unclassified', color: colors.unclassified, group: 'other' }
] as const

function pointValues(point: TokenPoint) {
  const breakdown = point.token_breakdown || {}
  return {
    uncached: Math.max(0, Number(breakdown.input?.uncached_tokens) || 0),
    cacheRead: Math.max(0, Number(breakdown.input?.cache_read_tokens) || 0),
    cacheWrite: Math.max(0, Number(breakdown.input?.cache_write_tokens) || 0),
    output: Math.max(0, Number(breakdown.output?.non_reasoning_tokens) || 0),
    reasoning: Math.max(0, Number(breakdown.output?.reasoning_tokens) || 0),
    unclassified: Math.max(0, Number(breakdown.unclassified_tokens) || 0)
  }
}

const sampled = computed(() => {
  const points = Array.isArray(props.points) ? props.points : []
  const stride = points.length > 36 ? Math.ceil(points.length / 36) : 1
  return points.map((point, index) => ({ point, index })).filter(({ index }) => index % stride === 0 || index === points.length - 1)
})
const tokenMaximum = computed(() => Math.max(1, ...sampled.value.map(({ point }) => Object.values(pointValues(point)).reduce((sum, value) => sum + value, 0))))
const overlayMaximum = computed(() => Math.max(1, ...sampled.value.map(({ index }) => Math.max(0, Number(props.overlay[index]) || 0))))
const barWidth = computed(() => Math.max(8, Math.min(54, plot.width / Math.max(1, sampled.value.length) * 0.58)))
const centerX = (index: number) => sampled.value.length === 1 ? plot.left + plot.width / 2 : plot.left + (index / (sampled.value.length - 1)) * plot.width
const barX = (index: number) => centerX(index) - barWidth.value / 2
const overlayY = (value: number) => plot.bottom - (value / overlayMaximum.value) * plot.height

const entries = computed(() => sampled.value.map(({ point, index: sourceIndex }, index) => {
  const values = pointValues(point)
  const total = Object.values(values).reduce((sum, value) => sum + value, 0)
  let cumulative = 0
  const segments = definitions.map(definition => {
    const value = values[definition.key]
    const segmentHeight = value / tokenMaximum.value * plot.height
    cumulative += segmentHeight
    return { ...definition, value, height: segmentHeight, y: plot.bottom - cumulative }
  }).filter(segment => segment.value > 0)
  const input = definitions.filter(item => item.group === 'input').map(item => ({ ...item, value: values[item.key] }))
  const output = definitions.filter(item => item.group === 'output').map(item => ({ ...item, value: values[item.key] }))
  return {
    key: point.bucket_start || sourceIndex,
    point,
    total,
    segments,
    input,
    output,
    inputTotal: input.reduce((sum, item) => sum + item.value, 0),
    outputTotal: output.reduce((sum, item) => sum + item.value, 0),
    unclassified: { ...definitions[5], value: values.unclassified },
    overlay: Math.max(0, Number(props.overlay[sourceIndex]) || 0),
    index
  }
}))
const overlayPath = computed(() => entries.value.map((entry, index) => `${index ? 'L' : 'M'} ${centerX(index).toFixed(2)} ${overlayY(entry.overlay).toFixed(2)}`).join(' '))
const activeEntry = computed(() => activeIndex.value == null ? null : entries.value[activeIndex.value] || null)
const overlayName = computed(() => props.overlayType === 'spend' ? 'Spend' : 'Requests')
const tokenTicks = computed(() => axisTicks(tokenMaximum.value).map(value => ({ value, y: plot.bottom - value / tokenMaximum.value * plot.height })))
const overlayTicks = computed(() => axisTicks(overlayMaximum.value).map(value => ({ value, y: plot.bottom - value / overlayMaximum.value * plot.height })))
const xLabels = computed(() => {
  const count = entries.value.length
  if (!count) return []
  const indexes = count <= 4 ? entries.value.map((_, index) => index) : [0, Math.round((count - 1) / 3), Math.round((count - 1) * 2 / 3), count - 1]
  return [...new Set(indexes)].map((index, position, list) => ({ index, point: entries.value[index]!.point, x: centerX(index), anchor: position === 0 ? 'start' : position === list.length - 1 ? 'end' : 'middle' }))
})
const tooltipStyle = computed(() => {
  if (activeIndex.value == null) return {}
  const xPercent = centerX(activeIndex.value) / width * 100
  const left = xPercent > 66 ? `calc(${xPercent}% - 18rem)` : `calc(${xPercent}% + 0.75rem)`
  return { left, top: '1rem' }
})

function axisTicks(maximum: number) {
  return [0, 0.25, 0.5, 0.75, 1].map(factor => maximum * factor)
}
function compact(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
}
function overlayLabel(value: number) {
  return props.overlayType === 'spend'
    ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
    : new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 0 }).format(value)
}
function overlayValue(value: number) {
  return props.overlayType === 'spend'
    ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value)
    : new Intl.NumberFormat().format(value)
}
function formatBucket(value?: string, short = false) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat(undefined, short
    ? { month: 'short', day: 'numeric', hour: 'numeric' }
    : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}
function hitX(index: number) {
  if (entries.value.length === 1) return plot.left
  const previous = index === 0 ? plot.left : (centerX(index - 1) + centerX(index)) / 2
  return previous
}
function hitWidth(index: number) {
  if (entries.value.length === 1) return plot.width
  const next = index === entries.value.length - 1 ? plot.right : (centerX(index) + centerX(index + 1)) / 2
  return next - hitX(index)
}
function onKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') activeIndex.value = 0
  else if (event.key === 'End') activeIndex.value = entries.value.length - 1
  else activeIndex.value = Math.max(0, Math.min(entries.value.length - 1, (activeIndex.value ?? (event.key === 'ArrowLeft' ? entries.value.length : -1)) + (event.key === 'ArrowRight' ? 1 : -1)))
}
</script>
