<template>
  <div class="space-y-8">

    <UAlert v-if="pageError" color="error" variant="subtle" icon="i-tabler-alert-triangle" title="Some workspace data could not be loaded" :description="pageError" />

    <section v-if="section === 'dashboard'" class="dashboard-limit-grid grid grid-cols-1 gap-4" :style="dashboardGridStyle" aria-label="Account summary and period limits">
      <UCard>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm text-[var(--ui-text-muted)]">Credit balance</p>
            <p class="mt-2 truncate text-2xl font-bold tabular-nums text-[var(--ui-text-highlighted)]">{{ formatCredits(user?.credits ?? selectedOverview?.current_balance) }}</p>
          </div>
          <span class="rounded-xl bg-primary-500/10 p-2.5 text-primary-500"><UIcon name="i-tabler-wallet" class="size-5" /></span>
        </div>
      </UCard>
      <UCard v-for="window in activePeriodWindows" :key="window.id">
        <div class="flex items-center justify-between gap-3"><p class="text-sm font-semibold">{{ periodWindowLabel(window.id) }}</p><span class="text-xs font-medium tabular-nums" :class="periodWindowColor(window)">{{ formatPercent(periodWindowRatio(window)) }}</span></div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div class="h-full rounded-full transition-all" :class="periodWindowBarColor(window)" :style="{ width: `${Math.round(periodWindowRatio(window) * 100)}%` }" /></div>
        <div class="mt-3 flex items-end justify-between gap-3"><div><p class="text-xs text-[var(--ui-text-muted)]">Used</p><p class="font-semibold tabular-nums">{{ formatCredits(window.used) }} / {{ formatCredits(window.limit) }}</p></div><div class="text-right"><p class="text-xs text-[var(--ui-text-muted)]">Remaining</p><p class="text-sm font-medium tabular-nums">{{ formatCredits(window.remaining) }}</p></div></div>
        <p v-if="window.reset_at" class="mt-2 text-xs text-[var(--ui-text-dimmed)]">Resets {{ formatDate(window.reset_at) }}</p>
      </UCard>
    </section>

    <section v-if="section === 'dashboard'" class="space-y-5" aria-labelledby="billing-title">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="billing-title" class="text-xl font-semibold text-[var(--ui-text-highlighted)]">Billing & usage report</h2>
          <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Credit usage is reported as generic credits. Date-only ranges use UTC and include the full end date.</p>
        </div>
        <UButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="billingLoading" @click="loadBilling">Refresh report</UButton>
      </div>

      <UCard class="workbench-filter-panel">
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="applyBillingRange">
          <UFormField label="Time range">
            <USelect v-model="rangePreset" :items="rangeOptions" value-key="value" label-key="label" class="w-44" @update:model-value="selectRange" />
          </UFormField>
          <template v-if="rangePreset === 'custom'">
            <UFormField label="From (UTC)"><UInput v-model="rangeFrom" type="date" /></UFormField>
            <UFormField label="To (UTC)"><UInput v-model="rangeTo" type="date" /></UFormField>
            <UButton type="submit" :loading="billingLoading">Apply range</UButton>
          </template>
        </form>
        <UAlert v-if="billingError" class="mt-4" color="error" variant="subtle" title="Billing request failed" :description="billingError" />
      </UCard>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UCard v-for="metric in billingMetrics" :key="metric.label">
          <p class="text-sm text-[var(--ui-text-muted)]">{{ metric.label }}</p>
          <p class="mt-2 text-2xl font-bold tabular-nums text-[var(--ui-text-highlighted)]">{{ metric.value }}</p>
          <p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ metric.detail }}</p>
        </UCard>
      </div>

      <div class="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <UCard>
          <template #header>
            <div>
              <h3 class="font-semibold">Top models</h3>
              <p class="text-xs text-[var(--ui-text-muted)]">Up to five models in the selected range</p>
            </div>
          </template>
          <div v-if="topModels.length" class="space-y-4">
            <div v-for="(model, index) in topModels" :key="model.id || model.label" class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ index + 1 }}. {{ model.label || model.id || 'Unknown model' }}</p>
                <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(model.request_count) }} requests</p>
              </div>
              <span class="shrink-0 font-mono text-sm font-semibold">{{ formatCredits(model.amount) }}</span>
            </div>
          </div>
          <p v-else class="py-10 text-center text-sm text-[var(--ui-text-muted)]">No model charges in this range.</p>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="font-semibold">Recent charges</h3>
                <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(chargesTotal) }} matching records</p>
              </div>
              <UFormField label="Rows per page">
                <USelect v-model="chargePageSize" :items="pageSizeOptions" value-key="value" label-key="label" class="w-28" @update:model-value="changePageSize" />
              </UFormField>
            </div>
          </template>
          <div class="overflow-x-auto">
            <UTable :data="charges" :columns="chargeColumns" :loading="billingLoading" class="min-w-[980px]">
              <template #created_at-cell="{ row }"><span class="whitespace-nowrap text-sm">{{ formatDate(rowValue(row).created_at) }}</span></template>
              <template #provider-cell="{ row }"><span class="text-sm">{{ rowValue(row).provider || '—' }}</span></template>
              <template #model-cell="{ row }"><span class="text-sm font-medium">{{ rowValue(row).model || '—' }}</span></template>
              <template #input_tokens-cell="{ row }"><span class="tabular-nums">{{ formatNumber(rowValue(row).input_tokens) }}</span></template>
              <template #output_tokens-cell="{ row }"><span class="tabular-nums">{{ formatNumber(rowValue(row).output_tokens) }}</span></template>
              <template #amount-cell="{ row }"><span class="font-mono font-semibold text-red-600 dark:text-red-400">−{{ formatCredits(Math.abs(Number(rowValue(row).amount) || 0)) }}</span></template>
              <template #balance_after-cell="{ row }"><span class="font-mono">{{ formatCredits(rowValue(row).balance_after) }}</span></template>
              <template #empty><div class="py-12 text-center text-sm text-[var(--ui-text-muted)]">No billing charges found.</div></template>
            </UTable>
          </div>
          <div class="flex flex-col gap-3 border-t border-[var(--ui-border)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span class="text-[var(--ui-text-muted)]">Showing {{ chargeRangeStart }}–{{ chargeRangeEnd }} of {{ formatNumber(chargesTotal) }}</span>
            <div class="flex items-center gap-2">
              <UButton size="sm" color="neutral" variant="outline" :disabled="chargePage <= 1 || billingLoading" @click="changeChargePage(-1)">Previous</UButton>
              <span>Page {{ chargePage }} of {{ chargePages }}</span>
              <UButton size="sm" color="neutral" variant="outline" :disabled="chargePage >= chargePages || billingLoading" @click="changeChargePage(1)">Next</UButton>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <section v-if="section === 'api-keys'" class="space-y-4" aria-labelledby="keys-title">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="keys-title" class="text-xl font-semibold text-[var(--ui-text-highlighted)]">Client access keys</h2>
          <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Credentials owned by your account. Scopes are assigned by Home and shown read-only here.</p>
        </div>
        <UButton icon="i-tabler-plus" @click="openKeyForm()">Create key</UButton>
      </div>
      <section class="overflow-hidden rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]">
        <div class="overflow-x-auto">
          <UTable :data="keys" :columns="keyColumns" :loading="keysLoading" class="user-keys-table min-w-[980px]">
            <template #identity-cell="{ row }"><div class="flex min-w-0 items-center gap-3"><span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-500/10 text-primary-500"><UIcon name="i-tabler-key" class="size-4" /></span><div class="min-w-0"><code class="block truncate text-xs font-semibold">{{ maskKey(keyRow(row).api_key) }}</code><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ keyRow(row).id != null ? `Key #${keyRow(row).id}` : `Key ${keyRow(row).index + 1}` }}</p></div></div></template>

            <template #updated_at-cell="{ row }"><div class="whitespace-nowrap"><p class="text-sm">{{ formatDate(keyRow(row).updated_at || keyRow(row).created_at) }}</p><p v-if="keyRow(row).created_at" class="mt-1 text-xs text-[var(--ui-text-muted)]">Created {{ formatDate(keyRow(row).created_at) }}</p></div></template>
            <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><AdminTableAction action="copy" :label="`Copy ${maskKey(keyRow(row).api_key)}`" @click="copyKey(keyRow(row).api_key)" /><AdminTableAction action="edit" :label="`Edit ${maskKey(keyRow(row).api_key)}`" @click="openKeyForm(keyRow(row))" /><AdminTableAction action="delete" :label="`Delete ${maskKey(keyRow(row).api_key)}`" destructive @click="confirmKeyDelete(keyRow(row))" /></div></template>
            <template #empty><div class="py-14 text-center"><UIcon name="i-tabler-key" class="mx-auto size-8 text-[var(--ui-text-dimmed)]" /><p class="mt-3 font-medium">No client access keys</p><p class="mt-1 text-sm text-[var(--ui-text-muted)]">Create a key to authenticate client requests.</p></div></template>
          </UTable>
        </div>
      </section>
    </section>

    <section v-if="section === 'settings'" class="space-y-4" aria-labelledby="security-title">
      <div>
        <h2 id="security-title" class="text-xl font-semibold text-[var(--ui-text-highlighted)]">Account security</h2>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Manage account recovery and sign-in protections inline.</p>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <UCard>
          <template #header><div><h3 class="font-semibold">Password</h3><p class="text-xs text-[var(--ui-text-muted)]">Changing your password refreshes the active session.</p></div></template>
          <form class="space-y-4" @submit.prevent="changePassword">
            <UAlert v-if="passwordError" color="error" variant="subtle" :description="passwordError" />
            <UFormField label="New password" required><UInput v-model="passwordForm.password" type="password" autocomplete="new-password" class="w-full" /></UFormField>
            <UFormField label="Confirm password" required><UInput v-model="passwordForm.confirm" type="password" autocomplete="new-password" class="w-full" /></UFormField>
            <div class="flex justify-end"><UButton type="submit" :loading="passwordSaving">Change password</UButton></div>
          </form>
        </UCard>

        <UCard>
          <template #header><div><h3 class="font-semibold">Recovery email</h3><p class="text-xs text-[var(--ui-text-muted)]">{{ emailDetail }}</p></div></template>
          <form class="space-y-4" @submit.prevent="updateEmail">
            <UAlert v-if="emailError" color="error" variant="subtle" :description="emailError" />
            <UFormField label="Email address" required><UInput v-model="email" type="email" autocomplete="email" class="w-full" :disabled="capabilities.email_verification === false" /></UFormField>
            <div class="flex flex-wrap justify-end gap-2">
              <UButton v-if="user?.email_status.configured" type="button" color="error" variant="soft" :loading="emailSaving" @click="clearEmail">Remove email</UButton>
              <UButton v-if="user?.email_status.configured && !user?.email_status.verified" type="button" color="neutral" variant="outline" :loading="emailSaving" @click="requestVerification">Resend verification</UButton>
              <UButton type="submit" :loading="emailSaving" :disabled="capabilities.email_verification === false">Save and verify</UButton>
            </div>
          </form>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div><h3 class="font-semibold">Authenticator app</h3><p class="text-xs text-[var(--ui-text-muted)]">{{ user?.totp_enabled ? 'TOTP is enabled for this account.' : 'Add a time-based one-time password.' }}</p></div>
              <UBadge :color="user?.totp_enabled ? 'success' : 'neutral'" variant="subtle">{{ user?.totp_enabled ? 'Enabled' : 'Not enabled' }}</UBadge>
            </div>
          </template>
          <div class="space-y-4">
            <UAlert v-if="totpError" color="error" variant="subtle" :description="totpError" />
            <div class="flex flex-wrap gap-2">
              <UButton color="neutral" variant="outline" :loading="totpLoading" @click="showTOTP(false)">Show setup</UButton>
              <UButton color="neutral" variant="outline" :loading="totpLoading" @click="showTOTP(true)">Regenerate setup</UButton>
              <UButton v-if="user?.totp_enabled" color="error" variant="soft" @click="openTOTPDelete">Disable TOTP</UButton>
            </div>
            <form v-if="totpSetup" class="space-y-4 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-4" @submit.prevent="bindTOTP">
              <p class="text-sm text-[var(--ui-text-muted)]">Open the setup link in a compatible authenticator or enter the raw secret manually, then confirm a current code.</p>
              <div>
                <p class="text-xs font-medium text-[var(--ui-text-dimmed)]">Raw secret</p>
                <div class="mt-1 flex items-start gap-2"><code class="min-w-0 flex-1 break-all text-sm font-semibold">{{ totpSetup.secret }}</code><UButton type="button" icon="i-tabler-clipboard" color="neutral" variant="ghost" size="xs" aria-label="Copy TOTP secret" @click="copyText(totpSetup.secret, 'TOTP secret copied')" /></div>
              </div>
              <div v-if="totpSetup.otp_auth_url">
                <p class="text-xs font-medium text-[var(--ui-text-dimmed)]">Authenticator setup link</p>
                <a :href="totpSetup.otp_auth_url" class="mt-1 block break-all text-sm text-primary-500 underline underline-offset-2">{{ totpSetup.otp_auth_url }}</a>
                <p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">No QR encoder is bundled, so the standard otpauth link is provided directly.</p>
              </div>
              <UFormField label="Verification code" required><UInput v-model="totpCode" class="w-full font-mono tracking-[0.3em]" inputmode="numeric" autocomplete="one-time-code" /></UFormField>
              <div class="flex justify-end"><UButton type="submit" :loading="totpSaving">{{ user?.totp_enabled ? 'Confirm regenerated setup' : 'Enable TOTP' }}</UButton></div>
            </form>
          </div>
        </UCard>

        <UCard>
          <template #header><div><h3 class="font-semibold">Passkeys</h3><p class="text-xs text-[var(--ui-text-muted)]">Use a device authenticator or hardware security key.</p></div></template>
          <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="addPasskey">
            <UFormField label="Passkey name" hint="Optional" class="flex-1"><UInput v-model="passkeyName" class="w-full" placeholder="MacBook Touch ID" /></UFormField>
            <UButton type="submit" icon="i-tabler-fingerprint" :loading="passkeySaving">Add passkey</UButton>
          </form>
          <UAlert v-if="passkeyError" class="mt-4" color="error" variant="subtle" :description="passkeyError" />
          <div class="mt-5 overflow-x-auto rounded-lg border border-[var(--ui-border)]">
            <table class="w-full min-w-[560px] text-left text-sm">
              <thead class="bg-[var(--ui-bg-muted)] text-xs text-[var(--ui-text-muted)]"><tr><th class="px-4 py-3 font-medium">Name</th><th class="px-4 py-3 font-medium">Created</th><th class="px-4 py-3 font-medium">Updated</th><th class="px-4 py-3 text-right font-medium">Actions</th></tr></thead>
              <tbody class="divide-y divide-[var(--ui-border)]">
                <tr v-for="passkey in user?.passkeys || []" :key="passkey.id"><td class="px-4 py-3 font-medium">{{ passkey.name || 'Unnamed passkey' }}</td><td class="px-4 py-3 text-[var(--ui-text-muted)]">{{ formatDate(passkey.created_at) }}</td><td class="px-4 py-3 text-[var(--ui-text-muted)]">{{ formatDate(passkey.updated_at) }}</td><td class="px-4 py-3 text-right"><UButton icon="i-tabler-trash" color="error" variant="ghost" size="sm" :aria-label="`Delete ${passkey.name || 'passkey'}`" @click="confirmPasskeyDelete(passkey)" /></td></tr>
                <tr v-if="!(user?.passkeys || []).length"><td colspan="4" class="px-4 py-10 text-center text-[var(--ui-text-muted)]">No passkeys registered.</td></tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>
    </section>

    <UModal v-model:open="keyFormOpen" :title="editingKey ? 'Edit client access key' : 'Create client access key'" :description="editingKey ? 'Enter a non-empty replacement key. Existing scopes remain unchanged.' : 'Leave the key blank to let Home generate a secure value.'">
      <template #body>
        <form class="space-y-5" @submit.prevent="saveKey">
          <UAlert v-if="keyFormError" color="error" variant="subtle" :description="keyFormError" />
          <UFormField label="Key" :hint="editingKey ? 'Required when editing' : 'Optional; blank is generated by the server'">
            <UInput v-model="keyValue" class="w-full font-mono" autocomplete="off" />
          </UFormField>

          <div class="flex justify-end gap-2"><UButton type="button" color="neutral" variant="ghost" @click="closeKeyForm">Cancel</UButton><UButton type="submit" :loading="keySaving">{{ editingKey ? 'Save key' : 'Create key' }}</UButton></div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="keyDeleteOpen" title="Delete client access key?" description="Clients using this key will immediately lose access.">
      <template #body><div class="space-y-5"><p class="break-all text-sm">Delete <code>{{ keyDeleteTarget ? maskKey(keyDeleteTarget.api_key) : '' }}</code>?</p><div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" :disabled="keyDeleting" @click="closeKeyDelete">Cancel</UButton><UButton color="error" icon="i-tabler-trash" :loading="keyDeleting" @click="deleteKey">Delete key</UButton></div></div></template>
    </UModal>

    <UModal v-model:open="totpDeleteOpen" title="Disable authenticator app?" description="Your account will no longer require authenticator codes after this change.">
      <template #body><div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" :disabled="totpDeleting" @click="closeTOTPDelete">Cancel</UButton><UButton color="error" :loading="totpDeleting" @click="deleteTOTP">Disable TOTP</UButton></div></template>
    </UModal>

    <UModal v-model:open="passkeyDeleteOpen" title="Delete passkey?" description="The selected authenticator will no longer be accepted for this account.">
      <template #body><div class="space-y-5"><p class="text-sm">Delete {{ passkeyDeleteTarget?.name || 'this passkey' }}?</p><div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" :disabled="passkeyDeleting" @click="closePasskeyDelete">Cancel</UButton><UButton color="error" :loading="passkeyDeleting" @click="deletePasskey">Delete passkey</UButton></div></div></template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ section?: 'dashboard' | 'api-keys' | 'settings' }>(), { section: 'dashboard' })
const section = computed(() => props.section)

type BillingRange = { from: string; to: string }
type WorkspaceBillingOverview = BillingOverview & {
  request_count?: number
  input_tokens?: number
  output_tokens?: number
  cache_tokens?: number
  total_charge_amount?: number
}
type BillingChargesResponse = { items?: BillingCharge[]; data?: BillingCharge[]; total?: number; limit?: number; offset?: number }
type TOTPSetup = { secret: string; otp_auth_url?: string; issuer?: string; enabled?: boolean }
type WorkspaceKey = Omit<UserApiKey, 'id'> & { id: number | null; index: number }
type PeriodWindowStatus = { id: string; enabled: boolean; limit: number | null; used: number; remaining: number | null; active: boolean; reset_at?: string | null }
type PeriodLimitsStatus = { windows?: PeriodWindowStatus[] }

const toast = useToast()
const { currentUser: user, tokenExpiresAt, fetchAPI, loadCurrentUser, saveSession, capabilities, loadCapabilities, registerPasskey } = useUserApi()

const pageError = ref('')
const keys = ref<WorkspaceKey[]>([])
const keysLoading = ref(false)
const selectedOverview = ref<WorkspaceBillingOverview | null>(null)
const todayOverview = ref<WorkspaceBillingOverview | null>(null)
const monthOverview = ref<WorkspaceBillingOverview | null>(null)
const charges = ref<BillingCharge[]>([])
const chargesTotal = ref(0)
const billingLoading = ref(false)
const billingError = ref('')
const periodLimits = ref<PeriodLimitsStatus | null>(null)
let billingRequest = 0

const rangeOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom', value: 'custom' }
]
const pageSizeOptions = [20, 50, 100].map(value => ({ label: String(value), value }))
const rangePreset = ref('today')
const rangeFrom = ref('')
const rangeTo = ref('')
const appliedRange = ref<BillingRange>(presetRange('today'))
const chargePage = ref(1)
const chargePageSize = ref(20)
const chargePages = computed(() => Math.max(1, Math.ceil(chargesTotal.value / chargePageSize.value)))
const chargeRangeStart = computed(() => chargesTotal.value ? (chargePage.value - 1) * chargePageSize.value + 1 : 0)
const chargeRangeEnd = computed(() => Math.min(chargePage.value * chargePageSize.value, chargesTotal.value))
const topModels = computed(() => (selectedOverview.value?.top_models || []).slice(0, 5))
const activePeriodWindows = computed(() => (periodLimits.value?.windows || []).filter(window => window.enabled && window.limit != null))
const dashboardGridStyle = computed(() => ({
  '--dashboard-columns': activePeriodWindows.value.length
    ? `minmax(9rem, 0.65fr) repeat(${activePeriodWindows.value.length}, minmax(0, 1fr))`
    : 'minmax(9rem, 18rem)'
}))

const keyFormOpen = ref(false)
const keyFormError = ref('')
const keySaving = ref(false)
const editingKey = ref<WorkspaceKey | null>(null)
const keyValue = ref('')
const keyDeleteOpen = ref(false)
const keyDeleteTarget = ref<WorkspaceKey | null>(null)
const keyDeleting = ref(false)

const passwordForm = reactive({ password: '', confirm: '' })
const passwordError = ref('')
const passwordSaving = ref(false)
const email = ref('')
const emailError = ref('')
const emailSaving = ref(false)
const totpSetup = ref<TOTPSetup | null>(null)
const totpCode = ref('')
const totpError = ref('')
const totpLoading = ref(false)
const totpSaving = ref(false)
const totpDeleteOpen = ref(false)
const totpDeleting = ref(false)
const passkeyName = ref('')
const passkeyError = ref('')
const passkeySaving = ref(false)
const passkeyDeleteOpen = ref(false)
const passkeyDeleteTarget = ref<UserPasskey | null>(null)
const passkeyDeleting = ref(false)

const chargeColumns = [
  { accessorKey: 'created_at', header: 'Time' },
  { accessorKey: 'provider', header: 'Provider' },
  { accessorKey: 'model', header: 'Model' },
  { accessorKey: 'input_tokens', header: 'Input tokens' },
  { accessorKey: 'output_tokens', header: 'Output tokens' },
  { accessorKey: 'amount', header: 'Charge' },
  { accessorKey: 'balance_after', header: 'Balance after' }
]
const keyColumns = [
  { accessorKey: 'identity', header: 'Client key' },
  { accessorKey: 'updated_at', header: 'Updated' },
  { accessorKey: 'actions', header: 'Actions', meta: { class: { th: 'table-action-head table-action-wide', td: 'table-action-cell table-action-wide' } } }
]


const billingMetrics = computed(() => [
  { label: 'Selected range', value: formatCredits(selectedOverview.value?.total_charge_amount ?? selectedOverview.value?.today_spend), detail: `${appliedRange.value.from} – ${appliedRange.value.to}` },
  { label: 'Today', value: formatCredits(todayOverview.value?.total_charge_amount ?? todayOverview.value?.today_spend), detail: 'Credits charged today' },
  { label: 'This month', value: formatCredits(monthOverview.value?.total_charge_amount ?? monthOverview.value?.month_spend), detail: 'Credits charged this calendar month' },
  { label: 'Requests', value: formatNumber(selectedOverview.value?.request_count), detail: `${formatNumber(selectedOverview.value?.input_tokens)} input · ${formatNumber(selectedOverview.value?.output_tokens)} output tokens` }
])
const sessionExpiryValue = computed(() => {
  if (!tokenExpiresAt.value) return 'Browser session'
  const expires = new Date(tokenExpiresAt.value)
  if (!Number.isFinite(expires.getTime())) return 'Unknown'
  return expires.getTime() <= Date.now() ? 'Expired' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(expires)
})
const sessionExpiryDetail = computed(() => tokenExpiresAt.value ? 'Token expiration time' : 'Ends when this browser session closes')
const emailDetail = computed(() => {
  if (capabilities.value.email_verification === false) return 'Email recovery is not enabled on this Home server.'
  if (!user.value?.email_status.configured) return 'No recovery email configured.'
  return `${user.value.email_status.masked} · ${user.value.email_status.verified ? 'verified' : 'verification pending'}`
})

function presetRange(preset: string): BillingRange {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  if (preset === 'month') start.setUTCDate(1)
  else start.setUTCDate(start.getUTCDate() - (preset === '30d' ? 29 : preset === '7d' ? 6 : 0))
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}
function overviewValue(response: any): WorkspaceBillingOverview {
  return (response?.overview && typeof response.overview === 'object' ? response.overview : response || {}) as WorkspaceBillingOverview
}
function rowValue(row: any): BillingCharge { return row?.original ?? row }
function keyRow(row: any): WorkspaceKey { return row?.original ?? row }
function isObject(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function keyEntries(payload: any): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isObject(payload)) return []
  for (const name of ['api_keys', 'api-keys', 'items', 'data']) {
    const value = payload[name]
    if (Array.isArray(value)) return value
    if (isObject(value)) {
      const nested = keyEntries(value)
      if (nested.length) return nested
    }
  }
  return []
}
function numericArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map(Number).filter(item => Number.isInteger(item) && item > 0)
}
function normalizeKey(entry: unknown, index: number): WorkspaceKey | null {
  const source = isObject(entry) ? entry : {}
  const value = String(typeof entry === 'string' ? entry : source.api_key ?? source['api-key'] ?? source.key ?? source.value ?? '').trim()
  if (!value) return null
  const numericID = Number(source.id ?? source.api_key_id ?? source['api-key-id'])
  return {
    id: Number.isInteger(numericID) && numericID > 0 ? numericID : null,
    index,
    api_key: value,
    channels: numericArray(source.channels),
    model_groups: numericArray(source.model_groups ?? source['model-groups']),
    created_at: typeof source.created_at === 'string' ? source.created_at : undefined,
    updated_at: typeof source.updated_at === 'string' ? source.updated_at : undefined
  }
}
function errorMessage(error: any, fallback: string) { return error?.data?.message || error?.data?.error || error?.message || fallback }
function periodWindowLabel(id: string) { return id === '5h' ? '5 hours' : id === '1d' ? '1 day' : id === '7d' ? '7 days' : id === '30d' ? '1 month' : id }
function periodWindowRatio(window: PeriodWindowStatus) { const limit = Number(window.limit); return limit > 0 ? Math.max(0, Math.min(1, Number(window.used || 0) / limit)) : 1 }
function periodWindowColor(window: PeriodWindowStatus) { const ratio = periodWindowRatio(window); return ratio >= 1 ? 'text-red-500' : ratio >= 0.8 ? 'text-amber-500' : 'text-primary-500' }
function periodWindowBarColor(window: PeriodWindowStatus) { const ratio = periodWindowRatio(window); return ratio >= 1 ? 'bg-red-500' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-[var(--ui-primary)]' }
function formatPercent(value: number) { return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }

async function loadPeriodLimits() {
  try { periodLimits.value = await fetchAPI<PeriodLimitsStatus>('/period-limits') }
  catch (error: any) { if (error?.statusCode !== 404) throw error; periodLimits.value = null }
}

async function loadKeys() {
  keysLoading.value = true
  try {
    const response = await fetchAPI<any>('/api-keys')
    keys.value = keyEntries(response).map(normalizeKey).filter((item): item is WorkspaceKey => Boolean(item))
  } finally {
    keysLoading.value = false
  }
}
async function loadBilling() {
  const request = ++billingRequest
  const selected = appliedRange.value
  const today = presetRange('today')
  const month = presetRange('month')
  const limit = chargePageSize.value
  const offset = (chargePage.value - 1) * limit
  billingLoading.value = true
  billingError.value = ''
  try {
    const [selectedResponse, todayResponse, monthResponse, chargesResponse] = await Promise.all([
      fetchAPI<any>('/billing/overview', { query: selected }),
      fetchAPI<any>('/billing/overview', { query: today }),
      fetchAPI<any>('/billing/overview', { query: month }),
      fetchAPI<BillingChargesResponse>('/billing/charges', { query: { ...selected, limit, offset } })
    ])
    if (request !== billingRequest) return
    selectedOverview.value = overviewValue(selectedResponse)
    todayOverview.value = overviewValue(todayResponse)
    monthOverview.value = overviewValue(monthResponse)
    charges.value = Array.isArray(chargesResponse?.items) ? chargesResponse.items : Array.isArray(chargesResponse?.data) ? chargesResponse.data : []
    chargesTotal.value = Number(chargesResponse?.total) || 0
  } catch (error: any) {
    if (request === billingRequest) billingError.value = errorMessage(error, 'Unable to load billing activity.')
  } finally {
    if (request === billingRequest) billingLoading.value = false
  }
}
async function loadWorkspace() {
  pageError.value = ''
  const tasks = [loadCapabilities(), loadCurrentUser(), loadKeys(), loadBilling()]
  if (section.value === 'dashboard') tasks.push(loadPeriodLimits())
  const results = await Promise.allSettled(tasks)
  const failures = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[]
  if (failures.length) pageError.value = failures.map(result => errorMessage(result.reason, 'Unable to load workspace data.')).join(' · ')
  email.value = ''
}
function selectRange(preset: string) {
  if (preset === 'custom') {
    rangeFrom.value = appliedRange.value.from
    rangeTo.value = appliedRange.value.to
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
function changePageSize() {
  if (import.meta.client) localStorage.setItem('hmc:user-billing:page-size', String(chargePageSize.value))
  chargePage.value = 1
  void loadBilling()
}
function changeChargePage(delta: number) {
  const next = chargePage.value + delta
  if (next < 1 || next > chargePages.value) return
  chargePage.value = next
  void loadBilling()
}

function openKeyForm(key?: WorkspaceKey) {
  editingKey.value = key || null
  keyValue.value = key?.api_key || ''
  keyFormError.value = ''
  keyFormOpen.value = true
}
function closeKeyForm() { keyFormOpen.value = false }
function closeKeyDelete() { keyDeleteOpen.value = false }
function openTOTPDelete() { totpDeleteOpen.value = true }
function closeTOTPDelete() { totpDeleteOpen.value = false }
function closePasskeyDelete() { passkeyDeleteOpen.value = false }
async function saveKey() {
  keyFormError.value = ''
  const nextValue = keyValue.value.trim()
  if (editingKey.value && !nextValue) {
    keyFormError.value = 'A non-empty key is required when editing.'
    return
  }
  keySaving.value = true
  try {
    if (editingKey.value) {
      if (editingKey.value.id != null) {
        await fetchAPI(`/api-keys/${editingKey.value.id}`, { method: 'PATCH', body: { api_key: nextValue } })
      } else {
        await fetchAPI('/api-keys', { method: 'PATCH', body: { old: editingKey.value.api_key, new_api_key: nextValue } })
      }
    } else {
      await fetchAPI('/api-keys', { method: 'POST', body: nextValue ? { api_key: nextValue } : {} })
    }
    keyFormOpen.value = false
    await loadKeys()
    toast.add({ title: editingKey.value ? 'Client key updated' : 'Client key created', color: 'success' })
  } catch (error: any) {
    keyFormError.value = errorMessage(error, 'Unable to save the client key.')
  } finally {
    keySaving.value = false
  }
}
function confirmKeyDelete(key: WorkspaceKey) {
  keyDeleteTarget.value = key
  keyDeleteOpen.value = true
}
async function deleteKey() {
  const target = keyDeleteTarget.value
  if (!target) return
  keyDeleting.value = true
  try {
    if (target.id != null) await fetchAPI(`/api-keys/${target.id}`, { method: 'DELETE', body: {} })
    else await fetchAPI('/api-keys', { method: 'DELETE', body: { api_key: target.api_key } })
    keyDeleteOpen.value = false
    keyDeleteTarget.value = null
    await loadKeys()
    toast.add({ title: 'Client key deleted', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Delete failed', description: errorMessage(error, 'Unable to delete the client key.'), color: 'error' })
  } finally {
    keyDeleting.value = false
  }
}

async function changePassword() {
  passwordError.value = ''
  if (!passwordForm.password) return void (passwordError.value = 'Enter a new password.')
  if (passwordForm.password !== passwordForm.confirm) return void (passwordError.value = 'Passwords do not match.')
  passwordSaving.value = true
  try {
    const session = await fetchAPI<UserSessionResponse>('/password', { method: 'POST', body: { new_password: passwordForm.password } })
    saveSession(session)
    passwordForm.password = ''
    passwordForm.confirm = ''
    toast.add({ title: 'Password changed', color: 'success' })
  } catch (error: any) {
    passwordError.value = errorMessage(error, 'Unable to change the password.')
  } finally {
    passwordSaving.value = false
  }
}
async function updateEmail() {
  emailError.value = ''
  const value = email.value.trim()
  if (!value) return void (emailError.value = 'Enter a recovery email address.')
  emailSaving.value = true
  try {
    await fetchAPI('/email', { method: 'PUT', body: { email: value } })
    await fetchAPI('/email/verification', { method: 'POST', body: {} })
    await loadCurrentUser()
    email.value = ''
    toast.add({ title: 'Recovery email saved', description: 'A verification email has been queued.', color: 'success' })
  } catch (error: any) {
    emailError.value = errorMessage(error, 'Unable to update the recovery email.')
  } finally {
    emailSaving.value = false
  }
}
async function clearEmail() {
  emailError.value = ''
  emailSaving.value = true
  try {
    await fetchAPI('/email', { method: 'DELETE', body: {} })
    await loadCurrentUser()
    email.value = ''
    toast.add({ title: 'Recovery email removed', color: 'success' })
  } catch (error: any) {
    emailError.value = errorMessage(error, 'Unable to remove the recovery email.')
  } finally {
    emailSaving.value = false
  }
}
async function requestVerification() {
  emailError.value = ''
  emailSaving.value = true
  try {
    await fetchAPI('/email/verification', { method: 'POST', body: {} })
    toast.add({ title: 'Verification email queued', color: 'success' })
  } catch (error: any) {
    emailError.value = errorMessage(error, 'Unable to request verification.')
  } finally {
    emailSaving.value = false
  }
}
async function showTOTP(regenerate: boolean) {
  totpError.value = ''
  totpLoading.value = true
  try {
    totpSetup.value = await fetchAPI<TOTPSetup>('/totp', { query: { issuer: 'CPAHome', ...(regenerate ? { regenerate: true } : {}) } })
    totpCode.value = ''
  } catch (error: any) {
    totpError.value = errorMessage(error, 'Unable to load TOTP setup.')
  } finally {
    totpLoading.value = false
  }
}
async function bindTOTP() {
  if (!totpSetup.value) return
  totpError.value = ''
  if (!totpCode.value.trim()) return void (totpError.value = 'Enter the current authenticator code.')
  totpSaving.value = true
  try {
    await fetchAPI('/totp', { method: 'POST', body: { secret: totpSetup.value.secret, issuer: totpSetup.value.issuer || 'CPAHome', code: totpCode.value.trim() } })
    await loadCurrentUser()
    totpSetup.value = null
    totpCode.value = ''
    toast.add({ title: 'Authenticator setup saved', color: 'success' })
  } catch (error: any) {
    totpError.value = errorMessage(error, 'Unable to save TOTP setup.')
  } finally {
    totpSaving.value = false
  }
}
async function deleteTOTP() {
  totpDeleting.value = true
  try {
    await fetchAPI('/totp', { method: 'DELETE', body: {} })
    await loadCurrentUser()
    totpSetup.value = null
    totpDeleteOpen.value = false
    toast.add({ title: 'Authenticator disabled', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Unable to disable TOTP', description: errorMessage(error, 'Request failed.'), color: 'error' })
  } finally {
    totpDeleting.value = false
  }
}
async function addPasskey() {
  passkeyError.value = ''
  passkeySaving.value = true
  try {
    await registerPasskey(passkeyName.value.trim())
    passkeyName.value = ''
    toast.add({ title: 'Passkey added', color: 'success' })
  } catch (error: any) {
    passkeyError.value = error?.name === 'NotAllowedError' ? 'Passkey registration was cancelled.' : errorMessage(error, 'Unable to add the passkey.')
  } finally {
    passkeySaving.value = false
  }
}
function confirmPasskeyDelete(passkey: UserPasskey) {
  passkeyDeleteTarget.value = passkey
  passkeyDeleteOpen.value = true
}
async function deletePasskey() {
  const target = passkeyDeleteTarget.value
  if (!target) return
  passkeyDeleting.value = true
  try {
    await fetchAPI(`/passkeys/${encodeURIComponent(target.id)}`, { method: 'DELETE', body: {} })
    await loadCurrentUser()
    passkeyDeleteOpen.value = false
    passkeyDeleteTarget.value = null
    toast.add({ title: 'Passkey deleted', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Unable to delete passkey', description: errorMessage(error, 'Request failed.'), color: 'error' })
  } finally {
    passkeyDeleting.value = false
  }
}

async function copyKey(value: string) { await copyText(value, 'Client key copied') }
async function copyText(value: string, title: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title, color: 'success' })
  } catch {
    toast.add({ title: 'Copy failed', color: 'error' })
  }
}
function maskKey(value: string) {
  const text = String(value || '')
  return text.length <= 12 ? `${text.slice(0, 3)}***` : `${text.slice(0, 8)}...${text.slice(-4)}`
}

function formatCredits(value: unknown) {
  const number = Number(value)
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number.isFinite(number) ? number : 0)
}
function formatNumber(value: unknown) {
  const number = Number(value)
  return new Intl.NumberFormat().format(Number.isFinite(number) ? number : 0)
}
function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—'
}

onMounted(() => {
  const stored = Number(localStorage.getItem('hmc:user-billing:page-size'))
  if ([20, 50, 100].includes(stored)) chargePageSize.value = stored
  void loadWorkspace()
})
</script>

<style scoped>
.dashboard-limit-grid > :deep(*) { min-width: 0; }
@media (min-width: 768px) {
  .dashboard-limit-grid { grid-template-columns: var(--dashboard-columns); }
}
</style>
