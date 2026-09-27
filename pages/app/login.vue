<template>
  <div class="mx-auto max-w-md py-8">

    <AppCard>
      <template #header>
        <div class="flex items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-500/10 text-primary-500"><UIcon :name="passkeyRequired ? 'i-tabler-fingerprint' : needsTOTP ? 'i-tabler-device-mobile' : 'i-tabler-user'" class="size-5" /></span>
          <div><h1 class="text-xl font-semibold text-[var(--ui-text-highlighted)]">{{ title }}</h1><p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ description }}</p></div>
        </div>
      </template>

      <UAlert v-if="token && currentUser" class="mb-4" color="info" variant="subtle" :title="`Already signed in as ${currentUser.username}`" description="You can continue to the workspace or sign in with another account." />
      <form class="space-y-4" @submit.prevent="submit">
        <UAlert v-if="error" ref="errorAlert" color="error" variant="subtle" title="Sign in failed" :description="error" role="alert" tabindex="-1" />
        <UFormField label="Username" required><UInput v-model="form.username" class="w-full" autocomplete="username" icon="i-tabler-user" :readonly="needsTOTP || passkeyRequired" autofocus /></UFormField>
        <UFormField v-if="!passkeyRequired" label="Password" required><UInput v-model="form.password" class="w-full" type="password" autocomplete="current-password" icon="i-tabler-lock" /></UFormField>
        <UFormField v-if="needsTOTP" label="Authenticator code" required><UInput v-model="form.totp" class="w-full font-mono tracking-[0.3em]" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" autofocus /></UFormField>
        <UAlert v-if="passkeyRequired" color="warning" variant="subtle" title="Passkey required" description="This account requires one of its registered passkeys to sign in." />
        <div v-if="!needsTOTP && !passkeyRequired" class="flex items-center justify-between gap-3"><UCheckbox v-model="form.remember" label="Remember this login" /><NuxtLink to="/app/forgot-password" class="text-sm font-medium text-primary-500">Forgot password?</NuxtLink></div>
        <UCheckbox v-else v-model="form.remember" label="Remember this login" />
        <p class="text-xs leading-5 text-[var(--ui-text-muted)]">Remembered sessions persist after the browser closes. Otherwise this login lasts for the current browser session.</p>
        <UButton v-if="passkeyRequired" type="button" color="primary" block icon="i-tabler-fingerprint" :loading="passkeyLoading" :disabled="!passkeysSupported" @click="passkeyLogin">Use passkey</UButton>
        <UButton v-else type="submit" color="primary" block :loading="loading">{{ needsTOTP ? 'Verify and sign in' : 'Sign in' }}</UButton>
        <UButton v-if="!needsTOTP && !passkeyRequired && passkeysSupported" type="button" color="neutral" variant="outline" block icon="i-tabler-fingerprint" :loading="passkeyLoading" @click="passkeyLogin">Sign in with passkey</UButton>
        <UButton v-if="token && currentUser" to="/app" color="neutral" variant="outline" block>User workspace</UButton>
      </form>
      <template #footer><p class="text-center text-sm text-[var(--ui-text-muted)]">Need an account? <NuxtLink to="/app/register" class="font-medium text-primary-500">Create account</NuxtLink></p></template>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const route = useRoute()
const router = useRouter()
const { token, currentUser, login, loginWithPasskey, rememberSession } = useUserApi()
const form = reactive({ username: '', password: '', totp: '', remember: false })
const needsTOTP = ref(false)
const passkeyRequired = ref(false)
const loading = ref(false)
const passkeyLoading = ref(false)
const error = ref('')
const errorAlert = ref<HTMLElement | null>(null)
const passkeysSupported = ref(false)
const title = computed(() => needsTOTP.value ? 'Authenticator verification' : passkeyRequired.value ? 'Passkey sign in' : 'User login')
const description = computed(() => needsTOTP.value ? 'Enter the current code from your authenticator app.' : passkeyRequired.value ? 'Continue using a passkey registered to this account.' : 'Sign in to access your workspace, billing, and API keys.')
const destination = computed(() => typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/app') ? route.query.redirect : '/app')

async function focusError() { await nextTick(); errorAlert.value?.focus?.() }
async function submit() {
  error.value = ''
  if (!form.username.trim()) { error.value = 'Username is required.'; return focusError() }
  if (!form.password) { error.value = 'Password is required.'; return focusError() }
  if (needsTOTP.value && !form.totp.trim()) { error.value = 'Authenticator code is required.'; return focusError() }
  loading.value = true
  try {
    await login(form.username.trim(), form.password, needsTOTP.value ? form.totp.trim() : undefined, form.remember)
    await router.replace(destination.value)
  } catch (cause: any) {
    if (cause?.code === 'totp_required') { needsTOTP.value = true; passkeyRequired.value = false; form.totp = '' }
    else if (cause?.code === 'passkey_required') { passkeyRequired.value = true; needsTOTP.value = false; error.value = '' }
    else { error.value = cause?.message || 'Unable to sign in.'; await focusError() }
  } finally { loading.value = false }
}
async function passkeyLogin() {
  if (!form.username.trim()) { error.value = 'Username is required.'; return focusError() }
  error.value = ''; passkeyLoading.value = true
  try { await loginWithPasskey(form.username.trim(), form.remember); await router.replace(destination.value) }
  catch (cause: any) { error.value = cause?.name === 'NotAllowedError' ? 'Passkey authentication was cancelled.' : (cause?.message || 'Passkey authentication failed.'); await focusError() }
  finally { passkeyLoading.value = false }
}
onMounted(() => { passkeysSupported.value = Boolean(window.PublicKeyCredential && navigator.credentials); form.remember = Boolean(rememberSession.value) })
</script>
