<template>
  <div class="mx-auto max-w-md py-12">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Reset your password</h1>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Enter your verified email address to receive recovery instructions.</p>
      </template>

      <div v-if="capabilityState === 'loading'" class="space-y-4 py-4 text-center">
        <UIcon name="i-heroicons-arrow-path" class="mx-auto size-10 animate-spin text-primary-500" />
        <p class="text-sm text-[var(--ui-text-muted)]">Checking whether password recovery is available…</p>
      </div>

      <div v-else-if="capabilityState === 'failure'" class="space-y-5">
        <UAlert color="error" variant="subtle" title="Unable to check password recovery" :description="capabilityError" />
        <UButton color="primary" block :loading="capabilityLoading" @click="checkCapabilities">Try again</UButton>
        <UButton to="/app/login" color="neutral" variant="ghost" block>Back to sign in</UButton>
      </div>

      <div v-else-if="capabilityState === 'unsupported'" class="space-y-5">
        <UAlert color="warning" variant="subtle" title="Password recovery is not supported" description="This Home server does not advertise password recovery. Ask an administrator for help accessing your account." />
        <UButton to="/app/login" color="primary" block>Back to sign in</UButton>
      </div>

      <div v-else-if="capabilityState === 'disabled'" class="space-y-5">
        <UAlert color="warning" variant="subtle" title="Password recovery is disabled" description="Email password recovery is not enabled on this Home server. Ask an administrator for help accessing your account." />
        <UButton to="/app/login" color="primary" block>Back to sign in</UButton>
      </div>

      <div v-else-if="sent" class="space-y-5 text-center">
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><UIcon name="i-heroicons-envelope" class="size-7" /></div>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ message }}</p>
        <UButton color="neutral" variant="outline" block @click="requestAnother">Submit another request</UButton>
        <UButton to="/app/login" color="primary" block>Return to sign in</UButton>
      </div>

      <form v-else class="space-y-5" @submit.prevent="submit">
        <UAlert v-if="error" color="error" variant="subtle" title="Request failed" :description="error" />
        <UFormField label="Email" required><UInput v-model="email" class="w-full" type="email" autocomplete="email" icon="i-heroicons-envelope" /></UFormField>
        <UButton type="submit" color="primary" block :loading="loading">Send reset instructions</UButton>
        <UButton to="/app/login" color="neutral" variant="ghost" block>Back to sign in</UButton>
      </form>
    </UCard>
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
const message = ref('If an eligible account matches, password reset instructions will be sent.')

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
    capabilityError.value = cause?.message || capabilityError.value
    capabilityState.value = 'failure'
  } finally {
    capabilityLoading.value = false
  }
}

async function submit() {
  error.value = ''
  if (!email.value.trim()) return void (error.value = 'Email is required.')
  loading.value = true
  try {
    const response = await fetchAPI<{ message?: string }>('/password/forgot', { method: 'POST', auth: false, body: { email: email.value.trim() } })
    message.value = response.message || message.value
    sent.value = true
  } catch (cause: any) {
    error.value = cause?.message || 'Unable to request a password reset.'
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
