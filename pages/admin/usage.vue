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

    <UCard class="workbench-filter-panel">
      <form @submit.prevent="applyFilters">
        <div class="mb-3">
          <h2 class="text-sm font-semibold">Overview scope</h2>
          <p class="text-xs text-[var(--ui-text-muted)]">Time, provider, model, endpoint, and Home IP apply to headline metrics, charts, insights, and records.</p>
        </div>
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
        <div class="mt-4 border-t border-[var(--ui-border)] pt-4">
          <h2 class="text-sm font-semibold">Records only</h2>
          <p class="mb-3 text-xs text-[var(--ui-text-muted)]">These filters narrow records and export, not headline metrics, charts, or insights.</p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <UFormField label="Status">
              <USelect :model-value="filters.status || allOptionValue" @update:model-value="filters.status = $event === allOptionValue ? '' : $event" :items="statusOptions" value-key="value" label-key="label" class="w-full" />
            </UFormField>
            <UFormField label="Search">
              <UInput v-model="filters.search" placeholder="Request, user, key, node..." icon="i-heroicons-magnifying-glass-20-solid" class="w-full" />
            </UFormField>
          </div>
        </div>
        <div class="mt-4">
          <UButton type="button" color="neutral" variant="ghost" size="sm" :icon="showAdvancedFilters ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" :aria-expanded="showAdvancedFilters" @click="showAdvancedFilters = !showAdvancedFilters">
            {{ showAdvancedFilters ? 'Hide advanced filters' : 'Advanced filters' }}
          </UButton>
        </div>
        <div v-if="showAdvancedFilters" class="mt-3 space-y-4">
          <div>
            <p class="mb-2 text-xs font-semibold text-[var(--ui-text-muted)]">Overview scope</p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <UFormField label="From">
                <UInput v-model="filters.from" type="date" class="w-full" @update:model-value="rangePreset = 'custom'" />
              </UFormField>
              <UFormField label="To">
                <UInput v-model="filters.to" type="date" class="w-full" @update:model-value="rangePreset = 'custom'" />
              </UFormField>
              <UFormField label="Endpoint">
                <UInput v-model="filters.endpoint" placeholder="Endpoint" class="w-full" />
              </UFormField>
              <UFormField label="Home IP">
                <UInput v-model="filters.homeIp" placeholder="Home IP" class="w-full" />
              </UFormField>
            </div>
          </div>
          <div>
            <p class="mb-2 text-xs font-semibold text-[var(--ui-text-muted)]">Records only</p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <UFormField label="HTTP status code">
                <UInput v-model="filters.statusCode" type="number" min="1" placeholder="e.g. 429" class="w-full" />
              </UFormField>
              <UFormField label="Request ID">
                <UInput v-model="filters.requestId" placeholder="Exact request ID" class="w-full" />
              </UFormField>
              <UFormField label="User">
                <UInput v-model="filters.user" placeholder="Username" class="w-full" />
              </UFormField>
              <UFormField label="Client key">
                <UInput v-model="filters.clientKey" placeholder="Client key" class="w-full" />
              </UFormField>
              <UFormField label="Credential ID">
                <UInput v-model="filters.credentialId" placeholder="Credential ID" class="w-full" />
              </UFormField>
              <UFormField label="CPA node">
                <UInput v-model="filters.cpaNode" placeholder="CPA node" class="w-full" />
              </UFormField>
            </div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <UButton type="submit" color="primary" :loading="loading">Apply filters</UButton>
          <UButton type="button" color="neutral" variant="ghost" @click="resetFilters">Reset</UButton>
          <span class="ml-auto text-xs text-[var(--ui-text-muted)]">
            Times are interpreted by Home in {{ timezone }}. Date-only “To” includes the full selected day.
          </span>
        </div>
      </form>
    </UCard>

    <div>
      <h2 class="font-semibold">Overview</h2>
      <p class="text-xs text-[var(--ui-text-muted)]">Applied scope: {{ overviewScopeLabel }} · Records-only filters do not affect these totals or charts.</p>
    </div>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
            <p class="text-xs text-[var(--ui-text-muted)]">Recent {{ formatDuration(live.window_seconds) }} within the applied overview scope</p>
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

    <div class="grid gap-6 xl:grid-cols-2">
      <UCard>
        <template #header><div><h2 class="font-semibold">Token accounting</h2><p class="text-xs text-[var(--ui-text-muted)]">Canonical mutually-exclusive buckets for the selected overview range.</p></div></template>
        <div v-if="overviewTokenBreakdown" class="space-y-4"><div class="flex items-center justify-between"><span class="text-sm">Accounting quality</span><UBadge :color="tokenQualityColor(overviewTokenBreakdown.quality)" variant="subtle">{{ overviewTokenBreakdown.quality || 'unknown' }}</UBadge></div><div class="grid grid-cols-2 gap-3 sm:grid-cols-3"><div v-for="bucket in overviewTokenBuckets" :key="bucket.label" class="rounded-lg bg-[var(--ui-bg-muted)] p-3"><p class="text-xs text-[var(--ui-text-muted)]">{{ bucket.label }}</p><p class="mt-1 font-semibold">{{ formatCompactNumber(bucket.value) }}</p></div></div></div><p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">Canonical token accounting is unavailable.</p>
      </UCard>
      <UCard>
        <template #header><h2 class="font-semibold">Cost breakdown</h2></template>
        <div v-if="costBreakdown.length" class="space-y-3"><div v-for="item in costBreakdown" :key="item.category" class="flex items-center justify-between gap-3 text-sm"><div><p class="font-medium">{{ item.category }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatCompactNumber(item.tokens) }} tokens · {{ item.billing_basis || 'unknown basis' }}</p></div><span>{{ formatAmount(item.amount, totals.currency) }} · {{ formatPercent(item.percentage) }}</span></div></div><p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">Reliable cost splitting is unavailable; Home does not fabricate a breakdown.</p>
      </UCard>
      <UCard>
        <template #header><h2 class="font-semibold">Model efficiency</h2></template>
        <div v-if="modelEfficiency.length" class="space-y-3"><div v-for="item in modelEfficiency.slice(0, 8)" :key="item.id || item.label" class="flex items-center justify-between gap-3 text-sm"><div class="min-w-0"><p class="truncate font-medium">{{ item.label || item.id }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(item.request_count) }} requests · p95 {{ formatMilliseconds(item.p95_latency_ms) }}</p></div><span>{{ formatCompactNumber(item.total_tokens) }} tok</span></div></div><p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No model efficiency data.</p>
      </UCard>
      <UCard>
        <template #header><h2 class="font-semibold">Activity health</h2></template>
        <div v-if="activity.length" class="grid grid-cols-8 gap-1 sm:grid-cols-12">
          <div v-for="point in activity" :key="point.bucket_start" class="aspect-square rounded-sm" :class="activityColor(point.status)" :title="`${formatDateTime(point.bucket_start)} · ${point.status} · ${formatNumber(point.request_count)} requests`" />
          <div class="col-span-full mt-3 flex flex-wrap gap-3 text-xs text-[var(--ui-text-muted)]">
            <span v-for="legend in activityLegend" :key="legend.status" class="flex items-center gap-1"><span class="size-2 rounded-sm" :class="activityColor(legend.status)" />{{ legend.label }}</span>
          </div>
        </div>
        <p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No activity buckets.</p>
      </UCard>
    </div>

    <UCard :ui="{ body: { padding: '' } }">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-semibold">Usage records</h2>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(recordsTotal) }} matching requests · Applied {{ recordScopeLabel }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <USelect v-model="sort" :items="sortOptions" value-key="value" label-key="label" class="w-full sm:w-52" @update:model-value="changeRecordsView" />
            <USelect v-model="pageSize" :items="pageSizeOptions" value-key="value" label-key="label" class="w-full sm:w-36" @update:model-value="changeRecordsView" />
          </div>
        </div>
      </template>

      <UTable :columns="recordColumns" :data="records" :loading="recordsLoading">
        <template #empty>
          <div class="flex flex-col items-center justify-center py-12">
            <UIcon name="i-heroicons-chart-bar-square" class="mb-3 size-8 text-[var(--ui-text-muted)]" />
            <span class="text-sm text-[var(--ui-text-muted)]">No usage records match these filters.</span>
          </div>
        </template>

        <template #timestamp-cell="{ row }">
          <div class="min-w-32">
            <p class="text-sm font-medium">{{ formatDateTime(rowValue(row).timestamp) }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).request_id || 'No request ID' }}</p>
          </div>
        </template>

        <template #status-cell="{ row }">
          <div class="space-y-1">
            <UBadge :color="rowValue(row).failed ? 'error' : 'success'" variant="subtle" size="sm">
              {{ rowValue(row).failed ? 'Failed' : 'Success' }}
            </UBadge>
            <p v-if="rowValue(row).status_code" class="text-xs text-[var(--ui-text-muted)]">
              HTTP {{ rowValue(row).status_code }}
            </p>
          </div>
        </template>

        <template #model-cell="{ row }">
          <div class="min-w-36">
            <p class="font-medium">{{ rowValue(row).model || 'Unknown model' }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ rowValue(row).provider || 'Unknown provider' }} · {{ rowValue(row).endpoint || 'Unknown endpoint' }}
            </p>
          </div>
        </template>

        <template #tokens-cell="{ row }">
          <div class="min-w-28 text-sm tabular-nums">
            <p class="font-semibold">{{ formatNumber(rowValue(row).tokens?.total_tokens) }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ formatNumber(rowValue(row).tokens?.input_tokens) }} in / {{ formatNumber(rowValue(row).tokens?.output_tokens) }} out
            </p>
          </div>
        </template>

        <template #performance-cell="{ row }">
          <div class="min-w-24 text-sm tabular-nums">
            <p>{{ formatMilliseconds(rowValue(row).performance?.latency_ms) }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">TTFT {{ formatMilliseconds(rowValue(row).performance?.ttft_ms) }}</p>
          </div>
        </template>

        <template #client-cell="{ row }">
          <div class="min-w-32 text-sm">
            <p>{{ rowValue(row).client?.username || rowValue(row).client?.api_key_label || 'Unattributed' }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).runtime?.cpa_label || rowValue(row).runtime?.cpa_ip || rowValue(row).runtime?.home_ip || 'Unknown node' }}</p>
          </div>
        </template>

        <template #actions-cell="{ row }">
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
            <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-down-tray" :loading="downloadingLog" @click="downloadDetailLog">Download request log</UButton>
          </div>
        </div>
        <div v-else class="py-10 text-center text-sm text-[var(--ui-text-muted)]">Record details are unavailable.</div>
      </template>
    </UModal>
    <UsageInsights :common-query="insightQuery" :record-query="exportQuery" />
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const allOptionValue = '__all__'

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
  endpoint: '',
  homeIp: '',
  cpaNode: '',
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
const downloadingLog = ref(false)

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
  { accessorKey: 'actions', header: '' },
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
const modelEfficiency = computed(() => Array.isArray(overview.value?.model_efficiency) ? overview.value.model_efficiency : [])
const activity = computed(() => Array.isArray(overview.value?.activity) ? overview.value.activity.slice(-96) : [])
const activityLegend = [{ status: 'healthy', label: 'Healthy' }, { status: 'degraded', label: 'Degraded' }, { status: 'unavailable', label: 'Unavailable' }, { status: 'empty', label: 'No requests' }]
const displayedTrend = computed(() => {
  const points = trend.value
  if (points.length <= 16) return points
  const stride = Math.ceil(points.length / 16)
  return points.filter((_, index) => index % stride === 0 || index === points.length - 1)
})
const maxTrendRequests = computed(() => Math.max(1, ...displayedTrend.value.map((point) => Number(point.request_count) || 0)))
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
  if (source.endpoint.trim()) params.set('endpoint', source.endpoint.trim())
  if (source.homeIp.trim()) params.set('home_ip', source.homeIp.trim())
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
  if (preset === 'custom') showAdvancedFilters.value = true
  else Object.assign(filters.value, datesForRange(preset))
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

const refreshAll = async () => {
  errorMessage.value = ''
  try {
    await Promise.all([loadOverview(), loadRecords()])
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
const trendWidth = (count) => Math.max(2, Math.round(((Number(count) || 0) / maxTrendRequests.value) * 100))

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
