<template>
  <div class="mx-auto max-w-md py-16 text-center">
    <AppCard>
      <UIcon v-if="verifying" name="i-tabler-refresh" class="mx-auto size-14 animate-spin text-primary-500" />
      <UIcon v-else-if="verified" name="i-tabler-circle-check" class="mx-auto size-14 text-emerald-500" />
      <UIcon v-else-if="invalidToken" name="i-tabler-clock-x" class="mx-auto size-14 text-amber-500" />
      <UIcon v-else-if="failed || !verificationToken" name="i-tabler-alert-circle" class="mx-auto size-14 text-rose-500" />
      <UIcon v-else name="i-tabler-mail" class="mx-auto size-14 text-primary-500" />

      <h1 class="mt-5 text-2xl font-bold">{{ title }}</h1>
      <p class="mt-2 text-sm text-[var(--ui-text-muted)]">{{ message }}</p>

      <div v-if="ready" class="mt-6 space-y-3">
        <UAlert color="info" variant="subtle" title="Confirmation required" description="This action verifies the email address associated with this one-time link. The link is not consumed until you confirm." />
        <UCheckbox v-model="confirmed" label="I want to verify the email address associated with this link" />
        <AppButton color="primary" block :disabled="!confirmed" :loading="verifying" @click="verifyEmail">Confirm email address</AppButton>
        <AppButton :to="returnRoute" color="neutral" variant="ghost" block>Cancel</AppButton>
      </div>
      <div v-else-if="invalidToken" class="mt-6 space-y-3">
        <UAlert color="warning" variant="subtle" title="Verification link is invalid or expired" description="Request a new verification email from your account settings, then open the latest link." />
        <AppButton :to="returnRoute" color="primary" block>{{ authenticated ? 'Open workspace' : 'Go to sign in' }}</AppButton>
      </div>
      <AppButton v-else-if="!verifying" :to="returnRoute" color="primary" block class="mt-6">{{ authenticated ? 'Open workspace' : 'Go to sign in' }}</AppButton>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const route = useRoute()
const router = useRouter()
const { token: sessionToken, fetchAPI, loadCurrentUser } = useUserApi()
const verificationToken = ref('')
const verifying = ref(false)
const verified = ref(false)
const failed = ref(false)
const invalidToken = ref(false)
const confirmed = ref(false)
const message = ref('Confirm that you want to verify the email address associated with this link.')
const authenticated = computed(() => Boolean(sessionToken.value))
const returnRoute = computed(() => authenticated.value ? '/app' : '/app/login')
const ready = computed(() => Boolean(verificationToken.value) && !verified.value && !failed.value && !invalidToken.value && !verifying.value)
const title = computed(() => {
  if (verifying.value) return 'Verifying your email'
  if (verified.value) return 'Email verified'
  if (invalidToken.value) return 'Verification link expired'
  if (failed.value || !verificationToken.value) return 'Verification failed'
  return 'Verify your email'
})

async function scrubToken() {
  const query = { ...route.query }
  delete query.token
  await router.replace({ path: route.path, query, hash: route.hash })
}

async function verifyEmail() {
  if (!verificationToken.value || !confirmed.value || verifying.value) return
  verifying.value = true
  failed.value = false
  invalidToken.value = false
  try {
    await fetchAPI('/email/verify', { method: 'POST', auth: false, body: { token: verificationToken.value } })
    verified.value = true
    message.value = 'Your email address is now verified.'
    if (authenticated.value) await loadCurrentUser()
  } catch (cause: any) {
    if (cause?.code === 'invalid_or_expired_token') {
      invalidToken.value = true
      verificationToken.value = ''
      message.value = 'This verification link can no longer be used.'
    } else {
      failed.value = true
      message.value = cause?.message || 'Unable to verify your email address.'
    }
  } finally {
    verifying.value = false
  }
}

onMounted(() => {
  verificationToken.value = typeof route.query.token === 'string' ? route.query.token.trim() : ''
  if (!verificationToken.value) message.value = 'Open the complete verification link from your email.'
  void scrubToken()
})
</script>
