<template>
  <div class="relative h-12 w-full overflow-hidden" :aria-label="label" role="img">
    <svg viewBox="0 0 160 48" preserveAspectRatio="none" class="size-full" aria-hidden="true">
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.22" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path v-if="areaPath" :d="areaPath" :fill="`url(#${gradientId})`" />
      <path v-if="linePath" :d="linePath" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      <line v-else x1="0" y1="40" x2="160" y2="40" stroke="currentColor" stroke-opacity="0.2" stroke-width="1" />
    </svg>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  values?: Array<number | null | undefined>
  label?: string
}>(), {
  values: () => [],
  label: 'Trend'
})

const gradientId = useId().replace(/:/g, '')
const normalized = computed(() => props.values.map(value => Number(value) || 0))
const points = computed(() => {
  const values = normalized.value
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  const width = 160
  const top = 5
  const bottom = 40
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: bottom - ((value - min) / span) * (bottom - top)
  }))
})
const linePath = computed(() => points.value.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '))
const areaPath = computed(() => linePath.value ? `${linePath.value} L 160 48 L 0 48 Z` : '')
</script>
