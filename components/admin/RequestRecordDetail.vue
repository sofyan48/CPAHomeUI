<template>
  <AppModal v-model:open="open" title="Request Details" :description="subtitle" :ui="{ content: 'w-full sm:max-w-4xl', header: 'shrink-0 border-b border-[var(--ui-border)]', body: 'min-h-0 overflow-y-auto p-4 sm:p-6', footer: 'shrink-0 border-t border-[var(--ui-border)] bg-[var(--ui-bg)] p-4 sm:px-6' }">
    <template #body>
      <div v-if="loading" role="status" class="flex items-center justify-center gap-2 py-16 text-sm text-[var(--ui-text-muted)]"><UIcon name="i-tabler-loader-2" class="size-5 animate-spin" />Loading request details…</div>
      <div v-else-if="detail" class="space-y-4">
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div v-for="field in overview" :key="field.label" class="min-w-0 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 sm:p-4" :class="field.full ? 'sm:col-span-2' : ''">
            <dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ field.label }}</dt>
            <dd class="mt-2 flex min-w-0 items-start justify-between gap-3 text-sm">
              <div class="min-w-0 space-y-1">
                <UBadge v-if="field.label === 'Status'" :color="event.failed ? 'error' : 'success'" variant="subtle">{{ event.failed ? 'Failed' : 'Success' }}</UBadge>
                <span v-else class="block break-all font-medium" :class="field.mono ? 'font-mono text-xs leading-5' : ''">{{ display(field.value) }}</span>
                <p v-if="field.secondary" class="break-all text-xs text-[var(--ui-text-muted)]">{{ field.secondary }}</p>
              </div>
              <AppButton v-if="field.copy" type="button" color="neutral" variant="ghost" size="xs" icon="i-tabler-copy" class="shrink-0" :aria-label="`Copy ${field.label.toLowerCase()}`" :title="`Copy ${field.label.toLowerCase()}`" @click="copyText(field.copy, field.label)" />
            </dd>
          </div>
        </dl>

        <section class="rounded-lg border border-[var(--ui-border)] p-3 sm:p-4" aria-labelledby="request-detail-tokens">
          <div class="mb-3 flex items-center justify-between gap-3"><h3 id="request-detail-tokens" class="text-sm font-semibold">Tokens</h3><span class="text-xs text-[var(--ui-text-muted)]">Total <strong class="ml-1 text-[var(--ui-text)] tabular-nums">{{ number(event.tokens?.total_tokens) }}</strong></span></div>
          <dl class="grid grid-cols-3 gap-3">
            <div v-for="item in primaryTokens" :key="item.label" class="min-w-0 rounded-md bg-[var(--ui-bg-muted)] p-3"><dt class="text-xs text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="mt-1 break-all text-lg font-semibold tabular-nums">{{ item.value }}</dd></div>
          </dl>
          <dl class="mt-3 grid grid-cols-1 gap-3 border-t border-[var(--ui-border)] pt-3 sm:grid-cols-3">
            <div v-for="item in cacheTokens" :key="item.label"><dt class="text-xs text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="mt-1 text-sm font-medium tabular-nums">{{ item.value }}</dd></div>
          </dl>
        </section>

        <UAlert v-if="hasError" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Request error" :description="event.error.message || event.error.reason || event.error.body_preview" />
        <section v-if="hasError" class="rounded-lg border border-[var(--ui-border)] p-4" aria-labelledby="request-detail-error">
          <h3 id="request-detail-error" class="mb-3 text-sm font-semibold">Error details</h3>
          <dl class="grid gap-3 sm:grid-cols-2"><AdminDetailItem v-for="item in errorDetails" :key="item.label" :label="item.label" :value="item.value" /></dl>
          <pre v-if="event.error?.body_preview" class="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[var(--ui-bg-muted)] p-3 font-mono text-xs leading-5">{{ event.error.body_preview }}</pre>
        </section>

        <section class="rounded-lg border border-[var(--ui-border)] p-4" aria-labelledby="request-detail-routing">
          <h3 id="request-detail-routing" class="mb-3 text-sm font-semibold">Additional request details</h3>
          <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2"><AdminDetailItem v-for="item in requestDetails" :key="item.label" :label="item.label" :value="item.value" /></dl>
        </section>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AdminDetailSection title="Runtime" :items="runtimeDetails" />
          <AdminDetailSection title="Credential" :items="credentialDetails" />
          <AdminDetailSection title="Client" :items="clientDetails" />
          <AdminDetailSection title="Performance" :items="performanceDetails" />
          <AdminDetailSection title="Billing" :items="billingDetails" />
        </div>
        <section v-if="detail.payload_summary" class="rounded-lg border border-[var(--ui-border)] p-4"><h3 class="mb-3 text-sm font-semibold">Payload summary</h3><pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[var(--ui-bg-muted)] p-3 font-mono text-xs leading-5">{{ JSON.stringify(detail.payload_summary, null, 2) }}</pre></section>
        <section v-if="detail.log_excerpt?.length" class="rounded-lg border border-[var(--ui-border)] p-4"><div class="mb-3 flex items-center justify-between gap-2"><h3 class="text-sm font-semibold">Request log excerpt</h3><UBadge color="neutral" variant="subtle" size="sm">Redacted</UBadge></div><pre class="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[var(--ui-bg-muted)] p-3 font-mono text-xs leading-5">{{ detail.log_excerpt.join('\n') }}</pre></section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p v-if="!loading && !downloadUrl" id="request-detail-no-log" class="text-xs text-[var(--ui-text-muted)]">This request has no downloadable request log.</p>
        <p v-else-if="downloadError" role="alert" class="break-words text-xs text-[var(--ui-color-error-500)]">{{ downloadError }}</p>
        <AppButton type="button" color="neutral" variant="outline" icon="i-tabler-download" class="shrink-0 sm:ml-auto" :loading="downloading" :disabled="loading || !downloadUrl || downloading" :aria-describedby="!loading && !downloadUrl ? 'request-detail-no-log' : undefined" @click="emit('download', downloadUrl, event.request_id)">Download request log</AppButton>
      </div>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
type Fields = Record<string, any>
type Detail = { event?: Fields; payload_summary?: Fields | null; log_excerpt?: string[] }
type OverviewField = { label: string; value?: unknown; secondary?: string; mono?: boolean; full?: boolean; copy?: string }
const props = defineProps<{ detail: Detail | null; loading: boolean; downloading: boolean; downloadError?: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ download: [url: string, requestId: string] }>()
const toast = useToast()
const event = computed(() => props.detail?.event || {})
const display = (value: unknown) => value == null || value === '' ? '—' : String(value)
const number = (value: unknown) => value == null ? '—' : new Intl.NumberFormat().format(Number(value))
const decimal = (value: unknown) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value))
const milliseconds = (value: unknown) => value == null ? '—' : `${number(value)} ms`
const subtitle = computed(() => event.value.timestamp ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(event.value.timestamp)) : 'Routing, usage, billing, and redacted logs for this request.')
const downloadUrl = computed(() => event.value.related?.request_log?.download_url || '')
const amount = computed(() => event.value.billing?.amount == null ? '—' : `${decimal(event.value.billing.amount)} ${event.value.billing.currency || 'credits'}`)
const endpoint = computed(() => [props.detail?.payload_summary?.method, event.value.endpoint].filter(Boolean).join(' '))
const status = computed(() => [event.value.status || (event.value.failed ? 'failed' : 'success'), event.value.status_code ? `HTTP ${event.value.status_code}` : '', event.value.upstream_status_code ? `Upstream ${event.value.upstream_status_code}` : ''].filter(Boolean).join(' · '))
const overview = computed<OverviewField[]>(() => [
  { label: 'Event type', value: event.value.event_type || 'completion' },
  { label: 'Status', secondary: status.value },
  { label: 'Request ID', value: event.value.request_id, mono: true, copy: event.value.request_id },
  { label: 'Upstream request ID', value: event.value.upstream_request_id, mono: true, copy: event.value.upstream_request_id },
  { label: 'Provider', value: event.value.provider },
  { label: 'Model', value: event.value.model },
  { label: 'Endpoint', value: endpoint.value, mono: true, full: true, copy: endpoint.value },
  { label: 'Home node', value: event.value.runtime?.home_id || event.value.runtime?.home_ip },
  { label: 'CPA node', value: event.value.runtime?.cpa_label || event.value.runtime?.cpa_node_id },
  { label: 'User', value: event.value.client?.username || event.value.client?.user_id },
  { label: 'Client access key', value: event.value.client?.client_key_label },
  { label: 'Credential', value: event.value.credential?.label || event.value.credential?.credential_id, secondary: event.value.credential?.credential_type },
  { label: 'Latency', value: event.value.performance?.latency_ms == null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(event.value.performance.latency_ms / 1000)} s` },
  { label: 'Cost', value: amount.value, full: true }
])
function details(object: Fields | undefined, pairs: string[][]) { return pairs.map(([label, key]) => ({ label: label!, value: display(object?.[key!]) })) }
const primaryTokens = computed(() => details(event.value.tokens, [['Input', 'input_tokens'], ['Output', 'output_tokens'], ['Reasoning', 'reasoning_tokens']]).map(item => ({ ...item, value: item.value === '—' ? '—' : number(item.value) })))
const cacheTokens = computed(() => details(event.value.tokens, [['Cached', 'cached_tokens'], ['Cache read', 'cache_read_tokens'], ['Cache creation', 'cache_creation_tokens']]).map(item => ({ ...item, value: item.value === '—' ? '—' : number(item.value) })))
const requestDetails = computed(() => details(event.value, [['Event ID', 'id'], ['Original model', 'original_model'], ['Model alias', 'model_alias'], ['Executor', 'executor_type'], ['Source', 'source'], ['Service tier', 'service_tier'], ['Reasoning effort', 'reasoning_effort'], ['Session ID', 'session_id'], ['Parent session ID', 'parent_session_id'], ['Root session ID', 'root_session_id']]))
const runtimeDetails = computed(() => details(event.value.runtime, [['Home', 'home_id'], ['Home IP', 'home_ip'], ['Home port', 'home_port'], ['CPA label', 'cpa_label'], ['CPA node ID', 'cpa_node_id'], ['CPA address', 'cpa_ip'], ['CPA port', 'cpa_port']]))
const credentialDetails = computed(() => details(event.value.credential, [['Type', 'credential_type'], ['Label', 'label'], ['Credential ID', 'credential_id'], ['Auth index', 'auth_index'], ['Provider', 'provider'], ['Source', 'source'], ['Key preview', 'api_key_preview']]))
const clientDetails = computed(() => details(event.value.client, [['Username', 'username'], ['User ID', 'user_id'], ['Key label', 'client_key_label'], ['Key ID', 'client_key_id'], ['Masked key', 'client_key_masked'], ['Client IP', 'client_ip']]))
const performanceDetails = computed(() => [{ label: 'Latency', value: milliseconds(event.value.performance?.latency_ms) }, { label: 'TTFT', value: milliseconds(event.value.performance?.ttft_ms) }, { label: 'TPS', value: event.value.performance?.tps == null ? '—' : decimal(event.value.performance.tps) }])
const billingDetails = computed(() => [{ label: 'Amount', value: amount.value }, ...details(event.value.billing, [['Charge ID', 'charge_id'], ['Price rule', 'matched_price_rule']])])
const hasError = computed(() => Boolean(event.value.error?.message || event.value.error?.reason || event.value.error?.body_preview))
const errorDetails = computed(() => details(event.value.error, [['HTTP status', 'status_code'], ['Upstream status', 'upstream_status_code'], ['Reason', 'reason'], ['Message', 'message']]))
async function copyText(value: string, label: string) {
  try { await navigator.clipboard.writeText(value); toast.add({ title: `${label} copied`, color: 'success' }) }
  catch { toast.add({ title: `Could not copy ${label.toLowerCase()}`, description: 'Select the value and copy it manually.', color: 'error' }) }
}
</script>
