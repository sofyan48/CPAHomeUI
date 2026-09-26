<template>
  <div class="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-10 lg:grid-cols-[1fr_440px]">
    <section class="hidden lg:block">
      <UBadge color="primary" variant="subtle">User workspace</UBadge>
      <h1 class="mt-5 text-5xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">Your gateway to every model.</h1>
      <p class="mt-5 max-w-xl text-lg leading-8 text-[var(--ui-text-muted)]">Manage API credentials, explore available models, review usage charges, and secure your account from one native console.</p>
      <div class="mt-8 grid grid-cols-3 gap-3">
        <div v-for="item in benefits" :key="item.label" class="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/70 p-4">
          <UIcon :name="item.icon" class="size-6 text-primary-500" />
          <p class="mt-3 text-sm font-medium">{{ item.label }}</p>
        </div>
      </div>
    </section>

    <UCard class="shadow-xl shadow-primary-950/5">
      <template #header>
        <div>
          <h2 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">{{ needsTOTP ? 'Verification code' : passkeyRequired ? 'Sign in with a passkey' : 'Welcome back' }}</h2>
          <p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ needsTOTP ? 'Enter the code from your authenticator app.' : passkeyRequired ? 'This account requires one of its registered passkeys.' : 'Sign in to your CLIProxyAPI Home account.' }}</p>
        </div>
      </template>
      <form class="space-y-5" @submit.prevent="submit">
        <UAlert v-if="error" color="error" variant="subtle" icon="i-heroicons-exclamation-circle" title="Sign in failed" :description="error" />
        <template v-if="needsTOTP">
          <UFormField label="Six-digit code" required>
            <UInput v-model="form.totp" class="w-full font-mono tracking-[0.35em]" inputmode="numeric" autocomplete="one-time-code" maxlength="8" autofocus />
          </UFormField>
          <UButton color="neutral" variant="link" class="px-0" type="button" @click="resetPrincipal">Use a different account</UButton>
          <UButton type="submit" color="primary" block size="lg" :loading="loading">Verify and sign in</UButton>
        </template>
        <template v-else-if="passkeyRequired">
          <UFormField label="Username">
            <UInput v-model="form.username" class="w-full" autocomplete="username" icon="i-heroicons-user" readonly />
          </UFormField>
          <UCheckbox v-model="form.remember" label="Keep me signed in" />
          <UAlert v-if="!passkeysSupported" color="warning" variant="subtle" title="Passkeys unavailable" description="This browser cannot use the passkey required by this account." />
          <UButton type="button" color="primary" block size="lg" icon="i-heroicons-finger-print" :loading="passkeyLoading" :disabled="!passkeysSupported" @click="passkeyLogin">Continue with passkey</UButton>
          <UButton color="neutral" variant="link" class="px-0" type="button" @click="resetPrincipal">Use a different account</UButton>
        </template>
        <template v-else>
          <UFormField label="Username" required>
            <UInput v-model="form.username" class="w-full" autocomplete="username" icon="i-heroicons-user" autofocus />
          </UFormField>
          <UFormField label="Password" required>
            <UInput v-model="form.password" class="w-full" type="password" autocomplete="current-password" icon="i-heroicons-lock-closed" />
          </UFormField>
          <div class="flex items-center justify-between gap-3">
            <UCheckbox v-model="form.remember" label="Keep me signed in" />
            <NuxtLink to="/app/forgot-password" class="text-sm font-medium text-primary-500 hover:text-primary-600">Forgot password?</NuxtLink>
          </div>
          <p class="text-xs text-[var(--ui-text-muted)]">Without this option, the browser cookie expires when the browsing session ends. The server token still uses its configured expiry.</p>
          <UButton type="submit" color="primary" block size="lg" :loading="loading">Sign in</UButton>
          <UButton v-if="passkeysSupported" type="button" color="neutral" variant="outline" block size="lg" icon="i-heroicons-finger-print" :loading="passkeyLoading" @click="passkeyLogin">Sign in with passkey</UButton>
        </template>
      </form>
      <template #footer>
        <p class="text-center text-sm text-[var(--ui-text-muted)]">New here? <NuxtLink to="/app/register" class="font-medium text-primary-500">Create an account</NuxtLink></p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const route = useRoute()
const router = useRouter()
const { token, login, loginWithPasskey, rememberSession } = useUserApi()
const form = reactive({ username: '', password: '', totp: '', remember: false })
const needsTOTP = ref(false)
const loading = ref(false)
const passkeyLoading = ref(false)
const passkeyRequired = ref(false)
const error = ref('')
const passkeysSupported = ref(false)
const benefits = [
  { label: 'Personal API keys', icon: 'i-heroicons-key' },
  { label: 'Usage and billing', icon: 'i-heroicons-chart-bar-square' },
  { label: 'Strong security', icon: 'i-heroicons-shield-check' }
]
const destination = computed(() => typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/app') ? route.query.redirect : '/app')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await login(form.username.trim(), form.password, needsTOTP.value ? form.totp : undefined, form.remember)
    await router.replace(destination.value)
  } catch (cause: any) {
    if (cause?.code === 'totp_required') {
      needsTOTP.value = true
      form.totp = ''
    } else if (cause?.code === 'passkey_required') {
      passkeyRequired.value = true
      error.value = ''
    } else {
      error.value = cause?.message || 'Unable to sign in.'
    }
  } finally {
    loading.value = false
  }
}

function resetPrincipal() {
  needsTOTP.value = false
  passkeyRequired.value = false
  form.password = ''
  form.totp = ''
  error.value = ''
}

async function passkeyLogin() {
  if (!form.username.trim()) {
    error.value = 'Enter your username before using a passkey.'
    return
  }
  error.value = ''
  passkeyLoading.value = true
  try {
    await loginWithPasskey(form.username.trim(), form.remember)
    await router.replace(destination.value)
  } catch (cause: any) {
    error.value = cause?.name === 'NotAllowedError' ? 'Passkey authentication was cancelled.' : (cause?.message || 'Passkey authentication failed.')
  } finally {
    passkeyLoading.value = false
  }
}

onMounted(() => {
  passkeysSupported.value = Boolean(window.PublicKeyCredential && navigator.credentials)
  form.remember = Boolean(rememberSession.value)
  if (token.value) void router.replace(destination.value)
})
</script>
