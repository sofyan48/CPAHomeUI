<template>
  <div class="space-y-6">
    <AppPanelTabs :model-value="activeView" :items="usageTabs" label="Usage & Requests" @update:model-value="setView" />

    <AdminRequestRecords v-if="activeView === 'requests'" />

    <template v-else>
    <div
      v-if="errorMessage"
      class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
    >
      {{ errorMessage }}
    </div>

    <AppCard class="usage-filter-panel">
      <form @submit.prevent="applyFilters">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <UFormField label="Time range">
            <USelect v-model="rangePreset" :items="rangeOptions" value-key="value" label-key="label" class="w-full" @update:model-value="selectRange" />
          </UFormField>
          <UFormField label="Provider">
            <UInputMenu v-model="filters.provider" :items="providerSuggestions" create-item @create="filters.provider = $event.trim()" placeholder="Search providers..." class="w-full" />
          </UFormField>
          <UFormField label="Model">
            <UInputMenu v-model="filters.model" :items="modelSuggestions" create-item @create="filters.model = $event.trim()" placeholder="Search models..." class="w-full" />
          </UFormField>
        </div>

        <div v-if="rangePreset === 'custom'" class="mt-3 grid grid-cols-1 gap-3 border-t border-[var(--ui-border)] pt-3 sm:grid-cols-2">
          <UFormField label="Start date"><UInput v-model="filters.from" type="date" class="w-full" /></UFormField>
          <UFormField label="End date"><UInput v-model="filters.to" type="date" class="w-full" /></UFormField>
        </div>
        <div class="mt-3 border-t border-[var(--ui-border)] pt-3">
          <AppButton type="button" color="neutral" variant="ghost" size="sm" :icon="showAdvancedFilters ? 'i-tabler-chevron-up' : 'i-tabler-adjustments-horizontal'" :aria-expanded="showAdvancedFilters" @click="showAdvancedFilters = !showAdvancedFilters">{{ showAdvancedFilters ? 'Hide advanced' : 'Advanced filters' }}</AppButton>
        </div>
        <div v-if="showAdvancedFilters" class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <UFormField label="Credential type"><USelect :model-value="filters.credentialType || allOptionValue" @update:model-value="filters.credentialType = $event === allOptionValue ? '' : $event" :items="credentialTypeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Home node"><UInput v-model="filters.homeIp" placeholder="Home IP" class="w-full" /></UFormField>
          <UFormField label="Endpoint"><UInput v-model="filters.endpoint" placeholder="Endpoint" class="w-full" /></UFormField>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <AppButton type="submit" color="primary" :loading="loading">Apply filters</AppButton>
          <AppButton type="button" color="neutral" variant="ghost" @click="resetFilters">Reset</AppButton>

        </div>
      </form>
    </AppCard>

    <section>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AppCard v-for="metric in chartMetrics" :key="metric.label" :ui="{ body: 'p-0' }">
          <div class="flex items-start justify-between gap-3 px-4 pt-3"><div><p class="text-xs font-medium text-[var(--ui-text-muted)]">{{ metric.label }}</p><p class="mt-1 text-xl font-semibold tracking-tight">{{ metric.value }}</p></div><UIcon :name="metric.icon" class="mt-0.5 size-4 text-[var(--ui-text-muted)]" /></div>
          <AdminUsageSparkline :values="metric.points" :label="`${metric.label} trend`" class="px-2" :class="metric.color" />
          <p class="truncate border-t border-[var(--ui-border-muted)] px-4 py-2 text-[11px] text-[var(--ui-text-muted)]">{{ metric.hint }}</p>
        </AppCard>
        <AppCard>
          <div class="mb-3 flex items-center justify-between"><p class="text-xs font-medium text-[var(--ui-text-muted)]">System health</p><UIcon name="i-tabler-activity-heartbeat" class="size-4 text-[var(--ui-text-muted)]" /></div>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><dt class="text-[11px] text-[var(--ui-text-muted)]">RPM</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums">{{ formatDecimal(live.rpm) }}</dd></div>
            <div><dt class="text-[11px] text-[var(--ui-text-muted)]">TPM</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums">{{ formatCompactNumber(live.tpm) }}</dd></div>
            <div><dt class="text-[11px] text-[var(--ui-text-muted)]">Error rate</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums">{{ formatPercent(totals.error_rate) }}</dd></div>
            <div><dt class="text-[11px] text-[var(--ui-text-muted)]">P50 latency</dt><dd class="mt-0.5 text-sm font-semibold tabular-nums">{{ formatMilliseconds(live.p50_latency_ms) }}</dd></div>
          </dl>
        </AppCard>
      </div>
    </section>

    <div class="grid items-start gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)]">
      <AppCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div><h2 class="text-lg font-semibold">Token usage over time</h2><p class="text-xs text-[var(--ui-text-muted)]">Canonical token categories across the selected range.</p></div>
              <div class="flex items-center gap-2">
                <div class="inline-flex rounded-lg bg-[var(--ui-bg-muted)] p-1" role="group" aria-label="Chart overlay">
                  <AppButton v-for="option in chartOverlayOptions" :key="option.value" size="sm" color="neutral" :variant="chartOverlay === option.value ? 'solid' : 'ghost'" @click="chartOverlay = option.value">{{ option.label }}</AppButton>
                </div>
                <UBadge v-if="overviewTokenBreakdown" :color="tokenQualityColor(overviewTokenBreakdown.quality)" variant="subtle">{{ overviewTokenBreakdown.quality || 'unknown' }}</UBadge>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="series in tokenSeriesLegend" :key="series.label" class="inline-flex items-center gap-2 rounded-lg border border-[var(--ui-border)] px-3 py-1.5 text-xs font-medium">
                <span class="size-2.5 rounded-full" :style="{ backgroundColor: series.color }" />{{ series.label }}
              </span>
            </div>
          </div>
        </template>
        <div class="p-4"><AdminUsageTokenChart :points="trend" :overlay="chartOverlayValues" :overlay-type="chartOverlay" /></div>
      </AppCard>
      <AppCard :ui="{ body: 'p-0' }">
        <template #header><div><h2 class="text-sm font-semibold">Cost breakdown</h2><p class="text-xs text-[var(--ui-text-muted)]">{{ formatAmount(totals.total_amount, totals.currency) }} total · {{ formatAmount(totals.blended_cost_per_1m_tokens, totals.currency) }} / 1M tokens</p></div></template>
        <div v-if="costBreakdown.length" class="divide-y divide-[var(--ui-border-muted)] px-4"><div v-for="item in costBreakdown" :key="item.category" class="py-3"><div class="flex items-center justify-between gap-3 text-sm"><div><p class="font-medium">{{ item.category }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatCompactNumber(item.tokens) }} tokens · {{ item.billing_basis || 'unknown basis' }}</p></div><span class="whitespace-nowrap font-medium">{{ formatAmount(item.amount, totals.currency) }}</span></div><div class="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div class="h-full rounded-full bg-[var(--ui-primary)]" :style="{ width: `${Math.max(0, Math.min(100, Number(item.percentage) * 100))}%` }" /></div></div></div><p v-else class="p-6 text-center text-sm text-[var(--ui-text-muted)]">No cost breakdown is available.</p>
      </AppCard>
    </div>

    <div class="grid gap-3 lg:grid-cols-3">
      <AppCard v-for="ranking in rankingCards" :key="ranking.key" :ui="{ body: 'p-0' }"><template #header><div class="flex items-center justify-between"><h2 class="text-sm font-semibold">{{ ranking.label }}</h2><AppButton size="xs" color="neutral" variant="ghost" @click="openRanking(ranking.key)">View all</AppButton></div></template><ol v-if="ranking.items.length" class="divide-y divide-[var(--ui-border-muted)]"><li v-for="(item, index) in ranking.items" :key="item.id || item.label" class="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3"><span class="text-xs font-semibold text-[var(--ui-text-muted)]">{{ index + 1 }}</span><div class="min-w-0"><p class="truncate text-sm font-medium">{{ item.label || item.id || 'Unknown' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(item.request_count) }} requests</p></div><span class="whitespace-nowrap text-sm font-semibold">{{ formatAmount(item.total_amount, item.currency || totals.currency) }}</span></li></ol><p v-else class="px-4 py-6 text-center text-sm text-[var(--ui-text-muted)]">No ranking data.</p></AppCard>
    </div>

    <section>
      <AppCard :ui="{ body: 'p-0' }">
      <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3"><div><h2 class="text-sm font-semibold">Execution credential usage</h2><p class="text-xs text-[var(--ui-text-muted)]">Requests, tokens, spend, success, and latest activity by execution credential.</p></div><AppButton size="sm" color="neutral" variant="ghost" icon="i-tabler-refresh" :loading="credentialsLoading" @click="loadCredentialUsage" /></div>
      <AppTable :columns="credentialColumns" :data="credentialUsage" :loading="credentialsLoading" class="min-w-[980px]"><template #credential-cell="{ row }"><div class="min-w-48"><p class="truncate text-sm font-medium">{{ rowValue(row).label || rowValue(row).id || 'Unknown credential' }}</p><p class="truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).id }}</p></div></template><template #provider-cell="{ row }"><span class="text-sm">{{ rowValue(row).metadata?.provider || 'Unknown' }}</span></template><template #status-cell="{ row }"><div><UBadge :color="Number(rowValue(row).error_rate) > 0.05 ? 'warning' : 'success'" variant="subtle">{{ formatPercent(rowValue(row).success_rate) }} success</UBadge><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ formatNumber(rowValue(row).failed_count) }} failed</p></div></template><template #requests-cell="{ row }"><span class="tabular-nums">{{ formatNumber(rowValue(row).request_count) }}</span></template><template #tokens-cell="{ row }"><span class="tabular-nums">{{ formatCompactNumber(rowValue(row).total_tokens) }}</span></template><template #cost-cell="{ row }"><span class="whitespace-nowrap">{{ formatAmount(rowValue(row).total_amount, rowValue(row).currency || totals.currency) }}</span></template><template #lastUsed-cell="{ row }"><span class="whitespace-nowrap text-xs text-[var(--ui-text-muted)]">{{ formatDateTime(rowValue(row).last_used_at) }}</span></template><template #empty><div class="py-10 text-center text-sm text-[var(--ui-text-muted)]">No execution credential usage data.</div></template></AppTable>
      </AppCard>
    </section>

    <AppModal v-model:open="rankingOpen" title="Usage ranking" description="Aggregated usage for the selected dimension and metric." :ui="{ content: 'sm:max-w-6xl' }"><template #body><div class="space-y-4"><div class="grid gap-3 sm:grid-cols-3"><UFormField label="Group by"><USelect v-model="rankingGroup" :items="rankingGroupOptions" value-key="value" label-key="label" class="w-full" @update:model-value="loadRanking" /></UFormField><UFormField label="Metric"><USelect v-model="rankingMetric" :items="rankingMetricOptions" value-key="value" label-key="label" class="w-full" @update:model-value="loadRanking" /></UFormField><UFormField label="Rows"><USelect v-model="rankingLimit" :items="rankingLimitOptions" value-key="value" label-key="label" class="w-full" @update:model-value="loadRanking" /></UFormField></div><AppCard :ui="{ body: 'p-0' }"><AppTable :columns="rankingColumns" :data="rankingItems" :loading="rankingLoading" class="min-w-[980px]"><template #rank-cell="{ row }">{{ rankingItems.indexOf(rowValue(row)) + 1 }}</template><template #name-cell="{ row }"><div class="min-w-48"><p class="truncate font-medium">{{ rowValue(row).label || rowValue(row).id || 'Unknown' }}</p><p class="truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).id }}</p></div></template><template #amount-cell="{ row }">{{ formatAmount(rowValue(row).total_amount, rowValue(row).currency || totals.currency) }}</template><template #requests-cell="{ row }">{{ formatNumber(rowValue(row).request_count) }}</template><template #tokens-cell="{ row }">{{ formatCompactNumber(rowValue(row).total_tokens) }}</template><template #success-cell="{ row }">{{ formatPercent(rowValue(row).success_rate) }}</template><template #cache-cell="{ row }">{{ formatPercent(rowValue(row).cache_rate) }}</template><template #latency-cell="{ row }">{{ formatMilliseconds(rowValue(row).avg_latency_ms) }}</template></AppTable></AppCard></div></template></AppModal>

    <AppModal v-model:open="detailOpen" title="Usage record details" description="Redacted request, execution, token, and billing metadata.">
      <template #body>
        <div v-if="detailLoading" class="py-12 text-center text-sm text-[var(--ui-text-muted)]">Loading record details…</div>
        <div v-else-if="selectedDetail" class="space-y-5">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="Request ID" :value="selectedDetail.record?.request_id" mono />
            <DetailItem label="Upstream request ID" :value="selectedDetail.record?.upstream_request_id" mono />
            <DetailItem label="Timestamp" :value="formatDateTime(selectedDetail.record?.timestamp)" />
            <DetailItem label="Provider / Model" :value="`${selectedDetail.record?.provider || 'Unknown'} / ${selectedDetail.record?.model || 'Unknown'}`" />
            <DetailItem label="Endpoint" :value="selectedDetail.record?.endpoint" mono />
            <DetailItem label="Original model" :value="selectedDetail.record?.original_model" />
            <DetailItem label="Event / Source" :value="`${selectedDetail.record?.event_type || 'Unknown'} / ${selectedDetail.record?.source || 'Unknown'}`" />
            <DetailItem label="Service tier / Reasoning" :value="`${selectedDetail.record?.service_tier || 'default'} / ${selectedDetail.record?.reasoning_effort || 'default'}`" />
            <DetailItem label="Status" :value="`${selectedDetail.record?.status || 'Unknown'}${selectedDetail.record?.status_code ? ` (${selectedDetail.record.status_code})` : ''}`" />
            <DetailItem label="Latency" :value="formatMilliseconds(selectedDetail.record?.performance?.latency_ms)" />
            <DetailItem label="TTFT / Throughput" :value="`${formatMilliseconds(selectedDetail.record?.performance?.ttft_ms)} / ${formatTPS(selectedDetail.record?.performance?.tps)}`" />
            <DetailItem label="Total tokens" :value="formatNumber(selectedDetail.record?.tokens?.total_tokens)" />
            <DetailItem label="Charge" :value="formatAmount(selectedDetail.record?.billing?.amount, selectedDetail.record?.billing?.currency)" />
            <DetailItem label="User" :value="selectedDetail.record?.client?.username || 'Unattributed'" />
            <DetailItem label="Client key" :value="selectedDetail.record?.client?.api_key_label || selectedDetail.record?.client?.api_key_masked || 'Unattributed'" />
            <DetailItem label="Client IP" :value="selectedDetail.record?.client?.client_ip" mono />
            <DetailItem label="Session" :value="selectedDetail.record?.session_id" mono />
            <DetailItem label="Parent / Root session" :value="[selectedDetail.record?.parent_session_id, selectedDetail.record?.root_session_id].filter(Boolean).join(' / ')" mono />
            <DetailItem label="Credential" :value="selectedDetail.record?.credential?.label || selectedDetail.record?.credential?.credential_id || 'Unknown'" />
            <DetailItem label="Credential details" :value="credentialDetail(selectedDetail.record?.credential)" />
            <DetailItem label="Home" :value="formatHost(selectedDetail.record?.runtime?.home_ip, selectedDetail.record?.runtime?.home_port)" mono />
            <DetailItem label="CPA node" :value="selectedDetail.record?.runtime?.cpa_label || formatHost(selectedDetail.record?.runtime?.cpa_ip, selectedDetail.record?.runtime?.cpa_port)" mono />
          </div>

          <div v-if="selectedDetail.record?.token_breakdown" class="rounded-lg border border-[var(--ui-border)] p-4">
            <div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold">Token accounting</p><UBadge :color="tokenQualityColor(selectedDetail.record.token_breakdown.quality)" variant="subtle">{{ selectedDetail.record.token_breakdown.quality || 'unknown' }}</UBadge></div>
            <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DetailItem label="Input uncached" :value="formatNumber(selectedDetail.record.token_breakdown.input?.uncached_tokens)" />
              <DetailItem label="Cache read" :value="formatNumber(selectedDetail.record.token_breakdown.input?.cache_read_tokens)" />
              <DetailItem label="Cache write" :value="formatNumber(selectedDetail.record.token_breakdown.input?.cache_write_tokens)" />
              <DetailItem label="Output non-reasoning" :value="formatNumber(selectedDetail.record.token_breakdown.output?.non_reasoning_tokens)" />
              <DetailItem label="Output reasoning" :value="formatNumber(selectedDetail.record.token_breakdown.output?.reasoning_tokens)" />
              <DetailItem label="Unclassified" :value="formatNumber(selectedDetail.record.token_breakdown.unclassified_tokens)" />
              <DetailItem label="Schema" :value="selectedDetail.record.token_breakdown.schema_version" />
              <DetailItem label="Canonical total" :value="formatNumber(selectedDetail.record.token_breakdown.total_tokens)" />
            </div>
          </div>

          <div v-if="selectedDetail.record?.billing" class="rounded-lg border border-[var(--ui-border)] p-4">
            <p class="mb-3 text-sm font-semibold">Billing attribution</p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Charge ID" :value="selectedDetail.record.billing.charge_id" mono />
              <DetailItem label="Basis" :value="selectedDetail.record.billing.billing_basis" />
              <DetailItem label="Matched price rule" :value="selectedDetail.record.billing.matched_price_rule" mono />
              <DetailItem label="Balance change" :value="balanceChange(selectedDetail.record.billing)" />
            </div>
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
          <div v-if="selectedDetail.related?.request_log?.download_url" class="flex justify-end">
            <AppButton color="neutral" variant="outline" icon="i-tabler-download" :loading="downloadingLog" @click="downloadDetailLog">Download request log</AppButton>
          </div>
        </div>
        <div v-else class="py-10 text-center text-sm text-[var(--ui-text-muted)]">Record details are unavailable.</div>
      </template>
    </AppModal>
    </template>
  </div>
</template>

<script setup>
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useDataSync } from '~/composables/useDataSync'
const { fetchAPI } = useApi()
const route = useRoute()
const router = useRouter()
const allOptionValue = '__all__'
const activeView = computed(() => route.query.view === 'requests' ? 'requests' : 'overview')
const usageTabs = [{ label: 'Overview', value: 'overview' }, { label: 'Request records', value: 'requests' }]
const setView = async (view) => { await router.replace({ query: { ...route.query, view } }) }

const pageSize = ref(50)
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'


const dateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const datesForRange = (preset) => {
  const to = new Date()
  const from = new Date(to)
  if (preset === 'all') return { from: '', to: '' }
  if (preset === 'yesterday') {
    from.setDate(to.getDate() - 1)
    return { from: dateInputValue(from), to: dateInputValue(from) }
  }
  if (preset === 'month') from.setDate(1)
  if (preset === '7d') from.setDate(to.getDate() - 6)
  if (preset === '30d') from.setDate(to.getDate() - 29)
  return { from: dateInputValue(from), to: dateInputValue(to) }
}

const rangeOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This month', value: 'month' },
  { label: 'All time', value: 'all' },
  { label: 'Custom', value: 'custom' },
]
const rangePreset = ref('7d')
const showAdvancedFilters = ref(false)
const credentialTypeOptions = [{ label: 'All credential types', value: allOptionValue }, { label: 'OAuth', value: 'oauth' }, { label: 'API key', value: 'api_key' }, { label: 'Token', value: 'token' }]
const defaultFilters = () => ({
  ...datesForRange('7d'),
  provider: '',
  model: '',
  status: '',
  statusCode: '',
  requestId: '',
  user: '',
  clientKey: '',
  credentialId: '',
  credentialType: '',
  endpoint: '',
  homeIp: '',
  cpaNode: '',
  search: '',
})

const filters = ref(defaultFilters())
const appliedFilters = ref(defaultFilters())
const sort = ref('timestamp_desc')
const page = ref(1)
const overview = useWorkspaceState('admin:usage:overview', () => (null))
const recordsResponse = useWorkspaceState('admin:usage:recordsResponse', () => (null))
const overviewLoading = useWorkspaceState('admin:usage:overviewLoading', () => (false))
const recordsLoading = useWorkspaceState('admin:usage:recordsLoading', () => (false))
const errorMessage = useWorkspaceState('admin:usage:errorMessage', () => (''))
const detailOpen = ref(false)
const detailLoading = useWorkspaceState('admin:usage:detailLoading', () => (false))
const selectedDetail = useWorkspaceState('admin:usage:selectedDetail', () => (null))
const downloadingLog = useWorkspaceState('admin:usage:downloadingLog', () => (false))
const chartOverlay = ref('requests')
const chartOverlayOptions = [{ label: 'Requests', value: 'requests' }, { label: 'Spend', value: 'spend' }]
const rankingOpen = ref(false), rankingLoading = useWorkspaceState('admin:usage:rankingLoading', () => (false)), rankingItems = useWorkspaceState('admin:usage:rankingItems', () => ([])), rankingGroup = ref('user'), rankingMetric = ref('total_amount'), rankingLimit = ref(10)
const credentialUsage = useWorkspaceState('admin:usage:credentialUsage', () => ([])), credentialsLoading = useWorkspaceState('admin:usage:credentialsLoading', () => (false))

const statusOptions = [
  { label: 'All statuses', value: allOptionValue },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' },
]

const pageSizeOptions = [25, 50, 100, 200].map(value => ({ label: `${value} / page`, value }))

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
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } },
]

const loading = computed(() => overviewLoading.value || recordsLoading.value)
const totals = computed(() => overview.value?.totals || {})
const live = computed(() => overview.value?.live || {})
const trend = computed(() => Array.isArray(overview.value?.trend) ? overview.value.trend : [])
const overviewRange = computed(() => overview.value?.range || {})
const overviewTokenBreakdown = computed(() => totals.value?.token_breakdown || null)
const overviewTokenBuckets = computed(() => overviewTokenBreakdown.value ? [
  { label: 'Input uncached', value: overviewTokenBreakdown.value.input?.uncached_tokens },
  { label: 'Cache read', value: overviewTokenBreakdown.value.input?.cache_read_tokens },
  { label: 'Cache write', value: overviewTokenBreakdown.value.input?.cache_write_tokens },
  { label: 'Output non-reasoning', value: overviewTokenBreakdown.value.output?.non_reasoning_tokens },
  { label: 'Output reasoning', value: overviewTokenBreakdown.value.output?.reasoning_tokens },
  { label: 'Unclassified', value: overviewTokenBreakdown.value.unclassified_tokens }
] : [])
const costBreakdown = computed(() => Array.isArray(overview.value?.cost_breakdown) ? overview.value.cost_breakdown : [])
const top = computed(() => overview.value?.top || {})
const chartMetrics = computed(() => [
  { label: 'Total tokens', value: formatCompactNumber(totals.value.total_tokens), hint: `${formatCompactNumber(totals.value.input_tokens)} input · ${formatCompactNumber(totals.value.output_tokens)} output`, icon: 'i-tabler-database', color: 'text-blue-500', points: trend.value.map(point => Number(point.total_tokens) || 0) },
  { label: 'Spend', value: formatAmount(totals.value.total_amount, totals.value.currency), hint: `${formatAmount(totals.value.blended_cost_per_1m_tokens, totals.value.currency)} / 1M tokens`, icon: 'i-tabler-wallet', color: 'text-emerald-500', points: trend.value.map(point => Number(point.total_amount) || 0) },
  { label: 'Requests', value: formatNumber(totals.value.request_count), hint: `${formatNumber(totals.value.success_count)} successful · ${formatNumber(totals.value.failed_count)} failed`, icon: 'i-tabler-bolt', color: 'text-violet-500', points: trend.value.map(point => Number(point.request_count) || 0) }
])
const tokenSeriesLegend = [
  { label: 'Uncached input', color: '#65baf0' }, { label: 'Cache read', color: '#50c7bd' }, { label: 'Cache write', color: '#e8ae45' },
  { label: 'Regular output', color: '#6dcc91' }, { label: 'Reasoning', color: '#f49a45' }, { label: 'Unclassified', color: '#9aa6b2' }
]
const rankingCards = computed(() => [
  { key: 'user', label: 'User ranking', items: Array.isArray(top.value.users) ? top.value.users.slice(0, 3) : [] },
  { key: 'model', label: 'Model ranking', items: Array.isArray(top.value.models) ? top.value.models.slice(0, 3) : [] },
  { key: 'client_key', label: 'Client key ranking', items: Array.isArray(top.value.client_keys) ? top.value.client_keys.slice(0, 3) : [] }
])
const chartOverlayValues = computed(() => chartOverlay.value === 'requests' ? trend.value.map(point => Number(point.request_count) || 0) : chartOverlay.value === 'spend' ? trend.value.map(point => Number(point.total_amount) || 0) : [])
const rankingGroupOptions = [{ label: 'User', value: 'user' }, { label: 'Model', value: 'model' }, { label: 'Client key', value: 'client_key' }, { label: 'Execution credential', value: 'credential' }, { label: 'Provider', value: 'provider' }, { label: 'Endpoint', value: 'endpoint' }, { label: 'Home node', value: 'home_ip' }, { label: 'Executor', value: 'executor' }]
const rankingMetricOptions = [{ label: 'Spend', value: 'total_amount' }, { label: 'Requests', value: 'request_count' }, { label: 'Total tokens', value: 'total_tokens' }, { label: 'Failures', value: 'failed_count' }, { label: 'Average latency', value: 'avg_latency_ms' }, { label: 'P95 latency', value: 'p95_latency_ms' }]
const rankingLimitOptions = [{ label: 'Top 10', value: 10 }, { label: 'Top 50', value: 50 }]
const rankingColumns = [{ accessorKey: 'rank', header: '#' }, { accessorKey: 'name', header: 'Name' }, { accessorKey: 'amount', header: 'Spend' }, { accessorKey: 'requests', header: 'Requests' }, { accessorKey: 'tokens', header: 'Tokens' }, { accessorKey: 'success', header: 'Success' }, { accessorKey: 'cache', header: 'Cache rate' }, { accessorKey: 'latency', header: 'Avg latency' }]
const credentialColumns = [{ accessorKey: 'credential', header: 'Credential' }, { accessorKey: 'provider', header: 'Provider' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'requests', header: 'Requests' }, { accessorKey: 'tokens', header: 'Tokens' }, { accessorKey: 'cost', header: 'Cost' }, { accessorKey: 'lastUsed', header: 'Last used' }]
const records = computed(() => Array.isArray(recordsResponse.value?.items) ? recordsResponse.value.items : [])
const providerSuggestions = computed(() => [...new Set(records.value.map(item => item.provider).filter(Boolean))].sort())
const modelSuggestions = computed(() => [...new Set(records.value.map(item => item.model).filter(Boolean))].sort())
const recordsTotal = computed(() => Number(recordsResponse.value?.total) || 0)
const totalPages = computed(() => Math.max(1, Math.ceil(recordsTotal.value / pageSize.value)))
const pageStart = computed(() => recordsTotal.value === 0 ? 0 : ((page.value - 1) * pageSize.value) + 1)
const pageEnd = computed(() => Math.min(page.value * pageSize.value, recordsTotal.value))
const overviewScopeLabel = computed(() => {
  const source = appliedFilters.value
  const range = source.from || source.to ? `${source.from || 'Any start'} – ${source.to || 'Now'}` : 'All time'
  const extras = [
    source.provider && `Provider: ${source.provider}`,
    source.model && `Model: ${source.model}`,
    source.endpoint && `Endpoint: ${source.endpoint}`,
    source.homeIp && `Home IP: ${source.homeIp}`,
    source.credentialType && `Credential: ${source.credentialType}`,
  ].filter(Boolean)
  return [range, ...extras].join(' · ')
})
const recordScopeLabel = computed(() => {
  const source = appliedFilters.value
  const extras = [
    source.status && `Status: ${source.status}`,
    source.statusCode && `HTTP: ${source.statusCode}`,
    source.requestId && `Request ID: ${source.requestId}`,
    source.user && `User: ${source.user}`,
    source.clientKey && 'Client key filtered',
    source.credentialId && `Credential ID: ${source.credentialId}`,
    source.cpaNode && `CPA node: ${source.cpaNode}`,
    source.search && `Search: ${source.search}`,
  ].filter(Boolean)
  return extras.length ? `Records-only: ${extras.join(' · ')}` : 'No records-only filters'
})


const buildCommonParams = (source) => {
  const params = new URLSearchParams()
  if (source.from) params.set('from', source.from)
  if (source.to) params.set('to', source.to)
  if (timezone) params.set('timezone', timezone)
  if (source.provider.trim()) params.set('provider', source.provider.trim())
  if (source.model.trim()) params.set('model', source.model.trim())
  if (source.endpoint.trim()) params.set('endpoint', source.endpoint.trim())
  if (source.homeIp.trim()) params.set('home_ip', source.homeIp.trim())
  if (source.credentialType.trim()) params.set('credential_type', source.credentialType.trim())
  return params
}

const buildRecordParams = (source) => {
  const params = buildCommonParams(source)
  for (const [field, value] of Object.entries({
    status: source.status, status_code: source.statusCode, request_id: source.requestId,
    user: source.user, client_key: source.clientKey, credential_id: source.credentialId,
    cpa_node: source.cpaNode, search: source.search,
  })) {
    if (String(value).trim()) params.set(field, String(value).trim())
  }
  params.set('sort', sort.value)
  return params
}

const insightQuery = computed(() => buildCommonParams(appliedFilters.value).toString())
const exportQuery = computed(() => buildRecordParams(appliedFilters.value).toString())

const selectRange = (preset) => {
  if (preset !== 'custom') Object.assign(filters.value, datesForRange(preset))
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
    const params = buildRecordParams(appliedFilters.value)
    params.set('limit', String(pageSize.value))
    params.set('offset', String((page.value - 1) * pageSize.value))
    recordsResponse.value = await fetchAPI(`/usage/records?${params.toString()}`)
  } finally {
    recordsLoading.value = false
  }
}

const loadRanking = async () => {
  rankingLoading.value = true
  try { const response = await fetchAPI(`/usage/aggregates?${insightQuery.value}`, { query: { group_by: rankingGroup.value, metric: rankingMetric.value, limit: rankingLimit.value } }); rankingItems.value = response?.items || [] }
  catch (error) { errorMessage.value = apiErrorMessage(error, 'Failed to load usage ranking.') }
  finally { rankingLoading.value = false }
}
const openRanking = async (group) => { rankingGroup.value = group; rankingOpen.value = true; await loadRanking() }
const loadCredentialUsage = async () => {
  credentialsLoading.value = true
  try { const response = await fetchAPI(`/usage/aggregates?${insightQuery.value}`, { query: { group_by: 'credential', metric: 'request_count', limit: 50 } }); credentialUsage.value = response?.items || [] }
  catch (error) { errorMessage.value = apiErrorMessage(error, 'Failed to load execution credential usage.') }
  finally { credentialsLoading.value = false }
}

const refreshAll = async () => {
  errorMessage.value = ''
  try {
    await Promise.all([loadOverview(), loadRecords(), loadCredentialUsage()])
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to load usage observability data.')
  }
}

const changeRecordsView = async () => {
  page.value = 1
  await loadRecordsSafely()
}

const applyFilters = async () => {
  appliedFilters.value = { ...filters.value }
  page.value = 1
  await refreshAll()
}

const resetFilters = async () => {
  rangePreset.value = '7d'
  filters.value = defaultFilters()
  appliedFilters.value = defaultFilters()
  sort.value = 'timestamp_desc'
  showAdvancedFilters.value = false
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

const downloadDetailLog = async () => {
  const log = selectedDetail.value?.related?.request_log
  if (!log?.download_url) return
  downloadingLog.value = true
  errorMessage.value = ''
  try {
    const blob = await fetchAPI(log.download_url, { responseType: 'blob' })
    const objectURL = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectURL
    anchor.download = `${log.request_id || selectedDetail.value?.record?.request_id || 'request'}.log`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectURL)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to download the request log.')
  } finally {
    downloadingLog.value = false
  }
}

const rowValue = (row) => row?.original || row

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0)
const formatCompactNumber = (value) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
const formatDecimal = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0)
const formatPercent = (value) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format((Number(value) || 0) * 100)}%`
const formatMilliseconds = (value) => value === null || value === undefined ? '—' : `${formatNumber(value)} ms`
const formatTPS = value => value === null || value === undefined ? '—' : `${formatDecimal(value)} tok/s`
const tokenQualityColor = quality => quality === 'complete' ? 'success' : quality === 'partial' ? 'warning' : 'neutral'
const activityColor = status => status === 'healthy' ? 'bg-emerald-500' : status === 'degraded' ? 'bg-amber-500' : status === 'unavailable' ? 'bg-red-500' : 'bg-[var(--ui-bg-muted)]'
const credentialDetail = credential => credential ? [credential.credential_type, credential.provider, credential.source, credential.status, credential.api_key_preview].filter(Boolean).join(' · ') : 'Unknown'
const balanceChange = billing => billing?.balance_before == null && billing?.balance_after == null ? '—' : `${formatAmount(billing.balance_before, billing.currency)} → ${formatAmount(billing.balance_after, billing.currency)}`
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

useDataSync('admin:usage:sync', refreshAll)
onMounted(refreshAll)
</script>
