<template>
  <div class="space-y-7">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><UBadge color="primary" variant="subtle">Account #{{ user?.id }}</UBadge><h1 class="mt-3 text-3xl font-bold tracking-tight">Welcome, {{ user?.username }}</h1><p class="mt-2 text-sm text-[var(--ui-text-muted)]">Manage your API access, billing activity, and account security.</p><p v-if="tokenExpiresAt" class="mt-1 text-xs text-[var(--ui-text-dimmed)]">Session expires {{ formatDate(tokenExpiresAt) }}</p></div>
      <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="loading" @click="loadWorkspace">Refresh</UButton>
    </section>
    <UAlert v-if="error" color="error" variant="subtle" title="Some workspace data could not be loaded" :description="error" />

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="card in cards" :key="card.label"><div class="flex items-start justify-between"><div><p class="text-sm text-[var(--ui-text-muted)]">{{ card.label }}</p><p class="mt-2 text-2xl font-bold">{{ card.value }}</p><p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ card.detail }}</p></div><div class="rounded-xl bg-primary-500/10 p-2.5 text-primary-500"><UIcon :name="card.icon" class="size-5" /></div></div></UCard>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <UCard>
        <template #header><div class="flex items-center justify-between"><div><h2 class="font-semibold">API keys</h2><p class="text-xs text-[var(--ui-text-muted)]">Credentials owned by your account</p></div><UButton size="sm" icon="i-heroicons-plus" @click="openKey()">New key</UButton></div></template>
        <div v-if="keys.length" class="divide-y divide-[var(--ui-border)]">
          <div v-for="key in keys" :key="key.id" class="flex items-center gap-3 px-5 py-4">
            <div class="min-w-0 flex-1"><p class="text-sm font-medium">Key #{{ key.id }}</p><code class="block truncate text-xs text-[var(--ui-text-muted)]">{{ maskKey(key.api_key) }}</code><p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ scopeLabel(key) }}</p></div>
            <UButton icon="i-heroicons-clipboard" color="neutral" variant="ghost" size="sm" aria-label="Copy key" @click="copy(key.api_key)" />
            <UButton icon="i-heroicons-pencil-square" color="neutral" variant="ghost" size="sm" aria-label="Edit key" @click="openKey(key)" />
            <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="sm" aria-label="Delete key" @click="removeKey(key)" />
          </div>
        </div>
        <div v-else class="px-6 py-14 text-center"><UIcon name="i-heroicons-key" class="mx-auto size-8 text-[var(--ui-text-dimmed)]" /><p class="mt-3 font-medium">No API keys yet</p><p class="mt-1 text-sm text-[var(--ui-text-muted)]">Create one to start making requests.</p></div>
      </UCard>

      <UCard>
        <template #header><h2 class="font-semibold">Account security</h2></template>
        <div class="space-y-4">
          <SecurityRow icon="i-heroicons-lock-closed" title="Password" detail="Change your account password" action="Change" @action="openPassword" />
          <SecurityRow icon="i-heroicons-device-phone-mobile" title="Authenticator app" :detail="user?.totp_enabled ? 'Two-factor authentication enabled' : 'Add a time-based one-time password'" :action="user?.totp_enabled ? 'Disable' : 'Enable'" @action="user?.totp_enabled ? disableTOTP() : beginTOTP()" />
          <SecurityRow icon="i-heroicons-envelope" title="Recovery email" :detail="emailDetail" action="Manage" @action="openEmail" />
          <SecurityRow icon="i-heroicons-finger-print" title="Passkeys" :detail="`${user?.passkey_count || 0} registered`" action="Add" @action="openPasskey" />
          <div v-for="passkey in user?.passkeys || []" :key="passkey.id" class="ml-12 flex items-center justify-between rounded-lg bg-[var(--ui-bg-muted)] p-3"><div class="min-w-0"><p class="truncate text-sm font-medium">{{ passkey.name || 'Passkey' }}</p><p class="truncate text-xs text-[var(--ui-text-dimmed)]">{{ passkey.id }}</p><p v-if="passkey.created_at || passkey.updated_at" class="text-xs text-[var(--ui-text-dimmed)]">Added {{ formatDate(passkey.created_at || '') }}<span v-if="passkey.updated_at"> · updated {{ formatDate(passkey.updated_at) }}</span></p></div><UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs" @click="removePasskey(passkey)" /></div>
        </div>
      </UCard>
    </section>

    <UCard>
      <template #header><div><h2 class="font-semibold">Billing activity</h2><p class="text-xs text-[var(--ui-text-muted)]">Dates are interpreted in UTC; the end date includes the full day.</p></div></template>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="applyBillingRange">
        <UFormField label="Time range"><USelect v-model="rangePreset" :items="rangeOptions" value-key="value" label-key="label" class="w-40" @update:model-value="selectRange" /></UFormField>
        <template v-if="rangePreset === 'custom'">
          <UFormField label="From (UTC)"><UInput v-model="rangeFrom" type="date" /></UFormField>
          <UFormField label="To (UTC)"><UInput v-model="rangeTo" type="date" /></UFormField>
          <UButton type="submit" :loading="billingLoading">Apply range</UButton>
        </template>
      </form>
      <UAlert v-if="billingError" class="mt-4" color="error" variant="subtle" title="Billing request failed" :description="billingError" />
    </UCard>

    <section v-if="overview" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="metric in billingMetrics" :key="metric.label"><p class="text-sm text-[var(--ui-text-muted)]">{{ metric.label }}</p><p class="mt-2 text-2xl font-bold">{{ metric.value }}</p></UCard>
    </section>

    <section class="grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header><h2 class="font-semibold">Top models</h2></template>
        <div v-if="overview?.top_models?.length" class="space-y-3">
          <div v-for="model in overview.top_models" :key="model.id || model.label" class="flex items-center justify-between gap-4 text-sm">
            <div class="min-w-0"><p class="truncate font-medium">{{ model.label }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(model.request_count) }} requests</p></div>
            <span class="font-mono">{{ money(model.amount) }}</span>
          </div>
        </div>
        <p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No model charges in this range.</p>
      </UCard>
      <UCard v-if="overview?.top_providers">
        <template #header><h2 class="font-semibold">Top providers</h2></template>
        <div v-if="overview.top_providers.length" class="space-y-3">
          <div v-for="provider in overview.top_providers" :key="provider.id || provider.label" class="flex items-center justify-between gap-4 text-sm"><span class="truncate">{{ provider.label }}</span><span class="font-mono">{{ money(provider.amount) }} · {{ formatNumber(provider.request_count) }} requests</span></div>
        </div>
        <p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No provider charges in this range.</p>
      </UCard>
      <UCard v-if="overview?.daily_trend">
        <template #header><h2 class="font-semibold">Daily charges</h2></template>
        <div v-if="overview.daily_trend.length" class="space-y-3">
          <div v-for="day in overview.daily_trend" :key="day.date" class="flex justify-between gap-4 text-sm"><span>{{ day.date }}</span><span>{{ money(day.charge_amount) }} · {{ formatNumber(day.request_count) }} requests</span></div>
        </div>
        <p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No daily charges in this range.</p>
      </UCard>
    </section>

    <UCard>
      <template #header><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">Charges</h2><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(chargesTotal) }} matching records</p></div><UFormField label="Page size"><USelect v-model="chargePageSize" :items="pageSizeOptions" value-key="value" label-key="label" class="w-32" @update:model-value="changePageSize" /></UFormField></div></template>
      <UTable :data="charges" :columns="chargeColumns" :loading="billingLoading">
        <template #created_at-cell="{ row }"><span class="text-sm">{{ formatDate(rowValue(row).created_at) }}</span></template>
        <template #model-cell="{ row }"><div><p class="font-medium">{{ rowValue(row).model }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).provider }}</p></div></template>
        <template #tokens-cell="{ row }"><span class="text-sm">{{ formatNumber(rowValue(row).input_tokens) }} in · {{ formatNumber(rowValue(row).output_tokens) }} out</span></template>
        <template #amount-cell="{ row }"><div class="font-mono text-sm">{{ money(rowValue(row).amount) }}<p class="text-xs text-[var(--ui-text-muted)]">Bal. {{ money(rowValue(row).balance_after) }}</p></div></template>
        <template #actions-cell="{ row }"><UButton size="sm" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="openChargeDetail(rowValue(row))">Details</UButton></template>
        <template #empty><div class="py-12 text-center text-sm text-[var(--ui-text-muted)]">No billing charges found.</div></template>
      </UTable>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-border)] px-4 py-3 text-sm"><span>Showing {{ chargesTotal ? (chargePage - 1) * chargePageSize + 1 : 0 }}–{{ Math.min(chargePage * chargePageSize, chargesTotal) }} of {{ formatNumber(chargesTotal) }}</span><div class="flex items-center gap-2"><UButton size="sm" color="neutral" variant="outline" :disabled="chargePage <= 1 || billingLoading" @click="changeChargePage(-1)">Previous</UButton><span>Page {{ chargePage }} of {{ chargePages }}</span><UButton size="sm" color="neutral" variant="outline" :disabled="chargePage >= chargePages || billingLoading" @click="changeChargePage(1)">Next</UButton></div></div>
    </UCard>

    <UModal v-model:open="chargeDetailOpen" title="Charge details" description="Billing record for this request.">
      <template #body>
        <dl v-if="selectedCharge" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div v-if="selectedCharge.id" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Charge ID</dt><dd class="mt-1 break-all font-mono text-xs">{{ selectedCharge.id }}</dd></div>
          <div v-if="selectedCharge.request_id" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Request ID</dt><dd class="mt-1 break-all font-mono text-xs">{{ selectedCharge.request_id }}</dd></div>
          <div v-if="selectedCharge.created_at" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Created</dt><dd class="mt-1 text-sm">{{ formatDate(selectedCharge.created_at) }}</dd></div>
          <div v-if="selectedCharge.provider" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Provider</dt><dd class="mt-1 break-words text-sm">{{ selectedCharge.provider }}</dd></div>
          <div v-if="selectedCharge.model" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Model</dt><dd class="mt-1 break-words text-sm">{{ selectedCharge.model }}</dd></div>
          <div v-if="selectedCharge.input_tokens != null" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Input tokens</dt><dd class="mt-1 text-sm">{{ formatNumber(selectedCharge.input_tokens) }}</dd></div>
          <div v-if="selectedCharge.output_tokens != null" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Output tokens</dt><dd class="mt-1 text-sm">{{ formatNumber(selectedCharge.output_tokens) }}</dd></div>
          <div v-if="selectedCharge.amount != null" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Amount</dt><dd class="mt-1 font-mono text-sm">{{ money(selectedCharge.amount) }}</dd></div>
          <div v-if="selectedCharge.balance_after != null" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">Balance after</dt><dd class="mt-1 font-mono text-sm">{{ money(selectedCharge.balance_after) }}</dd></div>
        </dl>
      </template>
    </UModal>

    <UModal v-model:open="keyOpen" :title="editingKey ? 'Edit API key' : 'Create API key'" description="Leave the value blank when creating to let Home generate a secure key."><template #body><form class="space-y-5" @submit.prevent="saveKey"><UAlert v-if="modalError" color="error" variant="subtle" :description="modalError" /><UFormField label="API key" :hint="editingKey ? 'Change this value to rotate the key.' : 'Optional'"><UInput v-model="keyForm.api_key" class="w-full font-mono" autocomplete="off" /></UFormField><UFormField label="Channel group IDs" hint="Search existing IDs or type an ID and press Enter; empty means unrestricted"><UInputMenu v-model="keyForm.channels" :items="channelIDOptions" multiple create-item placeholder="Search or add channel ID" class="w-full" @create="addScopeID('channels', $event)" /></UFormField><UFormField label="Model group IDs" hint="Search existing IDs or type an ID and press Enter; empty means unrestricted"><UInputMenu v-model="keyForm.modelGroups" :items="modelGroupIDOptions" multiple create-item placeholder="Search or add model group ID" class="w-full" @create="addScopeID('modelGroups', $event)" /></UFormField><div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" type="button" @click="closeKey">Cancel</UButton><UButton type="submit" :loading="saving">Save</UButton></div></form></template></UModal>

    <UModal v-model:open="passwordOpen" title="Change password"><template #body><form class="space-y-5" @submit.prevent="changePassword"><UAlert v-if="modalError" color="error" variant="subtle" :description="modalError" /><UFormField label="New password" required><UInput v-model="passwordForm.password" class="w-full" type="password" autocomplete="new-password" /></UFormField><UFormField label="Confirm password" required><UInput v-model="passwordForm.confirm" class="w-full" type="password" autocomplete="new-password" /></UFormField><div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" type="button" @click="closePassword">Cancel</UButton><UButton type="submit" :loading="saving">Change password</UButton></div></form></template></UModal>

    <UModal v-model:open="emailOpen" title="Recovery email"><template #body><form class="space-y-5" @submit.prevent="updateEmail"><UAlert v-if="modalError" color="error" variant="subtle" :description="modalError" /><UFormField label="Email address" required><UInput v-model="email" class="w-full" type="email" /></UFormField><div class="flex flex-wrap justify-end gap-2"><UButton v-if="user?.email_status.configured" color="error" variant="soft" type="button" @click="clearEmail">Remove</UButton><UButton v-if="user?.email_status.configured && !user?.email_status.verified" color="neutral" variant="outline" type="button" @click="requestVerification">Resend verification</UButton><UButton type="submit" :loading="saving">Save email</UButton></div></form></template></UModal>

    <UModal v-model:open="totpOpen" title="Set up an authenticator app"><template #body><form class="space-y-5" @submit.prevent="bindTOTP"><UAlert v-if="modalError" color="error" variant="subtle" :description="modalError" /><p class="text-sm text-[var(--ui-text-muted)]">Add this secret to your authenticator, then enter a current code.</p><div class="rounded-xl bg-[var(--ui-bg-muted)] p-4"><p class="text-xs text-[var(--ui-text-dimmed)]">Secret</p><code class="mt-1 block break-all font-semibold">{{ totpSetup?.secret }}</code></div><UFormField label="Verification code" required><UInput v-model="totpCode" class="w-full font-mono tracking-[0.3em]" inputmode="numeric" autocomplete="one-time-code" /></UFormField><div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" type="button" @click="closeTOTP">Cancel</UButton><UButton type="submit" :loading="saving">Enable TOTP</UButton></div></form></template></UModal>

    <UModal v-model:open="passkeyOpen" title="Add a passkey" description="Your browser will ask for a device authenticator or security key."><template #body><form class="space-y-5" @submit.prevent="addPasskey"><UAlert v-if="modalError" color="error" variant="subtle" :description="modalError" /><UFormField label="Passkey name" required><UInput v-model="passkeyName" class="w-full" placeholder="MacBook Touch ID" /></UFormField><div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" type="button" @click="closePasskey">Cancel</UButton><UButton type="submit" icon="i-heroicons-finger-print" :loading="saving">Continue</UButton></div></form></template></UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const { currentUser: user, tokenExpiresAt, fetchAPI, loadCurrentUser, saveSession, capabilities, loadCapabilities, registerPasskey } = useUserApi()
type WorkspaceBillingOverview = BillingOverview & {
  total_charge_amount?: number
  total_recharge_amount?: number
  total_deduct_amount?: number
  total_balance?: number
  request_count?: number
  input_tokens?: number
  output_tokens?: number
  cache_tokens?: number
  active_user_count?: number
  top_providers?: BillingTopItem[]
  daily_trend?: { date: string; charge_amount: number; request_count: number }[]
}
type BillingChargesResponse = { items: BillingCharge[]; total: number; limit: number; offset: number }
type BillingRange = { from: string; to: string }
const toast = useToast(); const loading = ref(false); const error = ref(''); const keys = ref<UserApiKey[]>([]); const overview = ref<WorkspaceBillingOverview | null>(null); const charges = ref<BillingCharge[]>([])
const billingLoading = ref(false); const billingError = ref('')
const rangeOptions = [{ label: 'Today', value: 'today' }, { label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }, { label: 'Custom', value: 'custom' }]
const pageSizeOptions = [25, 50, 100, 200].map(value => ({ label: `${value} / page`, value }))
const rangePreset = ref('7d'); const rangeFrom = ref(''); const rangeTo = ref('')
const appliedRange = ref<BillingRange | null>(null)
const chargePage = ref(1); const chargePageSize = ref(50); const chargesTotal = ref(0)
const chargePages = computed(() => Math.max(1, Math.ceil(chargesTotal.value / chargePageSize.value)))
let billingRequest = 0
const chargeDetailOpen = ref(false); const selectedCharge = ref<BillingCharge | null>(null)
const keyOpen = ref(false); const passwordOpen = ref(false); const emailOpen = ref(false); const totpOpen = ref(false); const passkeyOpen = ref(false); const saving = ref(false); const modalError = ref(''); const editingKey = ref<UserApiKey | null>(null)
const keyForm = reactive({ api_key: '', channels: [] as string[], modelGroups: [] as string[] });
const channelIDOptions = computed(() => [...new Set(keys.value.flatMap(key => key.channels.map(String)))].sort((a, b) => Number(a) - Number(b)))
const modelGroupIDOptions = computed(() => [...new Set(keys.value.flatMap(key => key.model_groups.map(String)))].sort((a, b) => Number(a) - Number(b)))
const passwordForm = reactive({ password: '', confirm: '' }); const email = ref(''); const totpSetup = ref<any>(null); const totpCode = ref(''); const passkeyName = ref('')
const chargeColumns = [{ accessorKey: 'created_at', header: 'Date' }, { accessorKey: 'model', header: 'Model' }, { accessorKey: 'tokens', header: 'Tokens' }, { accessorKey: 'amount', header: 'Charge' }, { id: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }]
const rowValue = (row: any): BillingCharge => row?.original ?? row
function openChargeDetail(charge: BillingCharge) { selectedCharge.value = charge; chargeDetailOpen.value = true }
const openPassword = () => { modalError.value = ''; passwordOpen.value = true }
const openEmail = () => { modalError.value = ''; emailOpen.value = true }
const openPasskey = () => { modalError.value = ''; passkeyOpen.value = true }
const closeKey = () => { keyOpen.value = false }
const closePassword = () => { passwordOpen.value = false }
const closeTOTP = () => { totpOpen.value = false }
const closePasskey = () => { passkeyOpen.value = false }
const cards = computed(() => [
  { label: 'Current balance', value: money(overview.value?.current_balance ?? user.value?.credits ?? 0), detail: 'Available account credits', icon: 'i-heroicons-wallet' },
  { label: 'Month spend', value: money(overview.value?.month_spend ?? 0), detail: 'This month', icon: 'i-heroicons-banknotes' },
  { label: 'API keys', value: formatNumber(keys.value.length), detail: 'Active credentials', icon: 'i-heroicons-key' },
  { label: 'Security', value: securityScore.value, detail: 'Account protections enabled', icon: 'i-heroicons-shield-check' }
])
const billingMetrics = computed(() => {
  const data = overview.value
  if (!data) return []
  const metrics = [
    { label: 'Today spend', value: money(data.today_spend) },
    { label: 'Month spend', value: money(data.month_spend) },
    { label: 'Current balance', value: money(data.current_balance) }
  ]
  if (data.request_count != null) metrics.push({ label: 'Billed requests', value: formatNumber(data.request_count) })
  if (data.input_tokens != null) metrics.push({ label: 'Input tokens', value: formatNumber(data.input_tokens) })
  if (data.output_tokens != null) metrics.push({ label: 'Output tokens', value: formatNumber(data.output_tokens) })
  if (data.cache_tokens != null) metrics.push({ label: 'Cache tokens', value: formatNumber(data.cache_tokens) })
  if (data.total_recharge_amount != null) metrics.push({ label: 'Recharged', value: money(data.total_recharge_amount) })
  if (data.total_deduct_amount != null) metrics.push({ label: 'Deducted', value: money(data.total_deduct_amount) })
  if (data.total_balance != null) metrics.push({ label: 'Reported total balance', value: money(data.total_balance) })
  if (data.active_user_count != null) metrics.push({ label: 'Active users', value: formatNumber(data.active_user_count) })
  return metrics
})
function presetRange(preset: string): BillingRange {
  const today = new Date()
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const to = from.toISOString().slice(0, 10)
  from.setUTCDate(from.getUTCDate() - (preset === '30d' ? 29 : preset === '7d' ? 6 : 0))
  return { from: from.toISOString().slice(0, 10), to }
}
function billingQuery(range: BillingRange) { return { from: range.from, to: range.to } }
async function loadBilling() {
  const request = ++billingRequest
  const range = appliedRange.value || presetRange(rangePreset.value)
  const page = chargePage.value
  const size = chargePageSize.value
  billingLoading.value = true
  billingError.value = ''
  try {
    const [overviewResponse, chargesResponse] = await Promise.all([
      fetchAPI<{ overview: WorkspaceBillingOverview }>('/billing/overview', { query: billingQuery(range) }),
      fetchAPI<BillingChargesResponse>('/billing/charges', { query: { ...billingQuery(range), limit: size, offset: (page - 1) * size } })
    ])
    if (request !== billingRequest) return
    overview.value = overviewResponse.overview
    charges.value = chargesResponse.items || []
    chargesTotal.value = chargesResponse.total || 0
  } catch (cause: any) {
    if (request === billingRequest) billingError.value = cause?.message || 'Unable to load billing activity.'
  } finally {
    if (request === billingRequest) billingLoading.value = false
  }
}
function selectRange(preset: string) {
  if (preset === 'custom') {
    const range = appliedRange.value || presetRange('7d')
    rangeFrom.value = range.from
    rangeTo.value = range.to
    return
  }
  appliedRange.value = presetRange(preset)
  chargePage.value = 1
  void loadBilling()
}
function applyBillingRange() {
  if (!rangeFrom.value || !rangeTo.value || rangeFrom.value > rangeTo.value) {
    billingError.value = 'Choose valid From and To dates, with From on or before To.'
    return
  }
  appliedRange.value = { from: rangeFrom.value, to: rangeTo.value }
  chargePage.value = 1
  void loadBilling()
}
function changePageSize() { chargePage.value = 1; void loadBilling() }
function changeChargePage(delta: number) {
  const next = chargePage.value + delta
  if (next < 1 || next > chargePages.value) return
  chargePage.value = next
  void loadBilling()
}
const securityScore = computed(() => `${[user.value?.totp_enabled, Boolean(user.value?.passkey_count), user.value?.email_status.verified].filter(Boolean).length}/3`)
const emailDetail = computed(() => !user.value?.email_status.configured ? 'No recovery email configured' : `${user.value.email_status.masked} · ${user.value.email_status.verified ? 'verified' : 'unverified'}`)
async function loadWorkspace() {
  loading.value = true; error.value = ''
  try {
    await Promise.all([loadCapabilities().catch(() => null), loadCurrentUser(), fetchAPI<{ api_keys?: UserApiKey[] }>('/api-keys').then(r => { keys.value = (r.api_keys || []).map(item => ({ ...item, api_key: item.api_key || (item as any)['api-key'] })) }), loadBilling()])
  } catch (cause: any) { error.value = cause?.message || 'Unable to load workspace.' } finally { loading.value = false }
}
function openKey(key?: UserApiKey) { editingKey.value = key || null; keyForm.api_key = key?.api_key || ''; keyForm.channels = key?.channels.map(String) || []; keyForm.modelGroups = key?.model_groups.map(String) || [];  modalError.value = ''; keyOpen.value = true }
function addScopeID(scope: 'channels' | 'modelGroups', value: string) {
  const id = value.trim()
  if (id && !keyForm[scope].includes(id)) keyForm[scope] = [...keyForm[scope], id]
}
function IDs(value: string[]) { return value.map(item => Number(item.trim())).filter(item => Number.isInteger(item) && item > 0) }
async function saveKey() { saving.value = true; modalError.value = ''; try { const channels = IDs(keyForm.channels); const modelGroups = IDs(keyForm.modelGroups); if (channels.length !== keyForm.channels.length || modelGroups.length !== keyForm.modelGroups.length) throw new Error('Scope IDs must be positive whole numbers.'); const body: any = { channels, model_groups: modelGroups }; if (editingKey.value) { body.api_key = keyForm.api_key.trim(); await fetchAPI(`/api-keys/${editingKey.value.id}`, { method: 'PATCH', body }) } else { if (keyForm.api_key.trim()) body.api_key = keyForm.api_key.trim(); await fetchAPI('/api-keys', { method: 'POST', body }) } keyOpen.value = false; await loadWorkspace(); toast.add({ title: editingKey.value ? 'API key updated' : 'API key created', color: 'success' }) } catch (cause: any) { modalError.value = cause?.message || 'Unable to save API key.' } finally { saving.value = false } }
async function removeKey(key: UserApiKey) { if (!confirm(`Delete API key #${key.id}?`)) return; try { await fetchAPI(`/api-keys/${key.id}`, { method: 'DELETE', body: {} }); await loadWorkspace(); toast.add({ title: 'API key deleted', color: 'success' }) } catch (cause: any) { toast.add({ title: 'Delete failed', description: cause?.message, color: 'error' }) } }
async function changePassword() { modalError.value = ''; if (passwordForm.password !== passwordForm.confirm) return void (modalError.value = 'Passwords do not match.'); saving.value = true; try { const session = await fetchAPI<UserSessionResponse>('/password', { method: 'POST', body: { new_password: passwordForm.password } }); saveSession(session); passwordOpen.value = false; passwordForm.password = ''; passwordForm.confirm = ''; toast.add({ title: 'Password changed', color: 'success' }) } catch (cause: any) { modalError.value = cause?.message || 'Unable to change password.' } finally { saving.value = false } }
async function updateEmail() { saving.value = true; modalError.value = ''; try { await fetchAPI('/email', { method: 'PUT', body: { email: email.value.trim() } }); await loadCurrentUser(); emailOpen.value = false; toast.add({ title: 'Email updated', description: 'Check your inbox to verify it.', color: 'success' }) } catch (cause: any) { modalError.value = cause?.message || 'Unable to update email.' } finally { saving.value = false } }
async function clearEmail() { try { await fetchAPI('/email', { method: 'DELETE', body: {} }); await loadCurrentUser(); email.value = ''; emailOpen.value = false; toast.add({ title: 'Email removed', color: 'success' }) } catch (cause: any) { modalError.value = cause?.message || 'Unable to remove email.' } }
async function requestVerification() { try { await fetchAPI('/email/verification', { method: 'POST', body: {} }); toast.add({ title: 'Verification email queued', color: 'success' }) } catch (cause: any) { modalError.value = cause?.message || 'Unable to request verification.' } }
async function beginTOTP() { modalError.value = ''; try { totpSetup.value = await fetchAPI('/totp'); totpOpen.value = true } catch (cause: any) { toast.add({ title: 'TOTP setup failed', description: cause?.message, color: 'error' }) } }
async function bindTOTP() { saving.value = true; modalError.value = ''; try { await fetchAPI('/totp', { method: 'POST', body: { secret: totpSetup.value.secret, issuer: totpSetup.value.issuer, code: totpCode.value } }); await loadCurrentUser(); totpOpen.value = false; totpCode.value = ''; toast.add({ title: 'Authenticator enabled', color: 'success' }) } catch (cause: any) { modalError.value = cause?.message || 'Unable to enable TOTP.' } finally { saving.value = false } }
async function disableTOTP() { if (!confirm('Disable authenticator-based two-factor authentication?')) return; try { await fetchAPI('/totp', { method: 'DELETE', body: {} }); await loadCurrentUser(); toast.add({ title: 'Authenticator disabled', color: 'success' }) } catch (cause: any) { toast.add({ title: 'Unable to disable TOTP', description: cause?.message, color: 'error' }) } }
async function addPasskey() { modalError.value = ''; if (!passkeyName.value.trim()) return void (modalError.value = 'Passkey name is required.'); saving.value = true; try { await registerPasskey(passkeyName.value.trim()); passkeyOpen.value = false; passkeyName.value = ''; toast.add({ title: 'Passkey added', color: 'success' }) } catch (cause: any) { modalError.value = cause?.name === 'NotAllowedError' ? 'Passkey registration was cancelled.' : (cause?.message || 'Unable to add passkey.') } finally { saving.value = false } }
async function removePasskey(passkey: UserPasskey) { if (!confirm(`Delete ${passkey.name || 'this passkey'}?`)) return; try { await fetchAPI(`/passkeys/${encodeURIComponent(passkey.id)}`, { method: 'DELETE', body: {} }); await loadCurrentUser(); toast.add({ title: 'Passkey deleted', color: 'success' }) } catch (cause: any) { toast.add({ title: 'Unable to delete passkey', description: cause?.message, color: 'error' }) } }
async function copy(value: string) { try { await navigator.clipboard.writeText(value); toast.add({ title: 'API key copied', color: 'success' }) } catch { toast.add({ title: 'Copy failed', color: 'error' }) } }
function maskKey(value: string) { return value.length > 16 ? `${value.slice(0, 8)}••••••${value.slice(-6)}` : value }
function scopeLabel(key: UserApiKey) { const scopes = []; if (key.channels.length) scopes.push(`Channels: ${key.channels.map(id => `C#${id}`).join(', ')}`); if (key.model_groups.length) scopes.push(`Models: ${key.model_groups.map(id => `M#${id}`).join(', ')}`); return scopes.join(' · ') || 'All channels and models' }
function money(value: unknown) { const n = Number(value); return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(Number.isFinite(n) ? n : 0) }
function formatNumber(value: unknown) { const n = Number(value); return new Intl.NumberFormat().format(Number.isFinite(n) ? n : 0) }
function formatDate(value: string) { return value ? new Date(value).toLocaleString() : '—' }
watch(emailOpen, open => { if (open) { email.value = ''; modalError.value = ''; if (capabilities.value.email_verification === false) modalError.value = 'Email features are not enabled on this Home server.' } })
onMounted(loadWorkspace)
</script>
