<template>
  <div class="mx-auto max-w-md py-8">
    <UCard class="shadow-xl shadow-primary-950/5">
      <template #header>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Create your account</h1>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Start using models through CLIProxyAPI Home.</p>
      </template>
      <form class="space-y-5" @submit.prevent="submit">
        <UAlert v-if="error" color="error" variant="subtle" title="Registration failed" :description="error" />
        <UFormField label="Username" required>
          <UInput v-model="form.username" class="w-full" autocomplete="username" icon="i-tabler-user" />
        </UFormField>
        <UFormField v-if="emailEnabled" label="Email" hint="Optional, used for verification and recovery">
          <UInput v-model="form.email" class="w-full" type="email" autocomplete="email" icon="i-tabler-mail" />
        </UFormField>
        <UFormField label="Password" required hint="Maximum 72 bytes">
          <UInput v-model="form.password" class="w-full" type="password" autocomplete="new-password" icon="i-tabler-lock" />
        </UFormField>
        <UFormField label="Confirm password" required>
          <UInput v-model="form.confirmPassword" class="w-full" type="password" autocomplete="new-password" icon="i-tabler-lock" />
        </UFormField>
        <UCheckbox v-model="form.remember" label="Keep me signed in" />
        <p class="text-xs text-[var(--ui-text-muted)]">Without this option, the browser cookie expires when the browsing session ends. The server token still uses its configured expiry.</p>
        <UButton type="submit" color="primary" block size="lg" :loading="loading">Create account</UButton>
      </form>
      <template #footer><p class="text-center text-sm text-[var(--ui-text-muted)]">Already registered? <NuxtLink to="/app/login" class="font-medium text-primary-500">Sign in</NuxtLink></p></template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const router = useRouter()
const { fetchAPI, saveSession, capabilities, loadCapabilities, rememberSession } = useUserApi()
const form = reactive({ username: '', email: '', password: '', confirmPassword: '', remember: false })
const loading = ref(false)
const error = ref('')
const emailEnabled = computed(() => capabilities.value.email_registration === true)

async function submit() {
  error.value = ''
  if (!form.username.trim()) return void (error.value = 'Username is required.')
  if (!form.password) return void (error.value = 'Password is required.')
  if (form.password !== form.confirmPassword) return void (error.value = 'Passwords do not match.')
  loading.value = true
  try {
    const session = await fetchAPI<UserSessionResponse>('/register', { method: 'POST', auth: false, body: { username: form.username.trim(), password: form.password, ...(form.email.trim() ? { email: form.email.trim() } : {}) } })
    saveSession(session, form.remember)
    await router.replace('/app')
  } catch (cause: any) {
    error.value = cause?.message || 'Unable to create account.'
  } finally { loading.value = false }
}

onMounted(() => {
  form.remember = Boolean(rememberSession.value)
  void loadCapabilities().catch(() => {})
})
</script>
