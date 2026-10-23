<template>
  <section class="space-y-3">
    <UFormField label="Excluded models" description="A non-empty credential list replaces global OAuth exclusions. An empty list inherits them.">
      <UTextarea v-model="draft" class="w-full font-mono" :disabled="disabled" placeholder='["model-id", "model-prefix-*"]' />
    </UFormField>
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-[var(--ui-text-muted)]">Choose upstream IDs before aliases and prefixes, or edit JSON rules above.</p>
      <AppButton type="button" size="sm" color="neutral" variant="outline" :loading="loading" @click="loadCandidates(true)">Refresh candidates</AppButton>
    </div>
    <UAlert v-if="error" color="warning" variant="subtle" :description="error" />
    <p v-if="loading" role="status" class="text-xs text-[var(--ui-text-muted)]">Loading credential exclusion candidates…</p>
    <p v-else-if="candidates === null" class="text-xs text-[var(--ui-text-muted)]">Candidate snapshot unavailable on this Home node. Manual rules remain editable; routed model IDs are not used as substitutes.</p>
    <template v-if="!loading && (candidates !== null || pickerCandidates.length)">
      <UInput v-model="search" icon="i-tabler-search" placeholder="Search exclusion candidates…" aria-label="Search exclusion candidates" class="w-full" />
      <div class="flex flex-wrap gap-2">
        <AppButton type="button" size="sm" color="neutral" variant="outline" :disabled="disabled || rules === null || !filtered.length" @click="excludeVisible">Exclude visible</AppButton>
        <AppButton type="button" size="sm" color="neutral" variant="ghost" :disabled="disabled || rules === null || !rules.length" @click="draft = '[]'">Clear credential rules</AppButton>
      </div>
      <p v-if="rules === null" class="text-xs text-amber-500">Enter a valid JSON string array before selecting models.</p>
      <div class="max-h-64 space-y-2 overflow-y-auto rounded-md border border-[var(--ui-border)] p-3">
        <div v-for="model in filtered" :key="model.id" class="space-y-1">
          <UCheckbox :model-value="matches(model.id)" :disabled="disabled || rules === null || coveredByPattern(model.id)" :label="model.id" @update:model-value="toggle(model.id, $event)" />
          <p v-if="coveredByPattern(model.id)" class="text-xs text-[var(--ui-text-muted)]">Covered by a wildcard rule; edit that rule above to allow this model.</p>
        </div>
        <p v-if="!filtered.length" class="text-xs text-[var(--ui-text-muted)]">{{ pickerCandidates.length ? 'No candidates match this search.' : 'The candidate catalog is empty.' }}</p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { credentialExclusionMatches, credentialExclusionCandidates, parseCredentialExclusions, normalizeCredentialModels } from '~/composables/credentialModelCards'
const props = defineProps<{ credentialId: string; disabled?: boolean }>()
const draft = defineModel<string>({ required: true })
const { fetchAPI } = useApi()
const candidates = ref<ReturnType<typeof normalizeCredentialModels> | null>(null)
const loading = ref(false)
const error = ref('')
const search = ref('')
const rules = computed(() => parseCredentialExclusions(draft.value))
const knownRules = ref<string[]>([])
const pickerCandidates = computed(() => credentialExclusionCandidates(candidates.value, knownRules.value))
const filtered = computed(() => pickerCandidates.value.filter(model => `${model.id} ${model.display_name || ''}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const matches = (id: string) => (rules.value || []).some(rule => credentialExclusionMatches(rule, id))
const coveredByPattern = (id: string) => (rules.value || []).some(rule => rule.includes('*') && credentialExclusionMatches(rule, id))
let request = 0
async function loadCandidates(refresh = false) {
  const current = ++request
  loading.value = true; error.value = ''; candidates.value = null
  try {
    const result = await fetchAPI<{ exclusion_models?: unknown }>('/credentials/models', { query: { name: props.credentialId }, refresh })
    if (current === request) candidates.value = Array.isArray(result.exclusion_models) ? normalizeCredentialModels(result.exclusion_models) : null
  } catch (cause: any) {
    if (current === request) error.value = cause?.message || 'Unable to load exclusion candidates. Manual rules are still available.'
  } finally { if (current === request) loading.value = false }
}
function toggle(id: string, excluded: boolean | 'indeterminate') {
  if (!rules.value || coveredByPattern(id)) return
  const next = rules.value.filter(rule => rule.toLowerCase() !== id.toLowerCase())
  if (excluded === true) next.push(id)
  draft.value = JSON.stringify(next, null, 2)
}
function excludeVisible() {
  if (!rules.value) return
  draft.value = JSON.stringify([...rules.value, ...filtered.value.filter(model => !matches(model.id)).map(model => model.id)], null, 2)
}
watch(() => props.credentialId, () => {
  knownRules.value = []
  search.value = ''
  void loadCandidates()
}, { immediate: true, flush: 'sync' })
watch([() => props.credentialId, rules], () => {
  knownRules.value = credentialExclusionCandidates(null, [...knownRules.value, ...(rules.value || [])]).map(model => model.id)
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { request++ })
</script>
