<template>
  <section class="space-y-5">
    <h2 class="text-xl font-semibold">Advanced usage insights</h2>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <div class="flex flex-wrap gap-3">
      <USelect v-model="groupBy" :items="['model', 'provider', 'user', 'client_key', 'credential', 'endpoint', 'home_ip']" class="w-44" />
      <USelect v-model="metric" :items="['request_count', 'total_tokens', 'total_amount', 'failed_count', 'avg_latency_ms', 'p95_latency_ms']" class="w-48" />
      <UButton :loading="loading" @click="refresh">Load insights</UButton>
      <UButton color="neutral" variant="outline" :loading="exporting" @click="exportRecords('csv')">Export CSV</UButton>
      <UButton color="neutral" variant="outline" :loading="exporting" @click="exportRecords('jsonl')">Export JSONL</UButton>
      <span class="text-xs text-[var(--ui-text-muted)]">Exports use applied record filters and sort (up to 10,000 rows). Overview and insights support only date, provider, model, endpoint, and Home IP filters; without dates they default to 24 hours. Realtime uses the last 15 minutes.</span>
    </div>
    <div class="grid gap-4 xl:grid-cols-2">
      <UCard>
        <template #header><h3 class="font-semibold">Ranking by {{ groupBy }}</h3></template>
        <div v-for="item in aggregates?.items || []" :key="JSON.stringify(item)" class="flex justify-between gap-3 border-b border-[var(--ui-border)] py-2 text-sm">
          <span class="truncate">{{ item.label || item.name || item.id || item.key || 'Unknown' }}</span>
          <span class="font-mono">{{ item[metric] ?? item.value ?? 0 }}</span>
        </div>
        <p v-if="!aggregates?.items?.length" class="text-sm text-[var(--ui-text-muted)]">No ranking data.</p>
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold">Realtime snapshot (last 15 minutes)</h3></template>
        <div v-if="realtime" class="space-y-4 text-sm">
          <p class="text-xs text-[var(--ui-text-muted)]">Grouped by {{ realtime.group_by }} · Updated {{ new Date(realtime.updated_at).toLocaleString() }}</p>
          <div v-if="latestVelocity" class="grid grid-cols-3 gap-2">
            <div><p class="text-[var(--ui-text-muted)]">Requests/min</p><p class="font-semibold">{{ latestVelocity.rpm }}</p></div>
            <div><p class="text-[var(--ui-text-muted)]">Tokens/min</p><p class="font-semibold">{{ latestVelocity.tpm }}</p></div>
            <div><p class="text-[var(--ui-text-muted)]">Error rate</p><p class="font-semibold">{{ (latestVelocity.error_rate * 100).toFixed(1) }}%</p></div>
          </div>
          <p v-else class="text-[var(--ui-text-muted)]">No request velocity yet.</p>
          <div v-if="realtime.current_usage?.length">
            <p class="font-medium">Current usage</p>
            <div v-for="item in realtime.current_usage" :key="item.id" class="flex justify-between gap-2 border-b border-[var(--ui-border)] py-1">
              <span class="truncate">{{ item.label || item.id }}</span><span>{{ item.request_count }} requests</span>
            </div>
          </div>
          <div v-if="realtime.latency_distribution?.length">
            <p class="font-medium">Latency distribution</p>
            <div v-for="bucket in realtime.latency_distribution" :key="bucket.bucket" class="flex justify-between gap-2 py-1">
              <span>{{ bucket.bucket }}</span><span>{{ bucket.request_count }} requests</span>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-[var(--ui-text-muted)]">Load insights to see realtime usage.</p>
      </UCard>
      <UCard v-for="health in healthSections" :key="health.label">
        <template #header><h3 class="font-semibold">{{ health.label }} health</h3></template>
        <div v-for="item in health.items" :key="item.id" class="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] py-2 text-sm">
          <span>{{ item.label || item.id }}</span><UBadge :color="item.status === 'healthy' ? 'success' : 'warning'" variant="subtle">{{ item.status }}</UBadge>
        </div>
        <p v-if="!health.items.length" class="text-sm text-[var(--ui-text-muted)]">No health data available.</p>
      </UCard>
    </div>
    <UCard>
      <template #header><h3 class="font-semibold">Session tree</h3></template>
      <form class="flex flex-wrap gap-2" @submit.prevent="loadTree"><UInput v-model="sessionID" placeholder="Session or request ID" class="min-w-64 flex-1" /><UButton type="submit" :loading="loadingTree">Find session</UButton></form>
      <UAlert v-if="treeError" class="mt-3" color="error" variant="subtle" :description="treeError" />
      <pre v-if="tree" class="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{{ JSON.stringify(tree, null, 2) }}</pre>
    </UCard>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ commonQuery: string, recordQuery: string }>()
const { fetchAPI } = useApi()
const groupBy = ref('model')
const metric = ref('request_count')
const loading = ref(false)
const exporting = ref(false)
const loadingTree = ref(false)
const error = ref('')
const treeError = ref('')
const sessionID = ref('')
const aggregates = ref<any>(null)
const realtime = ref<any>(null)
const providerHealth = ref<any>(null)
const credentialHealth = ref<any>(null)
const tree = ref<any>(null)
const latestVelocity = computed(() => realtime.value?.velocity?.at(-1))
const realtimeGroupBy = computed(() => ['model', 'provider', 'client_key', 'credential'].includes(groupBy.value) ? groupBy.value : 'model')
const healthSections = computed(() => [
  { label: 'Provider', items: providerHealth.value?.items || [] },
  { label: 'Credential', items: credentialHealth.value?.items || [] }
])
async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const realtimeFilters = new URLSearchParams(props.commonQuery)
    realtimeFilters.delete('from')
    realtimeFilters.delete('to')
    const [ranking, snapshot, providers, credentials] = await Promise.all([
      fetchAPI(`/usage/aggregates?${props.commonQuery}`, { query: { group_by: groupBy.value, metric: metric.value, limit: 20 } }),
      fetchAPI(`/usage/realtime?${realtimeFilters.toString()}`, { query: { window_seconds: 900, bucket_seconds: 60, group_by: realtimeGroupBy.value } }),
      fetchAPI(`/usage/health/providers?${props.commonQuery}`), fetchAPI(`/usage/health/credentials?${props.commonQuery}`)
    ])
    aggregates.value = ranking
    realtime.value = snapshot
    providerHealth.value = providers
    credentialHealth.value = credentials
  } catch (cause: any) { error.value = cause?.message || 'Unable to load usage insights.' }
  finally { loading.value = false }
}
async function loadTree() {
  if (!sessionID.value.trim()) return
  loadingTree.value = true
  treeError.value = ''
  try { tree.value = await fetchAPI('/usage/session-tree', { query: { id: sessionID.value.trim() } }) }
  catch (cause: any) { treeError.value = cause?.message || 'Unable to load session tree.' }
  finally { loadingTree.value = false }
}
async function exportRecords(format: 'csv' | 'jsonl') {
  exporting.value = true
  error.value = ''
  try {
    const blob = await fetchAPI<Blob>(`/usage/export?${props.recordQuery}`, { query: { format }, responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `usage.${format}`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (cause: any) { error.value = cause?.message || 'Unable to export usage.' }
  finally { exporting.value = false }
}
</script>
