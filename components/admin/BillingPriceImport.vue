<template>
  <USlideover v-model:open="open" side="right" title="Import model prices" description="Preview models.dev matches, review write fields, and manually confirm the import." :dismissible="!applying" :close="!applying" :ui="{ content: 'w-full sm:max-w-4xl', body: 'min-h-0 overflow-y-auto', footer: 'shrink-0 bg-[var(--ui-bg)]' }">
    <template #body>
    <div class="space-y-5">
      <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      <UAlert v-if="recoveryError" color="warning" variant="subtle" title="Applying prices is disabled" :description="recoveryError" />
      <UAlert v-else-if="applySupportError" color="warning" variant="subtle" title="New applies are unavailable" :description="applySupportError" />
      <AppButton v-if="recoveryError && storageKey" color="error" variant="outline" :disabled="busy" @click="discardPendingOpen = true">Discard unreadable recovery request…</AppButton>
      <section v-if="pendingApply" class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4" aria-labelledby="pending-import-title">
        <h3 id="pending-import-title" class="text-sm font-semibold">Saved apply request · outcome uncertain</h3>
        <p class="text-sm">This request may already have been applied. Retry sends the exact saved selection and idempotency key, even after preview expiry, to recover the original result without duplicate writes. New previews and applies are blocked until this is resolved.</p>
        <p class="break-all text-xs text-[var(--ui-text-muted)]">Saved {{ new Date(pendingApply.createdAt).toLocaleString() }} · {{ pendingApply.input.selected_keys.length }} rule(s) · Preview {{ pendingApply.input.preview_id }}</p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <AppButton :loading="applying" :disabled="busy || !recoveryReady" @click="retryPendingApply">Retry saved request</AppButton>
          <AppButton color="error" variant="outline" :disabled="busy" @click="discardPendingOpen = true">Discard recovery request…</AppButton>
        </div>
      </section>
      <UAlert v-if="importUnavailable" color="warning" variant="subtle" title="Catalog import unavailable" description="This Home instance does not expose the models.dev preview endpoint. Manual model-price editing remains available." />
      <section class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-4" aria-labelledby="import-context-title">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 id="import-context-title" class="text-sm font-semibold">Runtime matching context</h3>
          <UBadge color="neutral" variant="subtle">{{ serviceTierSource === 'response' ? 'Provider response tier' : 'Client request tier' }}</UBadge>
        </div>
        <p class="mt-2 text-xs text-[var(--ui-text-muted)]">{{ serviceTierSource === 'response' ? 'Future charges match the provider response tier, falling back to the request tier.' : 'Future charges match the service tier sent in the client request.' }} Imports create wildcard-tier rules at Home-supported catalog context bands; this does not change your billing settings.</p>
      </section>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4" :disabled="applying">
        <legend class="px-1 text-sm font-semibold">Import targets</legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Provider"><USelect v-model="providerFilter" :items="providerOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          <UFormField label="Target set"><USelect v-model="targetSet" :items="targetSetOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
        </div>
        <p class="text-xs text-[var(--ui-text-muted)]">{{ targets.length }} target(s) · {{ targetSet === 'manual' ? 'Edit provider/model pairs in Advanced options below.' : 'Provider/model pairs from loaded candidates or existing synced rules, not the entire models.dev catalog.' }}</p>
        <p class="text-xs text-[var(--ui-text-muted)]">Home fetches models.dev/api.json; no browser credentials are sent to models.dev. Preview and update checks never apply automatically.</p>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4" :disabled="applying">
        <legend class="px-1 text-sm font-semibold">Import policy</legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Default multiplier"><UInput v-model.number="defaultMultiplier" type="number" min="0.000001" step="0.01" class="w-full" /></UFormField>
          <UFormField label="Existing rule handling"><USelect v-model="overwriteMode" :items="overwriteOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
        </div>
        <UCheckbox v-model="includeZeroCost" label="Include zero-cost catalog rows" />
        <p class="text-xs text-[var(--ui-text-muted)]">Missing only preserves existing rules. Sync updates protect manual rules. Replacing all requires explicit overwrite confirmation.</p>
      </fieldset>
      <details ref="advancedDetails" class="rounded-lg border border-[var(--ui-border)] p-4">
        <summary class="cursor-pointer text-sm font-semibold">Advanced options · manual targets, matching, multipliers &amp; operation lookup</summary>
        <fieldset class="mt-4 min-w-0 space-y-4" :disabled="applying">
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Manual targets</legend><AppButton size="sm" color="neutral" variant="outline" icon="i-tabler-plus" @click="addTarget">Add target</AppButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">Each target creates wildcard-tier rules at the catalog context bands supported by Home.</p>
        <div v-for="(target, index) in targets" :key="index" class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <UFormField :label="`Provider #${index + 1}`"><UInputMenu v-model="target.provider" :items="providers" create-item placeholder="Search or enter provider" class="w-full" @update:model-value="targetSet = 'manual'" @create="targetSet = 'manual'; target.provider = $event.trim()" /></UFormField>
          <UFormField :label="`Model #${index + 1}`"><UInputMenu v-model="target.model" :items="models" create-item placeholder="Search or enter model ID" class="w-full" @update:model-value="targetSet = 'manual'" @create="targetSet = 'manual'; target.model = $event.trim()" /></UFormField>
          <AppButton v-if="targets.length > 1" color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove target" class="self-end" @click="removeTarget(index)" />
        </div>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Model aliases</legend><AppButton size="sm" color="neutral" variant="outline" @click="() => { aliases.push({ target_model: '', source_models: '' }) }">Add alias</AppButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">Try these catalog model IDs when matching a target model. Separate multiple IDs with commas; order matters.</p>
        <div v-for="(alias, index) in aliases" :key="index" class="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <UFormField label="Target model"><UInput v-model="alias.target_model" placeholder="Target model ID" class="w-full" /></UFormField>
          <UFormField label="Catalog model IDs (comma-separated)"><UInput v-model="alias.source_models" placeholder="catalog-model-a, catalog-model-b" class="w-full" /></UFormField>
          <AppButton color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove alias" class="self-end" @click="() => { aliases.splice(index, 1) }" />
        </div>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Multiplier rules</legend><AppButton size="sm" color="neutral" variant="outline" @click="() => { multiplierRules.push({ id: '', label: '', match_mode: 'prefix', pattern: '', multiplier: 1 }) }">Add rule</AppButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">First matching rule wins against the target model ID (case-insensitive). Exact row multipliers take precedence.</p>
        <div v-for="(rule, index) in multiplierRules" :key="index" class="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <UFormField label="Label (optional)"><UInput v-model="rule.label" class="w-full" /></UFormField>
          <UFormField label="Match"><USelect v-model="rule.match_mode" :items="['prefix', 'regex']" class="w-full" /></UFormField>
          <UFormField label="Pattern"><UInput v-model="rule.pattern" :placeholder="rule.match_mode === 'regex' ? 'Go-compatible regex' : 'Model prefix'" class="w-full" /></UFormField>
          <UFormField label="Multiplier"><UInput v-model.number="rule.multiplier" type="number" min="0.000001" step="0.01" class="w-full" /></UFormField>
          <AppButton color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove multiplier rule" class="self-end" @click="() => { multiplierRules.splice(index, 1) }" />
        </div>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Exact row multipliers</legend><AppButton size="sm" color="neutral" variant="outline" @click="() => { rowMultipliers.push({ row_key: '', multiplier: 1 }) }">Add row</AppButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">Use the exact preview row key, including ::*::token-boundary for context bands. Preview again after editing.</p>
        <div v-for="(row, index) in rowMultipliers" :key="index" class="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <UFormField label="Row key"><UInput v-model="row.row_key" placeholder="provider::model or provider::model::*::200000" class="w-full" /></UFormField>
          <UFormField label="Multiplier"><UInput v-model.number="row.multiplier" type="number" min="0.000001" step="0.01" class="w-full" /></UFormField>
          <AppButton color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove row multiplier" class="self-end" @click="() => { rowMultipliers.splice(index, 1) }" />
        </div>
      </fieldset>
      <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
        <div class="flex items-center justify-between gap-3"><legend class="font-medium">Source match overrides</legend><AppButton size="sm" color="neutral" variant="outline" @click="() => { matchOverrides.push({ target_provider: '', target_model: '', source_provider: '', source_model: '' }) }">Add override</AppButton></div>
        <p class="text-xs text-[var(--ui-text-muted)]">Force one requested target to an exact models.dev provider and model. A missing catalog match stays unmatched.</p>
        <div v-for="(override, index) in matchOverrides" :key="index" class="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <UFormField label="Target provider"><UInput v-model="override.target_provider" class="w-full" /></UFormField>
          <UFormField label="Target model"><UInput v-model="override.target_model" class="w-full" /></UFormField>
          <UFormField label="Catalog provider"><UInput v-model="override.source_provider" class="w-full" /></UFormField>
          <UFormField label="Catalog model"><UInput v-model="override.source_model" class="w-full" /></UFormField>
          <AppButton color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove match override" class="self-end" @click="() => { matchOverrides.splice(index, 1) }" />
        </div>
      </fieldset>
        <form class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4" @submit.prevent="lookupOperation">
          <h4 class="text-sm font-medium">Look up a stored import operation</h4>
          <p class="text-xs text-[var(--ui-text-muted)]">Lookup only reads the stored result; it does not apply prices again.</p>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <UFormField label="Operation ID" class="flex-1"><UInput v-model="operationId" placeholder="import_…" class="w-full" :disabled="operationLoading" /></UFormField>
            <AppButton type="submit" color="neutral" variant="outline" :loading="operationLoading" :disabled="busy || !operationId.trim()">Look up operation</AppButton>
          </div>
          <UAlert v-if="operationError" color="error" variant="subtle" title="Operation lookup failed" :description="operationError" />
        </form>
        </fieldset>
      </details>
      <UAlert v-if="validationError" color="warning" variant="subtle" :description="validationError" />
      <section class="space-y-3" aria-labelledby="import-preview-title" aria-live="polite">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><h3 id="import-preview-title" class="text-sm font-semibold">Preview results</h3><p class="text-xs text-[var(--ui-text-muted)]">Review exact write fields before confirming. Changes to targets or policy require a new preview.</p></div>
          <div class="flex flex-wrap gap-2">
            <AppButton size="sm" color="neutral" variant="outline" icon="i-tabler-download" :disabled="!preview || busy" @click="exportPreview">Export preview</AppButton>
            <AppButton size="sm" color="neutral" variant="outline" icon="i-tabler-refresh" :loading="loading" :disabled="busy || !!pendingApply || importUnavailable || !!validationError" @click="previewPrices(targetSet === 'synced')">{{ preview ? 'Refresh preview' : 'Generate preview' }}</AppButton>
          </div>
        </div>
      <template v-if="preview">
        <div class="flex flex-wrap gap-2">
          <UBadge color="neutral" variant="subtle">{{ preview.rows?.length || 0 }} rows</UBadge>
          <UBadge color="success" variant="subtle">{{ changedRows }} applicable</UBadge>
          <UBadge color="warning" variant="subtle">{{ reviewRows }} need review</UBadge>
          <UBadge color="primary" variant="subtle">{{ selected.length }} selected</UBadge>
        </div>
        <p class="text-xs text-[var(--ui-text-muted)]">Expires {{ preview.expires_at ? new Date(preview.expires_at).toLocaleString() : 'unknown' }}</p>
        <p class="break-all text-xs text-[var(--ui-text-muted)]">Source {{ preview.source_url }} · Fetched {{ new Date(preview.source_fetched_at).toLocaleString() }} · Version {{ preview.source_version }}</p>
        <UAlert v-if="checkingUpdates" :color="changedRows || reviewRows ? 'info' : 'success'" variant="subtle" :title="changedRows ? `${changedRows} new or changed price rule(s)` : reviewRows ? 'No applicable price changes; review required' : 'No applicable price changes found'" :description="`${reviewRows} row(s) require review. Unchanged rows cannot be selected. Only successfully matched catalog rows were compared; inspect skipped rows below.`" />
        <p v-if="!preview.rows?.length" class="text-sm text-[var(--ui-text-muted)]">The catalog preview returned no rows.</p>
        <p v-else-if="!changedRows && !checkingUpdates" class="text-sm text-[var(--ui-text-muted)]">No applicable rules. Review matching reasons below or adjust the import policy.</p>
        <div class="max-h-[28rem] overflow-auto rounded-lg border border-[var(--ui-border)]">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">Model price import preview and exact write fields</caption>
            <thead class="sticky top-0 z-10 bg-[var(--ui-bg-muted)] text-xs text-[var(--ui-text-muted)]"><tr><th scope="col" class="p-3">Select</th><th scope="col" class="p-3">Target / catalog match</th><th scope="col" class="p-3">Action</th><th scope="col" class="p-3">Write fields</th></tr></thead>
            <tbody>
              <tr v-for="row in preview.rows || []" :key="row.row_key" class="border-t border-[var(--ui-border)] align-top">
                <td class="p-3"><input v-model="selected" type="checkbox" :value="row.row_key" :aria-label="`Select ${row.row_key}`" :disabled="applying || !selectable(row)" class="accent-[var(--ui-primary)]" /></td>
                <td class="min-w-48 p-3"><p class="break-all font-medium">{{ row.model || row.row_key }}</p><p class="break-all text-xs text-[var(--ui-text-muted)]">{{ row.row_key }}</p><p v-if="row.matched_model" class="mt-1 break-all text-xs">{{ row.matched_provider }}/{{ row.matched_model }} · ×{{ row.multiplier }}</p></td>
                <td class="p-3"><UBadge :color="selectable(row) ? 'success' : 'neutral'" variant="subtle">{{ checkingUpdates && row.action === 'update_sync' && !pricesChanged(row) ? 'unchanged' : row.action }}</UBadge><p v-for="(reason, index) in row.reasons || []" :key="index" class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ reason.message || reason.code }}</p></td>
                <td class="min-w-64 p-3">
                  <dl v-if="row.write_rule" class="space-y-1 text-xs"><div v-for="field in writeFields" :key="field.key" class="flex justify-between gap-3"><dt class="text-[var(--ui-text-muted)]">{{ field.label }}</dt><dd class="font-mono">{{ (field.cost ? row.final?.[field.cost] : row.write_rule[field.key]) ?? '—' }}</dd></div></dl>
                  <p v-else class="text-xs text-[var(--ui-text-muted)]">No applicable write rule</p>
                  <details class="mt-2"><summary class="cursor-pointer text-xs text-[var(--ui-text-muted)]">Exact rule &amp; comparison</summary><pre class="mt-2 max-w-80 overflow-auto rounded bg-[var(--ui-bg-muted)] p-2 text-xs">{{ JSON.stringify({ official: row.official, final: row.final, write_rule: row.write_rule, existing_rule: row.existing_rule, reasons: row.reasons }, null, 2) }}</pre></details>
                  <AppButton v-if="row.official && !rowMultipliers.some((entry) => entry.row_key === row.row_key)" size="xs" color="neutral" variant="ghost" class="mt-2" :disabled="applying" @click="setRowMultiplier(row)">Set row multiplier</AppButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else class="rounded-lg border border-dashed border-[var(--ui-border)] p-6 text-center text-sm text-[var(--ui-text-muted)]">{{ loading ? 'Fetching and matching catalog prices…' : 'Generate a preview to review matches and price rules. Nothing is written until you confirm.' }}</p>
      </section>
      <UAlert v-if="operation" :color="operation.status === 'applied' ? 'success' : 'warning'" variant="subtle" :title="`Import ${operation.status}`" :description="`Operation ${operation.operation_id} · ${operation.rows?.length || 0} row(s) · ${operation.atomic ? 'Atomic' : 'Non-atomic'} · Applied ${operation.applied_at ? new Date(operation.applied_at).toLocaleString() : 'unknown'}`" />
      <AppButton v-if="failedRows.length" color="neutral" variant="outline" :disabled="busy || !!pendingApply" @click="retryFailedRows">Preview failed/conflicting rows ({{ failedRows.length }})</AppButton>
      <pre v-if="operation?.summary" class="overflow-auto rounded-lg bg-[var(--ui-bg-muted)] p-3 text-xs">{{ JSON.stringify(operation.summary, null, 2) }}</pre>
      <div v-if="operation?.rows?.length" class="max-h-56 space-y-2 overflow-y-auto"><div v-for="result in operation.rows" :key="result.key" class="rounded-lg border border-[var(--ui-border)] p-3 text-xs"><strong>{{ result.key }}</strong><span> · {{ result.status || result.action }}</span><span v-if="result.resource_id" class="block font-mono text-[var(--ui-text-muted)]">{{ result.resource_id }}</span><span v-if="result.error_code || result.error_message" class="block text-[var(--ui-error)]">{{ result.error_code }} {{ result.error_message }}</span></div></div>
    </div>
    </template>
    <template #footer>
      <div class="w-full space-y-3">
        <UCheckbox v-if="requiresOverwrite" v-model="confirmOverwrite" :disabled="applying" label="I confirm replacing existing model-price rules" />
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-[var(--ui-text-muted)]">{{ selected.length }} rules selected · Future charges only</p>
          <div class="flex gap-2">
            <AppButton color="neutral" variant="outline" :disabled="applying" @click="open = false">Cancel</AppButton>
            <AppButton :loading="applying" :disabled="busy || !recoveryReady || !!applySupportError || !!pendingApply || !preview || !selected.length || (requiresOverwrite && !confirmOverwrite)" @click="applyPrices">Confirm apply ({{ selected.length }})</AppButton>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
  <UModal v-model:open="discardPendingOpen" title="Discard saved import request?" description="Discarding does not cancel or undo an import that Home may already have applied. Retry the saved request first when possible. A new import must use a fresh preview.">
    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
        <AppButton color="neutral" variant="outline" @click="discardPendingOpen = false">Keep recovery request</AppButton>
        <AppButton color="error" :disabled="busy" @click="discardPendingApply">Discard recovery request</AppButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { billingImportApplySupportError, createBillingImportIdempotencyKey, billingImportStorageKey, isDefinitiveBillingImportFailure, readBillingImportPending, validateBillingImportResult, writeBillingImportPending, type BillingImportPendingApply } from '~/composables/billingImport'
type ImportTarget = { provider: string; model: string }
const props = defineProps<{ providers: string[]; models: string[]; candidates: ImportTarget[]; availableTargets: ImportTarget[]; priceRules: { provider: string; model: string; source: string }[]; serviceTierSource: string }>()
const open = ref(false)
const advancedDetails = ref<HTMLDetailsElement | null>(null)
const providerFilter = ref('__all_providers__')
const targetSet = ref('available')
const targetSetOptions = [
  { label: 'All candidates', value: 'all' },
  { label: 'Available models', value: 'available' },
  { label: 'Existing synced rules', value: 'synced' },
  { label: 'Manual targets', value: 'manual' }
]
const overwriteOptions = [
  { label: 'Missing only · preserve existing rules', value: 'missing' },
  { label: 'Update synced rules · protect manual rules', value: 'sync' },
  { label: 'Replace all · confirmation required', value: 'all' }
]
const providerOptions = computed(() => [
  { label: 'All providers', value: '__all_providers__' },
  ...[...new Set([...props.candidates, ...props.availableTargets, ...props.priceRules].map(target => target.provider).filter(Boolean))].sort().map(provider => ({ label: provider, value: provider }))
])
const writeFields: { key: string; cost?: string; label: string }[] = [
  { key: 'service_tier', label: 'Service tier' }, { key: 'min_input_tokens', label: 'Minimum input tokens' },
  { key: 'input_price_per_million', cost: 'input', label: 'Input / 1M' }, { key: 'output_price_per_million', cost: 'output', label: 'Output / 1M' },
  { key: 'cache_read_price_per_million', cost: 'cache_read', label: 'Cache read / 1M' }, { key: 'cache_write_price_per_million', cost: 'cache_write', label: 'Cache write / 1M' },
  { key: 'request_price', cost: 'request', label: 'Per request' }
]
const source = ref('models.dev')
const importUnavailable = ref(false)
const checkingUpdates = ref(false)
const syncTargets = computed(() => [...new Map(props.priceRules.filter(rule => rule.source === 'sync').map(rule => [`${rule.provider.toLowerCase()}::${rule.model}`, { provider: rule.provider, model: rule.model }])).values()])
const emit = defineEmits<{ applied: [] }>()
const { fetchAPI, apiBase, token } = useApi()
const runtimeConfig = useRuntimeConfig()
const effectiveToken = computed(() => String(token.value || runtimeConfig.public.secretKey || '').trim())
const applySupportError = billingImportApplySupportError()
const recoveryReady = ref(false)
const recoveryError = ref('')
const pendingApply = ref<BillingImportPendingApply | null>(null)
const discardPendingOpen = ref(false)
let storageKey = ''
let sessionVersion = 0
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
const operationId = ref('')
const operationLoading = ref(false)
const operationError = ref('')
let operationController: AbortController | null = null
let previewController: AbortController | null = null
let applyController: AbortController | null = null
let disposed = false
function preventUnload(event: BeforeUnloadEvent) {
  if (!applying.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', preventUnload))
onScopeDispose(() => {
  disposed = true
  sessionVersion++
  operationController?.abort()
  previewController?.abort()
  applyController?.abort()
  window.removeEventListener('beforeunload', preventUnload)
})
const busy = computed(() => loading.value || applying.value || operationLoading.value)
const automaticTargets = computed(() => {
  const candidates = targetSet.value === 'synced' ? syncTargets.value : targetSet.value === 'all' ? props.candidates : props.availableTargets
  return [...new Map(candidates.filter(target => providerFilter.value === '__all_providers__' || target.provider === providerFilter.value).map(target => [`${target.provider.toLowerCase()}::${target.model}`, { provider: target.provider, model: target.model }])).values()]
})
function openImport() {
  open.value = true
}
async function checkUpdates() {
  if (busy.value || pendingApply.value || importUnavailable.value || !syncTargets.value.length) return
  open.value = true
  providerFilter.value = '__all_providers__'
  targetSet.value = 'synced'
  targets.splice(0, targets.length, ...automaticTargets.value)
  overwriteMode.value = 'sync'
  await previewPrices(true)
}
defineExpose({ openImport, checkUpdates })
function exportPreview() {
  if (!preview.value) return
  const url = URL.createObjectURL(new Blob([JSON.stringify(preview.value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'model-price-import-preview.json'
  link.click()
  URL.revokeObjectURL(url)
}
function setRowMultiplier(row: any) {
  rowMultipliers.push({ row_key: row.row_key, multiplier: row.multiplier })
  if (advancedDetails.value) advancedDetails.value.open = true
}
function pricesChanged(row: any) {
  if (!row.existing_rule || !row.final) return true
  const fields: [string, string][] = [
    ['input', 'input_price_per_million'], ['output', 'output_price_per_million'],
    ['cache_read', 'cache_read_price_per_million'], ['cache_write', 'cache_write_price_per_million'],
    ['request', 'request_price']
  ]
  return fields.some(([cost, field]) => Number(row.final[cost]) !== Number(row.existing_rule[field]))
}
function selectable(row: any) {
  return row.applicable && row.write_rule && row.action !== 'skip' && (!checkingUpdates.value || pricesChanged(row))
}
const changedRows = computed(() => (preview.value?.rows || []).filter(selectable).length)
const reviewRows = computed(() => (preview.value?.rows || []).filter((row: any) => row.action === 'review' || ['conflict', 'failed'].includes(row.status)).length)
watch(operationId, () => { operationError.value = '' })
async function lookupOperation() {
  const id = operationId.value.trim()
  if (!id || operationLoading.value || loading.value || applying.value) return
  operationLoading.value = true
  operationError.value = ''
  operation.value = null
  const controller = new AbortController()
  const session = sessionVersion
  operationController = controller
  try {
    const result = await fetchAPI(`/billing/model-prices/import/operations/${encodeURIComponent(id)}`, { method: 'GET', signal: controller.signal })
    if (!disposed && session === sessionVersion && !controller.signal.aborted) operation.value = result
  } catch (cause: any) {
    if (!disposed && session === sessionVersion && !controller.signal.aborted) operationError.value = cause?.message || 'Unable to load the stored import operation.'
  } finally {
    if (!disposed && session === sessionVersion && operationController === controller) {
      operationLoading.value = false
      operationController = null
    }
  }
}
const selected = ref<string[]>([])
const confirmOverwrite = ref(false)
let inputVersion = 0
function invalidatePreview() {
  inputVersion++
  previewController?.abort()
  checkingUpdates.value = false
  error.value = ''
  preview.value = null
  selected.value = []
  confirmOverwrite.value = false
}
watch([source, targets, overwriteMode, defaultMultiplier, includeZeroCost, aliases, multiplierRules, rowMultipliers, matchOverrides], invalidatePreview, { deep: true, flush: 'sync' })
watch(effectiveToken, async () => {
  const session = ++sessionVersion
  operationController?.abort()
  applyController?.abort()
  invalidatePreview()
  loading.value = false
  applying.value = false
  operationLoading.value = false
  operation.value = null
  operationId.value = ''
  operationError.value = ''
  importUnavailable.value = false
  pendingApply.value = null
  discardPendingOpen.value = false
  recoveryReady.value = false
  recoveryError.value = ''
  storageKey = ''
  if (!effectiveToken.value || !import.meta.client) return
  try {
    const key = await billingImportStorageKey(new URL(apiBase, window.location.origin).href, effectiveToken.value)
    if (disposed || session !== sessionVersion) return
    storageKey = key
    pendingApply.value = readBillingImportPending(window.sessionStorage, key)
    recoveryReady.value = true
  } catch (cause: any) {
    if (!disposed && session === sessionVersion) recoveryError.value = `${cause?.message || 'Import recovery storage is unavailable.'} No apply request will be sent. Previews and update checks remain available. If storage is blocked, enable session storage and reload this UI.`
  }
}, { immediate: true, flush: 'sync' })
watch([targetSet, automaticTargets], () => {
  if (targetSet.value === 'manual') {
    if (advancedDetails.value) advancedDetails.value.open = true
    return
  }
  targets.splice(0, targets.length, ...automaticTargets.value)
}, { immediate: true, deep: true, flush: 'sync' })
const addTarget = () => { targetSet.value = 'manual'; targets.push(emptyTarget()) }
const removeTarget = (index: number) => { targetSet.value = 'manual'; targets.splice(index, 1) }
const positive = (value: number) => typeof value === 'number' && Number.isFinite(value) && value > 0
const validationError = computed(() => {
  if (!targets.length) return 'No targets in this selection. Choose another provider or target set, or add manual targets in Advanced options.'
    if (targets.some(target => !target.provider.trim() || !target.model.trim())) return 'Every target needs a provider and model.'
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
async function previewPrices(updates = false, preferredSelection?: string[]) {
  if (busy.value || pendingApply.value || importUnavailable.value) return
  loading.value = true
  error.value = ''
  invalidatePreview()
  checkingUpdates.value = updates
  operation.value = null
  const version = inputVersion
  const session = sessionVersion
  const controller = new AbortController()
  previewController = controller
  try {
    if (validationError.value) throw new Error(validationError.value)
    const result: any = await fetchAPI('/billing/model-prices/import/preview', {
      method: 'POST',
      signal: controller.signal,
      body: {
        source: source.value,
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
    if (disposed || session !== sessionVersion || controller.signal.aborted || version !== inputVersion) return
    preview.value = result
    selected.value = (result.rows || []).filter((row: any) => selectable(row) && (!preferredSelection || preferredSelection.includes(row.row_key))).map((row: any) => row.row_key)
    confirmOverwrite.value = false
  } catch (cause: any) {
    if (!disposed && session === sessionVersion && !controller.signal.aborted && version === inputVersion) {
      if ([404, 405, 501].includes(cause?.statusCode)) importUnavailable.value = true
      else error.value = cause?.message || 'Unable to preview model prices.'
    }
  } finally {
    if (!disposed && session === sessionVersion && previewController === controller) {
      loading.value = false
      previewController = null
    }
  }
}
async function applyPrices() {
  if (!preview.value || !selected.value.length || busy.value || pendingApply.value || (requiresOverwrite.value && !confirmOverwrite.value)) return
  if (!recoveryReady.value || applySupportError) {
    error.value = recoveryError.value || applySupportError || 'Import recovery is still initializing. Wait before applying prices.'
    return
  }
  try {
    const pending: BillingImportPendingApply = {
      version: 1,
      createdAt: new Date().toISOString(),
      input: {
        preview_id: preview.value.preview_id,
        preview_revision: preview.value.preview_revision,
        selected_keys: [...selected.value],
        confirm_overwrite: confirmOverwrite.value,
        idempotency_key: createBillingImportIdempotencyKey()
      }
    }
    writeBillingImportPending(window.sessionStorage, storageKey, pending)
    pendingApply.value = pending
  } catch (cause: any) {
    error.value = cause?.message || 'Unable to save the recovery request. Nothing was sent; enable session storage before applying.'
    return
  }
  await retryPendingApply()
}
async function retryPendingApply() {
  if (busy.value || !recoveryReady.value || !pendingApply.value) return
  const pending = pendingApply.value
  const session = sessionVersion
  const controller = new AbortController()
  applyController = controller
  applying.value = true
  error.value = ''
  try {
    // Persist again before a retry, and never rebuild this body from editable controls.
    writeBillingImportPending(window.sessionStorage, storageKey, pending)
    const result = await fetchAPI('/billing/model-prices/import/apply', { method: 'POST', body: pending.input, signal: controller.signal })
    if (disposed || session !== sessionVersion || controller.signal.aborted) return
    validateBillingImportResult(result, pending.input)
    operation.value = result
    writeBillingImportPending(window.sessionStorage, storageKey, null)
    pendingApply.value = null
    invalidatePreview()
    emit('applied')
  } catch (cause: any) {
    if (disposed || session !== sessionVersion || controller.signal.aborted) return
    if (isDefinitiveBillingImportFailure(cause)) {
      try {
        writeBillingImportPending(window.sessionStorage, storageKey, null)
        pendingApply.value = null
        invalidatePreview()
      } catch {
        error.value = 'Unable to clear the saved recovery request. It has been retained.'
        return
      }
    }
    error.value = cause?.message || 'Apply outcome is uncertain. Retry the saved request to recover the original result.'
  } finally {
    if (!disposed && session === sessionVersion && applyController === controller) {
      applying.value = false
      applyController = null
    }
  }
}
function discardPendingApply() {
  if (busy.value || !storageKey) return
  try {
    writeBillingImportPending(window.sessionStorage, storageKey, null)
    pendingApply.value = null
    discardPendingOpen.value = false
    recoveryError.value = ''
    recoveryReady.value = true
    invalidatePreview()
  } catch {
    error.value = 'Unable to remove the saved recovery request.'
  }
}
const failedRows = computed<any[]>(() => (operation.value?.rows || []).filter((row: any) => ['failed', 'conflict'].includes(row.status)))
async function retryFailedRows() {
  if (busy.value || pendingApply.value || !failedRows.value.length) return
  const rows = [...failedRows.value]
  const retryTargets = rows.map(row => ({ provider: row.provider, model: row.model }))
  if (retryTargets.some(target => typeof target.provider !== 'string' || !target.provider.trim() || typeof target.model !== 'string' || !target.model.trim())) {
    error.value = 'The stored result has no valid target identities. Choose targets and generate a fresh preview manually.'
    return
  }
  targetSet.value = 'manual'
  const existingTargets = targets.filter(target => target.provider.trim() && target.model.trim())
  targets.splice(0, targets.length, ...new Map([...existingTargets, ...retryTargets].map(target => [`${target.provider.toLowerCase()}::${target.model}`, target])).values())
  // Preserve policy, but select only failed/conflicting exact row keys in the new preview.
  await previewPrices(false, rows.map(row => row.key))
}
</script>
