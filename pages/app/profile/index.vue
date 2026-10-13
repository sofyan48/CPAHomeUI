<template>
  <div class="user-profile mx-auto min-w-0 max-w-[80rem] space-y-5 py-3" :aria-busy="loading">
    <section class="flex flex-wrap items-center justify-between gap-3" aria-labelledby="profile-title">
      <div class="flex min-w-0 items-center gap-3">
        <span class="profile-icon flex size-9 shrink-0 items-center justify-center rounded-xl"><UIcon name="i-tabler-user-circle" class="size-5" aria-hidden="true" /></span>
        <div class="min-w-0"><h1 id="profile-title" class="break-words text-base font-semibold tracking-tight text-[var(--ui-text-highlighted)]">{{ user?.username || 'User' }}</h1><p class="mt-0.5 text-xs text-[var(--ui-text-muted)]">Account #{{ user?.id || '—' }} · Profile and security</p></div>
      </div>
      <AppButton class="shrink-0 rounded-full" color="neutral" variant="ghost" size="sm" icon="i-tabler-refresh" :loading="loading" @click="loadProfile">Refresh</AppButton>
    </section>

    <UAlert v-if="error" color="error" variant="subtle" title="Profile could not be loaded" :description="error" />

    <AppCard v-if="activePeriods.length" class="profile-panel"><template #header><div class="flex items-center gap-3"><span class="profile-icon flex size-9 shrink-0 items-center justify-center rounded-xl"><UIcon name="i-tabler-gauge" class="size-5" aria-hidden="true" /></span><div><h2 class="text-sm font-semibold">Period limits</h2><p class="text-xs text-[var(--ui-text-muted)]">Active limits currently applied to your account.</p></div></div></template><div class="grid gap-x-6 gap-y-4 sm:grid-cols-2"><div v-for="window in activePeriods" :key="window.id" class="min-w-0"><div class="flex items-center justify-between"><span class="font-medium">{{ periodLabel(window.id) }}</span><span class="text-xs font-semibold">{{ percent(window) }}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div class="h-full rounded-full bg-[var(--ui-primary)]" :style="{ width: `${percent(window)}%` }" /></div><p class="mt-2 text-xs text-[var(--ui-text-muted)]">{{ credits(window.used) }} used · {{ credits(window.remaining) }} remaining</p></div></div></AppCard>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account summary">
      <AppCard v-for="(stat, index) in stats" :key="stat.label" class="profile-panel min-w-0" :ui="{ body: 'p-4' }"><div class="flex items-center justify-between gap-2"><p class="text-xs font-medium text-[var(--ui-text-muted)]">{{ stat.label }}</p><span class="profile-icon flex size-8 shrink-0 items-center justify-center rounded-lg"><UIcon :name="profileStatIcons[index]" class="size-4" aria-hidden="true" /></span></div><p class="mt-2 break-words text-lg font-semibold tabular-nums tracking-tight text-[var(--ui-text-highlighted)]">{{ stat.value }}</p><p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ stat.detail }}</p></AppCard>
    </section>

    <div class="grid items-start gap-5 lg:grid-cols-2">
      <AppCard class="profile-panel"><template #header><div class="flex items-center gap-3"><span class="profile-icon flex size-9 shrink-0 items-center justify-center rounded-xl"><UIcon name="i-tabler-id" class="size-5" aria-hidden="true" /></span><div><h2 class="text-sm font-semibold">Account details</h2><p class="text-xs text-[var(--ui-text-muted)]">Identity and recovery information.</p></div></div></template><dl class="divide-y divide-[var(--ui-border)]/50"><div v-for="item in accountDetails" :key="item.label" class="grid min-w-0 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="min-w-0 break-words text-sm" :class="item.mono ? 'font-mono text-xs' : ''">{{ item.value }}</dd></div></dl></AppCard>
      <AppCard class="profile-panel"><template #header><div class="flex items-center gap-3"><span class="profile-icon flex size-9 shrink-0 items-center justify-center rounded-xl"><UIcon name="i-tabler-shield-lock" class="size-5" aria-hidden="true" /></span><div><h2 class="text-sm font-semibold">Security status</h2><p class="text-xs text-[var(--ui-text-muted)]">Your current sign-in and recovery methods.</p></div></div></template><div class="divide-y divide-[var(--ui-border)]/50"><div v-for="item in securityDetails" :key="item.label" class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div class="min-w-0"><p class="text-sm font-medium">{{ item.label }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ item.detail }}</p></div><UBadge :color="item.enabled ? 'success' : 'neutral'" variant="subtle">{{ item.enabled ? 'Enabled' : 'Not enabled' }}</UBadge></div></div><template #footer><div class="flex justify-end"><AppButton to="/app/settings" size="sm" color="neutral" variant="outline" icon="i-tabler-settings" class="rounded-xl">Manage security</AppButton></div></template></AppCard>
    </div>


    <AppCard class="profile-panel" :ui="{ body: 'p-0' }">
      <template #header><div class="flex items-center gap-3"><span class="profile-icon flex size-9 shrink-0 items-center justify-center rounded-xl"><UIcon name="i-tabler-fingerprint" class="size-5" aria-hidden="true" /></span><div><h2 class="text-sm font-semibold">Registered passkeys</h2><p class="text-xs text-[var(--ui-text-muted)]">Passkeys registered to this account.</p></div></div></template>
      <div class="overflow-x-auto">
        <AppTable :data="user?.passkeys || []" :columns="passkeyColumns" empty="No passkeys registered." class="min-w-[560px]">
          <template #name-cell="{ row }"><span class="font-medium">{{ row.original.name || 'Unnamed passkey' }}</span></template>
          <template #id-cell="{ row }"><span class="font-mono text-xs">{{ row.original.id }}</span></template>
          <template #created_at-cell="{ row }">{{ date(row.original.created_at) }}</template>
          <template #updated_at-cell="{ row }">{{ date(row.original.updated_at) }}</template>
        </AppTable>
      </div>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
import { useWorkspaceState } from '~/composables/useWorkspaceState'
definePageMeta({ layout: 'app' })
const { currentUser: user, tokenExpiresAt, fetchAPI, loadCurrentUser } = useUserApi()
const loading = useWorkspaceState('user:profile:loading', () => false)
const error = useWorkspaceState('user:profile:error', () => '')
const keys = useWorkspaceState<any[]>('user:profile:keys', () => [])
const periodLimits = useWorkspaceState<any>('user:profile:period-limits', () => null)
const activePeriods = computed(() => (periodLimits.value?.windows || []).filter((window: any) => window.enabled && window.limit != null))
const passkeyColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'created_at', header: 'Created' },
  { accessorKey: 'updated_at', header: 'Updated' }
]
const profileStatIcons = ['i-tabler-wallet', 'i-tabler-key', 'i-tabler-fingerprint', 'i-tabler-clock']
const stats = computed(() => [
  { label: 'Credits', value: credits(user.value?.credits), detail: 'Current available balance' },
  { label: 'API keys', value: String(keys.value.length), detail: 'Client access credentials' },
  { label: 'Passkeys', value: String(user.value?.passkey_count || 0), detail: 'Registered authenticators' },
  { label: 'Session expiry', value: date(tokenExpiresAt.value || undefined), detail: 'Current bearer session' }
])
const accountDetails = computed(() => [
  { label: 'User ID', value: user.value?.id || '—', mono: true }, { label: 'Username', value: user.value?.username || '—' },
  { label: 'Created', value: date(user.value?.created_at) }, { label: 'Last updated', value: date(user.value?.updated_at) },
  { label: 'Recovery email', value: user.value?.email_status.masked || 'Not configured' }, { label: 'Email verification', value: user.value?.email_status.verified ? 'Verified' : user.value?.email_status.configured ? 'Pending' : 'Not configured' }
])
const securityDetails = computed(() => [
  { label: 'Authenticator app', enabled: Boolean(user.value?.totp_enabled), detail: user.value?.totp_enabled ? 'TOTP is required at sign in.' : 'No authenticator is configured.' },
  { label: 'Passkeys', enabled: Boolean(user.value?.passkey_count), detail: `${user.value?.passkey_count || 0} passkey(s) registered.` },
  { label: 'Recovery email', enabled: Boolean(user.value?.email_status.verified), detail: user.value?.email_status.verified ? 'Recovery email is verified.' : 'No verified recovery email.' }
])
async function loadProfile() {
  loading.value = true; error.value = ''
  try {
    const [, keyResponse, limits] = await Promise.all([loadCurrentUser(), fetchAPI<any>('/api-keys'), fetchAPI<any>('/period-limits').catch((cause: any) => cause?.statusCode === 404 ? null : Promise.reject(cause))])
    keys.value = Array.isArray(keyResponse) ? keyResponse : keyResponse?.api_keys || keyResponse?.['api-keys'] || keyResponse?.items || keyResponse?.data || []
    periodLimits.value = limits
  } catch (cause: any) { error.value = cause?.message || 'Unable to load profile.' }
  finally { loading.value = false }
}
function credits(value: unknown) { const number = Number(value); return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, roundingMode: 'ceil' } as Intl.NumberFormatOptions).format(Number.isFinite(number) ? number : 0) }
function date(value?: string) { if (!value) return '—'; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed) : '—' }
function periodLabel(id: string) { return id === '5h' ? '5 hours' : id === '1d' ? '1 day' : id === '7d' ? '7 days' : id === '30d' ? '30 days' : id }
function percent(window: any) { const limit = Number(window.limit); return limit > 0 ? Math.round(Math.max(0, Math.min(1, Number(window.used || 0) / limit)) * 100) : 100 }
onMounted(loadProfile)
</script>

<style scoped>
.profile-panel {
  border-radius: 1.5rem;
  border-color: color-mix(in oklch, var(--ui-border) 50%, transparent);
  background: var(--ui-bg);
  box-shadow: none;
}
.profile-panel :deep([data-slot="header"]),
.profile-panel :deep([data-slot="footer"]) { border-color: color-mix(in oklch, var(--ui-border) 55%, transparent); }
.profile-icon { color: var(--ui-primary); background: color-mix(in oklch, var(--ui-primary) 8%, var(--ui-bg)); }
</style>
