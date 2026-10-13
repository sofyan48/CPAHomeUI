<template>
  <section v-if="supported" class="limit-reset" aria-label="Period limit resets" :aria-busy="loading">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="flex items-center gap-2 text-xs font-medium"><UIcon name="i-tabler-refresh" class="size-4 text-primary" aria-hidden="true" /> Available resets: {{ loading ? '…' : loadError ? '—' : allowance?.available ?? '—' }}</h3>
        <p v-if="allowance && allowance.available > 0" class="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">Reset limits without changing your credits.</p>
        <p v-if="allowance && !loadError && allowance.available > 0" class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ allowance.mode === 'monthly' ? `${allowance.amount} resets per month · Unused resets do not carry over.` : allowance.mode === 'one_time' ? 'One-time reset allowance.' : 'No resets granted.' }}</p>
        <p v-if="!loadError && (allowance?.renews_at || allowance?.expires_at)" class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ allowance?.mode === 'monthly' ? 'Renews' : 'Expires' }} {{ formatDate(allowance?.renews_at || allowance?.expires_at || '') }}</p>
        <p v-if="!loading && !loadError && limits && !enabledWindows.length" class="mt-1 text-xs text-[var(--ui-text-muted)]">There are no enabled period limits to reset.</p>
      </div>
      <AppButton v-if="!loading && !loadError && allowance && allowance.available > 0" size="sm" variant="soft" class="rounded-full" icon="i-tabler-refresh" :disabled="pending || !enabledWindows.length" @click="resetError = ''; confirmOpen = true">Reset limits</AppButton>
    </div>
    <UAlert v-if="loadError" class="mt-3" color="error" variant="subtle" title="Reset allowance could not be loaded" :description="loadError" />
    <AppButton v-if="loadError" class="mt-2" size="sm" color="neutral" variant="outline" :loading="loading" @click="loadLimits">Retry</AppButton>
    <UModal v-model:open="confirmOpen" title="Reset all enabled period limits?" :dismissible="!pending" :close="!pending" :ui="{ content: 'sm:max-w-md' }">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm">This uses one reset to clear usage for every enabled period window on your account. Your configured limits, credits, and usage history will not change.</p>
          <UAlert v-if="resetError" color="error" variant="subtle" :description="resetError" />
          <div class="flex justify-end gap-2"><AppButton color="neutral" variant="outline" :disabled="pending" @click="confirmOpen = false">Cancel</AppButton><AppButton :loading="pending" :disabled="pending" @click="resetLimits">Use Reset</AppButton></div>
        </div>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
const emit = defineEmits<{ reset: [] }>()
const { capabilities, fetchAPI } = useUserApi()
const toast = useToast()
const supported = computed(() => capabilities.value.user_reset_allowance === true)
type Allowance = { mode: string; amount: number; available: number; expires_at: string | null; renews_at: string | null }
type Limits = { windows?: { enabled: boolean; limit: number | null }[]; reset_allowance?: Allowance }
const limits = ref<Limits | null>(null)
const allowance = computed(() => limits.value?.reset_allowance)
const enabledWindows = computed(() => (limits.value?.windows || []).filter(window => window.enabled && window.limit != null))
const loading = ref(false)
const loadError = ref('')
const confirmOpen = ref(false)
const pending = ref(false)
const resetError = ref('')
const controller = new AbortController()
onScopeDispose(() => controller.abort())
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
async function loadLimits() {
  if (!supported.value || controller.signal.aborted || loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const response = await fetchAPI<Limits>('/period-limits', { signal: controller.signal })
    if (!response.reset_allowance) throw new Error('The server did not return reset allowance information. Update Home and refresh this page.')
    if (!controller.signal.aborted) limits.value = response
  } catch (cause: any) {
    if (!controller.signal.aborted) loadError.value = cause?.message || 'Unable to load reset allowance.'
  } finally { loading.value = false }
}
async function resetLimits() {
  if (pending.value || !supported.value || !allowance.value || allowance.value.available <= 0 || !enabledWindows.value.length) return
  pending.value = true
  resetError.value = ''
  try {
    const response = await fetchAPI<{ limits: Limits }>('/period-limits/reset', { method: 'POST', signal: controller.signal })
    if (controller.signal.aborted) return
    limits.value = response.limits
    confirmOpen.value = false
    emit('reset')
    toast.add({ title: 'All enabled period limits reset.', description: 'One reset has been used. Your credits are unchanged.', color: 'success' })
  } catch (cause: any) {
    if (controller.signal.aborted) return
    resetError.value = cause?.message || 'Unable to reset period limits.'
    await loadLimits()
  } finally { pending.value = false }
}
watch(supported, value => { if (value) void loadLimits() }, { immediate: true })
</script>

<style scoped>
.limit-reset { padding: 0.875rem 0; color: var(--ui-text-muted); }
</style>
