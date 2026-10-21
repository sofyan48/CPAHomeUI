<template>
  <AppButton color="neutral" variant="outline" icon="i-tabler-list-details" @click="start">
    Replace whole list
  </AppButton>
  <USlideover
    v-model:open="open"
    title="Replace the complete access-key list"
    description="Explicit collection replacement. Nothing is saved until you review and confirm."
    :dismissible="!saving"
    :close="saving ? false : { 'aria-label': 'Close list replacement' }"
    :ui="{ content: 'w-full sm:max-w-2xl', body: 'min-h-0 overflow-y-auto', footer: 'shrink-0' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert color="warning" variant="subtle" title="Omitted keys will stop working" description="This replaces every active client access key, not just filtered or selected rows. Removing or changing a value revokes the old value. An empty list revokes all keys. Use the normal key editor for owner, name, or scope changes." />
        <p class="text-sm text-[var(--ui-text-muted)]">
          Unchanged values keep their identifiers and all stored metadata, including owners, names, credential groups, and model groups. A value with no stored record starts unassigned and unrestricted; re-adding a previously deleted value restores its stored metadata. Changing a line does not transfer the old key's metadata to the new value.
        </p>
        <UAlert v-if="error" role="alert" color="error" variant="subtle" :description="error" />
        <p v-if="loading" role="status" class="text-sm text-[var(--ui-text-muted)]">Loading a fresh collection snapshot…</p>
        <AppButton v-if="error && !saving" color="neutral" variant="outline" :loading="loading" @click="loadSnapshot(true)">
          Reload latest list (keep draft)
        </AppButton>
        <UFormField label="Access keys — one value per line" hint="Raw secrets are visible here. Surrounding whitespace and blank lines are ignored; duplicate values are rejected." :error="validationError || undefined">
          <UTextarea v-model="draft" :rows="14" class="w-full font-mono" autocomplete="off" autocapitalize="off" :spellcheck="false" :disabled="!snapshot || loading || saving || reviewing" />
        </UFormField>
        <p v-if="plan" role="status" class="text-sm">
          {{ plan.kept }} kept · {{ plan.added }} added or restored · {{ plan.removed }} removed · {{ plan.total }} total
        </p>
        <template v-if="reviewing && plan">
          <UAlert color="warning" variant="subtle" :title="plan.total === 0 ? 'Confirm revoking every access key' : 'Confirm whole-list replacement'" :description="`This will remove ${plan.removed} key(s) and add or restore ${plan.added}. Removed values stop authenticating. Concurrent changes will reject this save rather than be overwritten.`" />
          <UCheckbox v-model="acknowledged" :disabled="saving" :label="plan.total === 0 ? 'I understand this will revoke ALL active access keys.' : 'I have reviewed the counts and understand that omitted keys will be revoked.'" />
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <AppButton color="neutral" variant="outline" :disabled="saving" @click="open = false">Cancel</AppButton>
        <AppButton v-if="reviewing" color="neutral" variant="outline" :disabled="saving" @click="reviewing = false; acknowledged = false">Back to editor</AppButton>
        <AppButton v-if="reviewing" color="error" :loading="saving" :disabled="!acknowledged || blocked" @click="replaceList">Confirm replacement</AppButton>
        <AppButton v-else color="error" :disabled="blocked || !plan?.changed" @click="reviewing = true; acknowledged = false">Review replacement</AppButton>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { readReplacementSnapshot, planReplacement, type AccessKeySnapshot } from './replacement'

const emit = defineEmits<{ replaced: [] }>()
const { fetchRaw, fetchAPI, token } = useApi()
const toast = useToast()
const open = ref(false)
const snapshot = shallowRef<AccessKeySnapshot | null>(null)
const draft = ref('')
const loading = ref(false)
const saving = ref(false)
const reviewing = ref(false)
const acknowledged = ref(false)
const stale = ref(false)
const error = ref('')
let generation = 0
let readController: AbortController | undefined

const result = computed(() => {
  if (!snapshot.value) return { plan: null, error: '' }
  try {
    return { plan: planReplacement(draft.value, snapshot.value), error: '' }
  } catch (error) {
    return { plan: null, error: error instanceof Error ? error.message : 'Invalid key list.' }
  }
})
const plan = computed(() => result.value.plan)
const validationError = computed(() => result.value.error)
const blocked = computed(() => !snapshot.value || !plan.value || loading.value || saving.value || stale.value)

function start() {
  draft.value = ''
  snapshot.value = null
  open.value = true
  void loadSnapshot(false)
}

async function loadSnapshot(keepDraft: boolean) {
  if (loading.value || saving.value) return
  const requestGeneration = ++generation
  readController = new AbortController()
  loading.value = true
  reviewing.value = false
  acknowledged.value = false
  stale.value = true
  error.value = ''
  try {
    const response = await fetchRaw('/access/api-keys', { signal: readController.signal })
    const next = readReplacementSnapshot(response._data, response.headers.get('etag'))
    if (requestGeneration !== generation) return
    const hadSnapshot = snapshot.value !== null
    snapshot.value = next
    if (!keepDraft || !hadSnapshot) draft.value = next.values.join('\n')
    stale.value = false
  } catch (cause: any) {
    if (requestGeneration !== generation) return
    error.value = cause?.statusCode === 404 || cause?.statusCode === 405
      ? 'This Home instance does not expose the access-key collection. No fallback route will be used.'
      : cause?.statusCode ? 'Could not load the access-key collection. Check the connection and retry.'
        : cause instanceof Error ? cause.message : 'Could not safely read the access-key collection.'
  } finally {
    if (requestGeneration === generation) loading.value = false
  }
}

async function replaceList() {
  if (blocked.value || !reviewing.value || !acknowledged.value || !plan.value) return
  const requestGeneration = generation
  const replacement = plan.value
  saving.value = true
  error.value = ''
  try {
    await fetchAPI('/access/api-keys', { method: 'PUT', headers: replacement.headers, body: replacement.body })
    if (requestGeneration !== generation) return
    open.value = false
    toast.add({ title: 'Access-key list replaced.', color: 'success' })
    emit('replaced')
  } catch (cause: any) {
    if (requestGeneration !== generation) return
    // Never retry an uncertain write or strip If-Match. Reload and review again.
    stale.value = true
    reviewing.value = false
    acknowledged.value = false
    error.value = cause?.statusCode === 412
      ? 'The access-key list changed on Home. This replacement was not applied. Your draft is preserved; reload the latest list and review the new counts before confirming again.'
      : cause?.statusCode === 404 || cause?.statusCode === 405
        ? 'Whole-list replacement is unavailable on this Home instance. No fallback route was used.'
        : 'Replacement could not be confirmed. Reload the latest list to verify server state before trying again. Your draft is preserved.'
  } finally {
    if (requestGeneration === generation) saving.value = false
  }
}

function clear() {
  generation++
  readController?.abort()
  snapshot.value = null
  draft.value = ''
  error.value = ''
  loading.value = false
  saving.value = false
  reviewing.value = false
  acknowledged.value = false
}
watch(open, value => { if (!value) clear() })
watch(token, () => { open.value = false; clear() })
onScopeDispose(clear)
</script>
