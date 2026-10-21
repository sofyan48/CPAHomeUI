<template>
  <UModal v-model:open="open" title="Management connection" description="Manage the key for this Home instance without leaving your workspace." :dismissible="!pending" :close="!pending" :ui="{ content: 'sm:max-w-lg' }">
    <template #body>
      <form class="space-y-5" :aria-busy="pending" @submit.prevent="connect">
        <div class="space-y-1">
          <p role="status" class="text-sm font-medium">{{ pending ? 'Checking connection' : statusLabel }}</p>
          <p class="break-all text-xs text-[var(--ui-text-muted)]">{{ apiBase }}</p>
        </div>
        <UAlert v-if="errorMessage || capabilitiesError" color="error" variant="subtle" title="Connection failed" :description="errorMessage || capabilitiesError || undefined" />
        <UFormField label="Management key" required>
          <UInput v-model="key" type="password" autocomplete="current-password" placeholder="Enter the management secret" icon="i-tabler-key" class="w-full" :disabled="pending" autofocus />
        </UFormField>
        <UCheckbox v-model="remember" label="Keep this management connection for 30 days" :disabled="pending" />
        <p class="text-xs leading-5 text-[var(--ui-text-muted)]">Otherwise, the same-site cookie ends with this browser session. The key is sent only to the configured Management API path.</p>
        <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <AppButton v-if="token" type="button" color="error" variant="soft" :disabled="pending" @click="disconnect">Disconnect</AppButton>
          <AppButton type="button" color="neutral" variant="ghost" :disabled="pending" @click="open = false">Cancel</AppButton>
          <AppButton type="submit" :loading="pending" :disabled="pending || !key.trim()">Save and connect</AppButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useManagementSessionStore } from '~/stores/managementSession'

const open = defineModel<boolean>('open', { default: false })
defineProps<{ statusLabel: string }>()
const { token, rememberSession } = storeToRefs(useManagementSessionStore())
const { fetchAPI, apiBase } = useApi()
const { error: capabilitiesError, refreshCapabilities, resetCapabilities } = useCapabilities()
const key = ref('')
const remember = ref(false)
const pending = ref(false)
const errorMessage = ref('')
let controller: AbortController | undefined

watch(open, (value) => {
  errorMessage.value = ''
  key.value = value ? token.value || '' : ''
  remember.value = value ? Boolean(rememberSession.value) : false
}, { immediate: true })

onBeforeUnmount(() => controller?.abort())

async function connect() {
  const candidate = key.value.trim()
  if (!candidate || pending.value) return
  pending.value = true
  errorMessage.value = ''
  controller = new AbortController()
  const signal = controller.signal
  const previousToken = token.value
  try {
    // Keep the active session intact until the candidate key has been validated.
    await fetchAPI('/capabilities', { token: candidate, signal })
    if (signal.aborted || token.value !== previousToken) return
    const cookieOptions = {
      sameSite: 'strict' as const,
      secure: import.meta.client && window.location.protocol === 'https:',
      ...(remember.value ? { maxAge: 60 * 60 * 24 * 30 } : {})
    }
    useCookie<string | null>('management_token', cookieOptions).value = candidate
    useCookie<boolean>('management_remember', cookieOptions).value = remember.value
    token.value = candidate
    rememberSession.value = remember.value
    resetCapabilities()
    await refreshCapabilities(true)
    if (!signal.aborted && token.value === candidate) open.value = false
  } catch (cause: any) {
    if (!signal.aborted) errorMessage.value = cause?.message || 'Unable to reach the Management API.'
  } finally {
    pending.value = false
  }
}

function disconnect() {
  if (pending.value) return
  token.value = null
  rememberSession.value = false
  resetCapabilities()
  key.value = ''
  remember.value = false
  errorMessage.value = ''
}
</script>
