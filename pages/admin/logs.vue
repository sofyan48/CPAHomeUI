<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <USelect v-model="pageSize" :items="pageSizeOptions" value-key="value" label-key="label" class="w-32" aria-label="Page size" @update:model-value="resetPages" />
        <AppButton :color="liveRefresh ? 'primary' : 'neutral'" variant="outline" icon="i-tabler-refresh" @click="liveRefresh = !liveRefresh">
          Live refresh {{ liveRefresh ? 'on' : 'off' }}
        </AppButton>
        <AppButton
          v-if="activeView === 'application'"
          color="error"
          variant="outline"
          icon="i-tabler-trash"
          :disabled="applicationTotal === 0"
          @click="clearConfirmOpen = true"
        >
          Clear application logs
        </AppButton>
        <AppButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="loading" @click="refreshActive">
          Refresh
        </AppButton>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
    >
      {{ errorMessage }}
    </div>

    <AppPanelTabs :model-value="activeView" :items="views" label="Log views" @update:model-value="switchView" />

    <AppCard>
      <form class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6" @submit.prevent="applyFilters">
        <template v-if="activeView === 'error-logs'">
          <UFormField label="Search filename" class="md:col-span-2">
            <UInput v-model="errorLogSearch" placeholder="e.g. error-2026-05-27.log" icon="i-tabler-search" class="w-full" />
          </UFormField>
        </template>
        <template v-else-if="activeView !== 'application'">
          <UFormField label="From">
            <UInput v-model="requestFilters.from" type="date" class="w-full" />
          </UFormField>
          <UFormField label="To">
            <UInput v-model="requestFilters.to" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Provider">
            <UInput v-model="requestFilters.provider" placeholder="e.g. openai" class="w-full" />
          </UFormField>
          <UFormField label="Model">
            <UInput v-model="requestFilters.model" placeholder="Contains model name" class="w-full" />
          </UFormField>
          <UFormField label="Status">
            <USelect :model-value="requestFilters.status || allOptionValue" @update:model-value="requestFilters.status = $event === allOptionValue ? '' : $event" :items="requestStatusOptions" value-key="value" label-key="label" class="w-full" />
          </UFormField>
          <UFormField label="Search">
            <UInput
              v-model="requestFilters.search"
              :placeholder="activeView === 'events' ? 'Request, user, key, node...' : 'Request ID, file, provider...'"
              icon="i-tabler-search"
              class="w-full"
            />
          </UFormField>
        </template>

        <template v-else>
          <UFormField label="After">
            <UInput v-model="applicationFilters.after" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField label="Before">
            <UInput v-model="applicationFilters.before" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField label="Level">
            <USelect :model-value="applicationFilters.level || allOptionValue" @update:model-value="applicationFilters.level = $event === allOptionValue ? '' : $event" :items="levelOptions" value-key="value" label-key="label" class="w-full" />
          </UFormField>
          <UFormField label="Home IP">
            <UInput v-model="applicationFilters.home_ip" placeholder="192.0.2.10" class="w-full" />
          </UFormField>
          <UFormField label="Client IP">
            <UInput v-model="applicationFilters.client_ip" placeholder="10.0.0.5" class="w-full" />
          </UFormField>
          <UFormField label="Request ID">
            <UInput v-model="applicationFilters.request_id" placeholder="Full or 8-character request ID" class="w-full" />
          </UFormField>
        </template>

        <div class="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6">
          <AppButton type="submit" color="primary" :loading="loading">Apply filters</AppButton>
          <AppButton color="neutral" variant="ghost" @click="resetFilters">Reset</AppButton>
          <span class="ml-auto text-xs text-[var(--ui-text-muted)]">{{ activeDescription }}</span>
        </div>
      </form>
    </AppCard>

    <AppCard v-if="activeView === 'events'" :ui="{ body: 'p-0' }">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-semibold">Request events</h2>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(eventsTotal) }} matching persisted requests</p>
          </div>
          <USelect v-model="eventSort" :items="eventSortOptions" value-key="value" label-key="label" class="w-full sm:w-52" @update:model-value="applyFilters" />
        </div>
      </template>

      <AppTable :columns="eventColumns" :data="events" :loading="eventsLoading">
        <template #empty>
          <EmptyState icon="i-tabler-list" message="No request events match these filters." />
        </template>
        <template #timestamp-cell="{ row }">
          <div class="min-w-36">
            <p class="font-medium">{{ formatDateTime(rowValue(row).timestamp) }}</p>
            <p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).request_id || rowValue(row).id }}</p>
          </div>
        </template>
        <template #status-cell="{ row }">
          <div class="space-y-1">
            <UBadge :color="rowValue(row).failed ? 'error' : 'success'" variant="subtle" size="sm">
              {{ rowValue(row).failed ? 'Failed' : 'Success' }}
            </UBadge>
            <p v-if="rowValue(row).status_code" class="text-xs text-[var(--ui-text-muted)]">HTTP {{ rowValue(row).status_code }}</p>
          </div>
        </template>
        <template #model-cell="{ row }">
          <div class="min-w-36">
            <p class="font-medium">{{ rowValue(row).model || 'Unknown model' }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).provider || 'Unknown provider' }} · {{ rowValue(row).event_type || 'completion' }}</p>
          </div>
        </template>
        <template #client-cell="{ row }">
          <div class="min-w-32">
            <p class="text-sm">{{ rowValue(row).client?.username || rowValue(row).client?.client_key_label || 'Unattributed' }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).runtime?.cpa_label || rowValue(row).runtime?.home_id || 'Unknown node' }}</p>
          </div>
        </template>
        <template #tokens-cell="{ row }">
          <div class="min-w-24 tabular-nums">
            <p class="font-semibold">{{ formatNumber(rowValue(row).tokens?.total_tokens) }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ formatMilliseconds(rowValue(row).performance?.latency_ms) }}</p>
          </div>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <AppButton
              v-if="rowValue(row).related?.request_log?.download_url"
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-tabler-download"
              title="Download request log"
              :loading="downloadingId === rowValue(row).request_id"
              @click="downloadRequestLog(rowValue(row).related.request_log.download_url, rowValue(row).request_id)"
            />
            <AppButton size="sm" color="neutral" variant="ghost" icon="i-tabler-eye" @click="openEventDetail(rowValue(row))">
              Details
            </AppButton>
          </div>
        </template>
      </AppTable>

      <TablePager :page="eventsPage" :total="eventsTotal" :page-size="pageSize" :loading="eventsLoading" @previous="changeEventsPage(-1)" @next="changeEventsPage(1)" />
    </AppCard>

    <AppCard v-else-if="activeView === 'request-logs'" :ui="{ body: 'p-0' }">
      <template #header>
        <div>
          <h2 class="font-semibold">Request log files</h2>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(requestLogsTotal) }} indexed requests; availability is verified locally or routed to the owning Home.</p>
        </div>
      </template>

      <AppTable :columns="requestLogColumns" :data="requestLogs" :loading="requestLogsLoading">
        <template #empty>
          <EmptyState icon="i-tabler-file-search" message="No request log files match these filters." />
        </template>
        <template #timestamp-cell="{ row }">
          <div class="min-w-36">
            <p class="font-medium">{{ formatDateTime(rowValue(row).timestamp) }}</p>
            <p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).request_id || 'No request ID' }}</p>
          </div>
        </template>
        <template #file_name-cell="{ row }">
          <div class="min-w-40">
            <p class="font-mono text-xs">{{ rowValue(row).file_name || 'Remote file' }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ formatBytes(rowValue(row).size_bytes) }}</p>
          </div>
        </template>
        <template #model-cell="{ row }">
          <div class="min-w-36">
            <p class="font-medium">{{ rowValue(row).model || 'Unknown model' }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).provider || 'Unknown provider' }} · {{ rowValue(row).status || 'unknown' }}</p>
          </div>
        </template>
        <template #home_ip-cell="{ row }">
          <span class="font-mono text-xs">{{ formatHost(rowValue(row).home_ip, rowValue(row).home_port) }}</span>
        </template>
        <template #available-cell="{ row }">
          <UBadge :color="rowValue(row).available ? 'success' : 'neutral'" variant="subtle" size="sm">
            {{ rowValue(row).available ? 'Available' : 'Unavailable' }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <AppButton
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-tabler-download"
              :disabled="!rowValue(row).download_url"
              :loading="downloadingId === rowValue(row).request_id"
              @click="downloadRequestLog(rowValue(row).download_url, rowValue(row).request_id)"
            >
              Download
            </AppButton>
          </div>
        </template>
      </AppTable>

      <TablePager :page="requestLogsPage" :total="requestLogsTotal" :page-size="pageSize" :loading="requestLogsLoading" @previous="changeRequestLogsPage(-1)" @next="changeRequestLogsPage(1)" />
    </AppCard>

    <AppCard v-else-if="activeView === 'error-logs'" :ui="{ body: 'p-0' }">
      <template #header>
        <div>
          <h2 class="font-semibold">Request error logs</h2>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(filteredErrorLogs.length) }} local files match. Files are listed only when detailed request logging is disabled.</p>
        </div>
      </template>
      <AppTable :columns="errorLogColumns" :data="pagedErrorLogs" :loading="errorLogsLoading">
        <template #empty><EmptyState icon="i-tabler-file-search" message="No local request error logs match this filename." /></template>
        <template #modified-cell="{ row }">{{ formatDateTime(Number(rowValue(row).modified) * 1000) }}</template>
        <template #size-cell="{ row }">{{ formatBytes(rowValue(row).size) }}</template>
        <template #actions-cell="{ row }">
          <AppButton size="sm" color="neutral" variant="outline" icon="i-tabler-download"
            :disabled="!validErrorLogName(rowValue(row).name)" :loading="downloadingId === rowValue(row).name"
            @click="downloadErrorLog(rowValue(row).name)">Download</AppButton>
        </template>
      </AppTable>
      <TablePager :page="errorLogsPage" :total="filteredErrorLogs.length" :page-size="errorLogPageSize" :loading="errorLogsLoading" @previous="changeErrorLogsPage(-1)" @next="changeErrorLogsPage(1)" />
    </AppCard>

    <AppCard v-else :ui="{ body: 'p-0' }">
      <template #header>
        <div>
          <h2 class="font-semibold">Application logs</h2>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(applicationTotal) }} database-backed log lines across Home and CPA nodes</p>
        </div>
      </template>

      <AppTable :columns="applicationColumns" :data="applicationLogs" :loading="applicationLoading">
        <template #empty>
          <EmptyState icon="i-tabler-terminal-2" message="No application logs match these filters." />
        </template>
        <template #timestamp-cell="{ row }">
          <div class="min-w-36">
            <p class="font-medium">{{ formatDateTime(rowValue(row).timestamp) }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">Stored {{ formatDateTime(rowValue(row).created_at) }}</p>
          </div>
        </template>
        <template #level-cell="{ row }">
          <UBadge :color="levelColor(rowValue(row).level)" variant="subtle" size="sm">
            {{ rowValue(row).level || 'unknown' }}
          </UBadge>
        </template>
        <template #line-cell="{ row }">
          <p class="max-w-3xl whitespace-pre-wrap break-words font-mono text-xs">{{ rowValue(row).line || '—' }}</p>
        </template>
        <template #source-cell="{ row }">
          <div class="min-w-32 font-mono text-xs">
            <p>{{ rowValue(row).home_ip || 'Unknown Home' }}</p>
            <p class="text-[var(--ui-text-muted)]">{{ rowValue(row).client_ip || 'No client IP' }}</p>
          </div>
        </template>
        <template #request_id-cell="{ row }">
          <span class="font-mono text-xs">{{ rowValue(row).request_id || '—' }}</span>
        </template>
        <template #actions-cell="{ row }">
          <AppButton size="sm" color="neutral" variant="ghost" icon="i-tabler-eye" @click="selectedApplicationLog = rowValue(row)">Details</AppButton>
        </template>
      </AppTable>

      <TablePager :page="applicationPage" :total="applicationTotal" :page-size="applicationPageSize" :loading="applicationLoading" @previous="changeApplicationPage(-1)" @next="changeApplicationPage(1)" />
    </AppCard>

    <AppModal v-model:open="eventDetailOpen" title="Request event details" description="Redacted event, routing, token, performance, and billing metadata.">
      <template #body>
        <div v-if="eventDetailLoading" class="py-12 text-center text-sm text-[var(--ui-text-muted)]">Loading event details…</div>
        <div v-else-if="selectedEvent" class="space-y-5">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="Event ID" :value="selectedEvent.event?.id" mono />
            <DetailItem label="Request ID" :value="selectedEvent.event?.request_id" mono />
            <DetailItem label="Timestamp" :value="formatDateTime(selectedEvent.event?.timestamp)" />
            <DetailItem label="Event type" :value="selectedEvent.event?.event_type" />
            <DetailItem label="Provider / Model" :value="`${selectedEvent.event?.provider || 'Unknown'} / ${selectedEvent.event?.model || 'Unknown'}`" />
            <DetailItem label="Endpoint" :value="selectedEvent.event?.endpoint" mono />
            <DetailItem label="Status" :value="`${selectedEvent.event?.status || 'Unknown'}${selectedEvent.event?.status_code ? ` (${selectedEvent.event.status_code})` : ''}`" />
            <DetailItem label="Latency" :value="formatMilliseconds(selectedEvent.event?.performance?.latency_ms)" />
            <DetailItem label="Total tokens" :value="formatNumber(selectedEvent.event?.tokens?.total_tokens)" />
            <DetailItem label="Charge" :value="formatAmount(selectedEvent.event?.billing?.amount, selectedEvent.event?.billing?.currency)" />
            <DetailItem label="User / Key" :value="selectedEvent.event?.client?.username || selectedEvent.event?.client?.client_key_label || 'Unattributed'" />
            <DetailItem label="Credential" :value="selectedEvent.event?.credential?.label || selectedEvent.event?.credential?.credential_id || 'Unknown'" />
          </div>

          <div v-if="hasEventError" class="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p class="text-sm font-semibold text-red-600 dark:text-red-400">Request error</p>
            <p class="mt-1 whitespace-pre-wrap text-sm">{{ selectedEvent.event.error.message || selectedEvent.event.error.reason || selectedEvent.event.error.body_preview }}</p>
          </div>

          <div v-if="selectedEvent.payload_summary" class="rounded-lg border border-[var(--ui-border)] p-4">
            <p class="mb-3 text-sm font-semibold">Payload summary</p>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DetailItem label="Method" :value="selectedEvent.payload_summary.method" />
              <DetailItem label="Streaming" :value="formatBoolean(selectedEvent.payload_summary.stream)" />
              <DetailItem label="Messages" :value="formatNumber(selectedEvent.payload_summary.message_count)" />
              <DetailItem label="Tools" :value="formatNumber(selectedEvent.payload_summary.tool_count)" />
            </div>
          </div>

          <div v-if="selectedEvent.log_excerpt?.length" class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-4">
            <p class="mb-3 text-sm font-semibold">Request log excerpt</p>
            <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{{ selectedEvent.log_excerpt.join('\n') }}</pre>
          </div>

          <div v-if="selectedEvent.event?.related?.request_log?.download_url" class="flex justify-end">
            <AppButton
              color="neutral"
              variant="outline"
              icon="i-tabler-download"
              :loading="downloadingId === selectedEvent.event.request_id"
              @click="downloadRequestLog(selectedEvent.event.related.request_log.download_url, selectedEvent.event.request_id)"
            >
              Download request log
            </AppButton>
          </div>
        </div>
      </template>
    </AppModal>

    <AppModal :open="!!selectedApplicationLog" title="Application log details" description="Full stored log line; may contain sensitive data." @update:open="closeApplicationDetail">
      <template #body>
        <div v-if="selectedApplicationLog" class="space-y-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailItem label="Timestamp" :value="formatDateTime(selectedApplicationLog.timestamp)" />
            <DetailItem label="Stored" :value="formatDateTime(selectedApplicationLog.created_at)" />
            <DetailItem label="Level" :value="selectedApplicationLog.level" />
            <DetailItem label="Home IP" :value="selectedApplicationLog.home_ip" mono />
            <DetailItem label="Client IP" :value="selectedApplicationLog.client_ip" mono />
            <DetailItem label="Request ID" :value="selectedApplicationLog.request_id" mono />
          </div>
          <pre class="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--ui-bg-muted)] p-4 text-xs">{{ selectedApplicationLog.line }}</pre>
        </div>
      </template>
    </AppModal>

    <AppModal v-model:open="clearConfirmOpen" title="Clear all application logs?" description="This removes every application log row from the shared database across Home and CPA nodes. Local log files are not deleted.">
      <template #body>
        <div class="space-y-5">
          <div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
            This action cannot be undone through the management API. {{ formatNumber(applicationTotal) }} currently matching rows are visible, but the clear operation removes all stored application log rows, including rows outside the active filters.
          </div>
          <div class="flex justify-end gap-3">
            <AppButton color="neutral" variant="ghost" @click="clearConfirmOpen = false">Cancel</AppButton>
            <AppButton color="error" icon="i-tabler-trash" :loading="clearingLogs" @click="clearApplicationLogs">
              Clear all logs
            </AppButton>
          </div>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useDataSync } from '~/composables/useDataSync'
const { fetchAPI } = useApi()
const allOptionValue = '__all__'

const pageSize = ref(50)
const pageSizeOptions = [25, 50, 100, 200].map(value => ({ label: `${value} / page`, value }))
const applicationPageSize = computed(() => pageSize.value)
const errorLogPageSize = computed(() => pageSize.value)
const liveRefresh = ref(false)
let liveRefreshTimer = null
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

const defaultRequestFilters = () => ({
  from: dateInputValue(sevenDaysAgo),
  to: dateInputValue(today),
  provider: '',
  model: '',
  status: '',
  search: '',
})

const defaultApplicationFilters = () => ({
  after: '',
  before: '',
  level: '',
  home_ip: '',
  client_ip: '',
  request_id: '',
})

const views = [
  { value: 'events', label: 'Request events', icon: 'i-tabler-list' },
  { value: 'request-logs', label: 'Request log files', icon: 'i-tabler-file-download' },
  { value: 'error-logs', label: 'Request error logs', icon: 'i-tabler-alert-triangle' },
  { value: 'application', label: 'Application logs', icon: 'i-tabler-terminal-2' },
]

const activeView = ref('events')
const requestFilters = ref(defaultRequestFilters())
const appliedRequestFilters = ref(defaultRequestFilters())
const applicationFilters = ref(defaultApplicationFilters())
const appliedApplicationFilters = ref(defaultApplicationFilters())
const eventSort = ref('timestamp_desc')
const errorMessage = useWorkspaceState('admin:logs:errorMessage', () => (''))
const downloadingId = useWorkspaceState('admin:logs:downloadingId', () => (''))

const eventsResponse = useWorkspaceState('admin:logs:eventsResponse', () => (null))
const requestLogsResponse = useWorkspaceState('admin:logs:requestLogsResponse', () => (null))
const applicationResponse = useWorkspaceState('admin:logs:applicationResponse', () => (null))
const errorLogsResponse = useWorkspaceState('admin:logs:errorLogsResponse', () => (null))
const eventsLoading = useWorkspaceState('admin:logs:eventsLoading', () => (false))
const requestLogsLoading = useWorkspaceState('admin:logs:requestLogsLoading', () => (false))
const applicationLoading = useWorkspaceState('admin:logs:applicationLoading', () => (false))
const errorLogsLoading = useWorkspaceState('admin:logs:errorLogsLoading', () => (false))
const eventsPage = ref(1)
const requestLogsPage = ref(1)
const applicationPage = ref(1)
const errorLogsPage = ref(1)
const errorLogSearch = ref('')

const eventDetailOpen = ref(false)
const eventDetailLoading = useWorkspaceState('admin:logs:eventDetailLoading', () => (false))
const selectedEvent = useWorkspaceState('admin:logs:selectedEvent', () => (null))
const selectedApplicationLog = ref(null)
const clearConfirmOpen = ref(false)
const clearingLogs = useWorkspaceState('admin:logs:clearingLogs', () => (false))

const requestStatusOptions = [
  { label: 'All statuses', value: allOptionValue },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' },
]

const levelOptions = [
  { label: 'All levels', value: allOptionValue },
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
]

const eventSortOptions = [
  { label: 'Newest first', value: 'timestamp_desc' },
  { label: 'Oldest first', value: 'timestamp_asc' },
  { label: 'Highest latency', value: 'latency_desc' },
  { label: 'Most tokens', value: 'tokens_desc' },
  { label: 'Highest cost', value: 'cost_desc' },
  { label: 'Failures first', value: 'failed_first' },
]

const eventColumns = [
  { accessorKey: 'timestamp', header: 'Request' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'model', header: 'Provider / Model' },
  { accessorKey: 'client', header: 'Client / Node' },
  { accessorKey: 'tokens', header: 'Tokens / Latency' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } },
]

const errorLogColumns = [
  { accessorKey: 'name', header: 'File' },
  { accessorKey: 'modified', header: 'Modified' },
  { accessorKey: 'size', header: 'Size' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]

const requestLogColumns = [
  { accessorKey: 'timestamp', header: 'Request' },
  { accessorKey: 'file_name', header: 'File' },
  { accessorKey: 'model', header: 'Provider / Model' },
  { accessorKey: 'home_ip', header: 'Home' },
  { accessorKey: 'available', header: 'Availability' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } },
]

const applicationColumns = [
  { accessorKey: 'timestamp', header: 'Time' },
  { accessorKey: 'level', header: 'Level' },
  { accessorKey: 'line', header: 'Log line' },
  { accessorKey: 'source', header: 'Home / Client' },
  { accessorKey: 'request_id', header: 'Request ID' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]

const loading = computed(() => {
  if (activeView.value === 'events') return eventsLoading.value
  if (activeView.value === 'request-logs') return requestLogsLoading.value
  if (activeView.value === 'error-logs') return errorLogsLoading.value
  return applicationLoading.value
})

const events = computed(() => Array.isArray(eventsResponse.value?.items) ? eventsResponse.value.items : [])
const eventsTotal = computed(() => Number(eventsResponse.value?.total) || 0)
const requestLogs = computed(() => Array.isArray(requestLogsResponse.value?.items) ? requestLogsResponse.value.items : [])
const requestLogsTotal = computed(() => Number(requestLogsResponse.value?.total) || 0)
const applicationLogs = computed(() => Array.isArray(applicationResponse.value?.logs) ? applicationResponse.value.logs : [])
const applicationTotal = computed(() => Number(applicationResponse.value?.total) || 0)
const errorLogs = computed(() => Array.isArray(errorLogsResponse.value?.files) ? errorLogsResponse.value.files : [])
const filteredErrorLogs = computed(() => {
  const query = errorLogSearch.value.trim().toLowerCase()
  return query ? errorLogs.value.filter(item => String(item.name || '').toLowerCase().includes(query)) : errorLogs.value
})
const pagedErrorLogs = computed(() => filteredErrorLogs.value.slice((errorLogsPage.value - 1) * errorLogPageSize.value, errorLogsPage.value * errorLogPageSize.value))
const hasEventError = computed(() => {
  const error = selectedEvent.value?.event?.error
  return Boolean(error?.message || error?.reason || error?.body_preview)
})

const activeDescription = computed(() => {
  if (activeView.value === 'events') return 'DB-backed request metadata; raw payloads and credentials are not exposed.'
  if (activeView.value === 'request-logs') return 'Downloads are authenticated and may be forwarded to another Home node.'
  if (activeView.value === 'error-logs') return 'Local error files are exposed only while detailed request logging is disabled.'
  return 'Application logs are stored in the shared database; filters do not affect the clear-all action.'
})

const buildRequestParams = () => {
  const source = appliedRequestFilters.value
  const params = new URLSearchParams()
  if (source.from) params.set('from', source.from)
  if (source.to) params.set('to', source.to)
  if (timezone) params.set('timezone', timezone)
  if (source.provider.trim()) params.set('provider', source.provider.trim())
  if (source.model.trim()) params.set('model', source.model.trim())
  if (source.status) params.set('status', source.status)
  if (source.search.trim()) params.set('search', source.search.trim())
  return params
}

const loadEvents = async () => {
  eventsLoading.value = true
  try {
    const params = buildRequestParams()
    params.set('limit', String(pageSize.value))
    params.set('offset', String((eventsPage.value - 1) * pageSize.value))
    params.set('sort', eventSort.value)
    eventsResponse.value = await fetchAPI(`/request-events?${params.toString()}`)
  } finally {
    eventsLoading.value = false
  }
}

const loadRequestLogs = async () => {
  requestLogsLoading.value = true
  try {
    const params = buildRequestParams()
    params.set('limit', String(pageSize.value))
    params.set('offset', String((requestLogsPage.value - 1) * pageSize.value))
    requestLogsResponse.value = await fetchAPI(`/request-logs?${params.toString()}`)
  } finally {
    requestLogsLoading.value = false
  }
}

const loadErrorLogs = async () => {
  errorLogsLoading.value = true
  try {
    errorLogsResponse.value = await fetchAPI('/observability/logs/errors')
    const pages = Math.max(1, Math.ceil(filteredErrorLogs.value.length / errorLogPageSize.value))
    if (errorLogsPage.value > pages) errorLogsPage.value = pages
  } finally {
    errorLogsLoading.value = false
  }
}

const loadApplicationLogs = async () => {
  applicationLoading.value = true
  try {
    const source = appliedApplicationFilters.value
    const params = new URLSearchParams()
    if (source.after) params.set('after', new Date(source.after).toISOString())
    if (source.before) params.set('before', new Date(source.before).toISOString())
    if (source.level) params.set('level', source.level)
    if (source.home_ip.trim()) params.set('home_ip', source.home_ip.trim())
    if (source.client_ip.trim()) params.set('client_ip', source.client_ip.trim())
    if (source.request_id.trim()) params.set('request_id', source.request_id.trim())
    params.set('limit', String(applicationPageSize.value))
    params.set('offset', String((applicationPage.value - 1) * applicationPageSize.value))
    applicationResponse.value = await fetchAPI(`/observability/logs?${params.toString()}`)
  } finally {
    applicationLoading.value = false
  }
}

const refreshActive = async () => {
  errorMessage.value = ''
  try {
    if (activeView.value === 'events') await loadEvents()
    else if (activeView.value === 'request-logs') await loadRequestLogs()
    else if (activeView.value === 'error-logs') await loadErrorLogs()
    else await loadApplicationLogs()
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to load logs.')
  }
}

const switchView = async (view) => {
  if (activeView.value === view) return
  activeView.value = view
  await refreshActive()
}

const applyFilters = async () => {
  if (activeView.value === 'application') {
    appliedApplicationFilters.value = { ...applicationFilters.value }
    applicationPage.value = 1
  } else if (activeView.value === 'error-logs') {
    errorLogsPage.value = 1
  } else {
    appliedRequestFilters.value = { ...requestFilters.value }
    eventsPage.value = 1
    requestLogsPage.value = 1
  }
  await refreshActive()
}

const resetFilters = async () => {
  if (activeView.value === 'application') {
    applicationFilters.value = defaultApplicationFilters()
    appliedApplicationFilters.value = defaultApplicationFilters()
    applicationPage.value = 1
  } else if (activeView.value === 'error-logs') {
    errorLogSearch.value = ''
    errorLogsPage.value = 1
  } else {
    requestFilters.value = defaultRequestFilters()
    appliedRequestFilters.value = defaultRequestFilters()
    eventSort.value = 'timestamp_desc'
    eventsPage.value = 1
    requestLogsPage.value = 1
  }
  await refreshActive()
}

const changeEventsPage = async (delta) => {
  const next = eventsPage.value + delta
  const pages = Math.max(1, Math.ceil(eventsTotal.value / pageSize.value))
  if (next < 1 || next > pages) return
  eventsPage.value = next
  await refreshActive()
}

const changeRequestLogsPage = async (delta) => {
  const next = requestLogsPage.value + delta
  const pages = Math.max(1, Math.ceil(requestLogsTotal.value / pageSize.value))
  if (next < 1 || next > pages) return
  requestLogsPage.value = next
  await refreshActive()
}

const changeApplicationPage = async (delta) => {
  const next = applicationPage.value + delta
  const pages = Math.max(1, Math.ceil(applicationTotal.value / applicationPageSize.value))
  if (next < 1 || next > pages) return
  applicationPage.value = next
  await refreshActive()
}

const changeErrorLogsPage = (delta) => {
  const next = errorLogsPage.value + delta
  const pages = Math.max(1, Math.ceil(filteredErrorLogs.value.length / errorLogPageSize.value))
  if (next < 1 || next > pages) return
  errorLogsPage.value = next
}

const resetPages = async () => {
  eventsPage.value = 1
  requestLogsPage.value = 1
  applicationPage.value = 1
  errorLogsPage.value = 1
  await refreshActive()
}

const closeApplicationDetail = (open) => {
  if (!open) selectedApplicationLog.value = null
}

const validErrorLogName = name => /^error-[^/\\]+\.log$/.test(String(name || ''))

const openEventDetail = async (event) => {
  if (!event?.id) return
  eventDetailOpen.value = true
  eventDetailLoading.value = true
  selectedEvent.value = null
  errorMessage.value = ''
  try {
    selectedEvent.value = await fetchAPI(`/request-events/${encodeURIComponent(event.id)}?include_payload=true&include_logs=true&include_related=true`)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to load request event details.')
    eventDetailOpen.value = false
  } finally {
    eventDetailLoading.value = false
  }
}

const downloadRequestLog = async (downloadUrl, requestId) => {
  if (!downloadUrl) return
  downloadingId.value = requestId || downloadUrl
  errorMessage.value = ''
  try {
    const blob = await fetchAPI(downloadUrl, { responseType: 'blob' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `${requestId || 'request'}.log`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to download the request log.')
  } finally {
    downloadingId.value = ''
  }
}

const downloadErrorLog = async (name) => {
  if (!validErrorLogName(name)) {
    errorMessage.value = 'Invalid request error log filename.'
    return
  }
  downloadingId.value = name
  errorMessage.value = ''
  try {
    const blob = await fetchAPI(`/observability/logs/errors/${encodeURIComponent(name)}`, { responseType: 'blob' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to download the request error log.')
  } finally {
    downloadingId.value = ''
  }
}

const clearApplicationLogs = async () => {
  clearingLogs.value = true
  errorMessage.value = ''
  try {
    await fetchAPI('/observability/logs', { method: 'DELETE' })
    clearConfirmOpen.value = false
    applicationPage.value = 1
    await loadApplicationLogs()
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Failed to clear application logs.')
  } finally {
    clearingLogs.value = false
  }
}

const rowValue = (row) => row?.original || row
const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0)
const formatDateTime = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const formatMilliseconds = (value) => value === null || value === undefined ? '—' : `${formatNumber(value)} ms`
const formatHost = (host, port) => host ? `${host}${port ? `:${port}` : ''}` : '—'
const formatAmount = (amount, currency) => amount === null || amount === undefined ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(Number(amount))} ${currency || 'credits'}`
const formatBoolean = (value) => value === null || value === undefined ? '—' : value ? 'Yes' : 'No'
const formatBytes = (value) => {
  if (value === null || value === undefined) return 'Size unavailable'
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
const levelColor = (level) => {
  switch (String(level || '').toLowerCase()) {
    case 'error': return 'error'
    case 'warn':
    case 'warning': return 'warning'
    case 'info': return 'primary'
    default: return 'neutral'
  }
}
const apiErrorMessage = (error, fallback) => error?.data?.message || error?.data?.error || error?.message || fallback

watch(errorLogSearch, () => { errorLogsPage.value = 1 })
watch(liveRefresh, enabled => {
  if (liveRefreshTimer) clearInterval(liveRefreshTimer)
  liveRefreshTimer = enabled ? setInterval(() => { if (!loading.value) void refreshActive() }, 15_000) : null
})
useDataSync('admin:logs:sync', refreshActive)
onMounted(refreshActive)
onBeforeUnmount(() => { if (liveRefreshTimer) clearInterval(liveRefreshTimer) })
</script>

<script>
export default {
  components: {
    EmptyState: {
      props: { icon: String, message: String },
      template: `
        <div class="flex flex-col items-center justify-center py-12">
          <UIcon :name="icon" class="mb-3 size-8 text-[var(--ui-text-muted)]" />
          <span class="text-sm text-[var(--ui-text-muted)]">{{ message }}</span>
        </div>
      `,
    },
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
    TablePager: {
      props: {
        page: Number,
        total: Number,
        pageSize: Number,
        loading: Boolean,
      },
      emits: ['previous', 'next'],
      computed: {
        pages() { return Math.max(1, Math.ceil((this.total || 0) / (this.pageSize || 1))) },
        start() { return this.total === 0 ? 0 : ((this.page - 1) * this.pageSize) + 1 },
        end() { return Math.min(this.page * this.pageSize, this.total || 0) },
      },
      methods: {
        formatted(value) { return new Intl.NumberFormat().format(Number(value) || 0) },
      },
      template: `
        <div class="flex flex-col gap-3 border-t border-[var(--ui-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-[var(--ui-text-muted)]">Showing {{ start }}–{{ end }} of {{ formatted(total) }}</p>
          <div class="flex items-center gap-2">
            <AppButton size="sm" color="neutral" variant="outline" :disabled="page <= 1 || loading" @click="$emit('previous')">Previous</AppButton>
            <span class="min-w-20 text-center text-sm">Page {{ page }} of {{ pages }}</span>
            <AppButton size="sm" color="neutral" variant="outline" :disabled="page >= pages || loading" @click="$emit('next')">Next</AppButton>
          </div>
        </div>
      `,
    },
  },
}
</script>
