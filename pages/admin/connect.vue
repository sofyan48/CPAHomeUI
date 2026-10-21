<template>
  <div class="relative min-h-screen overflow-hidden bg-[var(--ui-bg)]">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_42%)]" />

    <div class="absolute right-4 top-4 z-10"><ConsoleLanguageSwitcher /></div>

        <div class="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
      <section class="hidden lg:block">
        <div class="mb-8 inline-flex items-center gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/80 px-4 py-3 shadow-sm backdrop-blur">
          <div class="flex size-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/25">
            <UIcon name="i-tabler-terminal-2" class="size-6" />
          </div>
          <div>
            <p class="font-semibold text-[var(--ui-text-highlighted)]">CPAHome</p>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ t('connect.controlPlane') }}</p>
          </div>
        </div>

        <h1 class="max-w-2xl text-5xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">
          {{ t('connect.heading') }}
        </h1>
        <p class="mt-5 max-w-xl text-lg leading-8 text-[var(--ui-text-muted)]">
          {{ t('connect.description') }}
        </p>

        <div class="mt-10 grid max-w-xl grid-cols-2 gap-4">
          <div v-for="item in highlights" :key="item.title" class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/70 p-4 backdrop-blur">
            <UIcon :name="item.icon" class="mb-3 size-5 text-primary-500" />
            <p class="font-medium text-[var(--ui-text-highlighted)]">{{ item.title }}</p>
            <p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ item.description }}</p>
          </div>
        </div>
      </section>

      <AppCard class="mx-auto w-full max-w-md shadow-2xl shadow-slate-950/10" :ui="{ body: 'p-6 sm:p-8', header: 'p-6 pb-0 sm:px-8 sm:pt-8' }">
        <template #header>
          <div class="text-center">
            <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-500 text-white lg:hidden">
              <UIcon name="i-tabler-terminal-2" class="size-7" />
            </div>
            <h2 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">{{ t('connect.signIn') }}</h2>
            <p class="mt-2 text-sm text-[var(--ui-text-muted)]">{{ t('connect.signInDescription') }}</p>
          </div>
        </template>

        <form class="space-y-5" @submit.prevent="handleLogin">
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-tabler-alert-triangle"
            :title="t('connection.failed')"
            :description="localizedErrorMessage"
          />

          <UAlert color="info" variant="subtle" :title="t('connect.endpoint')" :description="apiBase" />

          <UFormField :label="t('connect.key')" required>
            <UInput
              v-model="token"
              :type="keyVisible ? 'text' : 'password'"
              autocomplete="current-password"
              :placeholder="t('connect.keyPlaceholder')"
              icon="i-tabler-key"
              size="lg"
              class="w-full"
              :disabled="loading"
              :ui="{ trailing: 'pe-1' }"
              autofocus
            >
              <template #trailing>
                <AppButton type="button" size="xs" color="neutral" variant="ghost" :icon="keyVisible ? 'i-tabler-eye-off' : 'i-tabler-eye'" :aria-label="keyVisible ? t('connect.hideKey') : t('connect.showKey')" :title="keyVisible ? t('connect.hideKey') : t('connect.showKey')" :aria-pressed="keyVisible" :disabled="loading" @click="keyVisible = !keyVisible" />
              </template>
            </UInput>
          </UFormField>

          <UCheckbox v-model="remember" :label="t('connect.remember')" />

          <AppButton type="submit" color="primary" size="lg" block :loading="loading" :disabled="!token.trim()">
            {{ t('connect.submit') }}
          </AppButton>

          <p class="text-center text-xs leading-5 text-[var(--ui-text-dimmed)]">
            {{ t('connect.privacy') }}
          </p>
        </form>
      </AppCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useConsoleLocale } from '~/composables/useConsoleLocale'
import { storeToRefs } from 'pinia'
import { useManagementSessionStore } from '~/stores/managementSession'
import { useCapabilities as useManagementCapabilities } from '~/composables/useCapabilities'

definePageMeta({ layout: false })

const { t } = useConsoleLocale()
const highlights = computed(() => [
  { icon: 'i-tabler-antenna-bars-5', title: t('connect.topology'), description: t('connect.topologyDescription') },
  { icon: 'i-tabler-chart-bar', title: t('connect.usage'), description: t('connect.usageDescription') },
  { icon: 'i-tabler-shield-check', title: t('connect.access'), description: t('connect.accessDescription') },
  { icon: 'i-tabler-tools', title: t('connect.operations'), description: t('connect.operationsDescription') }
])

const router = useRouter()
const route = useRoute()
const { fetchAPI, token: storedToken, apiBase } = useApi()
const { rememberSession: remembered } = storeToRefs(useManagementSessionStore())
const { resetCapabilities } = useManagementCapabilities()
const token = ref('')
const keyVisible = ref(false)
const remember = ref(false)
const loading = useWorkspaceState('admin:connect:loading', () => (false))
const errorMessage = useWorkspaceState('admin:connect:errorMessage', () => (''))
const localizedErrorMessage = computed(() => {
  switch (errorMessage.value) {
    case 'connect.rejected': return t('connect.rejected')
    case 'connect.unavailable': return t('connect.unavailable')
    case 'connect.unreachable': return t('connect.unreachable')
    default: return errorMessage.value
  }
})

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
      errorMessage.value = 'connect.rejected'
    } else if (error?.statusCode === 404) {
      errorMessage.value = 'connect.unavailable'
    } else {
      errorMessage.value = error?.message || 'connect.unreachable'
    }
  } finally {
    loading.value = false
  }
}
</script>
