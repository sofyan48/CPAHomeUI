<template>
  <div class="mx-auto max-w-md py-12">
    <AppCard>
      <template #header>
        <h1 class="text-2xl font-bold">Reset your password</h1>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Enter your verified email address to receive recovery instructions.</p>
      </template>

      <div v-if="capabilityState === 'loading'" class="space-y-4 py-4 text-center">
        <UIcon name="i-tabler-refresh" class="mx-auto size-10 animate-spin text-primary-500" />
        <p class="text-sm text-[var(--ui-text-muted)]">Checking whether password recovery is available…</p>
      </div>

      <div v-else-if="capabilityState === 'failure'" class="space-y-5">
        <UAlert color="error" variant="subtle" title="Unable to check password recovery" :description="capabilityError" />
        <AppButton color="primary" block :loading="capabilityLoading" @click="checkCapabilities">Try again</AppButton>
        <AppButton to="/app/login" color="neutral" variant="ghost" block>Back to sign in</AppButton>
      </div>

      <div v-else-if="capabilityState === 'unsupported'" class="space-y-5">
        <UAlert color="warning" variant="subtle" title="Password recovery is not supported" description="This Home server does not advertise password recovery. Ask an administrator for help accessing your account." />
        <AppButton to="/app/login" color="primary" block>Back to sign in</AppButton>
      </div>

      <div v-else-if="capabilityState === 'disabled'" class="space-y-5">
        <UAlert color="warning" variant="subtle" title="Password recovery is disabled" description="Email password recovery is not enabled on this Home server. Ask an administrator for help accessing your account." />
        <AppButton to="/app/login" color="primary" block>Back to sign in</AppButton>
      </div>

      <div v-else-if="sent" class="space-y-5 text-center">
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><UIcon name="i-tabler-mail" class="size-7" /></div>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ acceptedMessage }}</p>
        <AppButton color="neutral" variant="outline" block @click="requestAnother">Submit another request</AppButton>
        <AppButton to="/app/login" color="primary" block>Return to sign in</AppButton>
      </div>

      <form v-else class="space-y-5" @submit.prevent="submit">
        <UAlert v-if="error" color="error" variant="subtle" title="Request failed" :description="error" />
        <UFormField label="Email" required><UInput v-model="email" class="w-full" type="email" autocomplete="email" icon="i-tabler-mail" /></UFormField>
        <AppButton type="submit" color="primary" block :loading="loading">Send reset instructions</AppButton>
        <AppButton to="/app/login" color="neutral" variant="ghost" block>Back to sign in</AppButton>
      </form>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const { fetchAPI, capabilities, loadCapabilities } = useUserApi()
const email = ref('')
const loading = ref(false)
const capabilityLoading = ref(false)
const capabilityState = ref<'loading' | 'failure' | 'unsupported' | 'disabled' | 'enabled'>('loading')
const capabilityError = ref('Unable to contact the Home server.')
const error = ref('')
const sent = ref(false)
const acceptedMessage = 'If an eligible account matches, password reset instructions will be sent.'

async function checkCapabilities() {
  capabilityState.value = 'loading'
  capabilityLoading.value = true
  capabilityError.value = 'Unable to contact the Home server.'
  try {
    const response = await loadCapabilities()
    const advertised = response?.capabilities
    if (!advertised || !Object.prototype.hasOwnProperty.call(advertised, 'password_recovery')) {
      capabilityState.value = 'unsupported'
    } else {
      capabilityState.value = capabilities.value.password_recovery === true ? 'enabled' : 'disabled'
    }
  } catch (cause: any) {
    if (cause?.statusCode === 404) {
      capabilityState.value = 'unsupported'
    } else {
      capabilityError.value = cause?.message || capabilityError.value
      capabilityState.value = 'failure'
    }
  } finally {
    capabilityLoading.value = false
  }
}

async function submit() {
  error.value = ''
  if (!email.value.trim()) return void (error.value = 'Email is required.')
  loading.value = true
  try {
    await fetchAPI('/password/forgot', { method: 'POST', auth: false, body: { email: email.value.trim() } })
    sent.value = true
  } catch (cause: any) {
    if (cause?.statusCode === 404 || cause?.code === 'email_feature_unavailable') {
      capabilityState.value = 'unsupported'
    } else if (cause?.code === 'invalid_email') {
      error.value = 'Enter a valid email address.'
    } else if (cause?.code === 'request_too_large') {
      error.value = 'The request is too large. Check the email address and try again.'
    } else {
      error.value = 'Unable to request a password reset. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

function requestAnother() {
  sent.value = false
  error.value = ''
  email.value = ''
}

onMounted(() => { void checkCapabilities() })
</script>
