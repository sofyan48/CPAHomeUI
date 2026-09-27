<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex min-w-0 items-start gap-4">
        <span class="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500"><UIcon name="i-tabler-user-circle" class="size-8" /></span>
        <div class="min-w-0"><p class="text-sm text-[var(--ui-text-muted)]">User profile</p><h1 class="mt-1 truncate text-2xl font-bold text-[var(--ui-text-highlighted)]">{{ user?.username || 'User' }}</h1><p class="mt-1 text-sm text-[var(--ui-text-muted)]">Account #{{ user?.id || '—' }}</p></div>
      </div>
      <UButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="loading" @click="loadProfile">Refresh</UButton>
    </section>

    <UAlert v-if="error" color="error" variant="subtle" title="Profile could not be loaded" :description="error" />

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AppCard v-for="stat in stats" :key="stat.label"><p class="text-xs font-medium uppercase tracking-wide text-[var(--ui-text-muted)]">{{ stat.label }}</p><p class="mt-2 text-xl font-semibold">{{ stat.value }}</p><p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ stat.detail }}</p></AppCard>
    </section>

    <div class="grid items-start gap-5 lg:grid-cols-2">
      <AppCard><template #header><h2 class="font-semibold">Account</h2></template><dl class="grid gap-4 sm:grid-cols-2"><div v-for="item in accountDetails" :key="item.label"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="mt-1 break-words text-sm" :class="item.mono ? 'font-mono text-xs' : ''">{{ item.value }}</dd></div></dl></AppCard>
      <AppCard><template #header><h2 class="font-semibold">Security status</h2></template><div class="space-y-3"><div v-for="item in securityDetails" :key="item.label" class="flex items-center justify-between gap-4 rounded-md border border-[var(--ui-border)] px-3 py-2.5"><div><p class="text-sm font-medium">{{ item.label }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ item.detail }}</p></div><UBadge :color="item.enabled ? 'success' : 'neutral'" variant="subtle">{{ item.enabled ? 'Enabled' : 'Not enabled' }}</UBadge></div></div><template #footer><div class="flex justify-end"><UButton to="/app/settings" size="sm" color="neutral" variant="outline">Manage security</UButton></div></template></AppCard>
    </div>

    <AppCard v-if="activePeriods.length"><template #header><div><h2 class="font-semibold">Period limits</h2><p class="text-xs text-[var(--ui-text-muted)]">Active limits currently applied to your account.</p></div></template><div class="grid gap-3 sm:grid-cols-2"><div v-for="window in activePeriods" :key="window.id" class="rounded-md border border-[var(--ui-border)] p-3"><div class="flex items-center justify-between"><span class="font-medium">{{ periodLabel(window.id) }}</span><span class="text-xs font-semibold">{{ percent(window) }}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div class="h-full rounded-full bg-[var(--ui-primary)]" :style="{ width: `${percent(window)}%` }" /></div><p class="mt-2 text-xs text-[var(--ui-text-muted)]">{{ credits(window.used) }} used · {{ credits(window.remaining) }} remaining</p></div></div></AppCard>

    <AppCard :ui="{ body: 'p-0' }">
      <template #header><div><h2 class="font-semibold">Registered passkeys</h2><p class="text-xs text-[var(--ui-text-muted)]">Passkeys registered to this account.</p></div></template>
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
definePageMeta({ layout: 'app' })
const { currentUser: user, tokenExpiresAt, fetchAPI, loadCurrentUser } = useUserApi()
const loading = ref(false)
const error = ref('')
const keys = ref<any[]>([])
const periodLimits = ref<any>(null)
const activePeriods = computed(() => (periodLimits.value?.windows || []).filter((window: any) => window.enabled && window.limit != null))
const passkeyColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'created_at', header: 'Created' },
  { accessorKey: 'updated_at', header: 'Updated' }
]
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
function credits(value: unknown) { const number = Number(value); return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number.isFinite(number) ? number : 0) }
function date(value?: string) { if (!value) return '—'; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed) : '—' }
function periodLabel(id: string) { return id === '5h' ? '5 hours' : id === '1d' ? '1 day' : id === '7d' ? '7 days' : id === '30d' ? '30 days' : id }
function percent(window: any) { const limit = Number(window.limit); return limit > 0 ? Math.round(Math.max(0, Math.min(1, Number(window.used || 0) / limit)) * 100) : 100 }
onMounted(loadProfile)
</script>
