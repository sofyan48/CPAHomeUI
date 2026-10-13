<template>
  <AppModal v-model:open="open" :dismissible="!saving" :title="`Reset allowance · ${user?.username || 'User'}`">
    <template #body>
      <form class="space-y-4" @submit.prevent="submit">
        <p class="text-sm text-[var(--ui-text-muted)]">One reset clears usage for all enabled period limits together. Credits, configured limits, and usage history remain unchanged.</p>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
        <UFormField label="Mode"><USelect v-model="mode" :items="modes" value-key="value" label-key="label" :disabled="saving" class="w-full" /></UFormField>
        <UFormField :label="mode === 'monthly' ? 'Resets per month' : 'Number of resets'"><UInput v-model="amount" type="number" min="0" step="1" :disabled="saving" class="w-full" /></UFormField>
        <UFormField v-if="mode === 'one_time'" label="Expires at (optional)" description="Date and time use your browser's local timezone."><UInput v-model="expiresAt" type="datetime-local" :disabled="saving" class="w-full" /></UFormField>
        <p class="text-xs text-[var(--ui-text-muted)]">{{ mode === 'monthly' ? 'Renews on the first day of each month at 00:00 in the user’s timezone. Unused resets do not carry over.' : 'Granted once, with no automatic renewal.' }}</p>
        <UAlert color="warning" variant="subtle" description="Saving replaces the existing allowance and immediately grants the entered amount. Enter 0 to disable resets." />
        <div class="flex justify-end gap-2"><AppButton type="button" color="neutral" variant="outline" :disabled="saving" @click="open = false">Cancel</AppButton><AppButton type="submit" :loading="saving" :disabled="saving">Save allowance</AppButton></div>
      </form>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ user: any }>()
const emit = defineEmits<{ saved: [] }>()
const { fetchAPI } = useApi()
const toast = useToast()
const mode = ref('one_time')
const amount = ref('0')
const expiresAt = ref('')
const saving = ref(false)
const error = ref('')
const modes = [{ label: 'One-time', value: 'one_time' }, { label: 'Monthly', value: 'monthly' }]
const controller = new AbortController()
onScopeDispose(() => controller.abort())
watch(open, (value) => {
  if (!value) return
  const allowance = props.user?.reset_allowance
  mode.value = allowance?.mode === 'monthly' ? 'monthly' : 'one_time'
  amount.value = String(allowance?.amount ?? 0)
  error.value = ''
  expiresAt.value = ''
  if (allowance?.expires_at) {
    const date = new Date(allowance.expires_at)
    if (!Number.isNaN(date.getTime())) {
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      expiresAt.value = local.toISOString().slice(0, 16)
    }
  }
})
async function submit() {
  if (saving.value || !props.user) return
  error.value = ''
  const count = Number(amount.value)
  if (String(amount.value).trim() === '' || !Number.isSafeInteger(count) || count < 0) {
    error.value = 'Enter a whole number greater than or equal to 0.'
    return
  }
  let expiry: string | null = null
  if (mode.value === 'one_time' && expiresAt.value) {
    const date = new Date(expiresAt.value)
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      error.value = 'Expiry must be a valid future date.'
      return
    }
    expiry = date.toISOString()
  }
  saving.value = true
  try {
    await fetchAPI(`/users/${encodeURIComponent(props.user.id)}/reset-allowance`, {
      method: 'PUT', body: { mode: mode.value, amount: count, expires_at: expiry }, signal: controller.signal
    })
    if (controller.signal.aborted) return
    open.value = false
    toast.add({ title: 'Reset allowance saved.', color: 'success' })
    emit('saved')
  } catch (cause: any) {
    if (!controller.signal.aborted) error.value = cause?.message || 'Unable to save reset allowance.'
  } finally { saving.value = false }
}
</script>
