<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Upstream</h1>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Credentials and model providers</p>
      </div>
      <UButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="syncing" @click="syncData">Sync data</UButton>
    </div>

    <p v-if="summaryPending" role="status" class="text-sm text-[var(--ui-text-muted)]">Loading Upstream summary…</p>
    <UAlert v-if="summaryError" color="warning" variant="subtle" title="Upstream summary unavailable" :description="summaryError" />
    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <AppCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Accounts</p><p class="mt-1 text-2xl font-bold">{{ accounts.length }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ activeAccounts }} active · {{ disabledAccounts }} disabled · {{ unavailableAccounts }} unavailable</p></AppCard>
      <AppCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Provider keys</p><p class="mt-1 text-2xl font-bold">{{ providerKeyCount }}</p><p class="truncate text-xs text-[var(--ui-text-muted)]" :title="providerGroups">{{ providerGroups || 'No entries' }}</p></AppCard>
      <AppCard><button type="button" class="w-full cursor-pointer text-left" aria-label="Show accounts needing attention" @click="showAttention"><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Quota attention</p><p class="mt-1 text-2xl font-bold">{{ quotaError ? 'Unavailable' : attentionCount }}</p><p class="text-xs text-[var(--ui-text-muted)]">Quota status and collection freshness</p></button></AppCard>
      <AppCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">WebSockets</p><p class="mt-1 text-2xl font-bold">{{ accounts.filter(item => item.websockets).length }}</p><p class="text-xs text-[var(--ui-text-muted)]">Enabled accounts</p></AppCard>
    </div>

    <AppPanelTabs :model-value="tab" :items="upstreamTabs" label="Upstream" @update:model-value="selectTab" />
    <AdminUpstreamAccounts v-if="tab === 'accounts'" :attention-request="attentionRequest" :sync-request="syncRequest" @changed="refreshSummary" />
    <AdminUpstreamProviders v-else :sync-request="syncRequest" @changed="refreshSummary" />
  </div>
</template>

<script setup>
const route = useRoute()
if (route.query.tab === 'proxy') await navigateTo('/admin/proxy-network', { replace: true })
watch(() => route.query.tab, value => { if (value === 'proxy') void navigateTo('/admin/proxy-network', { replace: true }) })
const router = useRouter()
const { fetchAPI } = useApi()
const toast = useToast()
const tab = computed(() => route.query.credential ? 'accounts' : route.query.tab === 'providers' ? 'providers' : 'accounts')
const upstreamTabs = [{ label: 'Accounts', value: 'accounts' }, { label: 'Providers', value: 'providers' }]
const summaryError = ref('')
const quotaError = ref('')
const syncing = ref(false)

const attentionRequest = ref(0)
const syncRequest = ref(0)
const providerRoutes = ['gemini-api-key', 'interactions-api-key', 'claude-api-key', 'codex-api-key', 'xai-api-key', 'meta-api-key', 'vertex-api-key', 'openai-compatibility']
async function loadSummary() {
  summaryError.value = ''
  quotaError.value = ''
  const [auth, ...providers] = await Promise.allSettled([
    fetchAPI('/auth-files'),
    ...providerRoutes.map(name => fetchAPI(`/${name}`))
  ])
  if (auth.status === 'rejected') summaryError.value = auth.reason?.message || 'Could not load accounts.'
  const accounts = auth.status === 'fulfilled' && Array.isArray(auth.value?.files) ? auth.value.files : []
  const groups = providerRoutes.map((name, index) => {
    const result = providers[index]
    const response = result.status === 'fulfilled' ? result.value : null
    const entries = response?.[name] ?? response?.items ?? response?.data
    return { name, count: Array.isArray(entries) ? entries.length : entries && typeof entries === 'object' ? 1 : 0 }
  })
  if (providers.some(result => result.status === 'rejected')) summaryError.value = [summaryError.value, 'Some provider groups could not be loaded.'].filter(Boolean).join(' ')
  return { accounts, groups }
}
const { data: summary, pending: summaryPending, refresh: refreshSummary } = useAsyncData('upstream-summary', loadSummary, { lazy: true, default: () => ({ accounts: [], groups: [] }) })
const accounts = computed(() => summary.value?.accounts || [])
async function loadSummaryQuota() {
  quotaError.value = ''
  const items = accounts.value
  if (!items.length) return []
  try {
    const quota = []
    for (let index = 0; index < items.length; index += 200) {
      const ids = items.slice(index, index + 200).map(item => item.id).filter(Boolean).join(',')
      if (!ids) continue
      const result = await fetchAPI('/quota/credentials', { query: { ids, limit: 200 } })
      quota.push(...(result.items || []))
    }
    return quota
  } catch (error) { quotaError.value = error?.message || 'Quota snapshots unavailable.'; return [] }
}
const summaryIDs = computed(() => accounts.value.map(item => item.id).filter(Boolean).join(','))
const { data: summaryQuota, refresh: refreshSummaryQuota } = useAsyncData('upstream-summary-quota', loadSummaryQuota, { lazy: true, default: () => [], watch: [summaryIDs] })
const activeAccounts = computed(() => accounts.value.filter(item => !item.disabled && !item.unavailable).length)
const disabledAccounts = computed(() => accounts.value.filter(item => item.disabled).length)
const unavailableAccounts = computed(() => accounts.value.filter(item => !item.disabled && item.unavailable).length)
const providerKeyCount = computed(() => (summary.value?.groups || []).reduce((total, item) => total + item.count, 0))
const providerGroups = computed(() => (summary.value?.groups || []).filter(item => item.count).map(item => item.name).join(', '))
const attentionCount = computed(() => (summaryQuota.value || []).filter(isQuotaAttention).length)
function selectTab(value) { void router.replace({ query: { ...route.query, tab: value, credential: undefined } }) }
function showAttention() { if (tab.value === 'providers') selectTab('accounts'); attentionRequest.value++ }
async function syncData() {
  syncing.value = true
  try {
    const [collection] = await Promise.allSettled([
      fetchAPI('/quota/collect', { method: 'POST', body: {} }),
      refreshSummary()
    ])
    void refreshSummaryQuota()
    syncRequest.value++
    if (collection.status === 'fulfilled') toast.add({ title: collection.value.accepted ? 'Quota collection queued' : 'No collection queued', color: collection.value.accepted ? 'success' : 'warning' })
    else toast.add({ title: 'Quota collection unavailable', description: collection.reason?.message || 'Accounts and providers were refreshed without quota collection.', color: 'warning' })
  } catch (error) {
    toast.add({ title: 'Sync failed', description: error?.message || 'Could not queue quota collection.', color: 'error' })
  } finally { syncing.value = false }
}
</script>
