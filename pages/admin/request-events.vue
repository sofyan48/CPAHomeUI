<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Request events</h1>
        <p class="mt-1 max-w-3xl text-sm text-[var(--ui-text-muted)]">
          Search persisted request activity, inspect redacted routing and billing details, and export the current result set.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-2 rounded-lg border border-[var(--ui-border)] px-3 py-2">
          <USwitch v-model="liveRefresh" size="sm" />
          <span class="text-sm">Live refresh</span>
          <USelect v-if="liveRefresh" v-model="refreshSeconds" :items="refreshOptions" value-key="value" label-key="label" size="sm" class="w-24" />
        </div>
        <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="loading" @click="refreshEvents">
          Refresh
        </UButton>
        <UButton color="primary" icon="i-heroicons-arrow-down-tray" @click="exportOpen = true">
          Export
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="pageError || liveError"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-triangle"
      title="Request events unavailable"
      :description="pageError || liveError"
    />

    <UCard>
      <form class="space-y-4" @submit.prevent="applyFilters">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <UFormField label="From"><UInput v-model="filters.from" type="datetime-local" class="w-full" /></UFormField>
          <UFormField label="To"><UInput v-model="filters.to" type="datetime-local" class="w-full" /></UFormField>
          <UFormField label="Event type"><USelect :model-value="filters.event_type || allOptionValue" @update:model-value="setSelectFilter('event_type', $event)" :items="eventTypeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Status"><USelect :model-value="filters.status || allOptionValue" @update:model-value="setSelectFilter('status', $event)" :items="statusOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Status code"><USelect :model-value="filters.status_code || allOptionValue" @update:model-value="setSelectFilter('status_code', $event)" :items="statusCodeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Search"><UInput v-model="filters.search" icon="i-heroicons-magnifying-glass" placeholder="Request, session, user, model..." class="w-full" /></UFormField>
          <UFormField label="Provider"><USelectMenu :model-value="filters.provider || allOptionValue" @update:model-value="setSelectFilter('provider', $event)" :items="providerOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Model"><USelectMenu :model-value="filters.model || allOptionValue" @update:model-value="setSelectFilter('model', $event)" :items="modelOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Home"><USelectMenu :model-value="filters.home_ip || allOptionValue" @update:model-value="setSelectFilter('home_ip', $event)" :items="homeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="CPA node"><USelectMenu :model-value="filters.cpa_node || allOptionValue" @update:model-value="setSelectFilter('cpa_node', $event)" :items="cpaOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Credential type"><USelect :model-value="filters.credential_type || allOptionValue" @update:model-value="setSelectFilter('credential_type', $event)" :items="credentialTypeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Sort"><USelect v-model="sort" :items="sortOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
        </div>

        <div v-if="advancedOpen" class="grid grid-cols-1 gap-4 border-t border-[var(--ui-border)] pt-4 md:grid-cols-2 xl:grid-cols-6">
          <UFormField label="Request ID"><UInput v-model="filters.request_id" class="w-full" /></UFormField>
          <UFormField label="Session ID"><UInput v-model="filters.session_id" class="w-full" /></UFormField>
          <UFormField label="Root session ID"><UInput v-model="filters.root_session_id" class="w-full" /></UFormField>
          <UFormField label="User"><UInput v-model="filters.user" placeholder="Username" class="w-full" /></UFormField>
          <UFormField label="Client key"><UInput v-model="filters.client_key" placeholder="Label or masked key" class="w-full" /></UFormField>
          <UFormField label="Credential ID"><UInput v-model="filters.credential_id" class="w-full" /></UFormField>
          <UFormField label="Auth index"><UInput v-model="filters.auth_index" class="w-full" /></UFormField>
          <UFormField label="Executor type"><UInput v-model="filters.executor_type" class="w-full" /></UFormField>
          <UFormField label="Endpoint"><UInput v-model="filters.endpoint" placeholder="/v1/chat/completions" class="w-full" /></UFormField>
          <UFormField label="Min latency (ms)"><UInput v-model="filters.min_latency_ms" type="number" min="0" class="w-full" /></UFormField>
          <UFormField label="Max latency (ms)"><UInput v-model="filters.max_latency_ms" type="number" min="0" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Min amount"><UInput v-model="filters.min_amount" type="number" min="0" step="0.000001" class="w-full" /></UFormField>
            <UFormField label="Max amount"><UInput v-model="filters.max_amount" type="number" min="0" step="0.000001" class="w-full" /></UFormField>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 border-t border-[var(--ui-border)] pt-4">
          <UButton type="submit" color="primary" :loading="loading">Apply filters</UButton>
          <UButton color="neutral" variant="ghost" @click="resetFilters">Reset</UButton>
          <UButton color="neutral" variant="ghost" :icon="advancedOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-adjustments-horizontal'" @click="advancedOpen = !advancedOpen">
            {{ advancedOpen ? 'Hide advanced' : 'Advanced filters' }}
          </UButton>
          <span class="ml-auto text-xs text-[var(--ui-text-muted)]">Times are interpreted in {{ timezone }}.</span>
        </div>
      </form>
    </UCard>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard>
        <p class="text-sm font-medium text-[var(--ui-text-muted)]">Matching events</p>
        <p class="mt-2 text-2xl font-bold">{{ formatNumber(total) }}</p>
        <p class="mt-1 text-xs text-[var(--ui-text-muted)]">Server-filtered total</p>
      </UCard>
      <UCard>
        <p class="text-sm font-medium text-[var(--ui-text-muted)]">Visible failures</p>
        <p class="mt-2 text-2xl font-bold">{{ formatNumber(visibleFailures) }}</p>
        <p class="mt-1 text-xs text-[var(--ui-text-muted)]">On this page</p>
      </UCard>
      <UCard>
        <p class="text-sm font-medium text-[var(--ui-text-muted)]">Visible tokens</p>
        <p class="mt-2 text-2xl font-bold">{{ formatCompactNumber(visibleTokens) }}</p>
        <p class="mt-1 text-xs text-[var(--ui-text-muted)]">On this page</p>
      </UCard>
      <UCard>
        <p class="text-sm font-medium text-[var(--ui-text-muted)]">Last update</p>
        <p class="mt-2 text-lg font-bold">{{ lastUpdated ? formatDateTime(lastUpdated) : 'Not loaded' }}</p>
        <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ liveRefresh ? `Auto-refresh every ${refreshSeconds}s` : 'Manual refresh' }}</p>
      </UCard>
    </div>

    <UCard :ui="{ body: { padding: '' } }">
      <template #header>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 class="font-semibold">Events</h2><p class="text-xs text-[var(--ui-text-muted)]">Showing {{ pageStart }}–{{ pageEnd }} of {{ formatNumber(total) }}</p></div>
          <div class="flex items-center gap-2">
            <UButton v-if="pendingNewEvents" size="sm" color="primary" variant="soft" :loading="loading" @click="refreshEvents">
              Show {{ formatNumber(pendingNewEvents) }} new {{ pendingNewEvents === 1 ? 'event' : 'events' }}
            </UButton>
            <UBadge v-if="liveRefresh" color="success" variant="subtle"><span class="mr-1 inline-block size-1.5 rounded-full bg-current" />Live</UBadge>
          </div>
        </div>
      </template>
      <UTable :columns="columns" :data="events" :loading="loading">
        <template #timestamp-cell="{ row }"><div class="min-w-40"><p class="text-sm font-medium">{{ formatDateTime(rowValue(row).timestamp) }}</p><p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).request_id || rowValue(row).id }}</p></div></template>
        <template #status-cell="{ row }"><div class="space-y-1"><div class="flex flex-wrap gap-1"><UBadge :color="rowValue(row).failed ? 'error' : 'success'" variant="subtle">{{ rowValue(row).failed ? 'Failed' : 'Success' }}</UBadge><UBadge color="neutral" variant="subtle">{{ rowValue(row).event_type || 'completion' }}</UBadge></div><p class="text-xs text-[var(--ui-text-muted)]">HTTP {{ rowValue(row).status_code || '—' }}<span v-if="rowValue(row).upstream_status_code && rowValue(row).upstream_status_code !== rowValue(row).status_code"> · upstream {{ rowValue(row).upstream_status_code }}</span></p></div></template>
        <template #model-cell="{ row }"><div class="min-w-44"><p class="font-medium">{{ rowValue(row).model || 'Unknown model' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).provider || 'Unknown provider' }} · {{ rowValue(row).endpoint || 'Unknown endpoint' }}</p><p v-if="rowValue(row).service_tier || rowValue(row).reasoning_effort" class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).service_tier || 'default tier' }}<span v-if="rowValue(row).reasoning_effort"> · {{ rowValue(row).reasoning_effort }} reasoning</span></p></div></template>
        <template #client-cell="{ row }"><div class="min-w-36"><p class="text-sm">{{ rowValue(row).client?.username || rowValue(row).client?.client_key_label || 'Unattributed' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).client?.client_key_masked || rowValue(row).client?.client_ip || 'No client details' }}</p></div></template>
        <template #runtime-cell="{ row }"><div class="min-w-36"><p class="text-sm">{{ rowValue(row).runtime?.cpa_label || rowValue(row).runtime?.cpa_node_id || 'Unknown CPA' }}</p><p class="font-mono text-xs text-[var(--ui-text-muted)]">Home {{ rowValue(row).runtime?.home_id || rowValue(row).runtime?.home_ip || '—' }}</p></div></template>
        <template #tokens-cell="{ row }"><div class="min-w-28 text-sm tabular-nums"><p class="font-semibold">{{ formatNumber(rowValue(row).tokens?.total_tokens) }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(rowValue(row).tokens?.input_tokens) }} in / {{ formatNumber(rowValue(row).tokens?.output_tokens) }} out</p></div></template>
        <template #performance-cell="{ row }"><div class="min-w-24 text-sm tabular-nums"><p>{{ formatMilliseconds(rowValue(row).performance?.latency_ms) }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).performance?.tps == null ? '—' : `${formatDecimal(rowValue(row).performance.tps)} TPS` }}</p></div></template>
        <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><UButton v-if="rowValue(row).related?.request_log?.download_url" size="sm" color="neutral" variant="ghost" icon="i-heroicons-arrow-down-tray" title="Download request log" :loading="downloadingId === rowValue(row).request_id" @click="downloadRequestLog(rowValue(row).related.request_log.download_url, rowValue(row).request_id)" /><UButton size="sm" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="openDetail(rowValue(row))">Details</UButton></div></template>
        <template #empty><div class="flex flex-col items-center justify-center py-14 text-center"><UIcon name="i-heroicons-list-bullet" class="mb-3 size-8 text-[var(--ui-text-muted)]" /><p class="font-medium">No request events found</p><p class="mt-1 text-sm text-[var(--ui-text-muted)]">Try a broader time range or fewer filters.</p></div></template>
      </UTable>
      <div class="flex flex-col gap-3 border-t border-[var(--ui-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-[var(--ui-text-muted)]">Page {{ page }} of {{ totalPages }}</p>
        <div class="flex items-center gap-2"><UButton size="sm" color="neutral" variant="outline" :disabled="page <= 1 || loading" @click="changePage(-1)">Previous</UButton><UButton size="sm" color="neutral" variant="outline" :disabled="page >= totalPages || loading" @click="changePage(1)">Next</UButton></div>
      </div>
    </UCard>

    <UModal v-model:open="detailOpen" title="Request event details" description="Redacted request, routing, token, performance, billing, and log metadata.">
      <template #body>
        <div v-if="detailLoading" class="py-12 text-center text-sm text-[var(--ui-text-muted)]">Loading event details…</div>
        <div v-else-if="selectedDetail" class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap gap-2"><UBadge :color="selectedDetail.event?.failed ? 'error' : 'success'" variant="subtle">{{ selectedDetail.event?.failed ? 'Failed' : 'Success' }}</UBadge><UBadge color="neutral" variant="subtle">{{ selectedDetail.event?.event_type || 'completion' }}</UBadge></div>
            <UButton v-if="selectedDetail.event?.related?.request_log?.download_url" color="neutral" variant="outline" icon="i-heroicons-arrow-down-tray" :loading="downloadingId === selectedDetail.event.request_id" @click="downloadRequestLog(selectedDetail.event.related.request_log.download_url, selectedDetail.event.request_id)">Download log</UButton>
          </div>
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="Event ID" :value="selectedDetail.event?.id" mono />
            <DetailItem label="Request ID" :value="selectedDetail.event?.request_id" mono />
            <DetailItem label="Timestamp" :value="formatDateTime(selectedDetail.event?.timestamp)" />
            <DetailItem label="HTTP status" :value="formatStatus(selectedDetail.event)" />
            <DetailItem label="Provider / Model" :value="`${selectedDetail.event?.provider || 'Unknown'} / ${selectedDetail.event?.model || 'Unknown'}`" />
            <DetailItem label="Original model / alias" :value="selectedDetail.event?.model_alias || selectedDetail.event?.original_model || '—'" />
            <DetailItem label="Endpoint" :value="selectedDetail.event?.endpoint" mono />
            <DetailItem label="Executor" :value="selectedDetail.event?.executor_type" />
            <DetailItem label="Service tier" :value="selectedDetail.event?.service_tier || '—'" />
            <DetailItem label="Reasoning effort" :value="selectedDetail.event?.reasoning_effort || '—'" />
            <DetailItem label="Session ID" :value="selectedDetail.event?.session_id || '—'" mono />
            <DetailItem label="Root session ID" :value="selectedDetail.event?.root_session_id || '—'" mono />
          </dl>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DetailSection title="Runtime" :items="runtimeDetails" />
            <DetailSection title="Credential" :items="credentialDetails" />
            <DetailSection title="Client" :items="clientDetails" />
          </div>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DetailSection title="Tokens" :items="tokenDetails" />
            <DetailSection title="Performance" :items="performanceDetails" />
            <DetailSection title="Billing" :items="billingDetails" />
          </div>
          <UAlert v-if="hasEventError" color="error" variant="subtle" icon="i-heroicons-exclamation-circle" title="Request error" :description="eventErrorText" />
          <div v-if="selectedDetail.payload_summary" class="rounded-lg border border-[var(--ui-border)] p-4"><p class="mb-3 text-sm font-semibold">Payload summary</p><pre class="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{{ prettyJSON(selectedDetail.payload_summary) }}</pre></div>
          <div v-if="selectedDetail.log_excerpt?.length" class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-4"><p class="mb-3 text-sm font-semibold">Redacted request log excerpt</p><pre class="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{{ selectedDetail.log_excerpt.join('\n') }}</pre></div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="exportOpen" title="Export request events" description="Exports up to 10,000 events matching the currently applied filters.">
      <template #body>
        <div class="space-y-5">
          <UFormField label="Format"><USelect v-model="exportFormat" :items="exportOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UAlert color="info" variant="subtle" icon="i-heroicons-shield-check" title="Secrets remain redacted" description="The server export uses flattened event fields and does not include raw client API keys or payload bodies." />
          <div class="flex justify-end gap-3"><UButton color="neutral" variant="ghost" @click="exportOpen = false">Cancel</UButton><UButton icon="i-heroicons-arrow-down-tray" :loading="exporting" @click="exportEvents">Download {{ exportFormat.toUpperCase() }}</UButton></div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
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
const sort = ref('timestamp_desc')
const page = ref(1)
const response = ref(null)
const filterOptions = ref(null)
const loading = ref(false)
const pageError = ref('')
const liveError = ref('')
const pendingNewEvents = ref(0)
let requestVersion = 0
let polling = false
let disposed = false
const advancedOpen = ref(false)
const lastUpdated = ref(null)
const liveRefresh = ref(false)
const refreshSeconds = ref('15')
let refreshTimer = null
const detailOpen = ref(false)
const detailLoading = ref(false)
const selectedDetail = ref(null)
const downloadingId = ref('')
const exportOpen = ref(false)
const exportFormat = ref('csv')
const exporting = ref(false)

const statusOptions = [{ label: 'All statuses', value: allOptionValue }, { label: 'Success', value: 'success' }, { label: 'Failed', value: 'failed' }]
const credentialTypeOptions = [{ label: 'All credential types', value: allOptionValue }, { label: 'OAuth', value: 'oauth' }, { label: 'API key', value: 'api_key' }, { label: 'Token', value: 'token' }]
const sortOptions = [
  { label: 'Newest first', value: 'timestamp_desc' }, { label: 'Oldest first', value: 'timestamp_asc' }, { label: 'Most tokens', value: 'tokens_desc' }, { label: 'Highest latency', value: 'latency_desc' }, { label: 'Highest cost', value: 'cost_desc' }, { label: 'Failures first', value: 'failed_first' }
]
const refreshOptions = [{ label: '5s', value: '5' }, { label: '15s', value: '15' }, { label: '30s', value: '30' }, { label: '60s', value: '60' }]
const exportOptions = [{ label: 'CSV spreadsheet', value: 'csv' }, { label: 'JSON Lines', value: 'jsonl' }]
const columns = [
  { accessorKey: 'timestamp', header: 'Time / Request' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'model', header: 'Provider / Model' }, { accessorKey: 'client', header: 'Client' }, { accessorKey: 'runtime', header: 'CPA / Home' }, { accessorKey: 'tokens', header: 'Tokens' }, { accessorKey: 'performance', header: 'Performance' }, { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
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
const detailEvent = computed(() => selectedDetail.value?.event || {})
const runtimeDetails = computed(() => detailMap(detailEvent.value.runtime, [['Home', 'home_id'], ['CPA label', 'cpa_label'], ['CPA node ID', 'cpa_node_id'], ['CPA address', 'cpa_ip']]))
const credentialDetails = computed(() => detailMap(detailEvent.value.credential, [['Type', 'credential_type'], ['Label', 'label'], ['Credential ID', 'credential_id'], ['Auth index', 'auth_index'], ['Provider', 'provider'], ['Key preview', 'api_key_preview']]))
const clientDetails = computed(() => detailMap(detailEvent.value.client, [['Username', 'username'], ['User ID', 'user_id'], ['Key label', 'client_key_label'], ['Masked key', 'client_key_masked'], ['Client IP', 'client_ip']]))
const tokenDetails = computed(() => detailMap(detailEvent.value.tokens, [['Input', 'input_tokens'], ['Output', 'output_tokens'], ['Reasoning', 'reasoning_tokens'], ['Cached', 'cached_tokens'], ['Cache read', 'cache_read_tokens'], ['Cache creation', 'cache_creation_tokens'], ['Total', 'total_tokens']], formatNumber))
const performanceDetails = computed(() => [
  { label: 'Latency', value: formatMilliseconds(detailEvent.value.performance?.latency_ms) }, { label: 'TTFT', value: formatMilliseconds(detailEvent.value.performance?.ttft_ms) }, { label: 'TPS', value: detailEvent.value.performance?.tps == null ? '—' : formatDecimal(detailEvent.value.performance.tps) }
])
const billingDetails = computed(() => [
  { label: 'Amount', value: formatAmount(detailEvent.value.billing?.amount, detailEvent.value.billing?.currency) }, { label: 'Charge ID', value: detailEvent.value.billing?.charge_id || '—' }, { label: 'Price rule', value: detailEvent.value.billing?.matched_price_rule || '—' }
])
const hasEventError = computed(() => Boolean(detailEvent.value.error?.message || detailEvent.value.error?.reason || detailEvent.value.error?.body_preview))
const eventErrorText = computed(() => detailEvent.value.error?.message || detailEvent.value.error?.body_preview || detailEvent.value.error?.reason || '')

function buildQuery(source = appliedFilters.value, includePagination = true) {
  const query = { timezone, sort: sort.value }
  for (const [key, value] of Object.entries(source)) {
    if (value === '' || value == null) continue
    if (key === 'from' || key === 'to') query[key] = new Date(value).toISOString()
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
async function applyFilters() { appliedFilters.value = { ...filters.value }; page.value = 1; pendingNewEvents.value = 0; await refreshEvents() }
async function resetFilters() { filters.value = defaultFilters(); appliedFilters.value = { ...filters.value }; sort.value = 'timestamp_desc'; page.value = 1; pendingNewEvents.value = 0; await refreshEvents() }
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
  try { selectedDetail.value = await fetchAPI(`/request-events/${encodeURIComponent(event.id)}`, { query: { include_payload: true, include_logs: true } }); pageError.value = '' } catch (error) { detailOpen.value = false; pageError.value = errorMessage(error, 'Failed to load event details.') } finally { detailLoading.value = false }
}
async function downloadRequestLog(downloadUrl, requestId) {
  if (!downloadUrl) return
  downloadingId.value = requestId || downloadUrl
  try { const blob = await fetchAPI(downloadUrl, { responseType: 'blob' }); downloadBlob(blob, `${requestId || 'request'}.log`) } catch (error) { pageError.value = errorMessage(error, 'Failed to download the request log.') } finally { downloadingId.value = '' }
}
async function exportEvents() {
  exporting.value = true
  pageError.value = ''
  try {
    const blob = await fetchAPI('/request-events/export', { query: { ...buildQuery(appliedFilters.value, false), format: exportFormat.value }, responseType: 'blob' })
    downloadBlob(blob, `request-events.${exportFormat.value}`)
    exportOpen.value = false
  } catch (error) { pageError.value = errorMessage(error, 'Failed to export request events.') } finally { exporting.value = false }
}
function downloadBlob(blob, filename) { const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl) }
function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
  if (!liveRefresh.value) { liveError.value = ''; return }
  refreshTimer = setInterval(pollEvents, Number(refreshSeconds.value) * 1000)
}
function detailMap(object, pairs, formatter = value => value == null || value === '' ? '—' : value) { return pairs.map(([label, key]) => ({ label, value: formatter(object?.[key]) })) }
function formatNumber(value) { return new Intl.NumberFormat().format(Number(value) || 0) }
function formatCompactNumber(value) { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0) }
function formatDecimal(value) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0) }
function formatMilliseconds(value) { return value == null ? '—' : `${formatNumber(value)} ms` }
function formatDateTime(value) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : '—' }
function formatAmount(amount, currency) { return amount == null ? '—' : `${formatDecimal(amount)} ${currency || 'credits'}` }
function formatStatus(event) { return `${event?.status || (event?.failed ? 'failed' : 'success')}${event?.status_code ? ` (${event.status_code})` : ''}${event?.upstream_status_code && event.upstream_status_code !== event.status_code ? ` · upstream ${event.upstream_status_code}` : ''}` }
function prettyJSON(value) { return JSON.stringify(value || {}, null, 2) }
function errorMessage(error, fallback = 'Unexpected request error.') { return error?.data?.message || error?.data?.error || error?.message || fallback }

watch([liveRefresh, refreshSeconds], scheduleRefresh)
watch(sort, async () => { page.value = 1; pendingNewEvents.value = 0; await refreshEvents() })
onMounted(refreshEvents)
onBeforeUnmount(() => { disposed = true; requestVersion++; if (refreshTimer) clearInterval(refreshTimer) })
</script>

<script>
export default {
  components: {
    DetailItem: {
      props: { label: String, value: [String, Number], mono: Boolean },
      template: `<div class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ label }}</dt><dd class="mt-1 break-words text-sm" :class="mono ? 'font-mono text-xs' : ''">{{ value === null || value === undefined || value === '' ? '—' : value }}</dd></div>`
    },
    DetailSection: {
      props: { title: String, items: Array },
      template: `<div class="rounded-lg border border-[var(--ui-border)] p-4"><p class="mb-3 text-sm font-semibold">{{ title }}</p><dl class="space-y-2"><div v-for="item in items" :key="item.label" class="flex items-start justify-between gap-4 text-sm"><dt class="text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="break-all text-right">{{ item.value }}</dd></div></dl></div>`
    }
  }
}
</script>
