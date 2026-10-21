<template>
  <section class="space-y-5">
    <h2 class="text-xl font-semibold">Advanced usage insights</h2>
    <UAlert v-if="capabilityError" color="warning" variant="subtle" title="Capabilities unavailable" description="Optional usage endpoints will be checked when requested." />
    <UAlert v-if="unavailableFeatures.length" color="warning" variant="subtle" title="Some usage features are unavailable" :description="unavailableFeatures.join(', ')" />
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <div class="flex flex-wrap gap-3">
      <USelect v-model="groupBy" :items="['model', 'provider', 'user', 'client_key', 'credential', 'endpoint', 'home_ip']" class="w-44" />
      <USelect v-model="metric" :items="['request_count', 'total_tokens', 'total_amount', 'failed_count', 'avg_latency_ms', 'p95_latency_ms']" class="w-48" />
      <AppButton :loading="loading" :disabled="loading || !canLoadInsights" @click="refresh">Load insights</AppButton>
      <span class="text-xs text-[var(--ui-text-muted)]">Overview and insights support date, provider, model, credential type, endpoint, and Home IP filters; without dates aggregates default to 24 hours. Realtime uses the last 15 minutes.</span>
    </div>
    <div class="grid gap-4 xl:grid-cols-2">
      <AppCard v-if="available('usage_aggregates')">
        <template #header><h3 class="font-semibold">Ranking by {{ groupBy }}</h3></template>
        <div v-for="item in aggregates?.items || []" :key="JSON.stringify(item)" class="flex justify-between gap-3 border-b border-[var(--ui-border)] py-2 text-sm">
          <span class="truncate">{{ item.label || item.name || item.id || item.key || 'Unknown' }}</span>
          <span class="font-mono">{{ item[metric] ?? item.value ?? 0 }}</span>
        </div>
        <p v-if="!aggregates?.items?.length" class="text-sm text-[var(--ui-text-muted)]">No ranking data.</p>
      </AppCard>
      <AppCard v-if="available('usage_realtime')">
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
      </AppCard>
      <AppCard v-for="health in healthSections" :key="health.label">
        <template #header><h3 class="font-semibold">{{ health.label }} health</h3></template>
        <div v-for="item in health.items" :key="item.id" class="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] py-2 text-sm">
          <span>{{ item.label || item.id }}</span><UBadge :color="item.status === 'healthy' ? 'success' : 'warning'" variant="subtle">{{ item.status }}</UBadge>
        </div>
        <p v-if="!health.items.length" class="text-sm text-[var(--ui-text-muted)]">No health data available.</p>
      </AppCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useWorkspaceState } from '~/composables/useWorkspaceState'
const props = defineProps<{ commonQuery: string }>()
const { fetchAPI, token } = useApi()
const { supports, error: capabilityError, refreshCapabilities } = useCapabilities()
const unavailable = ref<string[]>([])
const featureLabels: Record<string, string> = {
  usage_aggregates: 'Rankings', usage_realtime: 'Realtime', usage_provider_health: 'Provider health',
  usage_credential_health: 'Credential health'
}
const available = (feature: string) => supports(feature) && !unavailable.value.includes(feature)
const unavailableFeatures = computed(() => Object.entries(featureLabels).filter(([feature]) => !available(feature)).map(([, label]) => label))
const canLoadInsights = computed(() => ['usage_aggregates', 'usage_realtime', 'usage_provider_health', 'usage_credential_health'].some(available))
let controller = new AbortController()
let generation = 0
let disposed = false
onScopeDispose(() => { disposed = true; generation++; controller.abort() })
onMounted(() => { void refreshCapabilities().catch(() => {}) })
watch(token, () => { unavailable.value = []; invalidate(); void refreshCapabilities().catch(() => {}) })
function endpointUnavailable(cause: any) { return [404, 405, 501].includes(cause?.statusCode) }
async function optionalRequest<T>(feature: string, path: string, query?: Record<string, string | number>) {
  if (!available(feature)) return null
  const current = generation
  try { return await fetchAPI<T>(path, { query, signal: controller.signal }) }
  catch (cause: any) {
    if (disposed || current !== generation) return null
    if (endpointUnavailable(cause)) { unavailable.value = [...new Set([...unavailable.value, feature])]; return null }
    throw cause
  }
}
const groupBy = ref('model')
const metric = ref('request_count')
const loading = useWorkspaceState('admin:usage-insights:loading', () => (false))
const error = useWorkspaceState('admin:usage-insights:error', () => (''))
const aggregates = useWorkspaceState<any>('admin:usage-insights:aggregates', () => (null))
const realtime = useWorkspaceState<any>('admin:usage-insights:realtime', () => (null))
const providerHealth = useWorkspaceState<any>('admin:usage-insights:providerHealth', () => (null))
const credentialHealth = useWorkspaceState<any>('admin:usage-insights:credentialHealth', () => (null))
const latestVelocity = computed(() => realtime.value?.velocity?.at(-1))
const realtimeGroupBy = computed(() => ['model', 'provider', 'client_key', 'credential'].includes(groupBy.value) ? groupBy.value : 'model')
const healthSections = computed(() => [
  { feature: 'usage_provider_health', label: 'Provider', items: providerHealth.value?.items || [] },
  { feature: 'usage_credential_health', label: 'Credential', items: credentialHealth.value?.items || [] }
].filter(section => available(section.feature)))
function invalidate() {
  generation++
  controller.abort()
  controller = new AbortController()
  loading.value = false
  error.value = ''
  aggregates.value = null
  realtime.value = null
  providerHealth.value = null
  credentialHealth.value = null
}
watch([() => props.commonQuery, groupBy, metric], invalidate)
async function refresh() {
  if (loading.value || !canLoadInsights.value) return
  const current = ++generation
  loading.value = true
  error.value = ''
  try {
    const realtimeFilters = new URLSearchParams(props.commonQuery)
    realtimeFilters.delete('from')
    realtimeFilters.delete('to')
    const [ranking, snapshot, providers, credentials] = await Promise.all([
      optionalRequest('usage_aggregates', `/usage/aggregates?${props.commonQuery}`, { group_by: groupBy.value, metric: metric.value, limit: 20 }),
      optionalRequest('usage_realtime', `/usage/realtime?${realtimeFilters.toString()}`, { window_seconds: 900, bucket_seconds: 60, group_by: realtimeGroupBy.value }),
      optionalRequest('usage_provider_health', `/usage/health/providers?${props.commonQuery}`), optionalRequest('usage_credential_health', `/usage/health/credentials?${props.commonQuery}`)
    ])
    if (disposed || current !== generation) return
    aggregates.value = ranking
    realtime.value = snapshot
    providerHealth.value = providers
    credentialHealth.value = credentials
  } catch (cause: any) { if (!disposed && current === generation) error.value = cause?.message || 'Unable to load usage insights.' }
  finally { if (!disposed && current === generation) loading.value = false }
}
</script>
