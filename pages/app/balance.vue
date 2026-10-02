<template>
  <div class="space-y-6">
    <UAlert v-if="pageError" color="error" variant="subtle" title="Could not load balance information" :description="pageError" />

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div class="grid min-w-0 grid-cols-2 gap-4 lg:col-span-6">
        <AppCard v-for="metric in metrics" :key="metric.label" tinted :accent="metric.label === 'Current balance' ? 'emerald' : undefined">
          <p class="text-sm text-[var(--ui-text-muted)]">{{ metric.label }}</p><p class="mt-2 break-words text-2xl font-bold tabular-nums">{{ metric.value }}</p><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ metric.detail }}</p>
        </AppCard>
      </div>
      <AppCard class="min-w-0 lg:col-span-6">
        <template #header><h2 class="font-semibold">Recharge Token</h2></template>
        <form class="space-y-4" @submit.prevent="recharge">
          <UAlert v-if="rechargeError" color="error" variant="subtle" title="Recharge failed" :description="rechargeError" />
          <UFormField label="Recharge amount (credits)" required hint="Enter any positive amount.">
            <div class="flex items-center gap-3">
              <UInput v-model="amount" type="number" min="0" step="any" placeholder="100" class="min-w-0 flex-1" :disabled="saving" required />
              <AppButton type="submit" icon="i-tabler-plus" class="shrink-0" :loading="saving" :disabled="!validAmount || !token">Topup {{ validAmount ? formatCredits(Number(amount)) : '' }}</AppButton>
            </div>
          </UFormField>
        </form>
      </AppCard>
    </div>
    <div>
      <AppCard class="min-w-0" :ui="{ body: 'p-0' }">
      <template #header><div><h2 class="font-semibold">Balance history</h2><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(recordsTotal) }} recharge and deduction records</p></div></template>
      <div class="overflow-x-auto">
        <AppTable :data="records" :columns="recordColumns" :loading="loading || recordsLoading" empty="No balance adjustments yet." class="min-w-[720px]">
          <template #created_at-cell="{ row }">{{ formatDate(balanceRow(row).created_at) }}</template>
          <template #type-cell="{ row }"><UBadge :color="balanceRow(row).type === 'recharge' ? 'success' : 'warning'" variant="subtle">{{ balanceRow(row).type }}</UBadge></template>
          <template #amount-cell="{ row }"><span class="font-mono font-semibold">{{ balanceRow(row).type === 'recharge' ? '+' : '−' }}{{ formatCredits(balanceRow(row).amount) }}</span></template>
          <template #balance_before-cell="{ row }">{{ formatCredits(balanceRow(row).balance_before) }}</template>
          <template #balance_after-cell="{ row }">{{ formatCredits(balanceRow(row).balance_after) }}</template>
        </AppTable>
      </div>
      <template #footer><div class="flex flex-wrap items-center justify-between gap-3 text-sm"><span>Page {{ recordPage }} of {{ recordPages }}</span><div class="flex gap-2"><AppButton size="sm" color="neutral" variant="outline" :disabled="recordPage <= 1 || busy" @click="changeRecordPage(-1)">Previous</AppButton><AppButton size="sm" color="neutral" variant="outline" :disabled="recordPage >= recordPages || busy" @click="changeRecordPage(1)">Next</AppButton></div></div></template>
      </AppCard>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { BillingBalanceRecord, BillingOverview } from '~/composables/useUserApi'

definePageMeta({ layout: 'app' })
const { currentUser, token, hydrateSession, fetchAPI, loadCurrentUser } = useUserApi()
const loading = ref(false)
const saving = ref(false)
const recordsLoading = ref(false)
const busy = computed(() => loading.value || saving.value || recordsLoading.value)
const pageError = ref('')
const rechargeError = ref('')
const toast = useToast()
const amount = ref('')
const validAmount = computed(() => Number.isFinite(Number(amount.value)) && Number(amount.value) > 0)
const overview = ref<BillingOverview | null>(null)
const records = ref<BillingBalanceRecord[]>([])

const recordsTotal = ref(0)

const recordPage = ref(1)

const pageSize = 20
const recordPages = computed(() => Math.max(1, Math.ceil(recordsTotal.value / pageSize)))

const formatNumber = (value?: number) => new Intl.NumberFormat().format(value ?? 0)
const balanceRow = (row: { original: unknown }) => row.original as BillingBalanceRecord

const formatCredits = (value?: number) => value == null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)
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
    const response = await fetchAPI<PageResponse<BillingBalanceRecord>>('/billing/balance-records', { query: { limit: pageSize, offset: (recordPage.value - 1) * pageSize } })
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
      fetchAPI<{ overview: BillingOverview }>('/billing/overview').then(response => { overview.value = response.overview }),
      loadCurrentUser(), loadRecords()
    ])
    const failure = results.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') pageError.value = failure.reason?.message || 'Please try refreshing again.'
  } finally { loading.value = false }
}
async function recharge() {
  if (!validAmount.value || saving.value) return
  saving.value = true
  rechargeError.value = ''

  const rechargeAmount = Number(amount.value)
  try {
    const response = await fetchAPI<{ record: BillingBalanceRecord; current_balance: number }>('/billing/recharge', { method: 'POST', body: { amount: rechargeAmount } })
    if (currentUser.value) currentUser.value.credits = response.current_balance
    if (overview.value) overview.value.current_balance = response.current_balance
    toast.add({
      title: 'Recharge completed',
      description: `${formatCredits(rechargeAmount)} credits recharged. Balance after recharge: ${formatCredits(response.current_balance)}. Transaction: ${response.record.id}.`,
      color: 'success',
      icon: 'i-tabler-circle-check'
    })
    amount.value = ''
    recordPage.value = 1
    await refresh()
  } catch (error: any) {
    rechargeError.value = error?.message || 'Recharge could not be completed. Refresh and check your history before retrying.'
  } finally { saving.value = false }
}
async function changeRecordPage(delta: number) {
  const previous = recordPage.value
  recordPage.value += delta
  pageError.value = ''
  try { await loadRecords() } catch (error: any) { recordPage.value = previous; pageError.value = error?.message || 'Could not load balance history.' }
}

onMounted(() => { hydrateSession(); void refresh() })
</script>
