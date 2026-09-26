<template>
  <div class="space-y-3">
    <div v-if="bars.length" class="relative h-48" role="img" aria-label="Token usage over time">
      <div class="absolute inset-0 flex items-end gap-1">
        <div v-for="bar in bars" :key="bar.key" class="group relative flex h-full min-w-0 flex-1 flex-col justify-end overflow-hidden rounded-sm bg-[var(--ui-bg-muted)]" :title="bar.title">
          <span v-for="segment in bar.segments" :key="segment.key" class="block w-full transition-opacity group-hover:opacity-80" :class="segment.color" :style="{ height: `${segment.height}%` }" />
        </div>
      </div>
      <svg v-if="overlayPath" viewBox="0 0 160 48" preserveAspectRatio="none" class="pointer-events-none absolute inset-0 size-full text-amber-500" aria-hidden="true"><path :d="overlayPath" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" /></svg>
    </div>
    <div v-else class="flex h-48 items-center justify-center text-sm text-[var(--ui-text-muted)]">No canonical token trend is available.</div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ points?: Array<Record<string, any>>; overlay?: Array<number | null | undefined> }>(), { points: () => [], overlay: () => [] })

const series = [
  { key: 'uncached', color: 'bg-blue-500' },
  { key: 'cacheRead', color: 'bg-cyan-500' },
  { key: 'cacheWrite', color: 'bg-teal-500' },
  { key: 'output', color: 'bg-violet-500' },
  { key: 'reasoning', color: 'bg-fuchsia-500' },
  { key: 'unclassified', color: 'bg-slate-400' }
]

function values(point: Record<string, any>) {
  const breakdown = point.token_breakdown || {}
  return {
    uncached: Number(breakdown.input?.uncached_tokens) || 0,
    cacheRead: Number(breakdown.input?.cache_read_tokens) || 0,
    cacheWrite: Number(breakdown.input?.cache_write_tokens) || 0,
    output: Number(breakdown.output?.non_reasoning_tokens) || 0,
    reasoning: Number(breakdown.output?.reasoning_tokens) || 0,
    unclassified: Number(breakdown.unclassified_tokens) || 0
  }
}

const sampled = computed(() => {
  if (props.points.length <= 48) return props.points
  const stride = Math.ceil(props.points.length / 48)
  return props.points.filter((_, index) => index % stride === 0 || index === props.points.length - 1)
})
const maximum = computed(() => Math.max(1, ...sampled.value.map(point => Object.values(values(point)).reduce((sum, value) => sum + value, 0))))
const bars = computed(() => sampled.value.map((point, index) => {
  const bucket = values(point)
  const total = Object.values(bucket).reduce((sum, value) => sum + value, 0)
  return {
    key: point.bucket_start || index,
    title: `${point.bucket_start || 'Bucket'} · ${new Intl.NumberFormat().format(total)} tokens`,
    segments: series.map(item => ({
      ...item,
      height: total ? (bucket[item.key as keyof typeof bucket] / maximum.value) * 100 : 0
    })).filter(item => item.height > 0)
  }
}))
const sampledOverlay = computed(() => {
  if (!props.overlay.length) return []
  if (props.overlay.length <= 48) return props.overlay.map(value => Number(value) || 0)
  const stride = Math.ceil(props.overlay.length / 48)
  return props.overlay.filter((_, index) => index % stride === 0 || index === props.overlay.length - 1).map(value => Number(value) || 0)
})
const overlayPath = computed(() => {
  const values = sampledOverlay.value
  if (!values.length) return ''
  const maximum = Math.max(1, ...values)
  return values.map((value, index) => {
    const x = values.length === 1 ? 80 : (index / (values.length - 1)) * 160
    const y = 43 - (value / maximum) * 38
    return `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
})
</script>
