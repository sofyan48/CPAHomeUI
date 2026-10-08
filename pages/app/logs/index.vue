<template>
  <div class="space-y-5">
    <UAlert v-if="unsupported" color="warning" variant="subtle" title="Request logs unavailable" description="This server does not support user request logs." />
    <UAlert v-else-if="error" color="error" variant="subtle" title="Could not load request logs" :description="errorMessage" />
    <AppCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><h2 class="font-semibold">Request logs</h2><p class="mt-1 text-xs text-[var(--ui-text-muted)]">Only request summaries attributed to your account are shown. Unattributed requests are excluded.</p></div>
          <AppButton icon="i-tabler-refresh" color="neutral" variant="outline" :loading="pending" @click="refresh">Refresh</AppButton>
        </div>
      </template>
      <form class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" @submit.prevent="applyFilters">
        <UFormField label="From"><UInput v-model="filters.from" type="datetime-local" class="w-full" :disabled="pending || unsupported" /></UFormField>
        <UFormField label="Until" hint="Exclusive end time"><UInput v-model="filters.to" type="datetime-local" class="w-full" :disabled="pending || unsupported" /></UFormField>
        <UFormField label="Request ID"><UInput v-model="filters.request_id" placeholder="Exact request ID" class="w-full" :disabled="pending || unsupported" /></UFormField>
        <div class="flex items-end gap-2">
          <AppButton type="submit" icon="i-tabler-filter" :disabled="pending || unsupported">Apply</AppButton>
          <AppButton type="button" color="neutral" variant="outline" :disabled="pending || unsupported" @click="resetFilters">Reset</AppButton>
        </div>
      </form>
      <UAlert v-if="filterError" class="mt-4" color="error" variant="subtle" :description="filterError" />
    </AppCard>
    <AppCard :ui="{ body: 'p-0' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-[var(--ui-text-muted)]">{{ formatNumber(total) }} requests</p>
          <UFormField label="Rows per page"><USelect v-model="pageSize" :items="pageSizeOptions" class="w-24" :disabled="pending || unsupported" @update:model-value="changePageSize" /></UFormField>
        </div>
      </template>
      <div class="overflow-x-auto">
        <AppTable :data="items" :columns="columns" :loading="pending" empty="No request logs match the current filters." class="min-w-[900px]">
          <template #timestamp-cell="{ row }"><span class="whitespace-nowrap">{{ formatTime(row.original.timestamp) }}</span></template>
          <template #event_type-cell="{ row }">{{ row.original.event_type || '—' }}</template>
          <template #status-cell="{ row }"><UBadge :color="row.original.status === 'failed' ? 'error' : 'success'" variant="subtle">{{ row.original.status }}</UBadge></template>
          <template #model-cell="{ row }">{{ row.original.model || '—' }}</template>

          <template #tokens-cell="{ row }"><span class="tabular-nums">{{ formatNumber(row.original.tokens) }}</span></template>
          <template #latency_ms-cell="{ row }"><span class="whitespace-nowrap tabular-nums">{{ formatNumber(row.original.latency_ms) }} ms</span></template>
          <template #request_id-cell="{ row }"><span class="font-mono text-xs">{{ row.original.request_id || '—' }}</span></template>
        </AppTable>
      </div>
      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span class="text-[var(--ui-text-muted)]">Showing {{ rangeStart }}–{{ rangeEnd }} of {{ formatNumber(total) }}</span>
          <div class="flex items-center gap-2">
            <AppButton color="neutral" variant="outline" size="sm" :disabled="page <= 1 || pending || unsupported" @click="changePage(-1)">Previous</AppButton>
            <span>Page {{ page }} of {{ pages }}</span>
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
interface LogPage { items: RequestLog[]; total: number; limit: number; offset: number }
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
