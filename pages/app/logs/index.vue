<template>
  <div class="logs-workspace min-w-0 space-y-5">

    <UAlert v-if="unsupported" color="warning" variant="subtle" title="Request logs unavailable" description="This server does not support user request logs." />
    <UAlert v-else-if="error" color="error" variant="subtle" title="Could not load request logs" :description="errorMessage" />
    <AppCard class="logs-panel">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold"><UIcon name="i-tabler-adjustments-horizontal" class="size-4 text-[var(--ui-text-muted)]" aria-hidden="true" /> Filter requests</h2>
          <AppButton icon="i-tabler-refresh" color="neutral" variant="outline" size="sm" :loading="pending" @click="refresh">Refresh</AppButton>
        </div>
      </template>
      <form class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" @submit.prevent="applyFilters">
        <UFormField label="From" class="min-w-0"><UInput v-model="filters.from" type="datetime-local" class="w-full" :disabled="pending || unsupported" /></UFormField>
        <UFormField label="Until" hint="Exclusive end time" class="min-w-0"><UInput v-model="filters.to" type="datetime-local" class="w-full" :disabled="pending || unsupported" /></UFormField>
        <UFormField label="Request ID" class="min-w-0"><UInput v-model="filters.request_id" icon="i-tabler-search" placeholder="Exact request ID" class="w-full" :disabled="pending || unsupported" /></UFormField>
        <div class="flex items-end gap-2">
          <AppButton type="submit" icon="i-tabler-filter" :disabled="pending || unsupported">Apply</AppButton>
          <AppButton type="button" color="neutral" variant="outline" :disabled="pending || unsupported" @click="resetFilters">Reset</AppButton>
        </div>
      </form>
      <p class="mt-3 text-xs leading-relaxed text-[var(--ui-text-muted)]">Only request summaries attributed to your account are shown. Unattributed requests are excluded.</p>
      <UAlert v-if="filterError" class="mt-4" color="error" variant="subtle" :description="filterError" />
    </AppCard>
    <div v-if="!unsupported" class="grid min-w-0 gap-4 md:grid-cols-3" aria-label="Matching request summary" :aria-busy="pending">
      <AppCard class="logs-panel logs-metric min-w-0">
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold"><UIcon name="i-tabler-box-multiple" class="size-4 text-[var(--ui-text-muted)]" aria-hidden="true" /> Requests by model</h3>
        <USkeleton v-if="pending" class="h-24 w-full" />
        <div v-else-if="summary?.by_model.length" class="max-h-40 space-y-2 overflow-y-auto">
          <div v-for="model in summary.by_model" :key="model.model" class="flex items-center justify-between gap-3 py-1 text-sm">
            <span class="min-w-0 truncate" :title="model.model">{{ model.model || 'Unknown model' }}</span>
            <span class="shrink-0 font-semibold tabular-nums">{{ formatNumber(model.requests) }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-[var(--ui-text-muted)]">{{ summary ? 'No requests in this range.' : 'Summary unavailable.' }}</p>
        <p class="mt-3 text-xs text-[var(--ui-text-muted)]">Request counts across all matching logs</p>
      </AppCard>
      <AppCard class="logs-panel logs-metric min-w-0">
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold"><UIcon name="i-tabler-clock" class="size-4 text-[var(--ui-text-muted)]" aria-hidden="true" /> Average latency</h3>
        <USkeleton v-if="pending" class="h-10 w-32" />
        <p v-else class="break-words text-3xl font-semibold tabular-nums tracking-tight text-[var(--ui-text-highlighted)]">{{ summary?.average_latency_ms != null ? formatLatency(summary.average_latency_ms) : '—' }}<span v-if="summary?.average_latency_ms != null" class="ml-1 text-sm font-normal text-[var(--ui-text-muted)]">ms</span></p>
        <p class="mt-3 text-xs text-[var(--ui-text-muted)]">All matching requests with measured latency</p>
      </AppCard>
      <AppCard class="logs-panel logs-metric min-w-0">
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold"><UIcon name="i-tabler-circle-check" class="size-4 text-[var(--ui-text-muted)]" aria-hidden="true" /> Request outcomes</h3>
        <USkeleton v-if="pending" class="h-16 w-full" />
        <div v-else class="grid grid-cols-2 gap-4">
          <div class="min-w-0"><p class="text-xs font-medium text-[var(--ui-success)]">Success</p><p class="mt-2 text-2xl font-semibold tabular-nums">{{ summary ? formatNumber(summary.status.success) : '—' }}</p></div>
          <div class="min-w-0"><p class="text-xs font-medium text-[var(--ui-error)]">Failed</p><p class="mt-2 text-2xl font-semibold tabular-nums">{{ summary ? formatNumber(summary.status.failed) : '—' }}</p></div>
        </div>
        <p class="mt-3 text-xs text-[var(--ui-text-muted)]">All matching logs, not just the current page</p>
      </AppCard>
    </div>
    <AppCard class="logs-panel min-w-0 overflow-hidden" :ui="{ body: 'p-0' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><h2 class="flex items-center gap-2 text-sm font-semibold"><UIcon name="i-tabler-list-details" class="size-4 text-[var(--ui-text-muted)]" aria-hidden="true" /> Request history</h2><p class="mt-1 text-xs tabular-nums text-[var(--ui-text-muted)]">{{ formatNumber(total) }} requests matching your filters</p></div>
          <UFormField label="Rows per page"><USelect v-model="pageSize" :items="pageSizeOptions" class="w-24" :disabled="pending || unsupported" @update:model-value="changePageSize" /></UFormField>
        </div>
      </template>
      <div class="overflow-x-auto">
        <AppTable :data="items" :columns="columns" :loading="pending" empty="No request logs match the current filters." class="min-w-[900px]">
          <template #timestamp-cell="{ row }"><span class="whitespace-nowrap">{{ formatTime(row.original.timestamp) }}</span></template>
          <template #event_type-cell="{ row }">{{ row.original.event_type || '—' }}</template>
          <template #status-cell="{ row }"><UBadge :color="row.original.status === 'failed' ? 'error' : 'success'" variant="subtle">{{ row.original.status }}</UBadge></template>
          <template #model-cell="{ row }"><span class="font-medium text-[var(--ui-text-highlighted)]">{{ row.original.model || '—' }}</span></template>

          <template #tokens-cell="{ row }"><span class="tabular-nums">{{ formatNumber(row.original.tokens) }}</span></template>
          <template #latency_ms-cell="{ row }"><span class="whitespace-nowrap tabular-nums">{{ formatNumber(row.original.latency_ms) }} ms</span></template>
          <template #request_id-cell="{ row }"><span class="rounded-md bg-[var(--ui-bg-muted)] px-2 py-1 font-mono text-xs">{{ row.original.request_id || '—' }}</span></template>
        </AppTable>
      </div>
      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span class="text-[var(--ui-text-muted)]">Showing {{ rangeStart }}–{{ rangeEnd }} of {{ formatNumber(total) }}</span>
          <div class="flex flex-wrap items-center gap-2">
            <AppButton color="neutral" variant="outline" size="sm" :disabled="page <= 1 || pending || unsupported" @click="changePage(-1)">Previous</AppButton>
            <span class="px-1 text-xs tabular-nums text-[var(--ui-text-muted)]">Page {{ page }} of {{ pages }}</span>
            <AppButton color="neutral" variant="outline" size="sm" :disabled="page >= pages || pending || unsupported" @click="changePage(1)">Next</AppButton>
          </div>
        </div>
      </template>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
import { useStoreData } from '~/composables/useStoreData'

definePageMeta({ layout: 'app' })
interface RequestLog {
  timestamp: string
  event_type: string
  status: string
  model: string

  tokens: number
  latency_ms: number
  request_id: string
}
interface LogSummary {
  by_model: { model: string; requests: number }[]
  average_latency_ms: number | null
  status: { success: number; failed: number }
}
interface LogPage { items: RequestLog[]; total: number; limit: number; offset: number; summary?: LogSummary }
const { fetchAPI, loadCapabilities, capabilities, hydrateSession } = useUserApi()
const unsupported = ref(false)
const localDateTime = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
function last24Hours() {
  const to = new Date()
  to.setSeconds(0, 0)
  return { from: localDateTime(new Date(to.getTime() - 24 * 60 * 60_000)), to: localDateTime(to), request_id: '' }
}
const filters = reactive(last24Hours())
const appliedFilters = ref<{ from?: string; to?: string; request_id?: string }>({
  from: new Date(filters.from).toISOString(),
  to: new Date(filters.to).toISOString()
})
const filterError = ref('')
const page = ref(1)
const pageSize = ref(20)
const pageSizeOptions = [20, 50, 100, 200]
const { data, pending, error, refresh } = useStoreData<LogPage>('user:request-logs', async () => {
  hydrateSession()
  unsupported.value = false
  try {
    await loadCapabilities()
  } catch (cause: any) {
    if (cause?.statusCode !== 404) throw cause
    unsupported.value = true
  }
  if (unsupported.value || capabilities.value.request_logs !== true) {
    unsupported.value = true
    return { items: [], total: 0, limit: pageSize.value, offset: 0 }
  }
  try {
    return await fetchAPI<LogPage>('/request-logs', { query: { ...appliedFilters.value, limit: pageSize.value, offset: (page.value - 1) * pageSize.value } })
  } catch (cause: any) {
    if (cause?.statusCode !== 404) throw cause
    unsupported.value = true
    return { items: [], total: 0, limit: pageSize.value, offset: 0 }
  }
}, { default: () => ({ items: [], total: 0, limit: 20, offset: 0 }) })
const items = computed(() => error.value ? [] : data.value?.items || [])
const total = computed(() => error.value ? 0 : data.value?.total || 0)
const summary = computed(() => error.value ? null : data.value?.summary || null)
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const rangeStart = computed(() => items.value.length ? (data.value?.offset || 0) + 1 : 0)
const rangeEnd = computed(() => items.value.length ? (data.value?.offset || 0) + items.value.length : 0)
const errorMessage = computed(() => (error.value as any)?.message || 'Please try refreshing again.')
const columns = [
  { accessorKey: 'timestamp', header: 'Time' },
  { accessorKey: 'event_type', header: 'Event' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'model', header: 'Model' },

  { accessorKey: 'tokens', header: 'Tokens' },
  { accessorKey: 'latency_ms', header: 'Latency' },
  { accessorKey: 'request_id', header: 'Request ID' }
]
const formatNumber = (value: number) => new Intl.NumberFormat().format(value)
const formatLatency = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
const formatTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
}
function applyFilters() {
  filterError.value = ''
  const from = filters.from ? new Date(filters.from) : null
  const to = filters.to ? new Date(filters.to) : null
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    filterError.value = 'Enter a valid date and time.'
    return
  }
  if (from && to && from > to) {
    filterError.value = 'From must not be after Until.'
    return
  }
  appliedFilters.value = { ...(from ? { from: from.toISOString() } : {}), ...(to ? { to: to.toISOString() } : {}), ...(filters.request_id.trim() ? { request_id: filters.request_id.trim() } : {}) }
  page.value = 1
  void refresh()
}
function resetFilters() {
  Object.assign(filters, last24Hours())
  applyFilters()
}
function changePageSize() { page.value = 1; void refresh() }
function changePage(delta: number) { page.value += delta; void refresh() }
</script>

<style scoped>
.logs-workspace {
  max-width: 80rem;
  padding-block: 0.75rem;
  margin-inline: auto;
}
.logs-workspace .logs-panel {
  border-radius: 1.5rem;
  border-color: color-mix(in oklch, var(--ui-border) 50%, transparent);
  background: var(--ui-bg);
  box-shadow: none;
}
:global(.dark) .logs-workspace .logs-panel {
  box-shadow: none;
}
.logs-metric :deep(p.tabular-nums) { overflow-wrap: anywhere; }
.logs-workspace :deep(input[type='datetime-local']) { min-width: 0; }
</style>
