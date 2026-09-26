<template>
  <div class="mx-auto max-w-md py-16 text-center">
    <UCard>
      <UIcon v-if="verifying" name="i-tabler-refresh" class="mx-auto size-14 animate-spin text-primary-500" />
      <UIcon v-else-if="verified" name="i-tabler-circle-check" class="mx-auto size-14 text-emerald-500" />
      <UIcon v-else-if="failed || !verificationToken" name="i-tabler-alert-circle" class="mx-auto size-14 text-rose-500" />
      <UIcon v-else name="i-tabler-mail" class="mx-auto size-14 text-primary-500" />

      <h1 class="mt-5 text-2xl font-bold">{{ title }}</h1>
      <p class="mt-2 text-sm text-[var(--ui-text-muted)]">{{ message }}</p>

      <div v-if="ready" class="mt-6 space-y-3">
        <UAlert color="info" variant="subtle" title="Confirmation required" description="Confirm below to verify your email. The link is not consumed until you continue." />
        <UButton color="primary" block :loading="verifying" @click="verifyEmail">Confirm email address</UButton>
        <UButton :to="returnRoute" color="neutral" variant="ghost" block>Cancel</UButton>
      </div>
      <UButton v-else-if="!verifying" :to="returnRoute" color="primary" block class="mt-6">{{ authenticated ? 'Open workspace' : 'Go to sign in' }}</UButton>
    </UCard>
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
const message = ref('Confirm that you want to verify the email address associated with this link.')
const authenticated = computed(() => Boolean(sessionToken.value))
const returnRoute = computed(() => authenticated.value ? '/app' : '/app/login')
const ready = computed(() => Boolean(verificationToken.value) && !verified.value && !failed.value && !verifying.value)
const title = computed(() => {
  if (verifying.value) return 'Verifying your email'
  if (verified.value) return 'Email verified'
  if (failed.value || !verificationToken.value) return 'Verification failed'
  return 'Verify your email'
})

async function scrubToken() {
  const query = { ...route.query }
  delete query.token
  await router.replace({ path: route.path, query, hash: route.hash })
}

async function verifyEmail() {
  if (!verificationToken.value || verifying.value) return
  verifying.value = true
  failed.value = false
  try {
    await fetchAPI('/email/verify', { method: 'POST', auth: false, body: { token: verificationToken.value } })
    verified.value = true
    message.value = 'Your email address is now verified.'
    if (authenticated.value) await loadCurrentUser()
  } catch (cause: any) {
    failed.value = true
    message.value = cause?.message || 'The verification link is invalid or expired.'
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
