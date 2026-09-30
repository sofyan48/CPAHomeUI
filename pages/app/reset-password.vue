<template>
  <div class="mx-auto max-w-md py-12">
    <AppCard>
      <template #header>
        <h1 class="text-2xl font-bold">Choose a new password</h1>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Reset links are single-use and expire for your security.</p>
      </template>

      <div v-if="securing" class="space-y-4 py-4 text-center">
        <UIcon name="i-tabler-shield-lock" class="mx-auto size-12 text-primary-500" />
        <p class="font-medium">Securing your reset link</p>
        <p class="text-sm text-[var(--ui-text-muted)]">Removing the one-time token from the address bar before continuing…</p>
      </div>

      <div v-else-if="complete" class="space-y-5 text-center">
        <UIcon name="i-tabler-circle-check" class="mx-auto size-14 text-emerald-500" />
        <p>Your password has been reset. Your previous sessions have been signed out, so you can now sign in with the new password.</p>
        <UAlert color="info" variant="subtle" title="Your other security methods are unchanged" description="TOTP and registered passkeys remain enabled and will still apply when you sign in." />
        <AppButton to="/app/login" color="primary" block>Sign in</AppButton>
      </div>

      <div v-else-if="invalidToken" class="space-y-5">
        <UAlert color="warning" variant="subtle" title="Reset link is invalid or expired" :description="invalidTokenMessage" />
        <AppButton to="/app/forgot-password" color="primary" block>Request a new reset link</AppButton>
        <AppButton to="/app/login" color="neutral" variant="ghost" block>Back to sign in</AppButton>
      </div>

      <form v-else class="space-y-5" @submit.prevent="submit">
        <UAlert v-if="error" color="error" variant="subtle" title="Reset failed" :description="error" />
        <UAlert color="info" variant="subtle" title="TOTP and passkeys remain enabled" description="Changing your password does not remove your authenticator app or registered passkeys." />
        <UFormField label="New password" required><UInput v-model="password" class="w-full" type="password" autocomplete="new-password" /></UFormField>
        <UFormField label="Confirm password" required><UInput v-model="confirmPassword" class="w-full" type="password" autocomplete="new-password" /></UFormField>
        <AppButton type="submit" color="primary" block :loading="loading">Reset password</AppButton>
      </form>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const route = useRoute()
const router = useRouter()
const { fetchAPI, clearSession } = useUserApi()
const resetToken = ref('')
const password = ref('')
const confirmPassword = ref('')
const securing = ref(true)
const loading = ref(false)
const error = ref('')
const complete = ref(false)
const invalidToken = ref(false)
const invalidTokenMessage = ref('Open a complete reset link from your recovery email, or request a new one.')

async function scrubToken() {
  const query = { ...route.query }
  delete query.token
  await router.replace({ path: route.path, query, hash: route.hash })
}

async function submit() {
  error.value = ''
  if (!password.value) return void (error.value = 'Password is required.')
  if (password.value !== confirmPassword.value) return void (error.value = 'Passwords do not match.')
  loading.value = true
  try {
    await fetchAPI('/password/reset', { method: 'POST', auth: false, body: { token: resetToken.value, new_password: password.value } })
    clearSession()
    complete.value = true
  } catch (cause: any) {
    if (cause?.code === 'invalid_or_expired_token') {
      invalidToken.value = true
      invalidTokenMessage.value = 'The password reset link is invalid or expired.'
      resetToken.value = ''
    } else {
      error.value = cause?.message || 'Unable to reset password.'
    }
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  resetToken.value = typeof route.query.token === 'string' ? route.query.token.trim() : ''
  invalidToken.value = !resetToken.value
  try {
    await scrubToken()
  } finally {
    securing.value = false
  }
})
</script>
