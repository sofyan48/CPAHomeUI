<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Diagnostics</h1>
      <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Usage, health, realtime traffic and request logs from Home.</p>
    </div>
    <AppPanelTabs v-model="activeView" :items="views" label="Diagnostics views" />

    <section v-if="activeView === 'console'" class="space-y-6" role="tabpanel">
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Overview window">
          <USelect v-model="windowSeconds" :items="windowOptions" value-key="value" label-key="label" class="w-40" :disabled="loadingConsole" @update:model-value="refreshConsole" />
        </UFormField>
        <UFormField label="Realtime grouping">
          <USelect v-model="groupBy" :items="['model', 'provider', 'client_key', 'credential']" class="w-40" :disabled="loadingConsole" @update:model-value="refreshConsole" />
        </UFormField>
        <AppButton icon="i-tabler-refresh" :loading="loadingConsole" @click="refreshConsole">Refresh</AppButton>
        <label class="flex items-center gap-2 text-sm"><input v-model="autoRefresh" type="checkbox" /> Auto-refresh every 30s</label>
        <span v-if="lastUpdated" class="text-xs text-[var(--ui-text-muted)]">Updated {{ formatTime(lastUpdated) }}</span>
      </div>
      <UAlert v-if="consoleError" color="error" variant="subtle" title="Some diagnostics could not be loaded" :description="consoleError" />
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AppCard v-for="metric in summaryMetrics" :key="metric.label">
          <p class="text-sm text-[var(--ui-text-muted)]">{{ metric.label }}</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">{{ metric.value }}</p>
        </AppCard>
      </div>
      <div class="grid gap-6 xl:grid-cols-2">
        <AppCard>
          <template #header><h2 class="font-semibold">Realtime · last 15 minutes</h2></template>
          <div class="grid grid-cols-3 gap-3 text-sm">
            <div><p class="text-[var(--ui-text-muted)]">Requests/min</p><p class="font-semibold">{{ decimal(latestVelocity?.rpm) }}</p></div>
            <div><p class="text-[var(--ui-text-muted)]">Tokens/min</p><p class="font-semibold">{{ number(latestVelocity?.tpm) }}</p></div>
            <div><p class="text-[var(--ui-text-muted)]">Error rate</p><p class="font-semibold">{{ percent(latestVelocity?.error_rate) }}</p></div>
          </div>
          <h3 class="mt-5 text-sm font-medium">Current usage by {{ groupBy }}</h3>
          <div v-for="item in realtime?.current_usage || []" :key="item.id" class="flex justify-between gap-3 border-b border-[var(--ui-border)] py-2 text-sm"><span class="truncate">{{ item.label || item.id }}</span><span>{{ number(item.request_count) }} requests</span></div>
          <p v-if="!realtime?.current_usage?.length" class="mt-3 text-sm text-[var(--ui-text-muted)]">No recent usage.</p>
          <h3 class="mt-5 text-sm font-medium">Latency distribution</h3>
          <div v-for="bucket in realtime?.latency_distribution || []" :key="bucket.bucket" class="flex justify-between gap-3 py-1 text-sm"><span>{{ bucket.bucket }}</span><span>{{ number(bucket.request_count) }}</span></div>
          <p v-if="!realtime?.latency_distribution?.length" class="mt-2 text-sm text-[var(--ui-text-muted)]">No latency data.</p>
        </AppCard>
        <AppCard>
          <template #header><h2 class="font-semibold">Recent activity</h2></template>
          <div v-for="point in recentActivity" :key="point.bucket_start" class="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] py-2 text-sm">
            <span>{{ formatTime(point.bucket_start) }}</span><span>{{ number(point.request_count) }} requests · {{ percent(point.error_rate) }} errors</span><UBadge :color="healthColor(point.status)" variant="subtle">{{ point.status }}</UBadge>
          </div>
          <p v-if="!recentActivity.length" class="text-sm text-[var(--ui-text-muted)]">No activity in this window.</p>
        </AppCard>
        <AppCard v-for="section in healthSections" :key="section.label">
          <template #header><h2 class="font-semibold">{{ section.label }} health</h2></template>
          <div v-for="item in section.items" :key="item.id" class="border-b border-[var(--ui-border)] py-3 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2"><span class="font-medium">{{ item.label || item.id }}</span><UBadge :color="healthColor(item.status)" variant="subtle">{{ item.status }}</UBadge></div>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ item.provider || item.credential_type || '' }} · {{ number(item.recent_success_count) }} success / {{ number(item.recent_failed_count) }} failed · {{ percent(item.recent_error_rate) }} errors · p95 {{ milliseconds(item.p95_latency_ms) }}</p>
            <p v-if="item.last_error_message" class="break-words text-xs text-[var(--ui-text-muted)]">Last error{{ item.last_error_status ? ` (${item.last_error_status})` : '' }}: {{ item.last_error_message }} · {{ formatTime(item.last_error_at) }}</p>
            <p v-if="item.next_retry_at" class="text-xs text-[var(--ui-text-muted)]">Next retry: {{ formatTime(item.next_retry_at) }}</p>
          </div>
          <p v-if="!section.items.length" class="text-sm text-[var(--ui-text-muted)]">No health data in this window.</p>
        </AppCard>
      </div>
      <AppCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">Request logs</h2><p class="text-xs text-[var(--ui-text-muted)]">{{ number(logs?.total) }} indexed requests · local availability or remote routability</p></div>
            <form class="flex gap-2" @submit.prevent="applyLogSearch"><UInput v-model="logSearch" placeholder="Request ID, model, status or file" aria-label="Search request logs" /><AppButton type="submit" color="neutral" variant="outline" :disabled="loadingConsole">Search</AppButton></form>
          </div>
        </template>
        <AppCard :ui="{ body: 'p-0' }"><AppTable native><table class="min-w-[42rem] text-left text-sm"><thead><tr><th>Request</th><th>Provider / model</th><th>Home</th><th>File</th><th>Status</th><th>Log</th></tr></thead><tbody>
          <tr v-for="item in logItems" :key="item.id"><td><div>{{ formatTime(item.timestamp) }}</div><div class="font-mono text-xs">{{ item.request_id || '—' }}</div></td><td>{{ item.provider || '—' }} / {{ item.model || '—' }}</td><td>{{ item.home_ip || '—' }}{{ item.home_port ? `:${item.home_port}` : '' }}</td><td class="font-mono text-xs">{{ item.file_name || 'Remote / unavailable' }}</td><td>{{ item.status }}</td><td><AppButton size="xs" color="neutral" variant="outline" :disabled="!item.download_url" :loading="downloadingId === item.id" @click="downloadLog(item)">Download</AppButton></td></tr>
        </tbody></table></AppTable></AppCard>
        <p v-if="!logItems.length" class="py-5 text-center text-sm text-[var(--ui-text-muted)]">No request logs match this window and search.</p>
        <div class="mt-4 flex items-center justify-end gap-3 text-sm"><AppButton size="sm" color="neutral" variant="outline" :disabled="logPage === 1 || loadingConsole" @click="changeLogPage(-1)">Previous</AppButton><span>Page {{ logPage }} / {{ logPages }}</span><AppButton size="sm" color="neutral" variant="outline" :disabled="logPage >= logPages || loadingConsole" @click="changeLogPage(1)">Next</AppButton></div>
      </AppCard>
    </section>

    <section v-else class="space-y-6" role="tabpanel">
    <p class="text-sm text-[var(--ui-text-muted)]">Send an HTTP request from Home, optionally using a stored credential for token substitution and credential-scoped proxy selection.</p>
    <UAlert color="warning" variant="subtle" icon="i-tabler-shield-exclamation" title="Administrative network access" description="Requests originate from Home and can reach addresses available to that server. Use only trusted URLs. Responses shown below may contain sensitive upstream data." />
    <UAlert v-if="errorMessage" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Request failed" :description="errorMessage" />

    <div class="grid gap-6 xl:grid-cols-2">
      <AppCard>
        <template #header><h2 class="font-semibold">Request</h2></template>
        <form class="space-y-4" @submit.prevent="sendRequest">
          <div class="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <UFormField label="Method">
              <USelect v-model="form.method" :items="methods" class="w-full" />
            </UFormField>
            <UFormField label="Absolute URL" required>
              <UInput v-model="form.url" type="url" placeholder="https://api.example.com/v1/models" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Credential">
            <USelectMenu :model-value="form.auth_index || noCredentialValue" @update:model-value="form.auth_index = $event === noCredentialValue ? '' : $event" :items="credentialOptions" value-key="value" label-key="label" class="w-full" :search-input="{ placeholder: 'Search credentials...' }" />
            <template #hint>Required when a header contains <code>$TOKEN$</code>.</template>
          </UFormField>
          <UFormField label="Headers (JSON object)">
            <UTextarea v-model="form.headers" :rows="8" class="w-full font-mono text-xs" spellcheck="false" />
          </UFormField>
          <UFormField label="Raw request body">
            <UTextarea v-model="form.data" :rows="10" class="w-full font-mono text-xs" spellcheck="false" />
          </UFormField>
          <div class="flex justify-end">
            <AppButton type="submit" icon="i-tabler-send" :loading="sending">Send request</AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard>
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold">Response</h2>
            <UBadge v-if="result" :color="statusColor(result.status_code)" variant="subtle">HTTP {{ result.status_code }}</UBadge>
          </div>
        </template>
        <div v-if="result" class="space-y-4">
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Headers</p>
            <pre class="max-h-64 overflow-auto rounded-lg bg-[var(--ui-bg-muted)] p-4 text-xs">{{ formattedHeaders }}</pre>
          </div>
          <div>
            <div class="mb-2 flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Body</p>
              <AppButton size="xs" color="neutral" variant="ghost" icon="i-tabler-clipboard" @click="copyBody">Copy</AppButton>
            </div>
            <pre class="max-h-[42rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--ui-bg-muted)] p-4 text-xs">{{ formattedBody }}</pre>
          </div>
        </div>
        <div v-else class="flex min-h-80 flex-col items-center justify-center text-center text-[var(--ui-text-muted)]">
          <UIcon name="i-tabler-terminal-2" class="size-10" />
          <p class="mt-3 text-sm">Send a request to inspect its status, headers, and body.</p>
        </div>
      </AppCard>
    </div>
    </section>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const toast = useToast()
const views = [{ value: 'console', label: 'Observability' }, { value: 'sender', label: 'API-call sender' }]
const activeView = ref('console')
const windowOptions = [{ label: 'Last hour', value: 3600 }, { label: 'Last 24 hours', value: 86400 }, { label: 'Last 7 days', value: 604800 }]
const windowSeconds = ref(86400)
const groupBy = ref('model')
const autoRefresh = ref(true)
const loadingConsole = ref(false)
const consoleError = ref('')
const lastUpdated = ref('')
const overview = ref(null)
const realtime = ref(null)
const providerHealth = ref(null)
const credentialHealth = ref(null)
const logs = ref(null)
const logSearch = ref('')
const appliedLogSearch = ref('')
const logPage = ref(1)
const logPageSize = 20
const downloadingId = ref('')
let refreshTimer
const number = value => value == null ? '—' : Number(value).toLocaleString()
const decimal = value => value == null ? '—' : Number(value).toFixed(1)
const percent = value => value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`
const milliseconds = value => value == null ? '—' : `${number(Math.round(value))} ms`
const formatTime = value => value ? new Date(value).toLocaleString() : '—'
const healthColor = status => status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : status === 'empty' || status === 'unknown' ? 'neutral' : 'error'
const latestVelocity = computed(() => realtime.value?.velocity?.at(-1))
const recentActivity = computed(() => (overview.value?.activity || []).filter(point => point.request_count > 0).slice(-10).reverse())
const healthSections = computed(() => [
  { label: 'Provider', items: providerHealth.value?.items || [] },
  { label: 'Credential', items: credentialHealth.value?.items || [] }
])
const logItems = computed(() => logs.value?.items || [])
const logPages = computed(() => Math.max(1, Math.ceil((logs.value?.total || 0) / logPageSize)))
const summaryMetrics = computed(() => {
  const totals = overview.value?.totals
  return [
    { label: 'Requests', value: number(totals?.request_count) },
    { label: 'Failures', value: number(totals?.failed_count) },
    { label: 'Error rate', value: percent(totals?.error_rate) },
    { label: 'Tokens', value: number(totals?.total_tokens) },
    { label: 'P95 latency', value: milliseconds(totals?.p95_latency_ms) },
    { label: 'Active credentials', value: number(totals?.active_credential_count) },
    { label: 'Active models', value: number(totals?.active_model_count) },
    { label: 'Billed amount', value: totals?.total_amount == null ? '—' : `${decimal(totals.total_amount)} ${totals.currency || 'credits'}` }
  ]
})
function consoleQueries() {
  const to = new Date()
  const from = new Date(to.getTime() - Number(windowSeconds.value) * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}
async function refreshConsole() {
  if (loadingConsole.value || activeView.value !== 'console') return
  loadingConsole.value = true
  consoleError.value = ''
  const range = consoleQueries()
  const requests = [
    ['Overview', () => fetchAPI('/usage/overview', { query: range }), overview],
    ['Realtime', () => fetchAPI('/usage/realtime', { query: { window_seconds: 900, bucket_seconds: 60, group_by: groupBy.value } }), realtime],
    ['Provider health', () => fetchAPI('/usage/health/providers', { query: range }), providerHealth],
    ['Credential health', () => fetchAPI('/usage/health/credentials', { query: range }), credentialHealth],
    ['Request logs', () => fetchAPI('/request-logs', { query: { ...range, search: appliedLogSearch.value, limit: logPageSize, offset: (logPage.value - 1) * logPageSize } }), logs]
  ]
  const results = await Promise.allSettled(requests.map(([, load]) => load()))
  const failures = []
  results.forEach((result, index) => {
    const [label, , target] = requests[index]
    if (result.status === 'fulfilled') target.value = result.value
    else { target.value = null; failures.push(`${label}: ${message(result.reason, 'Load failed')}`) }
  })
  consoleError.value = failures.join(' · ')
  lastUpdated.value = new Date().toISOString()
  loadingConsole.value = false
}
function applyLogSearch() { logPage.value = 1; appliedLogSearch.value = logSearch.value.trim(); refreshConsole() }
function changeLogPage(delta) { logPage.value += delta; refreshConsole() }
async function downloadLog(item) {
  if (!item.download_url) return
  downloadingId.value = item.id
  try {
    const blob = await fetchAPI(item.download_url, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${item.request_id || 'request'}.log`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) { consoleError.value = message(error, 'Could not download request log.') }
  finally { downloadingId.value = '' }
}
watch(activeView, view => { if (view === 'sender') loadCredentials(); else refreshConsole() })
onMounted(() => { refreshConsole(); refreshTimer = setInterval(() => { if (autoRefresh.value) refreshConsole() }, 30000) })
onUnmounted(() => clearInterval(refreshTimer))
const sending = ref(false)
const errorMessage = ref('')
const authResponse = ref(null)
const result = ref(null)
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const form = reactive({ method: 'GET', url: '', auth_index: '', headers: '{\n  "Accept": "application/json"\n}', data: '' })
const credentials = computed(() => Array.isArray(authResponse.value) ? authResponse.value : Array.isArray(authResponse.value?.credentials) ? authResponse.value.credentials : Array.isArray(authResponse.value?.files) ? authResponse.value.files : [])
const noCredentialValue = '__no_credential__'
const credentialOptions = computed(() => [
  { label: 'No credential', value: noCredentialValue },
  ...credentials.value.map(item => ({ value: item.auth_index || item.id, label: `${item.label || item.name || item.id} · ${item.provider || item.type || 'credential'}` }))
])
const formattedHeaders = computed(() => JSON.stringify(result.value?.header || {}, null, 2))
const formattedBody = computed(() => {
  const body = result.value?.body || ''
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
})
const message = (error, fallback) => error?.data?.message || error?.data?.error || error?.message || fallback
function statusColor(status) { if (status >= 200 && status < 300) return 'success'; if (status >= 400) return 'error'; return 'warning' }
async function loadCredentials() {
  try { authResponse.value = await fetchAPI('/credentials') }
  catch { authResponse.value = { files: [] } }
}
async function sendRequest() {
  errorMessage.value = ''; result.value = null
  if (!form.url.trim()) { errorMessage.value = 'An absolute URL is required.'; return }
  let headers
  try {
    headers = JSON.parse(form.headers || '{}')
    if (!headers || Array.isArray(headers) || typeof headers !== 'object' || Object.values(headers).some(value => typeof value !== 'string')) throw new Error()
  } catch { errorMessage.value = 'Headers must be a JSON object with string values.'; return }
  sending.value = true
  try {
    result.value = await fetchAPI('/requests/api-call', { method: 'POST', body: { auth_index: form.auth_index || undefined, method: form.method, url: form.url.trim(), header: headers, data: form.data } })
  } catch (error) { errorMessage.value = message(error, 'The diagnostic request failed.') }
  finally { sending.value = false }
}
async function copyBody() {
  await navigator.clipboard.writeText(result.value?.body || '')
  toast.add({ title: 'Response body copied', color: 'success' })
}
</script>
