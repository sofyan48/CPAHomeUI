<template>
  <AppCard>
    <template #header><div><h3 class="font-semibold">Import model prices from models.dev</h3><p class="text-xs text-[var(--ui-text-muted)]">Preview is fetched and pinned by Home. Review the exact rules before applying.</p></div></template>
    <div class="space-y-4">
      <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      <div class="grid gap-3 sm:grid-cols-3">
        <UFormField label="Overwrite policy"><USelect v-model="overwriteMode" :items="['missing', 'sync', 'all']" class="w-full" /></UFormField>
        <UFormField label="Default multiplier"><UInput v-model.number="defaultMultiplier" type="number" min="0.000001" step="0.01" class="w-full" /></UFormField>
        <div class="flex items-end"><UCheckbox v-model="includeZeroCost" label="Include zero-cost catalog rows" /></div>
      </div>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Import targets</legend><UButton size="sm" color="neutral" variant="outline" icon="i-tabler-plus" @click="addTarget">Add target</UButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">Each target creates wildcard-tier rules at the catalog context bands supported by Home.</p>
        <div v-for="(target, index) in targets" :key="index" class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <UFormField :label="`Provider #${index + 1}`"><UInputMenu v-model="target.provider" :items="providers" create-item placeholder="Search or enter provider" class="w-full" @create="target.provider = $event.trim()" /></UFormField>
          <UFormField :label="`Model #${index + 1}`"><UInputMenu v-model="target.model" :items="models" create-item placeholder="Search or enter model ID" class="w-full" @create="target.model = $event.trim()" /></UFormField>
          <UButton v-if="targets.length > 1" color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove target" class="self-end" @click="removeTarget(index)" />
        </div>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Model aliases</legend><UButton size="sm" color="neutral" variant="outline" @click="() => { aliases.push({ target_model: '', source_models: '' }) }">Add alias</UButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">Try these catalog model IDs when matching a target model. Separate multiple IDs with commas; order matters.</p>
        <div v-for="(alias, index) in aliases" :key="index" class="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <UFormField label="Target model"><UInput v-model="alias.target_model" placeholder="Target model ID" class="w-full" /></UFormField>
          <UFormField label="Catalog model IDs (comma-separated)"><UInput v-model="alias.source_models" placeholder="catalog-model-a, catalog-model-b" class="w-full" /></UFormField>
          <UButton color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove alias" class="self-end" @click="() => { aliases.splice(index, 1) }" />
        </div>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Multiplier rules</legend><UButton size="sm" color="neutral" variant="outline" @click="() => { multiplierRules.push({ id: '', label: '', match_mode: 'prefix', pattern: '', multiplier: 1 }) }">Add rule</UButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">First matching rule wins against the target model ID (case-insensitive). Exact row multipliers take precedence.</p>
        <div v-for="(rule, index) in multiplierRules" :key="index" class="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <UFormField label="Label (optional)"><UInput v-model="rule.label" class="w-full" /></UFormField>
          <UFormField label="Match"><USelect v-model="rule.match_mode" :items="['prefix', 'regex']" class="w-full" /></UFormField>
          <UFormField label="Pattern"><UInput v-model="rule.pattern" :placeholder="rule.match_mode === 'regex' ? 'Go-compatible regex' : 'Model prefix'" class="w-full" /></UFormField>
          <UFormField label="Multiplier"><UInput v-model.number="rule.multiplier" type="number" min="0.000001" step="0.01" class="w-full" /></UFormField>
          <UButton color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove multiplier rule" class="self-end" @click="() => { multiplierRules.splice(index, 1) }" />
        </div>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Exact row multipliers</legend><UButton size="sm" color="neutral" variant="outline" @click="() => { rowMultipliers.push({ row_key: '', multiplier: 1 }) }">Add row</UButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">Use the exact preview row key, including ::*::token-boundary for context bands. Preview again after editing.</p>
        <div v-for="(row, index) in rowMultipliers" :key="index" class="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <UFormField label="Row key"><UInput v-model="row.row_key" placeholder="provider::model or provider::model::*::200000" class="w-full" /></UFormField>
          <UFormField label="Multiplier"><UInput v-model.number="row.multiplier" type="number" min="0.000001" step="0.01" class="w-full" /></UFormField>
          <UButton color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove row multiplier" class="self-end" @click="() => { rowMultipliers.splice(index, 1) }" />
        </div>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Source match overrides</legend><UButton size="sm" color="neutral" variant="outline" @click="() => { matchOverrides.push({ target_provider: '', target_model: '', source_provider: '', source_model: '' }) }">Add override</UButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">Force one requested target to an exact models.dev provider and model. A missing catalog match stays unmatched.</p>
        <div v-for="(override, index) in matchOverrides" :key="index" class="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <UFormField label="Target provider"><UInput v-model="override.target_provider" class="w-full" /></UFormField>
          <UFormField label="Target model"><UInput v-model="override.target_model" class="w-full" /></UFormField>
          <UFormField label="Catalog provider"><UInput v-model="override.source_provider" class="w-full" /></UFormField>
          <UFormField label="Catalog model"><UInput v-model="override.source_model" class="w-full" /></UFormField>
          <UButton color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove match override" class="self-end" @click="() => { matchOverrides.splice(index, 1) }" />
        </div>
      </fieldset>
      <UAlert v-if="validationError" color="warning" variant="subtle" :description="validationError" />
      <UButton :loading="loading" :disabled="loading || applying || !!validationError" @click="previewPrices">Preview {{ targets.length }} target(s)</UButton>
      <template v-if="preview">
        <div class="text-sm text-[var(--ui-text-muted)]">{{ preview.rows?.length || 0 }} rows · Expires {{ preview.expires_at ? new Date(preview.expires_at).toLocaleString() : 'unknown' }}</div>
        <div class="max-h-72 space-y-2 overflow-y-auto">
          <label v-for="row in preview.rows || []" :key="row.row_key" class="flex gap-3 rounded-lg border border-[var(--ui-border)] p-3 text-sm">
            <input v-model="selected" type="checkbox" :value="row.row_key" :disabled="!row.write_rule || row.action === 'skip'" />
            <span class="min-w-0"><strong>{{ row.model || row.row_key }}</strong> · {{ row.action }} · {{ row.row_key }}<span v-if="row.matched_model" class="block text-xs">Matched {{ row.matched_provider }}/{{ row.matched_model }} · x{{ row.multiplier }}</span><pre class="mt-1 max-w-full overflow-auto text-xs">{{ JSON.stringify({ official: row.official, final: row.final, write_rule: row.write_rule, existing_rule: row.existing_rule, reasons: row.reasons }, null, 2) }}</pre><UButton v-if="row.official && !rowMultipliers.some((entry) => entry.row_key === row.row_key)" size="xs" color="neutral" variant="outline" @click.stop.prevent="() => { rowMultipliers.push({ row_key: row.row_key, multiplier: row.multiplier }) }">Set row multiplier (requires new preview)</UButton></span>
          </label>
        </div>
        <UCheckbox v-if="requiresOverwrite" v-model="confirmOverwrite" label="I confirm replacing existing model-price rules" />
        <UButton :loading="applying" :disabled="applying || !selected.length || (requiresOverwrite && !confirmOverwrite)" @click="applyPrices">Apply {{ selected.length }} selected rules</UButton>
      </template>
      <UAlert v-if="operation" color="success" variant="subtle" :title="`Import ${operation.status}`" :description="`Operation ${operation.operation_id} · ${operation.rows?.length || 0} row(s) processed atomically`" />
      <div v-if="operation?.rows?.length" class="max-h-56 space-y-2 overflow-y-auto"><div v-for="result in operation.rows" :key="result.key" class="rounded-lg border border-[var(--ui-border)] p-3 text-xs"><strong>{{ result.key }}</strong><span> · {{ result.status || result.action }}</span><span v-if="result.resource_id" class="block font-mono text-[var(--ui-text-muted)]">{{ result.resource_id }}</span></div></div>
    </div>
  </AppCard>
</template>

<script setup lang="ts">
defineProps<{ providers: string[]; models: string[] }>()
const emit = defineEmits<{ applied: [] }>()
const { fetchAPI } = useApi()
const emptyTarget = () => ({ provider: '', model: '' })
const targets = reactive([emptyTarget()])
const overwriteMode = ref('missing')
const defaultMultiplier = ref(1)
const includeZeroCost = ref(false)
const aliases = reactive<{ target_model: string; source_models: string }[]>([])
const multiplierRules = reactive<{ id: string; label: string; match_mode: string; pattern: string; multiplier: number }[]>([])
const rowMultipliers = reactive<{ row_key: string; multiplier: number }[]>([])
const matchOverrides = reactive<{ target_provider: string; target_model: string; source_provider: string; source_model: string }[]>([])
const loading = ref(false)
const applying = ref(false)
const error = ref('')
const preview = ref<any>(null)
const operation = ref<any>(null)
const selected = ref<string[]>([])
const confirmOverwrite = ref(false)
let inputVersion = 0
let applyRequest: { preview_id: string; preview_revision: string; selected_keys: string[]; confirm_overwrite: boolean; idempotency_key: string } | null = null
function invalidatePreview() {
  inputVersion++
  error.value = ''
  preview.value = null
  selected.value = []
  confirmOverwrite.value = false
  applyRequest = null
}
watch([targets, overwriteMode, defaultMultiplier, includeZeroCost, aliases, multiplierRules, rowMultipliers, matchOverrides], invalidatePreview, { deep: true, flush: 'sync' })
watch([selected, confirmOverwrite], () => { applyRequest = null }, { deep: true, flush: 'sync' })
const addTarget = () => { targets.push(emptyTarget()) }
const removeTarget = (index: number) => { targets.splice(index, 1) }
const positive = (value: number) => typeof value === 'number' && Number.isFinite(value) && value > 0
const validationError = computed(() => {
  if (!targets.length || targets.some(target => !target.provider.trim() || !target.model.trim())) return 'Every target needs a provider and model.'
  const targetKeys = targets.map(target => `${target.provider.trim().toLowerCase()}::${target.model.trim()}`)
  if (new Set(targetKeys).size !== targetKeys.length) return 'Duplicate import targets are not allowed.'
  if (!positive(defaultMultiplier.value)) return 'Default multiplier must be positive and finite.'
  if (aliases.some(alias => !alias.target_model.trim() || alias.source_models.split(',').some(model => !model.trim()))) return 'Each alias needs a target model and comma-separated catalog model IDs.'
  if (multiplierRules.some(rule => !rule.pattern.trim() || !positive(rule.multiplier))) return 'Each multiplier rule needs a pattern and a positive multiplier.'
  const rowKeys = rowMultipliers.map(row => row.row_key.trim())
  if (rowMultipliers.some(row => !row.row_key.trim() || !positive(row.multiplier)) || new Set(rowKeys).size !== rowKeys.length) return 'Row multipliers need distinct nonempty keys and positive values.'
  const overrideKeys = matchOverrides.map(item => `${item.target_provider.trim().toLowerCase()}::${item.target_model.trim()}`)
  if (matchOverrides.some(item => !item.target_provider.trim() || !item.target_model.trim() || !item.source_provider.trim() || !item.source_model.trim()) || new Set(overrideKeys).size !== overrideKeys.length || overrideKeys.some(key => !targetKeys.includes(key))) return 'Each match override must identify a distinct requested target and a catalog provider/model.'
  return ''
})
const requiresOverwrite = computed(() => (preview.value?.rows || []).some((row: any) => selected.value.includes(row.row_key) && row.action === 'overwrite'))
async function previewPrices() {
  loading.value = true
  error.value = ''
  invalidatePreview()
  operation.value = null
  const version = inputVersion
  try {
    if (validationError.value) throw new Error(validationError.value)
    const result: any = await fetchAPI('/billing/model-prices/import/preview', {
      method: 'POST',
      body: {
        source: 'models.dev',
        targets: targets.map(target => ({ provider: target.provider.trim(), model: target.model.trim(), service_tier: '*', min_input_tokens: 0 })),
        policy: {
          overwrite_mode: overwriteMode.value,
          default_multiplier: defaultMultiplier.value,
          include_zero_cost: includeZeroCost.value,
          aliases: aliases.map(alias => ({ target_model: alias.target_model.trim(), source_models: alias.source_models.split(',').map(model => model.trim()) })),
          multiplier_rules: multiplierRules.map((rule, index) => ({ id: rule.id || `rule-${index + 1}`, label: rule.label.trim(), match_mode: rule.match_mode, pattern: rule.pattern.trim(), multiplier: rule.multiplier })),
          row_multipliers: Object.fromEntries(rowMultipliers.map(row => [row.row_key.trim(), row.multiplier]))
        },
        match_overrides: matchOverrides.map(item => ({ target_provider: item.target_provider.trim(), target_model: item.target_model.trim(), source_provider: item.source_provider.trim(), source_model: item.source_model.trim() }))
      }
    })
    if (version !== inputVersion) return
    preview.value = result
    selected.value = (result.rows || []).filter((row: any) => row.applicable && row.write_rule && row.action !== 'skip').map((row: any) => row.row_key)
    confirmOverwrite.value = false
  } catch (cause: any) { if (version === inputVersion) error.value = cause?.message || 'Unable to preview model prices.' }
  finally { loading.value = false }
}
async function applyPrices() {
  if (!preview.value || !selected.value.length || applying.value) return
  applying.value = true
  error.value = ''
  try {
    applyRequest ||= {
      preview_id: preview.value.preview_id,
      preview_revision: preview.value.preview_revision,
      selected_keys: [...selected.value],
      confirm_overwrite: confirmOverwrite.value,
      idempotency_key: crypto.randomUUID()
    }
    const version = inputVersion
    const result = await fetchAPI('/billing/model-prices/import/apply', { method: 'POST', body: applyRequest })
    operation.value = result
    emit('applied')
    if (version === inputVersion) {
      preview.value = null
      selected.value = []
    }
  } catch (cause: any) { error.value = cause?.message || 'Unable to apply model prices.' }
  finally { applying.value = false }
}
</script>
