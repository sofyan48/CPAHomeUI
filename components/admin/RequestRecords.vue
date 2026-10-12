<template>
  <div class="space-y-6">
    <AppCard :ui="{ body: 'flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-4 sm:py-3' }">
      <div><p class="text-sm font-semibold">Request records</p><p class="text-xs text-[var(--ui-text-muted)]">Search persisted requests and inspect redacted routing, billing, and log details.</p></div>
      <div class="flex flex-wrap items-center gap-2"><div class="flex items-center gap-2 rounded-md border border-[var(--ui-border)] px-2.5 py-1.5"><USwitch v-model="liveRefresh" size="sm" /><span class="text-xs">Live refresh</span><USelect v-if="liveRefresh" v-model="refreshSeconds" :items="refreshOptions" value-key="value" label-key="label" size="sm" class="w-24" /></div><AppButton color="neutral" variant="outline" size="sm" icon="i-tabler-download" :disabled="exporting || !canExport" @click="exportOpen = true">Export CSV / JSONL</AppButton></div>
    </AppCard>

    <UAlert
      v-if="pageError || liveError"
      color="error"
      variant="subtle"
      icon="i-tabler-alert-triangle"
      title="Request events unavailable"
      :description="pageError || liveError"
    />

    <UAlert v-if="capabilityError" color="warning" variant="subtle" title="Capabilities unavailable" description="Request export will be checked when requested." />
    <UAlert v-if="!canExport" color="warning" variant="subtle" title="Request export unavailable" description="This Home deployment does not support request event export." />

    <AppCard :ui="{ body: 'px-4 py-3 sm:px-4 sm:py-3' }">
      <form class="space-y-3" @submit.prevent="applyFilters">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1.5fr)_repeat(4,minmax(0,1fr))]">
          <UFormField label="Search"><div class="flex"><USelect v-model="searchField" :items="searchFieldOptions" value-key="value" label-key="label" class="w-36 shrink-0 [&_button]:rounded-r-none" /><UInput v-model="filters.search" icon="i-tabler-search" placeholder="Search requests..." class="min-w-0 flex-1 [&_input]:rounded-l-none" /></div></UFormField>
          <UFormField label="Time range"><USelect v-model="timeRange" :items="timeRangeOptions" value-key="value" label-key="label" class="w-full" @update:model-value="applyTimeRange" /></UFormField>
          <UFormField label="Status"><USelect :model-value="filters.status || allOptionValue" @update:model-value="setSelectFilter('status', $event)" :items="statusOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Provider"><USelectMenu :model-value="filters.provider || allOptionValue" @update:model-value="setSelectFilter('provider', $event)" :items="providerOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Model"><USelectMenu :model-value="filters.model || allOptionValue" @update:model-value="setSelectFilter('model', $event)" :items="modelOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
        </div>
        <div v-if="timeRange === 'custom'" class="grid grid-cols-1 gap-3 border-t border-[var(--ui-border)] pt-3 sm:grid-cols-2"><UFormField label="Start time"><UInput v-model="filters.from" type="datetime-local" class="w-full" /></UFormField><UFormField label="End time"><UInput v-model="filters.to" type="datetime-local" class="w-full" /></UFormField></div>

        <div v-if="advancedOpen" class="grid grid-cols-1 gap-3 border-t border-[var(--ui-border)] pt-3 md:grid-cols-2 xl:grid-cols-6">
          <UFormField label="Event type"><USelect :model-value="filters.event_type || allOptionValue" @update:model-value="setSelectFilter('event_type', $event)" :items="eventTypeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Home node"><USelectMenu :model-value="filters.home_ip || allOptionValue" @update:model-value="setSelectFilter('home_ip', $event)" :items="homeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="CPA node"><USelectMenu :model-value="filters.cpa_node || allOptionValue" @update:model-value="setSelectFilter('cpa_node', $event)" :items="cpaOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="HTTP status"><USelect :model-value="filters.status_code || allOptionValue" @update:model-value="setSelectFilter('status_code', $event)" :items="statusCodeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Sort"><USelect v-model="sort" :items="sortOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-2"><UFormField label="Min latency"><UInput v-model="filters.min_latency_ms" type="number" min="0" placeholder="ms" class="w-full" /></UFormField><UFormField label="Max latency"><UInput v-model="filters.max_latency_ms" type="number" min="0" placeholder="ms" class="w-full" /></UFormField></div>
        </div>

        <div class="flex flex-wrap items-center gap-2 border-t border-[var(--ui-border)] pt-3">
          <AppButton type="submit" color="primary" :loading="loading">Apply filters</AppButton>
          <AppButton type="button" color="neutral" variant="ghost" @click="resetFilters">Reset</AppButton>
          <AppButton type="button" color="neutral" variant="ghost" :icon="advancedOpen ? 'i-tabler-chevron-up' : 'i-tabler-adjustments-horizontal'" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen">
            {{ advancedOpen ? 'Hide advanced' : 'Advanced filters' }}
          </AppButton>
          <span class="ml-auto text-xs text-[var(--ui-text-muted)]">Times are interpreted in {{ timezone }}.</span>
        </div>
      </form>
    </AppCard>

    <AdminUsageSessionTree />

    <AppCard :ui="{ body: 'p-0' }">
      <template #header>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 class="font-semibold">Events</h2><p class="text-xs text-[var(--ui-text-muted)]">Showing {{ pageStart }}–{{ pageEnd }} of {{ formatNumber(total) }}</p></div>
          <div class="flex items-center gap-2">
            <AppButton v-if="pendingNewEvents" size="sm" color="primary" variant="soft" :loading="loading" @click="refreshEvents">
              Show {{ formatNumber(pendingNewEvents) }} new {{ pendingNewEvents === 1 ? 'event' : 'events' }}
            </AppButton>
            <UBadge v-if="liveRefresh" color="success" variant="subtle"><span class="mr-1 inline-block size-1.5 rounded-full bg-current" />Live</UBadge>
          </div>
        </div>
      </template>
      <AppTable :columns="columns" :data="events" :loading="loading" class="min-w-[1320px]">
        <template #timestamp-cell="{ row }"><div class="min-w-36"><p class="text-sm font-medium">{{ formatDateTime(rowValue(row).timestamp) }}</p></div></template>
        <template #event-cell="{ row }"><div><p class="text-sm">{{ rowValue(row).event_type || 'completion' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).executor_type || 'default executor' }}</p></div></template>
        <template #status-cell="{ row }"><div class="space-y-1"><UBadge :color="rowValue(row).failed ? 'error' : 'success'" variant="subtle">{{ rowValue(row).failed ? 'Failed' : 'Success' }}</UBadge><p class="text-xs text-[var(--ui-text-muted)]">HTTP {{ rowValue(row).status_code || '—' }}</p></div></template>
        <template #model-cell="{ row }"><div class="min-w-40"><p class="font-medium">{{ rowValue(row).model || 'Unknown model' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).provider || 'Unknown provider' }}<span v-if="rowValue(row).model_alias || rowValue(row).original_model"> · {{ rowValue(row).model_alias || rowValue(row).original_model }}</span></p></div></template>
        <template #runtime-cell="{ row }"><div class="min-w-36"><p class="text-sm">{{ rowValue(row).runtime?.home_id || rowValue(row).runtime?.home_ip || 'Unknown Home' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).runtime?.cpa_label || rowValue(row).runtime?.cpa_node_id || rowValue(row).runtime?.cpa_ip || 'Unknown CPA' }}</p></div></template>
        <template #client-cell="{ row }"><div class="min-w-36"><p class="text-sm">{{ rowValue(row).client?.username || 'Unattributed' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).client?.client_key_label || rowValue(row).client?.client_key_masked || 'No client key' }}</p></div></template>
        <template #credential-cell="{ row }"><div class="min-w-36"><p class="truncate text-sm">{{ rowValue(row).credential?.label || rowValue(row).credential?.credential_id || 'Unknown' }}</p><p class="truncate text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).credential?.auth_index || rowValue(row).credential?.credential_type || 'No auth index' }}</p></div></template>
        <template #tokens-cell="{ row }"><div class="min-w-24 text-sm tabular-nums"><p class="font-semibold">{{ formatNumber(rowValue(row).tokens?.total_tokens) }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(rowValue(row).tokens?.input_tokens) }} in / {{ formatNumber(rowValue(row).tokens?.output_tokens) }} out</p></div></template>
        <template #latency-cell="{ row }"><div class="min-w-24 text-sm tabular-nums"><p>{{ formatMilliseconds(rowValue(row).performance?.latency_ms) }}</p><p class="text-xs text-[var(--ui-text-muted)]">TTFT {{ formatMilliseconds(rowValue(row).performance?.ttft_ms) }}</p></div></template>
        <template #request-cell="{ row }"><div class="min-w-40"><p class="truncate font-mono text-xs">{{ rowValue(row).request_id || rowValue(row).id }}</p><p class="truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).upstream_request_id || 'No upstream ID' }}</p></div></template>
        <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><AdminTableAction v-if="rowValue(row).related?.request_log?.download_url" action="download" label="Download request log" :loading="downloadingId === rowValue(row).request_id" @click="downloadRequestLog(rowValue(row).related.request_log.download_url, rowValue(row).request_id)" /><AdminTableAction action="view" label="View request event" @click="openDetail(rowValue(row))" /></div></template>
        <template #empty><div class="flex flex-col items-center justify-center py-14 text-center"><UIcon name="i-tabler-list" class="mb-3 size-8 text-[var(--ui-text-muted)]" /><p class="font-medium">No request events found</p><p class="mt-1 text-sm text-[var(--ui-text-muted)]">Try a broader time range or fewer filters.</p></div></template>
      </AppTable>
      <div class="flex flex-col gap-3 border-t border-[var(--ui-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-[var(--ui-text-muted)]">Page {{ page }} of {{ totalPages }}</p>
        <div class="flex items-center gap-2"><AppButton size="sm" color="neutral" variant="outline" :disabled="page <= 1 || loading" @click="changePage(-1)">Previous</AppButton><AppButton size="sm" color="neutral" variant="outline" :disabled="page >= totalPages || loading" @click="changePage(1)">Next</AppButton></div>
      </div>
    </AppCard>

    <AdminRequestRecordDetail
      v-model:open="detailOpen"
      :detail="selectedDetail"
      :loading="detailLoading"
      :downloading="Boolean(downloadingId)"
      :download-error="detailDownloadError"
      @download="downloadRequestLog"
    />

    <AppModal v-model:open="exportOpen" title="Export request events" description="Exports up to 10,000 events matching the currently applied filters and sort, across all pages.">
      <template #body>
        <div class="space-y-5">
          <UFormField label="Format"><USelect v-model="exportFormat" :items="exportOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UAlert color="info" variant="subtle" icon="i-tabler-shield-check" title="Secrets remain redacted" description="The server export uses flattened event fields and does not include raw client API keys or payload bodies." />
          <div class="flex justify-end gap-3"><AppButton color="neutral" variant="ghost" @click="exportOpen = false">Cancel</AppButton><AppButton icon="i-tabler-download" :loading="exporting" :disabled="exporting || !canExport" @click="exportEvents">Download {{ exportFormat.toUpperCase() }}</AppButton></div>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useDataSync } from '~/composables/useDataSync'
const { fetchAPI, token } = useApi()
const { supports, error: capabilityError, refreshCapabilities } = useCapabilities()
const exportUnavailable = ref(false)
const canExport = computed(() => supports('request_event_export') && !exportUnavailable.value)
let exportController = new AbortController()
let exportVersion = 0
const allOptionValue = '__all__'
const pageSize = 50
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const rowValue = row => row?.original ?? row
const toInputDateTime = date => {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const defaultFilters = () => ({
  from: toInputDateTime(new Date(Date.now() - 24 * 60 * 60 * 1000)), to: '', event_type: '', status: '', status_code: '', search: '', provider: '', model: '', home_ip: '', cpa_node: '', credential_type: '', request_id: '', session_id: '', root_session_id: '', user: '', client_key: '', credential_id: '', auth_index: '', executor_type: '', endpoint: '', min_latency_ms: '', max_latency_ms: '', min_amount: '', max_amount: ''
})

const filters = ref(defaultFilters())
const appliedFilters = ref({ ...filters.value })
const searchField = ref('all')
const appliedSearchField = ref('all')
const timeRange = ref('24h')
const sort = ref('timestamp_desc')
const page = ref(1)
const response = useWorkspaceState('admin:request-records:response', () => (null))
const filterOptions = useWorkspaceState('admin:request-records:filterOptions', () => (null))
const loading = useWorkspaceState('admin:request-records:loading', () => (false))
const pageError = useWorkspaceState('admin:request-records:pageError', () => (''))
const liveError = useWorkspaceState('admin:request-records:liveError', () => (''))
const pendingNewEvents = useWorkspaceState('admin:request-records:pendingNewEvents', () => (0))
let requestVersion = 0
let polling = false
let disposed = false
const advancedOpen = ref(false)
const lastUpdated = useWorkspaceState('admin:request-records:lastUpdated', () => (null))
const liveRefresh = ref(false)
const refreshSeconds = ref('15')
let refreshTimer = null
const detailOpen = ref(false)
const detailLoading = useWorkspaceState('admin:request-records:detailLoading', () => (false))
const selectedDetail = useWorkspaceState('admin:request-records:selectedDetail', () => (null))
const detailDownloadError = ref('')
const downloadingId = useWorkspaceState('admin:request-records:downloadingId', () => (''))
const exportOpen = ref(false)
const exportFormat = ref('csv')
const exporting = useWorkspaceState('admin:request-records:exporting', () => (false))

const statusOptions = [{ label: 'All statuses', value: allOptionValue }, { label: 'Success', value: 'success' }, { label: 'Failed', value: 'failed' }]
const searchFieldOptions = [{ label: 'All fields', value: 'all' }, { label: 'Request ID', value: 'request_id' }, { label: 'User', value: 'user' }, { label: 'Client key', value: 'client_key' }, { label: 'Credential', value: 'credential' }]
const timeRangeOptions = [{ label: 'Last 4 hours', value: '4h' }, { label: 'Last 12 hours', value: '12h' }, { label: 'Last 24 hours', value: '24h' }, { label: 'Today', value: 'today' }, { label: 'Yesterday', value: 'yesterday' }, { label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }, { label: 'Last 90 days', value: '90d' }, { label: 'Custom range', value: 'custom' }]
const sortOptions = [
  { label: 'Newest first', value: 'timestamp_desc' }, { label: 'Oldest first', value: 'timestamp_asc' }, { label: 'Most tokens', value: 'tokens_desc' }, { label: 'Highest latency', value: 'latency_desc' }, { label: 'Highest cost', value: 'cost_desc' }, { label: 'Failures first', value: 'failed_first' }
]
const refreshOptions = [{ label: '5s', value: '5' }, { label: '15s', value: '15' }, { label: '30s', value: '30' }, { label: '60s', value: '60' }]
const exportOptions = [{ label: 'CSV spreadsheet', value: 'csv' }, { label: 'JSON Lines', value: 'jsonl' }]
const columns = [
  { accessorKey: 'timestamp', header: 'Time' }, { accessorKey: 'event', header: 'Event' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'model', header: 'Model' }, { accessorKey: 'runtime', header: 'Home node' }, { accessorKey: 'client', header: 'User' }, { accessorKey: 'credential', header: 'Credential' }, { accessorKey: 'tokens', header: 'Tokens' }, { accessorKey: 'latency', header: 'Latency' }, { accessorKey: 'request', header: 'Request ID' }, { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]
const events = computed(() => Array.isArray(response.value?.items) ? response.value.items : [])
const total = computed(() => Number(response.value?.total) || 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const pageStart = computed(() => total.value ? ((page.value - 1) * pageSize) + 1 : 0)
const pageEnd = computed(() => Math.min(page.value * pageSize, total.value))
const visibleFailures = computed(() => events.value.filter(event => event.failed).length)
const visibleTokens = computed(() => events.value.reduce((sum, event) => sum + (Number(event.tokens?.total_tokens) || 0), 0))
const optionList = (key, label) => [{ label, value: allOptionValue }, ...(Array.isArray(filterOptions.value?.[key]) ? filterOptions.value[key] : []).filter(value => value !== '' && value != null).map(value => ({ label: value, value }))]
const setSelectFilter = (field, value) => { filters.value[field] = value === allOptionValue ? '' : value }
const eventTypeOptions = computed(() => optionList('event_types', 'All event types'))
const providerOptions = computed(() => optionList('providers', 'All providers'))
const modelOptions = computed(() => optionList('models', 'All models'))
const homeOptions = computed(() => optionList('home_ips', 'All Home nodes'))
const cpaOptions = computed(() => optionList('cpa_nodes', 'All CPA nodes'))
const statusCodeOptions = computed(() => optionList('status_codes', 'All status codes'))

function buildQuery(source = appliedFilters.value, includePagination = true) {
  const query = { timezone, sort: sort.value }
  for (const [key, value] of Object.entries(source)) {
    if (value === '' || value == null) continue
    if (key === 'from' || key === 'to') query[key] = new Date(value).toISOString()
    else if (key === 'search' && appliedSearchField.value !== 'all') query[appliedSearchField.value] = value
    else query[key] = value
  }
  if (includePagination) { query.limit = pageSize; query.offset = (page.value - 1) * pageSize }
  return query
}
async function loadEvents(version) {
  const result = await fetchAPI('/request-events', { query: buildQuery() })
  if (disposed || version !== requestVersion) return
  response.value = result
  pendingNewEvents.value = 0
  lastUpdated.value = new Date()
  pageError.value = ''
  liveError.value = ''
}
async function loadFilterOptions(version) {
  const result = await fetchAPI('/request-events/filter-options', { query: buildQuery(appliedFilters.value, false) })
  if (!disposed && version === requestVersion) filterOptions.value = result
}
async function refreshEvents() {
  const version = ++requestVersion
  loading.value = true
  pageError.value = ''
  try {
    await Promise.all([loadEvents(version), loadFilterOptions(version)])
  } catch (error) {
    if (!disposed && version === requestVersion) pageError.value = errorMessage(error, 'Failed to load request events.')
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
function applyTimeRange(value) {
  if (value === 'custom') return
  const now = new Date()
  const start = new Date(now)
  if (value === 'today') start.setHours(0, 0, 0, 0)
  else if (value === 'yesterday') { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); now.setDate(now.getDate() - 1); now.setHours(23, 59, 0, 0) }
  else { const hours = value === '4h' ? 4 : value === '12h' ? 12 : value === '24h' ? 24 : value === '7d' ? 168 : value === '30d' ? 720 : 2160; start.setTime(now.getTime() - hours * 60 * 60 * 1000) }
  filters.value.from = toInputDateTime(start)
  filters.value.to = value === 'yesterday' ? toInputDateTime(now) : ''
}
async function applyFilters() { appliedSearchField.value = searchField.value; appliedFilters.value = { ...filters.value }; page.value = 1; pendingNewEvents.value = 0; await refreshEvents() }
async function resetFilters() { filters.value = defaultFilters(); appliedFilters.value = { ...filters.value }; searchField.value = 'all'; appliedSearchField.value = 'all'; timeRange.value = '24h'; advancedOpen.value = false; sort.value = 'timestamp_desc'; page.value = 1; pendingNewEvents.value = 0; await refreshEvents() }
async function changePage(delta) {
  const next = page.value + delta
  if (next < 1 || next > totalPages.value) return
  page.value = next
  await refreshEvents()
}
async function pollEvents() {
  if (polling || loading.value || detailOpen.value || exportOpen.value || !response.value) return
  const version = requestVersion
  polling = true
  try {
    const result = await fetchAPI('/request-events', { query: { ...buildQuery(appliedFilters.value, false), limit: 1, offset: 0 } })
    if (disposed || version !== requestVersion || !liveRefresh.value) return
    pendingNewEvents.value = Math.max(0, (Number(result?.total) || 0) - total.value)
    liveError.value = ''
  } catch (error) {
    if (!disposed && version === requestVersion && liveRefresh.value) liveError.value = errorMessage(error, 'Live refresh failed.')
  } finally { polling = false }
}
async function openDetail(event) {
  if (!event?.id) return
  pageError.value = ''
  detailOpen.value = true
  detailLoading.value = true
  selectedDetail.value = null
  detailDownloadError.value = ''
  try { selectedDetail.value = await fetchAPI(`/request-events/${encodeURIComponent(event.id)}`, { query: { include_payload: true, include_logs: true } }); pageError.value = '' } catch (error) { detailOpen.value = false; pageError.value = errorMessage(error, 'Failed to load event details.') } finally { detailLoading.value = false }
}
async function downloadRequestLog(downloadUrl, requestId) {
  if (!downloadUrl || downloadingId.value) return
  detailDownloadError.value = ''
  downloadingId.value = requestId || downloadUrl
  try { const blob = await fetchAPI(downloadUrl, { responseType: 'blob' }); downloadBlob(blob, `${requestId || 'request'}.log`) } catch (error) { pageError.value = errorMessage(error, 'Failed to download the request log.'); detailDownloadError.value = pageError.value } finally { downloadingId.value = '' }
}
async function exportEvents() {
  if (exporting.value || !canExport.value) return
  const version = ++exportVersion
  const format = exportFormat.value
  exporting.value = true
  pageError.value = ''
  try {
    const blob = await fetchAPI('/request-events/export', { query: { ...buildQuery(appliedFilters.value, false), format }, responseType: 'blob', signal: exportController.signal })
    if (disposed || version !== exportVersion) return
    downloadBlob(blob, `request-events.${format}`)
    exportOpen.value = false
  } catch (error) {
    if (disposed || version !== exportVersion) return
    if ([404, 405, 501].includes(error?.statusCode)) { exportUnavailable.value = true; exportOpen.value = false }
    else pageError.value = errorMessage(error, 'Failed to export request events.')
  } finally { if (!disposed && version === exportVersion) exporting.value = false }
}
function downloadBlob(blob, filename) { const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl) }
function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
  if (!liveRefresh.value) { liveError.value = ''; return }
  refreshTimer = setInterval(pollEvents, Number(refreshSeconds.value) * 1000)
}
function formatNumber(value) { return new Intl.NumberFormat().format(Number(value) || 0) }
function formatCompactNumber(value) { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0) }
function formatDecimal(value) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0) }
function formatMilliseconds(value) { return value == null ? '—' : `${formatNumber(value)} ms` }
function formatDateTime(value) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : '—' }
function formatAmount(amount, currency) { return amount == null ? '—' : `${formatDecimal(amount)} ${currency || 'credits'}` }
function formatStatus(event) { return `${event?.status || (event?.failed ? 'failed' : 'success')}${event?.status_code ? ` (${event.status_code})` : ''}${event?.upstream_status_code && event.upstream_status_code !== event.status_code ? ` · upstream ${event.upstream_status_code}` : ''}` }
function errorMessage(error, fallback = 'Unexpected request error.') { return error?.data?.message || error?.data?.error || error?.message || fallback }

watch([liveRefresh, refreshSeconds], scheduleRefresh)
watch(sort, async () => { page.value = 1; pendingNewEvents.value = 0; await refreshEvents() })
useDataSync('admin:request-records:sync', refreshEvents)
watch(token, () => {
  exportVersion++
  exportController.abort()
  exportController = new AbortController()
  exportUnavailable.value = false
  exportOpen.value = false
  exporting.value = false
})
onMounted(() => { void refreshCapabilities().catch(() => {}); void refreshEvents() })
onBeforeUnmount(() => { disposed = true; exportVersion++; exportController.abort(); requestVersion++; loading.value = false; if (refreshTimer) clearInterval(refreshTimer) })
</script>
