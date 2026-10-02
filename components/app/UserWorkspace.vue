<template>
  <div class="space-y-8">

    <UAlert v-if="pageError" color="error" variant="subtle" icon="i-tabler-alert-triangle" title="Some workspace data could not be loaded" :description="pageError" />

    <section v-if="section === 'dashboard' && activePeriodWindows.length" class="dashboard-limit-grid grid grid-cols-1 gap-4" :style="dashboardGridStyle" aria-label="Account period limits">
      <AppCard v-for="window in activePeriodWindows" :key="window.id" tinted>
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <p class="shrink-0 text-sm font-semibold">{{ periodWindowLabel(window.id) }}</p>
            <p v-if="window.reset_at" class="text-xs text-[var(--ui-text-dimmed)]">Resets {{ formatDate(window.reset_at) }}</p>
          </div>
          <span class="shrink-0 text-xs font-medium tabular-nums" :class="periodWindowColor(window)">{{ formatPercent(periodWindowRatio(window)) }}</span>
        </div>
        <div class="period-progress-track mt-3 h-2.5 overflow-hidden rounded-full"><div class="h-full rounded-full transition-[width]" :class="periodWindowBarColor(window)" :style="{ width: `${periodWindowRatio(window) * 100}%`, minWidth: periodWindowRatio(window) > 0 ? '3px' : '0' }" /></div>
        <div class="mt-3 flex items-end justify-between gap-3"><div><p class="text-xs text-[var(--ui-text-muted)]">Used</p><p class="font-semibold tabular-nums">{{ formatCredits(window.used) }} / {{ formatCredits(window.limit) }}</p></div><div class="text-right"><p class="text-xs text-[var(--ui-text-muted)]">Remaining</p><p class="text-sm font-medium tabular-nums">{{ formatCredits(window.remaining) }}</p></div></div>

      </AppCard>
    </section>

    <section v-if="section === 'dashboard'" class="grid min-w-0 gap-5" :class="serverInfo.cpa_public_url ? 'lg:grid-cols-2' : ''" aria-label="CPA endpoint and usage summary">
    <AppCard v-if="serverInfo.cpa_public_url" class="min-w-0" :ui="{ body: 'space-y-4' }">
      <template #header><h2 class="text-sm font-semibold">Endpoint</h2></template>
      <div class="flex min-w-0 items-start gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-4 shadow-inner">
        <code class="min-w-0 flex-1 break-all font-mono text-sm leading-6 text-[var(--ui-text-highlighted)]">{{ serverInfo.cpa_public_url }}</code>
        <AppButton type="button" size="xs" class="shrink-0" color="neutral" variant="ghost" icon="i-tabler-copy" aria-label="Copy CPA endpoint" title="Copy endpoint" @click="copyText(serverInfo.cpa_public_url, 'CPA endpoint copied')" />
      </div>
      <div class="space-y-2">
        <h3 class="text-sm font-semibold">Example</h3>
        <div class="relative rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] shadow-inner">
          <AppButton type="button" size="xs" class="absolute right-3 top-3 z-10" color="neutral" variant="ghost" icon="i-tabler-copy" aria-label="Copy curl example" title="Copy example" @click="copyText(curlExample, 'Example copied')" />
          <pre class="overflow-x-auto p-4 pr-14 text-xs leading-6 text-[var(--ui-text-highlighted)]"><code class="font-mono">{{ curlExample }}</code></pre>
        </div>
      </div>
    </AppCard>
    <AppCard class="min-w-0" :ui="{ body: 'space-y-4' }">
      <template #header><h2 class="text-sm font-semibold">Usage summary</h2></template>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="applyBillingRange">
        <UFormField label="Time range">
          <USelect v-model="rangePreset" :items="rangeOptions" value-key="value" label-key="label" class="w-44" @update:model-value="selectRange" />
        </UFormField>
        <template v-if="rangePreset === 'custom'">
          <UFormField label="From (UTC)"><UInput v-model="rangeFrom" type="date" /></UFormField>
          <UFormField label="To (UTC)"><UInput v-model="rangeTo" type="date" /></UFormField>
          <AppButton type="submit" :loading="billingLoading">Apply range</AppButton>
        </template>
        <AppButton type="button" class="ml-auto" color="neutral" variant="outline" icon="i-tabler-refresh" :loading="billingLoading" @click="loadBilling">Refresh report</AppButton>
      </form>
    <div class="grid min-w-0 gap-4 sm:grid-cols-2" aria-label="Usage summary" :aria-busy="billingLoading">
      <AppCard v-for="metric in billingMetrics" :key="metric.label" class="min-w-0" tinted>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ metric.label }}</p>
        <p class="mt-2 break-words text-2xl font-bold tabular-nums text-[var(--ui-text-highlighted)]">{{ billingLoading ? '—' : metric.value }}</p>
        <p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ metric.detail }}</p>
      </AppCard>
    </div>
    </AppCard>
    </section>
    <UAlert v-if="section === 'dashboard' && billingError" color="error" variant="subtle" title="Usage summary could not be loaded" :description="billingError" />


    <section v-if="section === 'billing'" class="space-y-5" aria-labelledby="billing-title">
       <div>
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="applyBillingRange">
          <UFormField label="Time range">
            <USelect v-model="rangePreset" :items="rangeOptions" value-key="value" label-key="label" class="w-44" @update:model-value="selectRange" />
          </UFormField>
          <template v-if="rangePreset === 'custom'">
            <UFormField label="From (UTC)"><UInput v-model="rangeFrom" type="date" /></UFormField>
            <UFormField label="To (UTC)"><UInput v-model="rangeTo" type="date" /></UFormField>
            <AppButton type="submit" :loading="billingLoading">Apply range</AppButton>
          </template>
          <AppButton type="button" class="ml-auto shrink-0" color="neutral" variant="outline" icon="i-tabler-refresh" :loading="billingLoading" @click="loadBilling">Refresh report</AppButton>
        </form>
        <UAlert v-if="billingError" class="mt-4" color="error" variant="subtle" title="Billing request failed" :description="billingError" />
      </div>

      <div class="grid min-w-0 gap-5 lg:grid-cols-2">
        <div class="grid min-w-0 gap-4 sm:grid-cols-2" aria-label="Usage summary">
          <AppCard v-for="metric in billingMetrics" :key="metric.label" class="min-w-0" tinted>
            <p class="text-sm text-[var(--ui-text-muted)]">{{ metric.label }}</p>
            <p class="mt-2 break-words text-2xl font-bold tabular-nums text-[var(--ui-text-highlighted)]">{{ metric.value }}</p>
            <p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ metric.detail }}</p>
          </AppCard>
        </div>
        <AppCard class="min-w-0">
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
        </AppCard>
      </div>

        <div class="grid min-w-0 grid-cols-1 items-stretch gap-5 xl:grid-cols-2">

        <AppCard class="flex min-w-0 flex-col" :ui="{ header: 'min-h-24', body: 'flex-1 p-0' }">
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
          <div class="min-h-80 overflow-x-auto">
            <AppTable :data="charges" :columns="chargeColumns" :loading="billingLoading" empty="No billing charges found." class="min-w-[800px]">
              <template #created_at-cell="{ row }"><span class="whitespace-nowrap text-sm">{{ formatDate(rowValue(row).created_at) }}</span></template>
              <template #provider-cell="{ row }"><span class="text-sm">{{ rowValue(row).provider || '—' }}</span></template>
              <template #model-cell="{ row }"><span class="text-sm font-medium">{{ rowValue(row).model || '—' }}</span></template>
              <template #input_tokens-cell="{ row }"><span class="tabular-nums">{{ formatNumber(rowValue(row).input_tokens) }}</span></template>
              <template #output_tokens-cell="{ row }"><span class="tabular-nums">{{ formatNumber(rowValue(row).output_tokens) }}</span></template>
              <template #amount-cell="{ row }"><span class="font-mono font-semibold tabular-nums text-[var(--ui-text-highlighted)]">−{{ formatCredits(Math.abs(Number(rowValue(row).amount) || 0)) }}</span></template>
              <template #balance_after-cell="{ row }"><span class="font-mono">{{ formatCredits(rowValue(row).balance_after) }}</span></template>
            </AppTable>
          </div>
          <template #footer>
          <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span class="text-[var(--ui-text-muted)]">Showing {{ chargeRangeStart }}–{{ chargeRangeEnd }} of {{ formatNumber(chargesTotal) }}</span>
            <div class="flex items-center gap-2">
              <AppButton size="sm" color="neutral" variant="outline" :disabled="chargePage <= 1 || billingLoading" @click="changeChargePage(-1)">Previous</AppButton>
              <span>Page {{ chargePage }} of {{ chargePages }}</span>
              <AppButton size="sm" color="neutral" variant="outline" :disabled="chargePage >= chargePages || billingLoading" @click="changeChargePage(1)">Next</AppButton>
            </div>
          </div>
          </template>
        </AppCard>
          <slot name="balance-history" />
        </div>
    </section>

    <section v-if="section === 'api-keys'" class="space-y-4" aria-labelledby="keys-title">
      <div class="flex items-center justify-between gap-3">
        <UInput v-model="keySearch" icon="i-tabler-search" placeholder="Search API keys..." aria-label="Search API keys" class="min-w-0 flex-1 sm:max-w-sm" />
        <AppButton icon="i-tabler-plus" class="shrink-0" @click="openKeyForm()">Create key</AppButton>
      </div>
      <div v-if="keysLoading" class="py-10 text-center text-sm text-[var(--ui-text-muted)]" role="status">Loading client access keys...</div>
      <div v-else-if="filteredKeys.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AppCard v-for="key in filteredKeys" :key="key.api_key" class="min-w-0">
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-tabler-key" class="size-5 shrink-0 text-primary" />
              <h3 class="min-w-0 break-words font-semibold text-[var(--ui-text-highlighted)]">{{ key.display_name || 'Unnamed key' }}</h3>
            </div>
            <div class="flex items-center gap-2 rounded-md bg-[var(--ui-bg-muted)] px-3 py-2">
              <code class="min-w-0 flex-1 break-all text-xs text-[var(--ui-text-muted)]">{{ maskKey(key.api_key) }}</code>
              <AppButton type="button" size="xs" color="neutral" variant="ghost" icon="i-tabler-copy" class="shrink-0" :aria-label="`Copy ${maskKey(key.api_key)}`" @click="copyKey(key.api_key)" />
            </div>
            <dl class="space-y-2 text-xs">
              <div class="flex justify-between gap-3">
                <dt class="text-[var(--ui-text-muted)]">Created</dt>
                <dd class="text-right">{{ formatDate(key.created_at) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-[var(--ui-text-muted)]">Updated</dt>
                <dd class="text-right">{{ formatDate(key.updated_at || key.created_at) }}</dd>
              </div>
            </dl>
            <div class="flex items-center justify-end gap-1 border-t border-[var(--ui-border)] pt-3">

              <AdminTableAction action="edit" :label="`Edit ${maskKey(key.api_key)}`" @click="openKeyForm(key)" />
              <AdminTableAction action="delete" :label="`Delete ${maskKey(key.api_key)}`" destructive @click="confirmKeyDelete(key)" />
            </div>
          </div>
        </AppCard>
      </div>
      <AppCard v-else>
        <p class="py-6 text-center text-sm text-[var(--ui-text-muted)]">{{ keys.length ? 'No API keys match your search.' : 'No client access keys. Create a key to authenticate client requests.' }}</p>
      </AppCard>
    </section>

    <section v-if="section === 'settings'" class="space-y-4" aria-labelledby="security-title">
      <div class="grid gap-5 lg:grid-cols-2">
        <AppCard>
          <template #header><div><h3 class="font-semibold">Password</h3><p class="text-xs text-[var(--ui-text-muted)]">Changing your password refreshes the active session.</p></div></template>
          <form class="space-y-4" @submit.prevent="changePassword">
            <UAlert v-if="passwordError" color="error" variant="subtle" :description="passwordError" />
            <UFormField label="New password" required><UInput v-model="passwordForm.password" type="password" autocomplete="new-password" class="w-full" /></UFormField>
            <UFormField label="Confirm password" required><UInput v-model="passwordForm.confirm" type="password" autocomplete="new-password" class="w-full" /></UFormField>
            <div class="flex justify-end"><AppButton type="submit" :loading="passwordSaving">Change password</AppButton></div>
          </form>
        </AppCard>

        <AppCard>
          <template #header><div><h3 class="font-semibold">Recovery email</h3><p class="text-xs text-[var(--ui-text-muted)]">{{ emailDetail }}</p></div></template>
          <form class="space-y-4" @submit.prevent="updateEmail">
            <UAlert v-if="emailError" color="error" variant="subtle" :description="emailError" />
            <UFormField label="Email address" required><UInput v-model="email" type="email" autocomplete="email" class="w-full" :disabled="capabilities.email_verification === false" /></UFormField>
            <div class="flex flex-wrap justify-end gap-2">
              <AppButton v-if="user?.email_status.configured" type="button" color="error" variant="soft" :loading="emailSaving" @click="clearEmail">Remove email</AppButton>
              <AppButton v-if="user?.email_status.configured && !user?.email_status.verified" type="button" color="neutral" variant="outline" :loading="emailSaving" @click="requestVerification">Resend verification</AppButton>
              <AppButton type="submit" :loading="emailSaving" :disabled="capabilities.email_verification === false">Save and verify</AppButton>
            </div>
          </form>
        </AppCard>

        <AppCard>
          <template #header>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div><h3 class="font-semibold">Authenticator app</h3><p class="text-xs text-[var(--ui-text-muted)]">{{ user?.totp_enabled ? 'TOTP is enabled for this account.' : 'Add a time-based one-time password.' }}</p></div>
              <UBadge :color="user?.totp_enabled ? 'success' : 'neutral'" variant="subtle">{{ user?.totp_enabled ? 'Enabled' : 'Not enabled' }}</UBadge>
            </div>
          </template>
          <div class="space-y-4">
            <UAlert v-if="totpError" color="error" variant="subtle" :description="totpError" />
            <div class="flex flex-wrap gap-2">
              <AppButton color="neutral" variant="outline" :loading="totpLoading" @click="showTOTP(false)">Show setup</AppButton>
              <AppButton color="neutral" variant="outline" :loading="totpLoading" @click="showTOTP(true)">Regenerate setup</AppButton>
              <AppButton v-if="user?.totp_enabled" color="error" variant="soft" @click="openTOTPDelete">Disable TOTP</AppButton>
            </div>
            <form v-if="totpSetup" class="space-y-4 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] app-surface p-4" @submit.prevent="bindTOTP">
              <p class="text-sm text-[var(--ui-text-muted)]">Open the setup link in a compatible authenticator or enter the raw secret manually, then confirm a current code.</p>
              <div>
                <p class="text-xs font-medium text-[var(--ui-text-dimmed)]">Raw secret</p>
                <div class="mt-1 flex items-start gap-2"><code class="min-w-0 flex-1 break-all text-sm font-semibold">{{ totpSetup.secret }}</code><AppButton type="button" icon="i-tabler-clipboard" color="neutral" variant="ghost" size="xs" aria-label="Copy TOTP secret" @click="copyText(totpSetup.secret, 'TOTP secret copied')" /></div>
              </div>
              <div v-if="totpSetup.otp_auth_url">
                <p class="text-xs font-medium text-[var(--ui-text-dimmed)]">Authenticator setup link</p>
                <a :href="totpSetup.otp_auth_url" class="mt-1 block break-all text-sm text-primary-500 underline underline-offset-2">{{ totpSetup.otp_auth_url }}</a>
                <p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">No QR encoder is bundled, so the standard otpauth link is provided directly.</p>
              </div>
              <UFormField label="Verification code" required><UInput v-model="totpCode" class="w-full font-mono tracking-[0.3em]" inputmode="numeric" autocomplete="one-time-code" /></UFormField>
              <div class="flex justify-end"><AppButton type="submit" :loading="totpSaving">{{ user?.totp_enabled ? 'Confirm regenerated setup' : 'Enable TOTP' }}</AppButton></div>
            </form>
          </div>
        </AppCard>

        <AppCard :ui="{ body: 'p-0' }">
          <template #header><div><h3 class="font-semibold">Passkeys</h3><p class="text-xs text-[var(--ui-text-muted)]">Use a device authenticator or hardware security key.</p></div></template>
          <div class="p-4 sm:p-6">
            <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="addPasskey">
              <UFormField label="Passkey name" hint="Optional" class="flex-1"><UInput v-model="passkeyName" class="w-full" placeholder="MacBook Touch ID" /></UFormField>
              <AppButton type="submit" icon="i-tabler-fingerprint" :loading="passkeySaving">Add passkey</AppButton>
            </form>
            <UAlert v-if="passkeyError" class="mt-4" color="error" variant="subtle" :description="passkeyError" />
          </div>
          <div class="overflow-x-auto">
            <AppTable :data="user?.passkeys || []" :columns="passkeyColumns" empty="No passkeys registered." class="min-w-[560px]">
              <template #name-cell="{ row }"><span class="font-medium">{{ row.original.name || 'Unnamed passkey' }}</span></template>
              <template #created_at-cell="{ row }">{{ formatDate(row.original.created_at) }}</template>
              <template #updated_at-cell="{ row }">{{ formatDate(row.original.updated_at) }}</template>
              <template #actions-cell="{ row }">
                <div class="flex justify-end"><AppButton icon="i-tabler-trash" color="error" variant="ghost" size="sm" :aria-label="`Delete ${row.original.name || 'passkey'}`" @click="confirmPasskeyDelete(row.original)" /></div>
              </template>
            </AppTable>
          </div>
        </AppCard>
      </div>
    </section>

    <AppModal v-model:open="keyFormOpen" :title="editingKey ? 'Edit client access key' : 'Create client access key'" :description="editingKey ? 'Rename the key or change its value. Existing scopes remain unchanged.' : 'Give the key a name; leave its value blank to generate a secure one.'">
      <template #body>
        <form class="space-y-5" @submit.prevent="saveKey">
          <UAlert v-if="keyFormError" color="error" variant="subtle" :description="keyFormError" />
          <UFormField label="Name" hint="Optional; up to 128 characters"><UInput v-model="keyName" class="w-full" maxlength="128" placeholder="e.g. My laptop" /></UFormField>
          <UFormField label="Key" :hint="editingKey ? 'Leave unchanged to keep this key' : 'Optional; blank is generated by the server'">
            <UInput v-model="keyValue" class="w-full font-mono" autocomplete="off" />
          </UFormField>

          <div class="flex justify-end gap-2"><AppButton type="button" color="neutral" variant="ghost" @click="closeKeyForm">Cancel</AppButton><AppButton type="submit" :loading="keySaving">{{ editingKey ? 'Save key' : 'Create key' }}</AppButton></div>
        </form>
      </template>
    </AppModal>

    <AppModal v-model:open="keyDeleteOpen" title="Delete client access key?" description="Clients using this key will immediately lose access.">
      <template #body><div class="space-y-5"><p class="break-all text-sm">Delete <code>{{ keyDeleteTarget ? maskKey(keyDeleteTarget.api_key) : '' }}</code>?</p><div class="flex justify-end gap-2"><AppButton color="neutral" variant="ghost" :disabled="keyDeleting" @click="closeKeyDelete">Cancel</AppButton><AppButton color="error" icon="i-tabler-trash" :loading="keyDeleting" @click="deleteKey">Delete key</AppButton></div></div></template>
    </AppModal>

    <AppModal v-model:open="totpDeleteOpen" title="Disable authenticator app?" description="Your account will no longer require authenticator codes after this change.">
      <template #body><div class="flex justify-end gap-2"><AppButton color="neutral" variant="ghost" :disabled="totpDeleting" @click="closeTOTPDelete">Cancel</AppButton><AppButton color="error" :loading="totpDeleting" @click="deleteTOTP">Disable TOTP</AppButton></div></template>
    </AppModal>

    <AppModal v-model:open="passkeyDeleteOpen" title="Delete passkey?" description="The selected authenticator will no longer be accepted for this account.">
      <template #body><div class="space-y-5"><p class="text-sm">Delete {{ passkeyDeleteTarget?.name || 'this passkey' }}?</p><div class="flex justify-end gap-2"><AppButton color="neutral" variant="ghost" :disabled="passkeyDeleting" @click="closePasskeyDelete">Cancel</AppButton><AppButton color="error" :loading="passkeyDeleting" @click="deletePasskey">Delete passkey</AppButton></div></div></template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { useWorkspaceState } from '~/composables/useWorkspaceState'
const props = withDefaults(defineProps<{ section?: 'dashboard' | 'api-keys' | 'settings' | 'billing' }>(), { section: 'dashboard' })
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
const { currentUser: user, tokenExpiresAt, fetchAPI, loadCurrentUser, saveSession, capabilities, serverInfo, loadCapabilities, registerPasskey } = useUserApi()

const curlExample = computed(() => {
  const url = new URL(serverInfo.value.cpa_public_url || 'https://api.gonkagate.com/v1')
  const basePath = url.pathname.replace(/\/+$/, '')
  url.pathname = `${basePath.endsWith('/v1') ? basePath : `${basePath}/v1`}/chat/completions`
  url.search = ''
  url.hash = ''
  const endpoint = url.toString().replace(/'/g, "'\\''")
  return [
    `curl '${endpoint}' \\`,
    '  -H "Authorization: Bearer gp-..." \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    '    "model": "<model-id>",',
    '    "messages": [{"role": "user", "content": "Hello"}]',
    "  }'"
  ].join('\n')
})

const pageError = useWorkspaceState('user:workspace:page-error', () => '')
const keys = useWorkspaceState<WorkspaceKey[]>('user:workspace:keys', () => [])
const keySearch = ref('')
const filteredKeys = computed(() => {
  const query = keySearch.value.trim().toLowerCase()
  if (!query) return keys.value
  return keys.value.filter(key =>
    (key.display_name || 'Unnamed key').toLowerCase().includes(query) ||
    key.api_key.toLowerCase().includes(query)
  )
})
const keysLoading = useWorkspaceState('user:workspace:keys-loading', () => false)
const selectedOverview = useWorkspaceState<WorkspaceBillingOverview | null>('user:workspace:selected-overview', () => null)
const todayOverview = useWorkspaceState<WorkspaceBillingOverview | null>('user:workspace:today-overview', () => null)
const monthOverview = useWorkspaceState<WorkspaceBillingOverview | null>('user:workspace:month-overview', () => null)
const charges = useWorkspaceState<BillingCharge[]>('user:workspace:charges', () => [])
const chargesTotal = useWorkspaceState('user:workspace:charges-total', () => 0)
const billingLoading = useWorkspaceState('user:workspace:billing-loading', () => false)
const billingError = useWorkspaceState('user:workspace:billing-error', () => '')
const periodLimits = useWorkspaceState<PeriodLimitsStatus | null>('user:workspace:period-limits', () => null)
let billingRequest = 0

const rangeOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom', value: 'custom' }
]
const pageSizeOptions = [5, 20, 50, 100].map(value => ({ label: String(value), value }))
const rangePreset = ref('today')
const rangeFrom = ref('')
const rangeTo = ref('')
const appliedRange = ref<BillingRange>(presetRange('today'))
const chargePage = ref(1)
const chargePageSize = ref(5)
const chargePages = computed(() => Math.max(1, Math.ceil(chargesTotal.value / chargePageSize.value)))
const chargeRangeStart = computed(() => chargesTotal.value ? (chargePage.value - 1) * chargePageSize.value + 1 : 0)
const chargeRangeEnd = computed(() => Math.min(chargePage.value * chargePageSize.value, chargesTotal.value))
const topModels = computed(() => (selectedOverview.value?.top_models || []).slice(0, 5))
const activePeriodWindows = computed(() => (periodLimits.value?.windows || []).filter(window => window.enabled && window.limit != null))
const dashboardGridStyle = computed(() => ({
  '--dashboard-columns': activePeriodWindows.value.length
    ? `repeat(${activePeriodWindows.value.length}, minmax(0, 1fr))`
    : 'minmax(0, 1fr)'
}))

const keyFormOpen = ref(false)
const keyFormError = useWorkspaceState('user:workspace:key-form-error', () => '')
const keySaving = useWorkspaceState('user:workspace:key-saving', () => false)
const editingKey = ref<WorkspaceKey | null>(null)
const keyValue = ref('')
const keyName = ref('')
const keyDeleteOpen = ref(false)
const keyDeleteTarget = ref<WorkspaceKey | null>(null)
const keyDeleting = useWorkspaceState('user:workspace:key-deleting', () => false)

const passwordForm = reactive({ password: '', confirm: '' })
const passwordError = useWorkspaceState('user:workspace:password-error', () => '')
const passwordSaving = useWorkspaceState('user:workspace:password-saving', () => false)
const email = ref('')
const emailError = useWorkspaceState('user:workspace:email-error', () => '')
const emailSaving = useWorkspaceState('user:workspace:email-saving', () => false)
const totpSetup = useWorkspaceState<TOTPSetup | null>('user:workspace:totp-setup', () => null)
const totpCode = ref('')
const totpError = useWorkspaceState('user:workspace:totp-error', () => '')
const totpLoading = useWorkspaceState('user:workspace:totp-loading', () => false)
const totpSaving = useWorkspaceState('user:workspace:totp-saving', () => false)
const totpDeleteOpen = ref(false)
const totpDeleting = useWorkspaceState('user:workspace:totp-deleting', () => false)
const passkeyName = ref('')
const passkeyError = useWorkspaceState('user:workspace:passkey-error', () => '')
const passkeySaving = useWorkspaceState('user:workspace:passkey-saving', () => false)
const passkeyDeleteOpen = ref(false)
const passkeyDeleteTarget = ref<UserPasskey | null>(null)
const passkeyDeleting = useWorkspaceState('user:workspace:passkey-deleting', () => false)


const passkeyColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'created_at', header: 'Created' },
  { accessorKey: 'updated_at', header: 'Updated' },
  { id: 'actions', header: 'Actions', meta: { class: { th: 'text-right', td: 'text-right' } } }
]

const chargeColumns = [
  { accessorKey: 'created_at', header: 'Time' },
  { accessorKey: 'provider', header: 'Provider' },
  { accessorKey: 'model', header: 'Model' },
  { accessorKey: 'input_tokens', header: 'Input tokens' },
  { accessorKey: 'output_tokens', header: 'Output tokens' },
  { accessorKey: 'amount', header: 'Charge' },
  { accessorKey: 'balance_after', header: 'Balance after' }
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
    display_name: typeof source.display_name === 'string' ? source.display_name.trim() || null : null,
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
function periodWindowBarColor(window: PeriodWindowStatus) { const ratio = periodWindowRatio(window); return ratio >= 1 ? 'bg-red-600 dark:bg-red-400' : ratio >= 0.8 ? 'bg-amber-600 dark:bg-amber-400' : 'bg-sky-600 dark:bg-sky-400' }
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
async function loadDashboardBilling() {
  billingLoading.value = true
  billingError.value = ''
  try {
    const request = ++billingRequest
    const [selectedResponse, todayResponse, monthResponse] = await Promise.all([
      fetchAPI<any>('/billing/overview', { query: appliedRange.value }),
      fetchAPI<any>('/billing/overview', { query: presetRange('today') }),
      fetchAPI<any>('/billing/overview', { query: presetRange('month') })
    ])
    if (request !== billingRequest) return
    todayOverview.value = overviewValue(todayResponse)
    selectedOverview.value = overviewValue(selectedResponse)
    monthOverview.value = overviewValue(monthResponse)
  } catch (error: any) {
    billingError.value = errorMessage(error, 'Unable to load usage summary.')
  } finally {
    billingLoading.value = false
  }
}
async function loadBilling() {
  if (section.value === 'dashboard') return loadDashboardBilling()
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
  const tasks: Promise<unknown>[] = []
  if (section.value === 'billing') tasks.push(loadBilling())
  else {
    tasks.push(loadCapabilities(), loadCurrentUser())
    if (section.value === 'api-keys') tasks.push(loadKeys())
    if (section.value === 'dashboard') tasks.push(loadPeriodLimits(), loadDashboardBilling())
  }
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
  keyName.value = key?.display_name || ''
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
  const nextName = keyName.value.trim()
  if ([...nextName].length > 128) {
    keyFormError.value = 'Name must be 128 characters or fewer.'
    return
  }
  if (editingKey.value && !nextValue) {
    keyFormError.value = 'A non-empty key is required when editing.'
    return
  }
  keySaving.value = true
  try {
    if (editingKey.value) {
      if (editingKey.value.id != null) {
        await fetchAPI(`/api-keys/${editingKey.value.id}`, { method: 'PATCH', body: { api_key: nextValue, display_name: nextName } })
      } else {
        await fetchAPI('/api-keys', { method: 'PATCH', body: { old: editingKey.value.api_key, new_api_key: nextValue, display_name: nextName } })
      }
    } else {
      await fetchAPI('/api-keys', { method: 'POST', body: { ...(nextValue ? { api_key: nextValue } : {}), display_name: nextName } })
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
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, roundingMode: 'ceil' } as Intl.NumberFormatOptions).format(Number.isFinite(number) ? number : 0)
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

  void loadWorkspace()
})
</script>

<style scoped>
.dashboard-card-icon {
  color: color-mix(in oklch, var(--color-emerald-700) 70%, var(--ui-text-highlighted));
}

.period-progress-track {
  background: color-mix(in oklch, var(--ui-text-muted) 24%, var(--ui-bg));
  box-shadow: inset 0 1px 2px rgb(0 0 0 / 15%);
}

.dashboard-limit-grid > :deep(*) { min-width: 0; }
@media (min-width: 768px) {
  .dashboard-limit-grid { grid-template-columns: var(--dashboard-columns); }
}
</style>
