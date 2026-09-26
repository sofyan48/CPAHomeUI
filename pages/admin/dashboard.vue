<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div class="mb-2 flex items-center gap-2">
          <UBadge color="primary" variant="subtle">Control plane</UBadge>
          <span class="text-xs text-[var(--ui-text-muted)]">{{ lastUpdatedLabel }}</span>
        </div>
        <h1 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">Cluster overview</h1>
        <p class="mt-2 max-w-2xl text-sm text-[var(--ui-text-muted)]">
          Operational health, connected CPA nodes, and recent request activity from your Home runtime.
        </p>
      </div>
      <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="loading" @click="refreshDashboard">
        Refresh
      </UButton>
    </section>

    <UAlert
      v-if="loadError"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-circle"
      title="Dashboard data is incomplete"
      :description="loadError"
    />

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="card in summaryCards" :key="card.label" class="overflow-hidden">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-[var(--ui-text-muted)]">{{ card.label }}</p>
            <p class="mt-2 text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">{{ card.value }}</p>
            <p class="mt-2 text-xs text-[var(--ui-text-dimmed)]">{{ card.detail }}</p>
          </div>
          <div class="flex size-11 shrink-0 items-center justify-center rounded-2xl" :class="card.iconClass">
            <UIcon :name="card.icon" class="size-6" />
          </div>
        </div>
      </UCard>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-semibold text-[var(--ui-text-highlighted)]">Recent activity</h2>
              <p class="text-xs text-[var(--ui-text-muted)]">24-hour request and token summary</p>
            </div>
            <UBadge :color="usageAvailable ? 'success' : 'neutral'" variant="subtle">
              {{ usageAvailable ? 'Live data' : 'Unavailable' }}
            </UBadge>
          </div>
        </template>

        <div v-if="usageAvailable" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="metric in usageMetrics" :key="metric.label" class="rounded-xl bg-[var(--ui-bg-muted)] p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-[var(--ui-text-dimmed)]">{{ metric.label }}</p>
            <p class="mt-2 text-xl font-semibold text-[var(--ui-text-highlighted)]">{{ metric.value }}</p>
          </div>
        </div>
        <div v-else class="flex min-h-40 flex-col items-center justify-center text-center">
          <UIcon name="i-heroicons-chart-bar" class="size-8 text-[var(--ui-text-dimmed)]" />
          <p class="mt-3 text-sm font-medium">Usage overview is not advertised by this server.</p>
          <p class="mt-1 text-xs text-[var(--ui-text-muted)]">The rest of the dashboard remains available.</p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-[var(--ui-text-highlighted)]">Release status</h2>
        </template>
        <div class="space-y-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-[var(--ui-text-dimmed)]">Running</p>
            <p class="mt-1 font-mono text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ currentVersion }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-[var(--ui-text-dimmed)]">Latest release</p>
            <p class="mt-1 font-mono text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ latestVersion || 'Not available' }}</p>
          </div>
          <div class="flex items-center gap-2 rounded-xl bg-[var(--ui-bg-muted)] p-3">
            <UIcon :name="releaseIcon" class="size-5" :class="releaseCurrent ? 'text-emerald-500' : 'text-amber-500'" />
            <span class="text-sm">{{ releaseMessage }}</span>
          </div>
        </div>
      </UCard>
    </section>

    <section v-if="issues.length" class="grid gap-3 lg:grid-cols-2">
      <UAlert v-for="issue in issues" :key="issue.title" :color="issue.color" variant="subtle" :icon="issue.icon" :title="issue.title" :description="issue.description">
        <template #actions><UButton :to="issue.to" size="sm" color="neutral" variant="outline">Review</UButton></template>
      </UAlert>
    </section>

    <section class="grid gap-6 lg:grid-cols-3">
      <UCard>
        <template #header><div class="flex items-center justify-between"><div><h2 class="font-semibold">Providers</h2><p class="text-xs text-[var(--ui-text-muted)]">Credential inventory by provider</p></div><UButton to="/admin/providers" size="sm" color="neutral" variant="ghost">Manage</UButton></div></template>
        <div class="space-y-3"><div v-for="provider in providerSummary.slice(0, 6)" :key="provider.name" class="flex items-center justify-between gap-3 text-sm"><span class="truncate">{{ provider.name }}</span><span><strong>{{ provider.active }}</strong> active · {{ provider.total }} total</span></div><p v-if="!providerSummary.length" class="py-6 text-center text-sm text-[var(--ui-text-muted)]">No credentials configured.</p></div>
      </UCard>
      <UCard>
        <template #header><div class="flex items-center justify-between"><div><h2 class="font-semibold">Credential status</h2><p class="text-xs text-[var(--ui-text-muted)]">Database-backed execution accounts</p></div><UButton to="/admin/credentials" size="sm" color="neutral" variant="ghost">Inspect</UButton></div></template>
        <div class="grid grid-cols-2 gap-3"><div v-for="item in credentialMetrics" :key="item.label" class="rounded-xl bg-[var(--ui-bg-muted)] p-3"><p class="text-xs text-[var(--ui-text-muted)]">{{ item.label }}</p><p class="mt-1 text-xl font-semibold">{{ item.value }}</p></div></div>
      </UCard>
      <UCard>
        <template #header><div class="flex items-center justify-between"><div><h2 class="font-semibold">Client access keys</h2><p class="text-xs text-[var(--ui-text-muted)]">Key values are never shown here</p></div><UButton to="/admin/access-keys" size="sm" color="neutral" variant="ghost">Manage</UButton></div></template>
        <p class="text-3xl font-bold">{{ formatNumber(apiKeyItems.length) }}</p><p class="mt-2 text-sm text-[var(--ui-text-muted)]">{{ formatNumber(boundKeyCount) }} linked to users · {{ formatNumber(scopedKeyCount) }} scoped to channel or model groups</p>
      </UCard>
    </section>

    <section v-if="usageAvailable" class="grid gap-6 lg:grid-cols-2">
      <UCard><template #header><div class="flex items-center justify-between"><h2 class="font-semibold">Top models</h2><UButton to="/admin/usage" size="sm" color="neutral" variant="ghost">Usage details</UButton></div></template><div class="space-y-3"><div v-for="item in topModels" :key="item.id || item.label" class="flex items-center justify-between gap-3 text-sm"><div class="min-w-0"><p class="truncate font-medium">{{ item.label || item.id }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(item.request_count) }} requests · {{ formatNumber(item.failed_count) }} failed</p></div><strong>{{ formatNumber(item.total_tokens) }}</strong></div><p v-if="!topModels.length" class="py-6 text-center text-sm text-[var(--ui-text-muted)]">No model activity in this range.</p></div></UCard>
      <UCard><template #header><h2 class="font-semibold">Top client keys</h2></template><div class="space-y-3"><div v-for="item in topClientKeys" :key="item.id || item.label" class="flex items-center justify-between gap-3 text-sm"><div class="min-w-0"><p class="truncate font-medium">{{ item.label || `Key #${item.id}` }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(item.request_count) }} requests</p></div><span>{{ formatPercent(item.success_rate) }} success</span></div><p v-if="!topClientKeys.length" class="py-6 text-center text-sm text-[var(--ui-text-muted)]">No key activity in this range.</p></div></UCard>
    </section>

    <section class="grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-semibold text-[var(--ui-text-highlighted)]">Home topology</h2>
              <p class="text-xs text-[var(--ui-text-muted)]">Cluster ownership and heartbeat health</p>
            </div>
            <UButton to="/admin/system-nodes" color="neutral" variant="ghost" size="sm" trailing-icon="i-heroicons-arrow-right">Details</UButton>
          </div>
        </template>
        <div v-if="topologyAvailable" class="space-y-3">
          <div v-for="home in topologyHomes" :key="home.id" class="flex items-center justify-between gap-4 rounded-xl border border-[var(--ui-border)] p-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="healthDot(home.health)" />
                <p class="truncate text-sm font-medium text-[var(--ui-text-highlighted)]">{{ home.id }}</p>
              </div>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ home.role || 'unknown' }} · {{ home.cpa_count || 0 }} CPA nodes</p>
            </div>
            <UBadge :color="healthColor(home.health)" variant="subtle">{{ home.health || 'unknown' }}</UBadge>
          </div>
          <p v-if="!topologyHomes.length" class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No Home topology records.</p>
        </div>
        <p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">Topology capability is unavailable.</p>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-semibold text-[var(--ui-text-highlighted)]">Connected CPA nodes</h2>
              <p class="text-xs text-[var(--ui-text-muted)]">Current active node snapshots</p>
            </div>
            <UBadge color="neutral" variant="subtle">{{ nodeList.length }}</UBadge>
          </div>
        </template>
        <div class="space-y-3">
          <div v-for="node in nodeList.slice(0, 5)" :key="node.node_id || node.ip" class="flex items-center justify-between gap-4 rounded-xl border border-[var(--ui-border)] p-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-[var(--ui-text-highlighted)]">{{ node.node_name || node.node_id || node.ip }}</p>
              <p class="mt-1 truncate text-xs text-[var(--ui-text-muted)]">{{ node.ip }} · {{ node.home_id || 'Home unknown' }}</p>
            </div>
            <UBadge :color="node.healthy ? 'success' : 'warning'" variant="subtle">{{ node.healthy ? 'healthy' : 'attention' }}</UBadge>
          </div>
          <p v-if="!nodeList.length" class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No connected CPA nodes.</p>
        </div>
      </UCard>
    </section>
  </div>
</template>

<script setup lang="ts">
const { fetchAPI } = useApi()
const { capabilities, serverInfo, supports, refreshCapabilities } = useCapabilities()

const topology = ref<any>(null)
const nodes = ref<any>(null)
const usage = ref<any>(null)
const latest = ref<any>(null)
const authFiles = ref<any>(null)
const apiKeys = ref<any>(null)
const loading = ref(false)
const loadError = ref('')
const lastUpdated = ref<Date | null>(null)

const topologyAvailable = computed(() => supports('topology', true))
const usageAvailable = computed(() => supports('usage_overview', true))
const nodeList = computed<any[]>(() => Array.isArray(nodes.value?.nodes) ? nodes.value.nodes : [])
const topologyHomes = computed<any[]>(() => Array.isArray(topology.value?.homes) ? topology.value.homes : [])
const credentials = computed<any[]>(() => Array.isArray(authFiles.value?.files) ? authFiles.value.files : [])
const apiKeyItems = computed<any[]>(() => Array.isArray(apiKeys.value?.items) ? apiKeys.value.items : Array.isArray(apiKeys.value?.api_key_entries) ? apiKeys.value.api_key_entries : [])
const providerSummary = computed(() => {
  const groups = new Map<string, { name: string; total: number; active: number }>()
  for (const credential of credentials.value) {
    const name = String(credential.provider || credential.type || 'unknown')
    const group = groups.get(name) || { name, total: 0, active: 0 }
    group.total++
    if (!credential.disabled && !credential.unavailable && credential.status !== 'error') group.active++
    groups.set(name, group)
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
})
const disabledCredentialCount = computed(() => credentials.value.filter(item => item.disabled).length)
const unavailableCredentialCount = computed(() => credentials.value.filter(item => item.unavailable || item.status === 'error').length)
const activeCredentialCount = computed(() => credentials.value.filter(item => !item.disabled && !item.unavailable && item.status !== 'error').length)
const websocketCredentialCount = computed(() => credentials.value.filter(item => item.websockets).length)
const boundKeyCount = computed(() => apiKeyItems.value.filter(item => Number(item.user_id ?? item['user-id']) > 0).length)
const scopedKeyCount = computed(() => apiKeyItems.value.filter(item => item.channels?.length || item.model_groups?.length).length)
const credentialMetrics = computed(() => [
  { label: 'Active', value: formatNumber(activeCredentialCount.value) },
  { label: 'Disabled', value: formatNumber(disabledCredentialCount.value) },
  { label: 'Unavailable', value: formatNumber(unavailableCredentialCount.value) },
  { label: 'WebSockets', value: formatNumber(websocketCredentialCount.value) }
])
const topModels = computed<any[]>(() => Array.isArray(usage.value?.top?.models) ? usage.value.top.models.slice(0, 5) : [])
const topClientKeys = computed<any[]>(() => Array.isArray(usage.value?.top?.client_keys) ? usage.value.top.client_keys.slice(0, 5) : [])

const requestCount = computed(() => numberFrom(usage.value?.totals, ['request_count', 'total_requests', 'requests']))
const successfulCount = computed(() => numberFrom(usage.value?.totals, ['success_count', 'successful_requests', 'success']))
const failedCount = computed(() => numberFrom(usage.value?.totals, ['failed_count', 'failure_count', 'failed']))
const totalTokens = computed(() => numberFrom(usage.value?.totals, ['total_tokens', 'tokens']))

const summaryCards = computed(() => [
  {
    label: 'Connected CPA nodes', value: formatNumber(nodeList.value.length),
    detail: `${nodeList.value.filter(node => node.healthy).length} currently healthy`,
    icon: 'i-heroicons-server', iconClass: 'bg-sky-500/10 text-sky-500'
  },
  {
    label: 'Home instances', value: formatNumber(topology.value?.summary?.home_count ?? topologyHomes.value.length),
    detail: `${topology.value?.summary?.healthy_home_count ?? 0} healthy Home nodes`,
    icon: 'i-heroicons-building-office-2', iconClass: 'bg-indigo-500/10 text-indigo-500'
  },
  {
    label: 'Requests (24h)', value: usageAvailable.value ? formatNumber(requestCount.value) : '—',
    detail: usageAvailable.value ? `${formatNumber(failedCount.value)} failed requests` : 'Capability unavailable',
    icon: 'i-heroicons-bolt', iconClass: 'bg-amber-500/10 text-amber-500'
  },
  {
    label: 'Cluster attention', value: formatNumber(topology.value?.summary?.attention_count ?? nodeList.value.filter(node => !node.healthy).length),
    detail: topology.value?.summary?.missing_master ? 'Healthy master is missing' : 'Nodes requiring attention',
    icon: 'i-heroicons-shield-exclamation', iconClass: 'bg-rose-500/10 text-rose-500'
  }
])

const issues = computed(() => {
  const result: any[] = []
  if (topology.value?.summary?.missing_master) result.push({ title: 'Healthy Home master is missing', description: 'Cluster scheduling and coordination may be degraded.', color: 'error', icon: 'i-heroicons-shield-exclamation', to: '/admin/system-nodes' })
  const unhealthyNodes = nodeList.value.filter(node => !node.healthy).length
  if (unhealthyNodes) result.push({ title: `${unhealthyNodes} CPA node(s) need attention`, description: 'Inspect heartbeat and topology details.', color: 'warning', icon: 'i-heroicons-server', to: '/admin/system-nodes' })
  if (unavailableCredentialCount.value) result.push({ title: `${unavailableCredentialCount.value} credential(s) unavailable`, description: 'Review status messages, quota, and concurrency.', color: 'warning', icon: 'i-heroicons-key', to: '/admin/credentials' })
  if (usageAvailable.value && failedCount.value > 0) result.push({ title: `${formatNumber(failedCount.value)} failed request(s) in 24 hours`, description: 'Open usage records to inspect providers, models, and errors.', color: 'warning', icon: 'i-heroicons-exclamation-triangle', to: '/admin/usage' })
  if (!releaseCurrent.value && latestVersion.value) result.push({ title: `Home ${latestVersion.value} is available`, description: `This server reports ${currentVersion.value}.`, color: 'info', icon: 'i-heroicons-arrow-up-circle', to: '/admin/system-nodes' })
  return result
})

const usageMetrics = computed(() => [
  { label: 'Requests', value: formatNumber(requestCount.value) },
  { label: 'Successful', value: formatNumber(successfulCount.value) },
  { label: 'Failed', value: formatNumber(failedCount.value) },
  { label: 'Total tokens', value: formatNumber(totalTokens.value) }
])

const currentVersion = computed(() => serverInfo.value.home_version || 'Unknown')
const latestVersion = computed(() => latest.value?.['latest-version'] || latest.value?.latest_version || '')
const releaseCurrent = computed(() => !latestVersion.value || normalizeVersion(currentVersion.value) === normalizeVersion(latestVersion.value))
const releaseIcon = computed(() => releaseCurrent.value ? 'i-heroicons-check-circle' : 'i-heroicons-arrow-up-circle')
const releaseMessage = computed(() => {
  if (!latestVersion.value) return 'Latest release check was unavailable.'
  return releaseCurrent.value ? 'This Home is on the latest release.' : `A newer release (${latestVersion.value}) is available.`
})
const lastUpdatedLabel = computed(() => lastUpdated.value ? `Updated ${lastUpdated.value.toLocaleTimeString()}` : 'Not refreshed yet')

function numberFrom(source: any, keys: string[]) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value)) return value
  }
  return 0
}

function formatNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? new Intl.NumberFormat().format(number) : '0'
}

function formatPercent(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return `${number <= 1 ? (number * 100).toFixed(1) : number.toFixed(1)}%`
}

function normalizeVersion(value: string) {
  return String(value || '').trim().replace(/^v/i, '')
}

function healthColor(health?: string) {
  if (health === 'healthy') return 'success'
  if (health === 'stale') return 'warning'
  return 'neutral'
}

function healthDot(health?: string) {
  if (health === 'healthy') return 'bg-emerald-500'
  if (health === 'stale') return 'bg-amber-500'
  return 'bg-slate-400'
}

const refreshDashboard = async () => {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    await refreshCapabilities(true)
    const tasks: Array<Promise<void>> = [
      fetchAPI('/nodes').then(value => { nodes.value = value }).catch(() => { nodes.value = { nodes: [] } }),
      fetchAPI('/latest-version').then(value => { latest.value = value }).catch(() => { latest.value = null }),
      fetchAPI('/auth-files').then(value => { authFiles.value = value }).catch(() => { authFiles.value = { files: [] } }),
      fetchAPI('/api-keys').then(value => { apiKeys.value = value }).catch(() => { apiKeys.value = { items: [] } })
    ]
    if (supports('topology', true)) tasks.push(fetchAPI('/topology').then(value => { topology.value = value }))
    if (supports('usage_overview', true)) tasks.push(fetchAPI('/usage/overview').then(value => { usage.value = value }))
    await Promise.all(tasks)
    lastUpdated.value = new Date()
  } catch (error: any) {
    loadError.value = error?.message || 'Unable to load dashboard data.'
  } finally {
    loading.value = false
  }
}

onMounted(refreshDashboard)
</script>
