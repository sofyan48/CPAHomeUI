<template>
  <section class="space-y-4">
    <UAlert color="info" variant="subtle" title="Legacy usage records" description="Request events are unavailable on this Home deployment. These records use the supported usage API; exports contain redacted summaries, not raw payloads." />
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <UAlert v-if="!available('usage_records')" color="warning" variant="subtle" title="Usage records unavailable" />
    <AppCard>
      <form class="space-y-3" @submit.prevent="apply">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <UFormField label="From"><UInput v-model="filters.from" type="datetime-local" class="w-full" /></UFormField>
          <UFormField label="To"><UInput v-model="filters.to" type="datetime-local" class="w-full" /></UFormField>
          <UFormField v-for="field in fields" :key="field.key" :label="field.label"><UInput v-model="filters[field.key]" class="w-full" /></UFormField>
          <UFormField label="Status"><USelect v-model="filters.status" :items="statusOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Sort"><USelect v-model="sort" :items="sortOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Rows"><USelect v-model="limit" :items="[25, 50, 100, 200]" class="w-full" /></UFormField>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <AppButton type="submit" :loading="loading" :disabled="!available('usage_records')">Apply filters</AppButton>
          <AppButton color="neutral" variant="ghost" @click="reset">Reset</AppButton>
          <USelect v-model="exportFormat" aria-label="Usage export format" :items="['csv', 'jsonl']" class="w-28" />
          <AppButton color="neutral" variant="outline" icon="i-tabler-download" :loading="exporting" :disabled="exporting || !available('usage_export')" @click="exportRecords">Export applied filters</AppButton>
        </div>
        <p class="text-xs text-[var(--ui-text-muted)]">Times use {{ timezone }}. Export includes up to 10,000 matching records across all pages.</p>
        <p v-if="!available('usage_export')" class="text-xs text-[var(--ui-text-muted)]">Usage export is unavailable.</p>
        <p v-if="!available('usage_record_details')" class="text-xs text-[var(--ui-text-muted)]">Usage record details are unavailable.</p>
      </form>
    </AppCard>
    <AppCard :ui="{ body: 'p-0' }">
      <AppTable :columns="columns" :data="items" :loading="loading" class="min-w-[960px]">
        <template #request-cell="{ row }"><p class="font-mono text-xs">{{ value(row).request_id || value(row).id }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ date(value(row).timestamp) }}</p></template>
        <template #model-cell="{ row }"><p>{{ value(row).model || 'Unknown model' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ value(row).provider || 'Unknown provider' }} · {{ value(row).endpoint }}</p></template>
        <template #status-cell="{ row }"><UBadge :color="value(row).failed ? 'error' : 'success'" variant="subtle">{{ value(row).status || (value(row).failed ? 'Failed' : 'Success') }}</UBadge></template>
        <template #tokens-cell="{ row }">{{ number(value(row).tokens?.total_tokens) }}</template>
        <template #latency-cell="{ row }">{{ value(row).performance?.latency_ms == null ? '—' : `${number(value(row).performance.latency_ms)} ms` }}</template>
        <template #cost-cell="{ row }">{{ value(row).billing?.amount ?? '—' }} {{ value(row).billing?.currency || '' }}</template>
        <template #actions-cell="{ row }"><AdminTableAction v-if="available('usage_record_details')" action="view" label="View usage record" @click="openDetail(value(row))" /></template>
        <template #empty><p class="py-10 text-center text-sm text-[var(--ui-text-muted)]">No usage records found for the applied filters.</p></template>
      </AppTable>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-border)] px-4 py-3">
        <span class="text-xs text-[var(--ui-text-muted)]">Page {{ page }} of {{ pages }} · {{ number(total) }} records</span>
        <div class="flex gap-2"><AppButton size="sm" color="neutral" variant="outline" :disabled="loading || page <= 1" @click="page--">Previous</AppButton><AppButton size="sm" color="neutral" variant="outline" :disabled="loading || page >= pages" @click="page++">Next</AppButton></div>
      </div>
    </AppCard>
    <AdminRequestRecordDetail v-model:open="detailOpen" :detail="detail" :loading="detailLoading" :downloading="downloading" :download-error="downloadError" @download="downloadLog" />
  </section>
</template>

<script setup lang="ts">
import { useDataSync } from '~/composables/useDataSync'
const { fetchAPI, token } = useApi()
const { supports } = useCapabilities()
const unavailable = ref<string[]>([])
const available = (feature: string) => supports(feature) && !unavailable.value.includes(feature)
const fields = [
  { key: 'search', label: 'Search' }, { key: 'request_id', label: 'Request ID' },
  { key: 'provider', label: 'Provider' }, { key: 'model', label: 'Model' },
  { key: 'user', label: 'User' }, { key: 'client_key', label: 'Client key' },
  { key: 'credential_id', label: 'Credential ID' }, { key: 'endpoint', label: 'Endpoint' },
  { key: 'home_ip', label: 'Home IP' }, { key: 'cpa_node', label: 'CPA node' }
]
const defaults = (): Record<string, string> => ({ from: '', to: '', status: '__all__', ...Object.fromEntries(fields.map(field => [field.key, ''])) })
const filters = ref(defaults()), applied = ref(defaults())
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const sort = ref('timestamp_desc'), limit = ref(50), page = ref(1)
const sortOptions = [
  ['Newest first', 'timestamp_desc'], ['Oldest first', 'timestamp_asc'], ['Most tokens', 'tokens_desc'], ['Fewest tokens', 'tokens_asc'],
  ['Highest cost', 'cost_desc'], ['Lowest cost', 'cost_asc'], ['Highest latency', 'latency_desc'], ['Lowest latency', 'latency_asc'], ['Failures first', 'failed_first']
].map(([label, value]) => ({ label, value }))
const statusOptions = [{ label: 'All statuses', value: '__all__' }, { label: 'Success', value: 'success' }, { label: 'Failed', value: 'failed' }]
const columns = ['request', 'model', 'status', 'tokens', 'latency', 'cost', 'actions'].map(key => ({ accessorKey: key, header: key === 'actions' ? '' : key[0]!.toUpperCase() + key.slice(1) }))
const response = ref<any>(null), loading = ref(false), error = ref('')
const items = computed(() => response.value?.items || [])
const total = computed(() => Number(response.value?.total) || 0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
const exportFormat = ref('csv'), exporting = ref(false)
const detailOpen = ref(false), detailLoading = ref(false), detail = ref<any>(null)
const downloading = ref(false), downloadError = ref('')
let controller = new AbortController(), version = 0, detailVersion = 0, generation = 0, disposed = false
const value = (row: any) => row?.original || row
const number = (input: unknown) => new Intl.NumberFormat().format(Number(input) || 0)
const date = (input: string) => input ? new Date(input).toLocaleString() : '—'
function query(paginated = true) {
  const result: Record<string, string | number> = { timezone, sort: sort.value }
  for (const [key, input] of Object.entries(applied.value)) {
    if (!input.trim() || input === '__all__') continue
    result[key] = key === 'from' || key === 'to' ? new Date(input).toISOString() : input.trim()
  }
  if (paginated) { result.limit = limit.value; result.offset = (page.value - 1) * limit.value }
  return result
}
function failure(cause: any, feature: string) {
  if ([404, 405, 501].includes(cause?.statusCode)) { unavailable.value = [...new Set([...unavailable.value, feature])]; return }
  error.value = cause?.message || 'Unable to load usage records.'
}
async function load() {
  if (!available('usage_records') || disposed) return
  const current = ++version
  loading.value = true; error.value = ''
  try {
    const result = await fetchAPI('/usage/records', { query: query(), signal: controller.signal })
    if (disposed || current !== version) return
    response.value = result
    if (page.value > pages.value) page.value = pages.value
  } catch (cause) { if (!disposed && current === version) failure(cause, 'usage_records') }
  finally { if (!disposed && current === version) loading.value = false }
}
function apply() { applied.value = { ...filters.value }; if (page.value !== 1) page.value = 1; else void load() }
function reset() { filters.value = defaults(); apply() }
async function openDetail(record: any) {
  const current = ++detailVersion
  detailOpen.value = true; detailLoading.value = true; detail.value = null; downloadError.value = ''
  try {
    const result = await fetchAPI<any>(`/usage/records/${encodeURIComponent(record.id)}`, { query: { include_payload: true, include_logs: true }, signal: controller.signal })
    if (disposed || current !== detailVersion) return
    // Legacy client names differ from request-event names; reuse the redacted detail view.
    const client = result.record?.client || {}
    detail.value = { ...result, event: { ...result.record, client: { ...client, client_key_id: client.api_key_id, client_key_label: client.api_key_label, client_key_masked: client.api_key_masked }, related: result.related } }
  } catch (cause) { if (!disposed && current === detailVersion) { failure(cause, 'usage_record_details'); detailOpen.value = false } }
  finally { if (!disposed && current === detailVersion) detailLoading.value = false }
}
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
}
async function exportRecords() {
  if (exporting.value || !available('usage_export')) return
  const current = generation, format = exportFormat.value
  exporting.value = true; error.value = ''
  try {
    const blob = await fetchAPI<Blob>('/usage/export', { query: { ...query(false), format }, responseType: 'blob', signal: controller.signal })
    if (!disposed && current === generation) save(blob, `usage-records.${format}`)
  } catch (cause) { if (!disposed && current === generation) failure(cause, 'usage_export') }
  finally { if (!disposed && current === generation) exporting.value = false }
}
async function downloadLog(url: string, requestId: string) {
  if (downloading.value) return
  const current = generation
  downloading.value = true; downloadError.value = ''
  try { const blob = await fetchAPI<Blob>(url, { responseType: 'blob', signal: controller.signal }); if (!disposed && current === generation) save(blob, `${requestId || 'request'}.log`) }
  catch (cause: any) { if (!disposed && current === generation) downloadError.value = cause?.message || 'Unable to download request log.' }
  finally { if (!disposed && current === generation) downloading.value = false }
}
watch([sort, limit], () => { if (page.value !== 1) page.value = 1; else void load() })
watch(page, () => void load())
watch(token, () => {
  generation++; version++; detailVersion++; controller.abort(); controller = new AbortController()
  unavailable.value = []; response.value = null; detail.value = null; detailOpen.value = false
  loading.value = false; exporting.value = false; detailLoading.value = false; downloading.value = false
  void load()
})
useDataSync('admin:usage-legacy:sync', load)
onMounted(load)
onScopeDispose(() => { disposed = true; generation++; version++; detailVersion++; controller.abort() })
</script>
