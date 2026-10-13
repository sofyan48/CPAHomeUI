<template>
  <div class="balance-workspace min-w-0 space-y-6">
    <UAlert v-if="pageError" color="error" variant="subtle" title="Could not load balance information" :description="pageError" />

    <section class="balance-hero grid min-w-0 gap-6 rounded-2xl border p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center" aria-labelledby="balance-title">
      <div class="min-w-0">
        <p class="flex items-center gap-2 text-xs font-medium text-[var(--ui-text-muted)]"><UIcon name="i-tabler-wallet" class="size-4 text-[var(--ui-success)]" aria-hidden="true" /> Account credits</p>
        <h1 id="balance-title" class="mt-2 text-2xl font-semibold tracking-tight text-[var(--ui-text-highlighted)]">Balance</h1>
        <p class="mt-2 max-w-md text-sm leading-relaxed text-[var(--ui-text-muted)]">Keep your next request covered. Add credits, track spending, and review your account activity in one place.</p>
      </div>
      <dl class="grid min-w-0 gap-3 sm:grid-cols-2" :aria-busy="loading">
        <div v-for="(metric, index) in metrics" :key="metric.label" class="balance-summary min-w-0 rounded-xl border p-4">
          <dt class="flex items-center gap-2 text-xs font-medium text-[var(--ui-text-muted)]"><UIcon :name="index === 0 ? 'i-tabler-wallet' : 'i-tabler-arrow-down-left'" class="size-4 text-[var(--ui-success)]" aria-hidden="true" />{{ metric.label }}</dt>
          <dd class="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums text-[var(--ui-text-highlighted)]">{{ metric.value }}<span class="ml-1 text-xs font-normal tracking-normal text-[var(--ui-text-muted)]">credits</span></dd>
          <dd class="mt-2 text-xs text-[var(--ui-text-muted)]">{{ metric.detail }}</dd>
        </div>
      </dl>
    </section>

    <AppCard class="balance-panel min-w-0" :ui="{ body: resetAllowanceSupported ? 'grid gap-5 lg:grid-cols-2 lg:items-stretch' : 'grid gap-5' }">
      <template #header><div class="flex items-center gap-3"><span class="balance-icon flex size-9 shrink-0 items-center justify-center rounded-xl"><UIcon name="i-tabler-coins" class="size-5" aria-hidden="true" /></span><div><h2 class="text-sm font-semibold">{{ resetAllowanceSupported ? 'Topup & reset allowance' : 'Add credits' }}</h2><p class="mt-0.5 text-xs text-[var(--ui-text-muted)]">{{ resetAllowanceSupported ? 'Request credits and manage your period-limit resets.' : 'Top up your available balance.' }}</p></div></div></template>
      <div class="min-w-0 space-y-3">
        <h3 class="text-sm font-semibold">{{ topupApprovalEnabled ? 'Request topup' : 'Add credits' }}</h3>
        <form class="space-y-4" @submit.prevent="recharge">
          <UAlert v-if="pendingTopup" color="warning" variant="subtle" icon="i-tabler-clock" title="Topup awaiting approval" :description="`Your request for ${formatCredits(pendingTopup.amount)} credits is waiting for administrator approval. Your balance has not changed. You cannot request another topup while this request is pending.`" />

          <UAlert v-if="rechargeError" color="error" variant="subtle" title="Recharge failed" :description="rechargeError" />
          <UFormField label="Amount (credits)" required>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <UInput v-model="amount" type="number" min="0" step="any" placeholder="100" class="min-w-0 flex-1" :disabled="saving || loading || !requestStateLoaded || !!pendingTopup" required />
              <AppButton type="submit" icon="i-tabler-plus" class="shrink-0" :loading="saving" :disabled="!validAmount || !token || loading || !requestStateLoaded || !!pendingTopup">{{ topupApprovalEnabled ? 'Request topup' : 'Topup' }} {{ validAmount ? formatCredits(Number(amount)) : '' }}</AppButton>
            </div>
          </UFormField>
          <AppButton v-if="pendingTopup || !requestStateLoaded" type="button" color="neutral" variant="outline" icon="i-tabler-refresh" :loading="loading" :disabled="saving" @click="refresh">Refresh status</AppButton>
        </form>
      </div>
      <section v-if="resetAllowanceSupported" class="min-w-0 space-y-3 border-t border-[var(--ui-border)] pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5" aria-labelledby="reset-allowance-title" :aria-busy="resetLoading">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><h3 id="reset-allowance-title" class="flex items-center gap-2 text-sm font-semibold"><UIcon name="i-tabler-refresh" class="size-4 text-[var(--ui-primary)]" aria-hidden="true" /> Reset Available: {{ resetLoading ? '…' : resetLoadError ? '—' : resetAllowance?.available ?? '—' }}</h3>
            <p v-if="resetAllowance && !resetLoadError" class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ resetAllowance.mode === 'monthly' ? `${resetAllowance.amount} resets per month · Unused resets do not carry over.` : resetAllowance.mode === 'one_time' ? 'One-time reset allowance.' : 'No reset allowance has been granted.' }}</p>
            <p v-if="!resetLoadError && (resetAllowance?.renews_at || resetAllowance?.expires_at)" class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ resetAllowance?.mode === 'monthly' ? 'Renews' : 'Expires' }} {{ formatDate(resetAllowance?.renews_at || resetAllowance?.expires_at || '') }}</p>
          </div>
          <AppButton v-if="!resetLoading && !resetLoadError && resetAllowance && resetAllowance.available > 0" icon="i-tabler-refresh" :disabled="resetPending || !enabledPeriodWindows.length" @click="resetError = ''; resetConfirmOpen = true">Reset limits</AppButton>
        </div>
        <p class="text-xs text-[var(--ui-text-muted)]">Reset all enabled period limits at once. Credits and usage history stay unchanged.</p>
        <p v-if="!resetLoading && !resetLoadError && periodLimits && !enabledPeriodWindows.length" class="text-xs text-[var(--ui-text-muted)]">There are no enabled period limits to reset.</p>
        <UAlert v-if="resetLoadError" color="error" variant="subtle" title="Reset allowance could not be loaded" :description="resetLoadError" />
        <AppButton v-if="resetLoadError" size="sm" color="neutral" variant="outline" :loading="resetLoading" @click="loadResetLimits">Retry</AppButton>
      </section>
    </AppCard>
    <AppModal v-model:open="resetConfirmOpen" title="Reset all enabled period limits?" :dismissible="!resetPending">
      <template #body><div class="space-y-4"><p class="text-sm">This uses one reset to clear usage for every enabled period window on your account. Your configured limits, credits, and usage history will not change.</p><UAlert v-if="resetError" color="error" variant="subtle" :description="resetError" /><div class="flex justify-end gap-2"><AppButton color="neutral" variant="outline" :disabled="resetPending" @click="resetConfirmOpen = false">Cancel</AppButton><AppButton :loading="resetPending" :disabled="resetPending" @click="useResetAllowance">Use Reset</AppButton></div></div></template>
    </AppModal>
    <AppUserWorkspace section="billing" class="min-w-0">
      <template #balance-history>
      <AppCard class="balance-panel flex min-w-0 flex-col overflow-hidden" :ui="{ header: 'min-h-24', body: 'flex-1 p-0' }">
      <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div><h2 class="flex items-center gap-2 text-sm font-semibold"><UIcon name="i-tabler-history" class="size-4 text-[var(--ui-primary)]" aria-hidden="true" /> Balance history</h2><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(recordsTotal) }} recharge and deduction records</p></div>
                <UFormField label="Rows per page"><USelect v-model="pageSize" :items="pageSizeOptions" value-key="value" label-key="label" class="w-28" :disabled="busy" @update:model-value="changeRecordPageSize" /></UFormField>
              </div>
            </template>
      <div class="min-h-64 overflow-x-auto">
        <AppTable :data="records" :columns="recordColumns" :loading="loading || recordsLoading" empty="No balance adjustments yet." class="min-w-[720px]">
          <template #created_at-cell="{ row }">{{ formatDate(balanceRow(row).created_at) }}</template>
          <template #type-cell="{ row }"><UBadge :color="balanceRow(row).type === 'recharge' ? 'success' : 'warning'" variant="subtle">{{ balanceRow(row).type }}</UBadge></template>
          <template #amount-cell="{ row }"><span class="font-mono font-semibold">{{ balanceRow(row).type === 'recharge' ? '+' : '−' }}{{ formatCredits(balanceRow(row).amount) }}</span></template>
          <template #balance_before-cell="{ row }">{{ formatCredits(balanceRow(row).balance_before) }}</template>
          <template #balance_after-cell="{ row }">{{ formatCredits(balanceRow(row).balance_after) }}</template>
        </AppTable>
      </div>
      <template #footer><div class="flex flex-wrap items-center justify-between gap-3 text-sm"><span class="text-[var(--ui-text-muted)]">Showing {{ recordRangeStart }}–{{ recordRangeEnd }} of {{ formatNumber(recordsTotal) }}</span><div class="flex items-center gap-2"><AppButton size="sm" color="neutral" variant="outline" :disabled="recordPage <= 1 || busy" @click="changeRecordPage(-1)">Previous</AppButton><span>Page {{ recordPage }} of {{ recordPages }}</span><AppButton size="sm" color="neutral" variant="outline" :disabled="recordPage >= recordPages || busy" @click="changeRecordPage(1)">Next</AppButton></div></div></template>
      </AppCard>
      </template>
    </AppUserWorkspace>
  </div>
</template>

<script setup lang="ts">
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import type { BillingBalanceRecord, BillingOverview, BillingRechargeRequest } from '~/composables/useUserApi'

definePageMeta({ layout: 'app' })
const { currentUser, token, hydrateSession, fetchAPI, loadCurrentUser, capabilities, loadCapabilities } = useUserApi()
const topupApprovalEnabled = computed(() => capabilities.value.topup_approval === true)
const resetAllowanceSupported = computed(() => capabilities.value.user_reset_allowance === true)
type ResetAllowanceStatus = { mode: string; amount: number; available: number; expires_at: string | null; renews_at: string | null }
type PeriodLimitsStatus = { windows?: { id: string; enabled: boolean; limit: number | null }[]; reset_allowance?: ResetAllowanceStatus }
const periodLimits = useWorkspaceState<PeriodLimitsStatus | null>('user:balance:period-limits', () => null)
const resetAllowance = computed(() => periodLimits.value?.reset_allowance)
const enabledPeriodWindows = computed(() => (periodLimits.value?.windows || []).filter(window => window.enabled && window.limit != null))
const resetLoading = ref(false)
const resetLoadError = ref('')
const resetConfirmOpen = ref(false)
const resetPending = ref(false)
const resetError = ref('')
const resetController = new AbortController()
onScopeDispose(() => resetController.abort())
async function loadResetLimits() {
  if (!resetAllowanceSupported.value || resetController.signal.aborted) return
  resetLoading.value = true
  resetLoadError.value = ''
  try {
    const response = await fetchAPI<PeriodLimitsStatus>('/period-limits', { signal: resetController.signal })
    if (!response.reset_allowance) throw new Error('The server did not return reset allowance information. Update Home and refresh this page.')
    if (!resetController.signal.aborted) periodLimits.value = response
  } catch (cause: any) {
    if (!resetController.signal.aborted) resetLoadError.value = cause?.message || 'Unable to load reset allowance.'
  } finally { resetLoading.value = false }
}
async function useResetAllowance() {
  if (resetPending.value || !resetAllowanceSupported.value) return
  resetPending.value = true
  resetError.value = ''
  try {
    const response = await fetchAPI<{ limits: PeriodLimitsStatus }>('/period-limits/reset', { method: 'POST', signal: resetController.signal })
    if (resetController.signal.aborted) return
    periodLimits.value = response.limits
    resetConfirmOpen.value = false
    toast.add({ title: 'All enabled period limits reset.', description: 'One reset has been used. Your credits are unchanged.', color: 'success' })
  } catch (cause: any) {
    if (resetController.signal.aborted) return
    resetError.value = cause?.message || 'Unable to reset period limits.'
    await loadResetLimits()
  } finally { resetPending.value = false }
}
const requestStateLoaded = useWorkspaceState('user:balance:request-state-loaded', () => false)
const pendingTopup = useWorkspaceState<BillingRechargeRequest | null>('user:balance:pending-topup', () => null)
const loading = useWorkspaceState('user:balance:loading', () => false)
const saving = useWorkspaceState('user:balance:saving', () => false)
const recordsLoading = useWorkspaceState('user:balance:records-loading', () => false)
const busy = computed(() => loading.value || saving.value || recordsLoading.value)
const pageError = useWorkspaceState('user:balance:page-error', () => '')
const rechargeError = useWorkspaceState('user:balance:recharge-error', () => '')
const toast = useToast()
const amount = ref('')
const validAmount = computed(() => Number.isFinite(Number(amount.value)) && Number(amount.value) > 0)
const overview = useWorkspaceState<BillingOverview | null>('user:balance:overview', () => null)
const records = useWorkspaceState<BillingBalanceRecord[]>('user:balance:records', () => [])

const recordsTotal = useWorkspaceState('user:balance:records-total', () => 0)

const recordPage = ref(1)

const pageSize = ref(5)
const pageSizeOptions = [5, 20, 50, 100].map(value => ({ label: String(value), value }))
const recordPages = computed(() => Math.max(1, Math.ceil(recordsTotal.value / pageSize.value)))
const recordRangeStart = computed(() => recordsTotal.value ? (recordPage.value - 1) * pageSize.value + 1 : 0)
const recordRangeEnd = computed(() => Math.min(recordPage.value * pageSize.value, recordsTotal.value))

const formatNumber = (value?: number) => new Intl.NumberFormat().format(value ?? 0)
const balanceRow = (row: { original: unknown }) => row.original as BillingBalanceRecord

const formatCredits = (value?: number) => value == null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, roundingMode: 'ceil' } as Intl.NumberFormatOptions).format(value)
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const metrics = computed(() => [
  { label: 'Current balance', value: formatCredits(overview.value?.current_balance ?? currentUser.value?.credits), detail: 'Available account credits' },
  { label: 'Total recharge', value: formatCredits(overview.value?.total_recharge_amount), detail: 'All recorded recharges' }
])

const recordColumns = [
  { accessorKey: 'created_at', header: 'Time' }, { accessorKey: 'id', header: 'Transaction ID' },
  { accessorKey: 'type', header: 'Type' }, { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'balance_before', header: 'Balance before' }, { accessorKey: 'balance_after', header: 'Balance after' }
]

type PageResponse<T> = { items: T[]; total: number }
async function loadRecords() {
  recordsLoading.value = true
  try {
    const response = await fetchAPI<PageResponse<BillingBalanceRecord>>('/billing/balance-records', { query: { limit: pageSize.value, offset: (recordPage.value - 1) * pageSize.value } })
    records.value = response.items
    recordsTotal.value = response.total
  } finally { recordsLoading.value = false }
}

async function refresh() {
  if (!token.value || loading.value) return
  loading.value = true
  pageError.value = ''
  try {
    const results = await Promise.allSettled([
      loadTopupRequest().then(loadResetLimits),
      fetchAPI<{ overview: BillingOverview }>('/billing/overview').then(response => { overview.value = response.overview }),
      loadCurrentUser(), loadRecords()
    ])
    const failure = results.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') pageError.value = failure.reason?.message || 'Please try refreshing again.'
  } finally { loading.value = false }
}
async function loadTopupRequest() {
  requestStateLoaded.value = false
  try {
    await loadCapabilities()
  } catch (error: any) {
    if (error?.statusCode !== 404) throw error
  }
  if (topupApprovalEnabled.value) {
    const response = await fetchAPI<{ request: BillingRechargeRequest | null }>('/billing/recharge-request')
    pendingTopup.value = response.request
  } else {
    pendingTopup.value = null
  }
  requestStateLoaded.value = true
}
async function recharge() {
  if (!validAmount.value || saving.value || loading.value || !requestStateLoaded.value || pendingTopup.value) return
  saving.value = true
  rechargeError.value = ''

  const rechargeAmount = Number(amount.value)
  try {
    const response = await fetchAPI<{ request?: BillingRechargeRequest; record?: BillingBalanceRecord; current_balance: number }>('/billing/recharge', { method: 'POST', body: { amount: rechargeAmount } })
    if (response.request) {
      pendingTopup.value = response.request
      toast.add({ title: 'Topup requested', description: `${formatCredits(response.request.amount)} credits are awaiting administrator approval. Your balance has not changed.`, color: 'warning', icon: 'i-tabler-clock' })
    } else if (response.record) {
      if (currentUser.value) currentUser.value.credits = response.current_balance
      if (overview.value) overview.value.current_balance = response.current_balance
      toast.add({
        title: 'Recharge completed',
        description: `${formatCredits(rechargeAmount)} credits recharged. Balance after recharge: ${formatCredits(response.current_balance)}. Transaction: ${response.record.id}.`,
        color: 'success',
        icon: 'i-tabler-circle-check'
      })
    }
    amount.value = ''
    recordPage.value = 1
    await refresh()
  } catch (error: any) {
    rechargeError.value = error?.message || 'Recharge could not be completed. Refresh and check your history before retrying.'
    requestStateLoaded.value = false
    await refresh()
  } finally { saving.value = false }
}
async function changeRecordPageSize() {
  recordPage.value = 1
  pageError.value = ''
  try { await loadRecords() } catch (error: any) { pageError.value = error?.message || 'Could not load balance history.' }
}
async function changeRecordPage(delta: number) {
  const previous = recordPage.value
  recordPage.value += delta
  pageError.value = ''
  try { await loadRecords() } catch (error: any) { recordPage.value = previous; pageError.value = error?.message || 'Could not load balance history.' }
}

onMounted(() => { hydrateSession(); void refresh() })
</script>

<style scoped>
.balance-workspace .balance-hero {
  border-color: color-mix(in oklch, var(--ui-success) 18%, var(--ui-border));
  background: radial-gradient(ellipse at 0% 0%, color-mix(in oklch, var(--ui-success) 10%, transparent), transparent 70%), var(--ui-bg);
  box-shadow: 0 6px 24px color-mix(in oklch, var(--ui-success) 4%, transparent);
}

.balance-workspace .balance-summary {
  border-color: color-mix(in oklch, var(--ui-success) 16%, var(--ui-border));
  background: color-mix(in oklch, var(--ui-bg) 85%, transparent);
}

.balance-workspace .balance-panel {
  border-radius: 1.25rem;
  border-color: color-mix(in oklch, var(--ui-border) 75%, transparent);
  background: var(--ui-bg);
  box-shadow: 0 4px 20px color-mix(in oklch, var(--ui-text-highlighted) 4%, transparent);
}

.balance-workspace .balance-icon {
  color: var(--ui-primary);
  background: color-mix(in oklch, var(--ui-primary) 10%, var(--ui-bg));
}
</style>
