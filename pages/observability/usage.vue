<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">Usage</h1>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">
          Request volume, token consumption, latency, and billing attribution from persisted usage records.
        </p>
      </div>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-heroicons-arrow-path"
        :loading="loading"
        @click="refreshAll"
      >
        Refresh
      </UButton>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
    >
      {{ errorMessage }}
    </div>

    <UCard>
      <form class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6" @submit.prevent="applyFilters">
        <UFormField label="From">
          <UInput v-model="filters.from" type="date" class="w-full" />
        </UFormField>
        <UFormField label="To">
          <UInput v-model="filters.to" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Provider">
          <UInput v-model="filters.provider" placeholder="e.g. openai" class="w-full" />
        </UFormField>
        <UFormField label="Model">
          <UInput v-model="filters.model" placeholder="Contains model name" class="w-full" />
        </UFormField>
        <UFormField label="Status">
          <USelect v-model="filters.status" :options="statusOptions" class="w-full" />
        </UFormField>
        <UFormField label="Search">
          <UInput
            v-model="filters.search"
            placeholder="Request, user, key, node..."
            icon="i-heroicons-magnifying-glass-20-solid"
            class="w-full"
          />
        </UFormField>
        <div class="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6">
          <UButton type="submit" color="primary" :loading="loading">Apply filters</UButton>
          <UButton color="neutral" variant="ghost" @click="resetFilters">Reset</UButton>
          <span class="ml-auto text-xs text-[var(--ui-text-muted)]">
            Times are interpreted by Home in {{ timezone }}. Date-only “To” includes the full selected day.
          </span>
        </div>
      </form>
    </UCard>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="metric in metrics" :key="metric.label">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-[var(--ui-text-muted)]">{{ metric.label }}</p>
            <p class="mt-2 text-2xl font-bold tracking-tight">{{ metric.value }}</p>
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ metric.hint }}</p>
          </div>
          <div class="rounded-lg bg-[var(--ui-bg-elevated)] p-2 text-[var(--ui-text-muted)]">
            <UIcon :name="metric.icon" class="size-5" />
          </div>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <UCard class="xl:col-span-2">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold">Request activity</h2>
              <p class="text-xs text-[var(--ui-text-muted)]">Server-selected {{ overviewRange.interval || 'auto' }} buckets</p>
            </div>
            <span class="text-xs text-[var(--ui-text-muted)]">{{ formatRange(overviewRange.from, overviewRange.to) }}</span>
          </div>
        </template>

        <div v-if="trend.length" class="space-y-3">
          <div
            v-for="point in displayedTrend"
            :key="point.bucket_start"
            class="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm"
          >
            <span class="text-xs text-[var(--ui-text-muted)]">{{ formatTrendTime(point.bucket_start) }}</span>
            <div class="h-2 overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
              <div
                class="h-full rounded-full bg-[var(--ui-primary)] transition-all"
                :style="{ width: `${trendWidth(point.request_count)}%` }"
              />
            </div>
            <span class="min-w-12 text-right font-medium tabular-nums">{{ formatNumber(point.request_count) }}</span>
          </div>
        </div>
        <div v-else class="py-10 text-center text-sm text-[var(--ui-text-muted)]">
          No activity in the selected range.
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold">Live snapshot</h2>
            <p class="text-xs text-[var(--ui-text-muted)]">Recent {{ formatDuration(live.window_seconds) }} window</p>
          </div>
        </template>
        <dl class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <dt class="text-sm text-[var(--ui-text-muted)]">Requests / min</dt>
            <dd class="font-semibold tabular-nums">{{ formatDecimal(live.rpm) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-sm text-[var(--ui-text-muted)]">Tokens / min</dt>
            <dd class="font-semibold tabular-nums">{{ formatNumber(live.tpm) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-sm text-[var(--ui-text-muted)]">Success rate</dt>
            <dd class="font-semibold tabular-nums">{{ formatPercent(live.success_rate) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-sm text-[var(--ui-text-muted)]">P50 latency</dt>
            <dd class="font-semibold tabular-nums">{{ formatMilliseconds(live.p50_latency_ms) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-sm text-[var(--ui-text-muted)]">P95 latency</dt>
            <dd class="font-semibold tabular-nums">{{ formatMilliseconds(live.p95_latency_ms) }}</dd>
          </div>
        </dl>
      </UCard>
    </div>

    <UCard :ui="{ body: { padding: '' } }">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-semibold">Usage records</h2>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(recordsTotal) }} matching requests</p>
          </div>
          <USelect v-model="sort" :options="sortOptions" class="w-full sm:w-52" @change="applyFilters" />
        </div>
      </template>

      <UTable :columns="recordColumns" :data="records" :loading="recordsLoading">
        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12">
            <UIcon name="i-heroicons-chart-bar-square" class="mb-3 size-8 text-[var(--ui-text-muted)]" />
            <span class="text-sm text-[var(--ui-text-muted)]">No usage records match these filters.</span>
          </div>
        </template>

        <template #timestamp-data="{ row }">
          <div class="min-w-32">
            <p class="text-sm font-medium">{{ formatDateTime(rowValue(row).timestamp) }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).request_id || 'No request ID' }}</p>
          </div>
        </template>

        <template #status-data="{ row }">
          <div class="space-y-1">
            <UBadge :color="rowValue(row).failed ? 'error' : 'success'" variant="subtle" size="sm">
              {{ rowValue(row).failed ? 'Failed' : 'Success' }}
            </UBadge>
            <p v-if="rowValue(row).status_code" class="text-xs text-[var(--ui-text-muted)]">
              HTTP {{ rowValue(row).status_code }}
            </p>
          </div>
        </template>

        <template #model-data="{ row }">
          <div class="min-w-36">
            <p class="font-medium">{{ rowValue(row).model || 'Unknown model' }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ rowValue(row).provider || 'Unknown provider' }} · {{ rowValue(row).endpoint || 'Unknown endpoint' }}
            </p>
          </div>
        </template>

        <template #tokens-data="{ row }">
          <div class="min-w-28 text-sm tabular-nums">
            <p class="font-semibold">{{ formatNumber(rowValue(row).tokens?.total_tokens) }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ formatNumber(rowValue(row).tokens?.input_tokens) }} in / {{ formatNumber(rowValue(row).tokens?.output_tokens) }} out
            </p>
          </div>
        </template>

        <template #performance-data="{ row }">
          <div class="min-w-24 text-sm tabular-nums">
            <p>{{ formatMilliseconds(rowValue(row).performance?.latency_ms) }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">TTFT {{ formatMilliseconds(rowValue(row).performance?.ttft_ms) }}</p>
          </div>
        </template>

        <template #client-data="{ row }">
          <div class="min-w-32 text-sm">
            <p>{{ rowValue(row).client?.username || rowValue(row).client?.api_key_label || 'Unattributed' }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).runtime?.cpa_label || rowValue(row).runtime?.cpa_ip || rowValue(row).runtime?.home_ip || 'Unknown node' }}</p>
          </div>
        </template>

        <template #actions-data="{ row }">
          <div class="flex justify-end">
            <UButton size="sm" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="openDetail(rowValue(row))">
              Details
            </UButton>
          </div>
        </template>
      </UTable>

      <div class="flex flex-col gap-3 border-t border-[var(--ui-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-[var(--ui-text-muted)]">
          Showing {{ pageStart }}–{{ pageEnd }} of {{ formatNumber(recordsTotal) }}
        </p>
        <div class="flex items-center gap-2">
          <UButton size="sm" color="neutral" variant="outline" :disabled="page === 1 || recordsLoading" @click="previousPage">
            Previous
          </UButton>
          <span class="min-w-20 text-center text-sm">Page {{ page }} of {{ totalPages }}</span>
          <UButton size="sm" color="neutral" variant="outline" :disabled="page >= totalPages || recordsLoading" @click="nextPage">
            Next
          </UButton>
        </div>
      </div>
    </UCard>

    <UModal v-model:open="detailOpen" title="Usage record details" description="Redacted request, execution, token, and billing metadata.">
      <template #body>
        <div v-if="detailLoading" class="py-12 text-center text-sm text-[var(--ui-text-muted)]">Loading record details…</div>
        <div v-else-if="selectedDetail" class="space-y-5">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="Request ID" :value="selectedDetail.record?.request_id" mono />
            <DetailItem label="Timestamp" :value="formatDateTime(selectedDetail.record?.timestamp)" />
            <DetailItem label="Provider / Model" :value="`${selectedDetail.record?.provider || 'Unknown'} / ${selectedDetail.record?.model || 'Unknown'}`" />
            <DetailItem label="Endpoint" :value="selectedDetail.record?.endpoint" mono />
            <DetailItem label="Status" :value="`${selectedDetail.record?.status || 'Unknown'}${selectedDetail.record?.status_code ? ` (${selectedDetail.record.status_code})` : ''}`" />
            <DetailItem label="Latency" :value="formatMilliseconds(selectedDetail.record?.performance?.latency_ms)" />
            <DetailItem label="Total tokens" :value="formatNumber(selectedDetail.record?.tokens?.total_tokens)" />
            <DetailItem label="Charge" :value="formatAmount(selectedDetail.record?.billing?.amount, selectedDetail.record?.billing?.currency)" />
            <DetailItem label="User" :value="selectedDetail.record?.client?.username || 'Unattributed'" />
            <DetailItem label="Credential" :value="selectedDetail.record?.credential?.label || selectedDetail.record?.credential?.credential_id || 'Unknown'" />
            <DetailItem label="Home" :value="formatHost(selectedDetail.record?.runtime?.home_ip, selectedDetail.record?.runtime?.home_port)" mono />
            <DetailItem label="CPA node" :value="selectedDetail.record?.runtime?.cpa_label || formatHost(selectedDetail.record?.runtime?.cpa_ip, selectedDetail.record?.runtime?.cpa_port)" mono />
          </div>

          <div v-if="selectedDetail.record?.error" class="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p class="text-sm font-semibold text-red-600 dark:text-red-400">Request error</p>
            <p class="mt-1 whitespace-pre-wrap text-sm">{{ selectedDetail.record.error.message || selectedDetail.record.error.body_preview || 'No error details available.' }}</p>
          </div>

          <div v-if="selectedDetail.payload_summary" class="rounded-lg border border-[var(--ui-border)] p-4">
            <p class="mb-3 text-sm font-semibold">Payload summary</p>
            <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <DetailItem label="Method" :value="selectedDetail.payload_summary.method" />
              <DetailItem label="Streaming" :value="formatBoolean(selectedDetail.payload_summary.stream)" />
              <DetailItem label="Messages" :value="formatNumber(selectedDetail.payload_summary.message_count)" />
              <DetailItem label="Tools" :value="formatNumber(selectedDetail.payload_summary.tool_count)" />
            </div>
          </div>

          <div v-if="selectedDetail.log_excerpt?.length" class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-4">
            <p class="mb-3 text-sm font-semibold">Request log excerpt</p>
            <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{{ selectedDetail.log_excerpt.join('\n') }}</pre>
          </div>
        </div>
        <div v-else class="py-10 text-center text-sm text-[var(--ui-text-muted)]">Record details are unavailable.</div>
      </template>
    </UModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()

const pageSize = 50
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const today = new Date()
const sevenDaysAgo = new Date(today)
sevenDaysAgo.setDate(today.getDate() - 6)

const dateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const defaultFilters = () => ({
  from: dateInputValue(sevenDaysAgo),
  to: dateInputValue(today),
  provider: '',
  model: '',
  status: '',
  search: '',
})

const filters = ref(defaultFilters())
const appliedFilters = ref(defaultFilters())
const sort = ref('timestamp_desc')
const page = ref(1)
const overview = ref(null)
const recordsResponse = ref(null)
const overviewLoading = ref(false)
const recordsLoading = ref(false)
const errorMessage = ref('')
const detailOpen = ref(false)
const detailLoading = ref(false)
const selectedDetail = ref(null)

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' },
]

const sortOptions = [
  { label: 'Newest first', value: 'timestamp_desc' },
  { label: 'Oldest first', value: 'timestamp_asc' },
  { label: 'Most tokens', value: 'tokens_desc' },
  { label: 'Highest latency', value: 'latency_desc' },
  { label: 'Highest cost', value: 'cost_desc' },
  { label: 'Failures first', value: 'failed_first' },
]

const recordColumns = [
  { accessorKey: 'timestamp', header: 'Request' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'model', header: 'Provider / Model' },
  { accessorKey: 'tokens', header: 'Tokens' },
  { accessorKey: 'performance', header: 'Performance' },
  { accessorKey: 'client', header: 'Client / Node' },
  { accessorKey: 'actions', header: '' },
]

const loading = computed(() => overviewLoading.value || recordsLoading.value)
const totals = computed(() => overview.value?.totals || {})
const live = computed(() => overview.value?.live || {})
const trend = computed(() => Array.isArray(overview.value?.trend) ? overview.value.trend : [])
const overviewRange = computed(() => overview.value?.range || {})
const displayedTrend = computed(() => {
  const points = trend.value
  if (points.length <= 16) return points
  const stride = Math.ceil(points.length / 16)
  return points.filter((_, index) => index % stride === 0 || index === points.length - 1)
})
const maxTrendRequests = computed(() => Math.max(1, ...displayedTrend.value.map((point) => Number(point.request_count) || 0)))
const records = computed(() => Array.isArray(recordsResponse.value?.items) ? recordsResponse.value.items : [])
const recordsTotal = computed(() => Number(recordsResponse.value?.total) || 0)
const totalPages = computed(() => Math.max(1, Math.ceil(recordsTotal.value / pageSize)))
const pageStart = computed(() => recordsTotal.value === 0 ? 0 : ((page.value - 1) * pageSize) + 1)
const pageEnd = computed(() => Math.min(page.value * pageSize, recordsTotal.value))

const metrics = computed(() => [
  {
    label: 'Requests',
    value: formatNumber(totals.value.request_count),
    hint: `${formatNumber(totals.value.success_count)} successful · ${formatNumber(totals.value.failed_count)} failed`,
    icon: 'i-heroicons-bolt',
  },
  {
    label: 'Total tokens',
    value: formatCompactNumber(totals.value.total_tokens),
    hint: `${formatCompactNumber(totals.value.input_tokens)} input · ${formatCompactNumber(totals.value.output_tokens)} output`,
    icon: 'i-heroicons-circle-stack',
  },
  {
    label: 'Success rate',
    value: formatPercent(totals.value.success_rate),
    hint: `${formatPercent(totals.value.error_rate)} error rate`,
    icon: 'i-heroicons-check-circle',
  },
  {
    label: 'P95 latency',
    value: formatMilliseconds(totals.value.p95_latency_ms),
    hint: `${formatMilliseconds(totals.value.avg_latency_ms)} average`,
    icon: 'i-heroicons-clock',
  },
])

const buildCommonParams = (source) => {
  const params = new URLSearchParams()
  if (source.from) params.set('from', source.from)
  if (source.to) params.set('to', source.to)
  if (timezone) params.set('timezone', timezone)
  if (source.provider.trim()) params.set('provider', source.provider.trim())
  if (source.model.trim()) params.set('model', source.model.trim())
  return params
}

const loadOverview = async () => {
  overviewLoading.value = true
  try {
    const params = buildCommonParams(appliedFilters.value)
    params.set('interval', 'auto')
    overview.value = await fetchAPI(`/usage/overview?${params.toString()}`)
  } finally {
    overviewLoading.value = false
  }
}

const loadRecords = async () => {
  recordsLoading.value = true
  try {
    const params = buildCommonParams(appliedFilters.value)
    if (appliedFilters.value.status) params.set('status', appliedFilters.value.status)
    if (appliedFilters.value.search.trim()) params.set('search', appliedFilters.value.search.trim())
    params.set('limit', String(pageSize))
    params.set('offset', String((page.value - 1) * pageSize))
    params.set('sort', sort.value)
    recordsResponse.value = await fetchAPI(`/usage/records?${params.toString()}`)
  } finally {
    recordsLoading.value = false
  }
}

const refreshAll = async () => {
  errorMessage.value = ''
  try {
    await Promise.all([loadOverview(), loadRecords()])
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to load usage observability data.')
  }
}

const applyFilters = async () => {
  appliedFilters.value = { ...filters.value }
  page.value = 1
  await refreshAll()
}

const resetFilters = async () => {
  filters.value = defaultFilters()
  appliedFilters.value = defaultFilters()
  sort.value = 'timestamp_desc'
  page.value = 1
  await refreshAll()
}

const previousPage = async () => {
  if (page.value <= 1) return
  page.value -= 1
  await loadRecordsSafely()
}

const nextPage = async () => {
  if (page.value >= totalPages.value) return
  page.value += 1
  await loadRecordsSafely()
}

const loadRecordsSafely = async () => {
  errorMessage.value = ''
  try {
    await loadRecords()
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to load usage records.')
  }
}

const openDetail = async (record) => {
  if (!record?.id) return
  detailOpen.value = true
  detailLoading.value = true
  selectedDetail.value = null
  errorMessage.value = ''
  try {
    selectedDetail.value = await fetchAPI(`/usage/records/${encodeURIComponent(record.id)}?include_payload=true&include_logs=true`)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to load usage record details.')
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

const rowValue = (row) => row?.original || row
const trendWidth = (count) => Math.max(2, Math.round(((Number(count) || 0) / maxTrendRequests.value) * 100))

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0)
const formatCompactNumber = (value) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
const formatDecimal = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0)
const formatPercent = (value) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format((Number(value) || 0) * 100)}%`
const formatMilliseconds = (value) => value === null || value === undefined ? '—' : `${formatNumber(value)} ms`
const formatDuration = (seconds) => {
  const value = Number(seconds) || 0
  if (value >= 3600) return `${formatDecimal(value / 3600)}h`
  if (value >= 60) return `${formatDecimal(value / 60)}m`
  return `${value}s`
}
const formatDateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const formatTrendTime = (value) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'
const formatRange = (from, to) => from && to ? `${formatDateTime(from)} – ${formatDateTime(to)}` : 'Selected range'
const formatAmount = (amount, currency) => amount === null || amount === undefined ? '—' : `${formatDecimal(amount)} ${currency || 'credits'}`
const formatBoolean = (value) => value === null || value === undefined ? '—' : value ? 'Yes' : 'No'
const formatHost = (host, port) => host ? `${host}${port ? `:${port}` : ''}` : '—'

const apiErrorMessage = (error, fallback) => error?.data?.message || error?.data?.error || error?.message || fallback

onMounted(refreshAll)
</script>

<script>
export default {
  components: {
    DetailItem: {
      props: {
        label: String,
        value: [String, Number],
        mono: Boolean,
      },
      template: `
        <div class="min-w-0">
          <dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ label }}</dt>
          <dd class="mt-1 break-words text-sm" :class="mono ? 'font-mono text-xs' : ''">{{ value === null || value === undefined || value === '' ? '—' : value }}</dd>
        </div>
      `,
    },
  },
}
</script>
