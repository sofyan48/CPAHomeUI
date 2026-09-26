<template>
  <div class="relative min-h-screen overflow-hidden bg-[var(--ui-bg)]">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_42%)]" />

    <div class="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
      <section class="hidden lg:block">
        <div class="mb-8 inline-flex items-center gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/80 px-4 py-3 shadow-sm backdrop-blur">
          <div class="flex size-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/25">
            <UIcon name="i-tabler-terminal-2" class="size-6" />
          </div>
          <div>
            <p class="font-semibold text-[var(--ui-text-highlighted)]">CLIProxyAPI Home</p>
            <p class="text-xs text-[var(--ui-text-muted)]">Management control plane</p>
          </div>
        </div>

        <h1 class="max-w-2xl text-5xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">
          Operate your CPA cluster with confidence.
        </h1>
        <p class="mt-5 max-w-xl text-lg leading-8 text-[var(--ui-text-muted)]">
          Monitor topology, inspect usage, manage access, and keep every connected node visible from one secure console.
        </p>

        <div class="mt-10 grid max-w-xl grid-cols-2 gap-4">
          <div v-for="item in highlights" :key="item.title" class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/70 p-4 backdrop-blur">
            <UIcon :name="item.icon" class="mb-3 size-5 text-primary-500" />
            <p class="font-medium text-[var(--ui-text-highlighted)]">{{ item.title }}</p>
            <p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ item.description }}</p>
          </div>
        </div>
      </section>

      <UCard class="mx-auto w-full max-w-md shadow-2xl shadow-slate-950/10" :ui="{ body: 'p-6 sm:p-8', header: 'p-6 pb-0 sm:px-8 sm:pt-8' }">
        <template #header>
          <div class="text-center">
            <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-500 text-white lg:hidden">
              <UIcon name="i-tabler-terminal-2" class="size-7" />
            </div>
            <h2 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Management sign in</h2>
            <p class="mt-2 text-sm text-[var(--ui-text-muted)]">Validate your management key against this Home instance.</p>
          </div>
        </template>

        <form class="space-y-5" @submit.prevent="handleLogin">
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-tabler-alert-triangle"
            title="Connection failed"
            :description="errorMessage"
          />

          <UAlert color="info" variant="subtle" title="Management endpoint" :description="apiBase" />

          <UFormField label="Management key" required>
            <UInput
              v-model="token"
              type="password"
              autocomplete="current-password"
              placeholder="Enter the management secret"
              icon="i-tabler-key"
              size="lg"
              class="w-full"
              :disabled="loading"
              autofocus
            />
          </UFormField>

          <UCheckbox v-model="remember" label="Keep this management connection for 30 days" />

          <UButton type="submit" color="primary" size="lg" block :loading="loading" :disabled="!token.trim()">
            Connect to Home
          </UButton>

          <p class="text-center text-xs leading-5 text-[var(--ui-text-dimmed)]">
            Without persistence, the same-site cookie ends with this browser session. The key is sent only to the configured Management API path.
          </p>
        </form>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCapabilities as useManagementCapabilities } from '~/composables/useCapabilities'

definePageMeta({ layout: false })

const highlights = [
  { icon: 'i-tabler-antenna-bars-5', title: 'Live topology', description: 'See Home and CPA health at a glance.' },
  { icon: 'i-tabler-chart-bar', title: 'Usage insights', description: 'Track requests, tokens, and failures.' },
  { icon: 'i-tabler-shield-check', title: 'Access control', description: 'Manage users, keys, and routing scopes.' },
  { icon: 'i-tabler-tools', title: 'Operations', description: 'Inspect capabilities, nodes, and logs.' }
]

const router = useRouter()
const route = useRoute()
const { fetchAPI, token: storedToken, apiBase } = useApi()
const remembered = useCookie<boolean>('management_remember', { sameSite: 'strict', secure: import.meta.client && window.location.protocol === 'https:', default: () => false })
const { resetCapabilities } = useManagementCapabilities()
const token = ref('')
const remember = ref(false)
const loading = ref(false)
const errorMessage = ref('')

onMounted(() => {
  if (storedToken.value) token.value = storedToken.value
  remember.value = Boolean(remembered.value)
})

const handleLogin = async () => {
  const candidate = token.value.trim()
  if (!candidate || loading.value) return

  loading.value = true
  errorMessage.value = ''
  try {
    await fetchAPI('/capabilities', { token: candidate })
    const cookieOptions = { sameSite: 'strict' as const, secure: import.meta.client && window.location.protocol === 'https:', ...(remember.value ? { maxAge: 60 * 60 * 24 * 30 } : {}) }
    useCookie<string | null>('management_token', cookieOptions).value = candidate
    useCookie<boolean>('management_remember', cookieOptions).value = remember.value
    storedToken.value = candidate
    remembered.value = remember.value
    resetCapabilities()
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/admin/')
      ? route.query.redirect
      : '/admin/dashboard'
    await router.replace(redirect)
  } catch (error: any) {
    storedToken.value = null
    remembered.value = false
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      errorMessage.value = 'The management key was rejected. Check the key and remote-management settings.'
    } else if (error?.statusCode === 404) {
      errorMessage.value = 'The Management API is unavailable or disabled on this Home instance.'
    } else {
      errorMessage.value = error?.message || 'Unable to reach the Management API.'
    }
  } finally {
    loading.value = false
  }
}
</script>
