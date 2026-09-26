<template>
  <div class="space-y-4">
    <UAlert
      v-if="pageError"
      color="error"
      variant="subtle"
      icon="i-tabler-alert-triangle"
      title="Unable to load provider entries"
      :description="pageError"
    />

    <section class="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside class="self-start rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 max-xl:hidden" aria-label="Provider categories">
        <p class="px-2 pb-2 text-xs font-medium uppercase text-[var(--ui-text-muted)]">Provider categories</p>
        <nav class="grid gap-1" aria-label="Provider categories">
          <button
            v-for="category in providerCategories"
            :key="category.value"
            type="button"
            :disabled="providerEditorOpen || deleteOpen"
            :aria-current="selectedProviderRoute === category.value ? 'page' : undefined"
            class="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="selectedProviderRoute === category.value ? 'border-[var(--ui-primary)] bg-[var(--ui-primary)]/10 text-[var(--ui-primary)]' : 'border-transparent hover:border-[var(--ui-border)] hover:bg-[var(--ui-bg-elevated)]'"
            @click="selectedProviderRoute = category.value"
          >
            <span class="flex min-w-0 items-center gap-2.5">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] text-[10px] font-semibold" aria-hidden="true">{{ category.mark }}</span>
              <span class="min-w-0">
              <span class="block truncate text-sm font-medium">{{ category.label }}</span>
              <span class="mt-0.5 block text-xs text-[var(--ui-text-muted)]">
                {{ categoryStats[category.value] ? `${categoryStats[category.value].active} active / ${categoryStats[category.value].total} total` : 'Counts unavailable' }}
              </span>
              </span>
            </span>
            <UIcon v-if="categoryStats[category.value]?.disabled" name="i-tabler-alert-triangle" class="size-4 shrink-0 text-[var(--ui-warning)]" :aria-label="`${categoryStats[category.value].disabled} disabled entries`" />
            <span v-else class="shrink-0 rounded-md border border-[var(--ui-border)] px-2 py-1 text-xs" :aria-label="categoryStats[category.value] ? `${categoryStats[category.value].total} entries` : 'Counts unavailable'">{{ categoryStats[category.value]?.total ?? '—' }}</span>
          </button>
        </nav>

      </aside>

      <div class="min-w-0">
        <UCard :ui="{ body: { padding: '' } }">
        <div class="flex flex-col gap-3 border-b border-[var(--ui-border)] px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div class="w-full sm:w-auto">
            <label class="mb-1.5 block text-sm font-medium xl:hidden">Provider category</label>
            <USelectMenu
              v-model="selectedProviderRoute"
              :items="providerOptions"
              value-key="value"
              label-key="label"
              :search-input="{ placeholder: 'Search provider categories...' }"
              :disabled="providerEditorOpen || deleteOpen"
              class="w-full xl:hidden"
            />
            <h2 class="hidden items-center gap-2 text-base font-semibold text-[var(--ui-text-highlighted)] xl:flex"><span class="flex size-5 items-center justify-center rounded border border-[var(--ui-border)] text-[9px]" aria-hidden="true">{{ selectedProvider.mark }}</span>{{ selectedProvider.label }} <span class="font-mono text-xs font-normal text-[var(--ui-text-muted)]">/{{ selectedProviderRoute }}</span></h2>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <UInput v-model="providerSearch" icon="i-tabler-search" placeholder="Filter entries..." class="w-full sm:w-72" />
            <UButton color="primary" icon="i-tabler-plus" :disabled="pending || !!pageError" @click="openProviderCreate">New provider</UButton>
          </div>
        </div>

        <UTable :columns="providerColumns" :data="filteredProviderEntries" :loading="pending">
          <template #identity-cell="{ row }">
            <div class="min-w-0">
              <p class="max-w-52 truncate font-medium text-[var(--ui-text-highlighted)]">{{ providerEntryLabel(rowValue(row)) }}</p>
              <p class="mt-1 max-w-52 truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).api_key_preview || rowValue(row).auth_index || rowValue(row).id || selectedProvider.label }}</p>
            </div>
          </template>

          <template #endpoint-cell="{ row }">
            <p class="max-w-56 truncate font-mono text-xs text-[var(--ui-text-muted)]" :title="safeEndpoint(rowValue(row)['base-url'] || rowValue(row).base_url)">{{ safeEndpoint(rowValue(row)['base-url'] || rowValue(row).base_url) }}</p>
          </template>
          <template #prefix-cell="{ row }"><span class="rounded-md border border-[var(--ui-border)] px-2 py-1 text-xs">{{ rowValue(row).prefix || 'None' }}</span></template>
          <template #models-cell="{ row }"><span class="text-xs text-[var(--ui-text-muted)]">{{ Array.isArray(rowValue(row).models) ? rowValue(row).models.length : 0 }} models · {{ Object.keys(rowValue(row).headers || {}).length }} headers</span></template>
          <template #status-cell="{ row }">
            <span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium" :class="rowValue(row).disabled ? 'border-[var(--ui-warning)] text-[var(--ui-warning)]' : 'border-[var(--ui-primary)] text-[var(--ui-primary)]'">
              <UIcon :name="rowValue(row).disabled ? 'i-tabler-alert-triangle' : 'i-tabler-circle-check'" class="size-3" />{{ rowValue(row).disabled ? 'Disabled' : 'Active' }}
            </span>
          </template>

          <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><UButton color="neutral" variant="ghost" size="xs" icon="i-tabler-eye" aria-label="View provider" title="View" @click="openProviderDetail(rowValue(row))" /><UButton color="neutral" variant="ghost" size="xs" icon="i-tabler-pencil" aria-label="Edit provider" title="Edit" @click="openProviderEdit(rowValue(row))" /><UButton color="neutral" variant="ghost" size="xs" icon="i-tabler-files" aria-label="Duplicate provider" title="Duplicate" @click="duplicateProvider(rowValue(row))" /><UButton color="error" variant="ghost" size="xs" icon="i-tabler-trash" aria-label="Delete provider" title="Delete" @click="confirmProviderDelete(rowValue(row))" /></div></template>

          <template #empty>
            <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div class="mb-3 rounded-full bg-[var(--ui-bg-elevated)] p-3">
                <UIcon name="i-tabler-server-2" class="size-6 text-[var(--ui-text-muted)]" />
              </div>
              <p class="font-medium">{{ pending ? 'Loading provider entries…' : pageError ? 'Provider entries unavailable' : providerSearch ? 'No matching entries' : `No ${selectedProvider.label} entries` }}</p>
              <p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ pageError ? 'Check the error above and retry.' : providerSearch ? 'Try a different search.' : 'Add an entry to configure this provider category.' }}</p>
            </div>
          </template>
        </UTable>
        </UCard>
      </div>
    </section>

    <UModal
      v-model:open="providerEditorOpen"
      :title="providerEditorMode === 'detail' ? 'Provider details' : providerEditorMode === 'edit' ? `Edit ${selectedProvider.label} entry` : `Add ${selectedProvider.label} entry`"
      description="Configure common fields or edit advanced options in JSON. Saved credentials are not included in raw JSON."
    >
      <template #body>
        <div v-if="providerEditorMode === 'detail' && editingProviderEntry" class="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
          <div><p class="text-xs font-medium uppercase text-[var(--ui-text-muted)]">Provider details</p><h2 class="mt-2 text-base font-semibold">{{ providerEntryLabel(editingProviderEntry) }}</h2></div>
          <dl class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div v-for="field in providerDetailFields" :key="field.label" class="min-w-0"><dt class="text-xs text-[var(--ui-text-muted)]">{{ field.label }}</dt><dd class="mt-1 break-words font-mono text-xs">{{ field.value }}</dd></div>
          </dl>
          <details class="rounded-md border border-[var(--ui-border)] px-3 py-2.5 text-sm"><summary class="cursor-pointer font-medium">Additional metadata</summary>
            <dl class="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2"><div v-for="field in providerMetadataFields" :key="field.label"><dt class="text-xs text-[var(--ui-text-muted)]">{{ field.label }}</dt><dd class="mt-1 break-words font-mono text-xs">{{ field.value }}</dd></div></dl>
          </details>
          <div class="flex justify-end gap-2 border-t border-[var(--ui-border)] pt-4"><UButton color="neutral" variant="ghost" @click="providerEditorOpen = false">Close</UButton><UButton color="primary" icon="i-tabler-pencil" @click="openProviderEdit(editingProviderEntry)">Edit</UButton></div>
        </div>
        <form v-else class="max-h-[75vh] space-y-4 overflow-y-auto pr-1" @submit.prevent="saveProviderEntry">
          <div class="flex gap-2">
            <UButton type="button" color="neutral" :variant="editorView === 'guided' ? 'soft' : 'ghost'" @click="switchEditorView('guided')">Guided form</UButton>
            <UButton type="button" color="neutral" :variant="editorView === 'json' ? 'soft' : 'ghost'" @click="switchEditorView('json')">Raw JSON</UButton>
          </div>
          <UAlert
            v-if="editorError"
            color="error"
            variant="subtle"
            icon="i-tabler-alert-circle"
            title="Invalid provider entry"
            :description="editorError"
          />
          <template v-if="editorView === 'guided'">
            <UAlert color="info" variant="subtle" title="Status" description="Status is read-only in this editor. Manage credential status from Accounts." />
            <div class="grid gap-4">
              <UFormField v-if="isCompat" label="Provider name" required><UInput v-model="providerForm.name" class="w-full" placeholder="my-upstream" /></UFormField>
              <UFormField v-else label="API key"><UInput v-model="providerForm['api-key']" type="password" autocomplete="new-password" class="w-full" :placeholder="providerEditorMode === 'edit' ? 'Leave blank to keep saved key' : 'Enter API key'" /></UFormField>
              <UFormField label="Base URL" :required="requiresBaseURL"><UInput v-model="providerForm['base-url']" type="url" class="w-full" :placeholder="requiresBaseURL ? 'https://upstream.example/v1' : 'Use provider default'" /></UFormField>
              <UFormField v-if="!isCompat" label="Proxy URL"><UInput v-model="providerForm['proxy-url']" type="url" class="w-full" placeholder="Use global proxy" /></UFormField>
              <UFormField label="Priority" hint="Higher values are preferred"><UInput v-model="providerForm.priority" type="number" step="1" class="w-full" /></UFormField>
              <UFormField label="Model prefix"><UInput v-model="providerForm.prefix" class="w-full" placeholder="Optional namespace" /></UFormField>
              <UFormField label="Request retry override" hint="Blank inherits global; 0 disables additional rounds"><UInput v-model="requestRetryText" type="number" min="0" step="1" class="w-full" placeholder="Inherit global" /></UFormField>
              <UFormField label="Cooling policy"><USelect v-model="coolingPolicy" :items="coolingOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
            </div>
            <UCheckbox v-if="supportsWebsockets" v-model="providerForm.websockets" label="Enable WebSockets" />
            <UCheckbox v-if="selectedProviderRoute === 'codex-api-key'" v-model="providerForm['alpha-search']" label="Enable Alpha Search" />
            <fieldset v-if="selectedProviderRoute === 'claude-api-key'" class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
              <legend class="font-medium">Claude request cloaking</legend>
              <UCheckbox v-model="cloakEnabled" label="Configure request cloaking" />
              <div v-if="cloakEnabled" class="space-y-3">
                <UFormField label="Cloaking mode" hint="Auto cloaks clients other than Claude Code."><USelect v-model="cloakMode" :items="cloakModeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
                <UCheckbox v-model="cloakStrictMode" label="Strict mode (replace user system prompts)" />
                <UFormField label="Sensitive words" hint="One word per line; obfuscated in system instructions."><UTextarea v-model="cloakSensitiveWordsText" :rows="3" class="w-full" /></UFormField>
                <UFormField label="Cache user ID"><USelect v-model="cloakCacheUserID" :items="cloakCacheOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
              </div>
              <UCheckbox v-model="providerForm['experimental-cch-signing']" label="Experimental CCH signing for cloaked requests" />
            </fieldset>
            <fieldset v-if="isCompat" class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
              <div class="flex items-center justify-between gap-2"><legend class="font-medium">API key entries</legend><UButton type="button" size="sm" color="neutral" variant="outline" icon="i-tabler-plus" @click="providerForm['api-key-entries'].push({ 'api-key': '', 'proxy-url': '' })">Add key</UButton></div>
              <p class="text-xs text-[var(--ui-text-muted)]">Each key can use its own proxy. Leave a saved key blank to keep it.</p>
              <div v-for="(key, index) in providerForm['api-key-entries']" :key="index" class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <UFormField label="API key"><UInput v-model="key['api-key']" type="password" autocomplete="new-password" class="w-full" /></UFormField>
                <UFormField label="Proxy URL"><UInput v-model="key['proxy-url']" type="url" class="w-full" /></UFormField>
                <UButton type="button" color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove API key" class="self-end" @click="providerForm['api-key-entries'].splice(index, 1)" />
              </div>
            </fieldset>
            <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
              <div class="flex items-center justify-between gap-2"><legend class="font-medium">Models</legend><UButton type="button" size="sm" color="neutral" variant="outline" icon="i-tabler-plus" @click="addProviderModel">Add model</UButton></div>
              <p class="text-xs text-[var(--ui-text-muted)]">Map an upstream model name to a client-facing alias. Additional model properties are retained.</p>
              <div v-if="supportsDiscovery" class="space-y-3 rounded-lg border border-[var(--ui-border)] p-3">
                <p class="text-sm font-medium">Discover upstream models</p>
                <UAlert color="warning" variant="subtle" icon="i-tabler-alert-triangle" title="Server-side request (SSRF risk)" description="Home will request the exact URL you enter, including private network addresses. Only use a trusted upstream URL. A saved provider credential is required; its token is sent to that URL. Do not include secrets in the URL." />
                <UFormField label="Models endpoint URL" hint="Derived from the base URL by default. Only request trusted HTTP(S) endpoints."><UInput v-model="discoveryURL" type="url" class="w-full" :placeholder="defaultDiscoveryURL || 'https://upstream.example/v1/models'" @update:model-value="clearDiscoveryResults" /></UFormField>
                <p class="text-xs text-[var(--ui-text-muted)]">{{ discoveryHint }}</p>
                <UButton type="button" color="neutral" variant="outline" icon="i-tabler-search" :loading="discovering" :disabled="!discoveryAuthIndex || (!discoveryURL.trim() && !defaultDiscoveryURL)" @click="discoverModels">Fetch models</UButton>
                <UAlert v-if="discoveryError" color="error" variant="subtle" title="Discovery failed" :description="discoveryError" />
                <div v-if="discoveredModels.length" class="space-y-2">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm">{{ selectedDiscovered.length }} of {{ discoveredModels.length }} selected</p>
                    <div class="flex gap-2"><UButton type="button" size="sm" color="neutral" variant="ghost" @click="selectedDiscovered = discoveredModels.map(model => model.name)">Select all</UButton><UButton type="button" size="sm" color="neutral" variant="ghost" @click="selectedDiscovered = []">Clear</UButton></div>
                  </div>
                  <div class="max-h-40 space-y-1 overflow-y-auto">
                    <UCheckbox v-for="model in discoveredModels" :key="model.name" :model-value="selectedDiscovered.includes(model.name)" :label="model.name" @update:model-value="toggleDiscoveredModel(model.name, $event)" />
                  </div>
                  <UButton type="button" size="sm" color="primary" :disabled="!selectedDiscovered.length" @click="applyDiscoveredModels">Apply selected to entry</UButton>
                  <p class="text-xs text-[var(--ui-text-muted)]">Apply adds missing models without replacing existing aliases. Save entry to persist changes.</p>
                </div>
              </div>
              <div v-for="(model, index) in providerForm.models" :key="index" class="space-y-2 rounded-lg bg-[var(--ui-bg-muted)] p-3">
                <div class="grid gap-2 sm:grid-cols-2"><UFormField label="Upstream model"><UInputMenu v-model="model.name" :items="modelSuggestions" create-item class="w-full" placeholder="Search catalog or enter model" @create="model.name = $event.trim()" /></UFormField><UFormField label="Alias"><UInput v-model="model.alias" class="w-full" /></UFormField><UFormField label="Display name"><UInput v-model="model['display-name']" class="w-full" /></UFormField><div class="flex items-end justify-between gap-2"><UCheckbox v-model="model['force-mapping']" label="Force response mapping" /><UButton type="button" color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove model" @click="removeProviderModel(index)" /></div></div>
              </div>
            </fieldset>
            <UFormField v-if="!isCompat" label="Excluded models" hint="One model ID per line"><UTextarea v-model="excludedModelsText" :rows="3" class="w-full" /></UFormField>
            <UFormField label="Headers (JSON object)" hint="Header values may contain secrets; they are not shown in the list."><UTextarea v-model="headersJSON" :rows="4" class="w-full font-mono text-xs" spellcheck="false" /></UFormField>
            <p class="text-xs text-[var(--ui-text-muted)]">Advanced options and unknown fields are preserved. Use Raw JSON to edit them.</p>
          </template>
          <UFormField v-else label="Provider entry JSON (credentials omitted)" required>
            <UTextarea v-model="providerJSON" :rows="18" autoresize class="w-full font-mono text-xs" spellcheck="false" />
          </UFormField>
          <div class="flex items-center justify-between border-t border-[var(--ui-border)] pt-4">
            <UButton v-if="editorView === 'json'" color="neutral" variant="ghost" type="button" icon="i-tabler-code" @click="formatProviderJSON">Format JSON</UButton>
            <span v-else class="text-xs text-[var(--ui-text-muted)]">Credentials are not shown in the entry list.</span>
            <div class="flex gap-3">
              <UButton color="neutral" variant="ghost" type="button" @click="providerEditorOpen = false">Cancel</UButton>
              <UButton color="primary" type="submit" :loading="savingProvider">Save entry</UButton>
            </div>
          </div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Delete provider entry">
      <template #body>
        <div class="space-y-5">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-tabler-alert-triangle"
            title="Requests using this provider entry may stop working"
            :description="deleteDescription"
          />
          <div class="flex justify-end gap-3">
            <UButton color="neutral" variant="ghost" @click="deleteOpen = false">Cancel</UButton>
            <UButton color="error" :loading="deleting" @click="performDelete">Delete</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup>
const props = defineProps({ syncRequest: { type: Number, default: 0 } })
const emit = defineEmits(['changed'])
const { fetchAPI } = useApi()
const toast = useToast()
const rowValue = (row) => row?.original ?? row

const providerCategories = [
  { label: 'Gemini API keys', value: 'gemini-api-key', responseKey: 'gemini-api-key', template: { 'api-key': '', 'base-url': '', priority: 0, prefix: '', 'proxy-url': '', models: [], headers: {}, 'excluded-models': [] } },
  { label: 'Gemini Interactions', value: 'interactions-api-key', responseKey: 'interactions-api-key', template: { 'api-key': '', 'base-url': '', priority: 0, prefix: '', 'proxy-url': '', models: [], headers: {}, 'excluded-models': [] } },
  { label: 'Claude API keys', value: 'claude-api-key', responseKey: 'claude-api-key', template: { 'api-key': '', 'base-url': '', priority: 0, prefix: '', 'proxy-url': '', models: [], headers: {}, 'excluded-models': [] } },
  { label: 'Codex API keys', value: 'codex-api-key', responseKey: 'codex-api-key', template: { 'api-key': '', 'base-url': '', priority: 0, prefix: '', 'proxy-url': '', models: [], headers: {}, websockets: false } },
  { label: 'xAI API keys', value: 'xai-api-key', responseKey: 'xai-api-key', template: { 'api-key': '', 'base-url': 'https://api.x.ai/v1', priority: 0, prefix: '', 'proxy-url': '', models: [], headers: {}, websockets: false } },
  { label: 'Meta API keys', value: 'meta-api-key', responseKey: 'meta-api-key', template: { 'api-key': '', 'base-url': '', priority: 0, prefix: '', 'proxy-url': '', models: [], headers: {} } },
  { label: 'Vertex compatibility', value: 'vertex-api-key', responseKey: 'vertex-api-key', template: { 'api-key': '', 'base-url': '', priority: 0, prefix: '', 'proxy-url': '', models: [], headers: {} } },
  { label: 'OpenAI compatibility', value: 'openai-compatibility', responseKey: 'openai-compatibility', template: { name: '', 'base-url': '', priority: 0, disabled: false, prefix: '', 'api-key-entries': [], models: [], headers: {} } }
]

const providerMarks = ['G', 'G', 'C', 'Cx', 'xAI', 'M', 'V', 'AI']
providerCategories.forEach((category, index) => { category.mark = providerMarks[index] })

const selectedProviderRoute = ref(providerCategories[0].value)
const providerSearch = ref('')
const pageError = ref('')
const providerEditorOpen = ref(false)
const providerEditorMode = ref('create')
const editingProviderEntry = ref(null)
const editingProviderIndex = ref(-1)
const providerJSON = ref('')
const providerForm = ref({})
const editorView = ref('guided')
const excludedModelsText = ref('')
const headersJSON = ref('{}')
const cloakEnabled = ref(false)
const cloakMode = ref('auto')
const cloakStrictMode = ref(false)
const cloakSensitiveWordsText = ref('')
const cloakCacheUserID = ref('inherit')
const cloakModeOptions = [{ label: 'Auto', value: 'auto' }, { label: 'Always', value: 'always' }, { label: 'Never', value: 'never' }]
const cloakCacheOptions = [{ label: 'Use default', value: 'inherit' }, { label: 'Cache per API key', value: 'enabled' }, { label: 'Generate for each request', value: 'disabled' }]
const requestRetryText = ref('')
const coolingPolicy = ref('inherit')
const coolingOptions = [{ label: 'Inherit global policy', value: 'inherit' }, { label: 'Disable cooling', value: 'disabled' }, { label: 'Enable cooling', value: 'enabled' }]
const isCompat = computed(() => selectedProviderRoute.value === 'openai-compatibility')
const supportsWebsockets = computed(() => ['codex-api-key', 'xai-api-key', 'meta-api-key'].includes(selectedProviderRoute.value))
const requiresBaseURL = computed(() => ['codex-api-key', 'xai-api-key', 'openai-compatibility'].includes(selectedProviderRoute.value))
const supportsDiscovery = computed(() => ['gemini-api-key', 'interactions-api-key', 'claude-api-key', 'codex-api-key', 'openai-compatibility'].includes(selectedProviderRoute.value))
const discoveryURL = ref('')
const discoveredModels = ref([])
const selectedDiscovered = ref([])
const discoveryError = ref('')
const discovering = ref(false)
let discoveryGeneration = 0
const discoveryAuthIndex = computed(() => {
  if (providerEditorMode.value !== 'edit') return ''
  const entry = editingProviderEntry.value
  const credential = isCompat.value ? entry?.['api-key-entries']?.[0] : entry
  return String(credential?.auth_index || credential?.id || entry?.auth_index || entry?.id || '').trim()
})
const discoveryHint = computed(() => discoveryAuthIndex.value
  ? 'Uses the saved credential for this entry. Unsaved keys and editor headers are not sent.'
  : 'Save an entry with a credential first, then edit it to discover models.')
const defaultDiscoveryURL = computed(() => {
  const base = String(providerForm.value['base-url'] || '').trim().replace(/\/+$/, '')
  const route = selectedProviderRoute.value
  if (['gemini-api-key', 'interactions-api-key'].includes(route)) return `${(base || 'https://generativelanguage.googleapis.com').replace(/\/v1beta(?:\/.*)?$/i, '')}/v1beta/models`
  if (route === 'claude-api-key') return `${(base || 'https://api.anthropic.com').replace(/\/v1(?:\/.*)?$/i, '')}/v1/models`
  if (!base) return ''
  if (route === 'codex-api-key') return /\/v1\/models$/i.test(base) ? base : /\/v1$/i.test(base) ? `${base}/models` : `${base}/v1/models`
  return /\/models$/i.test(base) ? base : `${base}/models`
})
const editorError = ref('')
const savingProvider = ref(false)
const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleteTargetIndex = ref(-1)
const deleting = ref(false)


const providerColumns = [
  { accessorKey: 'identity', header: 'Key' },
  { accessorKey: 'endpoint', header: 'Base URL' },
  { accessorKey: 'prefix', header: 'Prefix' },
  { accessorKey: 'models', header: 'Models' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'actions', header: 'Actions', meta: { class: { th: 'table-action-head table-action-wide', td: 'table-action-cell table-action-wide' } } }
]

const selectedProvider = computed(() => providerCategories.find(item => item.value === selectedProviderRoute.value) || providerCategories[0])
const providerOptions = providerCategories.map(item => ({ label: item.label, value: item.value }))

function entriesFromResponse(response, category) {
  const candidate = response?.[category.responseKey] ?? response?.items ?? response?.data
  if (Array.isArray(candidate)) return candidate
  if (candidate && typeof candidate === 'object') return [candidate]
  return []
}

async function loadWorkspace() {
  const providerRoute = selectedProviderRoute.value
  pageError.value = ''
  try {
    const providerResponse = await fetchAPI(`/${providerRoute}`)
    return { providerResponse, providerRoute }
  } catch (error) {
    pageError.value = error?.message || 'Could not load provider entries. Check the Management API connection and try again.'
    return { providerResponse: null, providerRoute }
  }
}

const { data, pending, refresh: refreshWorkspace } = useAsyncData('management-provider-credentials', loadWorkspace, { lazy: true, default: () => ({ providerResponse: null, providerRoute: selectedProviderRoute.value }), watch: [selectedProviderRoute] })
async function loadCategoryStats() {
  const results = await Promise.all(providerCategories.map(async category => {
    try {
      const response = await fetchAPI(`/${category.value}`)
      const entries = entriesFromResponse(response, category)
      return [category.value, { total: entries.length, active: entries.filter(entry => !entry.disabled).length, disabled: entries.filter(entry => entry.disabled).length }]
    } catch { return [category.value, null] }
  }))
  return Object.fromEntries(results)
}
const { data: statsData, refresh: refreshCategoryStats } = useAsyncData('management-provider-stats', loadCategoryStats, { lazy: true, default: () => ({}) })
const { data: modelData } = useAsyncData('management-provider-models', () => fetchAPI('/models?scope=static').catch(() => ({ models: {} })), { lazy: true, default: () => ({ models: {} }) })
watch(() => props.syncRequest, () => { void refreshWorkspace(); void refreshCategoryStats() })

const modelSuggestions = computed(() => {
  const source = modelData.value?.models
  const models = Array.isArray(source) ? source : source && typeof source === 'object' ? Object.values(source).flat() : []
  return [...new Set(models.flatMap(model => [model?.id, model?.name]).filter(Boolean))].sort()
})

const categoryStats = computed(() => statsData.value || {})
const providerEntries = computed(() => data.value?.providerRoute === selectedProviderRoute.value
  ? entriesFromResponse(data.value.providerResponse, selectedProvider.value)
  : [])

const filteredProviderEntries = computed(() => {
  const query = providerSearch.value.trim().toLowerCase()
  if (!query) return providerEntries.value
  return providerEntries.value.filter(entry => [entry.name, entry.prefix, entry.id, entry.uuid, entry.auth_index, entry['base-url'], ...(Array.isArray(entry.models) ? entry.models.flatMap(model => [model.name, model.alias]) : [])]
    .some(value => String(value || '').toLowerCase().includes(query)))
})
const deleteDescription = computed(() => deleteTarget.value ? `This entry will be removed from ${selectedProvider.value.label}.` : '')
const providerDetailFields = computed(() => {
  const entry = editingProviderEntry.value || {}
  return [
    { label: 'Identifier', value: providerEntryLabel(entry) },
    { label: 'Base URL', value: safeEndpoint(entry['base-url'] || entry.base_url) },
    { label: 'Proxy URL', value: safeEndpoint(entry['proxy-url'] || entry.proxy_url) },
    { label: 'Prefix', value: entry.prefix || 'None' },
    { label: 'Models', value: String(entry.models?.length || 0) },
    { label: 'Headers', value: String(Object.keys(entry.headers || {}).length) }
  ]
})
const providerMetadataFields = computed(() => {
  const entry = editingProviderEntry.value || {}
  return [
    { label: 'Auth index', value: entry.auth_index || 'Not available' },
    { label: 'Excluded models', value: String(entry['excluded-models']?.length || 0) },
    { label: 'API key entries', value: String(entry['api-key-entries']?.length || 0) },
    { label: 'Priority', value: entry.priority ?? 'Not set' },
    { label: 'Request retry', value: entry['request-retry'] ?? 'Inherited' },
    { label: 'Cooling disabled', value: entry['disable-cooling'] ? 'Yes' : 'No' },
    ...(supportsWebsockets.value ? [{ label: 'WebSockets', value: entry.websockets ? 'Enabled' : 'Disabled' }] : [])
  ]
})

function openProviderCreate() {

  providerEditorMode.value = 'create'
  editingProviderEntry.value = null
  editingProviderIndex.value = -1
  loadGuidedEntry(selectedProvider.value.template)
  editorError.value = ''
  providerEditorOpen.value = true
}

function openProviderDetail(entry) {
  editingProviderEntry.value = entry
  providerEditorMode.value = 'detail'
  providerEditorOpen.value = true
}

function openProviderEdit(entry) {
  providerEditorMode.value = 'edit'
  editingProviderEntry.value = entry
  editingProviderIndex.value = providerEntries.value.indexOf(entry)
  loadGuidedEntry(entry)
  editorError.value = ''
  providerEditorOpen.value = true
}

function duplicateProvider(entry) {
  providerEditorMode.value = 'create'
  editingProviderEntry.value = null
  editingProviderIndex.value = -1
  const copy = JSON.parse(JSON.stringify(entry))
  delete copy.id
  delete copy.uuid
  delete copy.auth_index
  delete copy.disabled
  if (isCompat.value) {
    copy.name = ''
    copy['api-key-entries'] = (copy['api-key-entries'] || []).map(key => ({ 'api-key': '', 'proxy-url': key['proxy-url'] || '' }))
  } else copy['api-key'] = ''
  loadGuidedEntry(copy)
  editorError.value = ''
  providerEditorOpen.value = true
}

async function discoverModels() {
  discoveryError.value = ''
  discoveredModels.value = []
  selectedDiscovered.value = []
  const authIndex = discoveryAuthIndex.value
  if (!authIndex) { discoveryError.value = 'Save a provider credential before discovery.'; return }
  let url
  try {
    url = new URL(discoveryURL.value.trim() || defaultDiscoveryURL.value)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) throw new Error()
  } catch {
    discoveryError.value = 'Enter a full HTTP or HTTPS URL without embedded credentials or a fragment.'
    return
  }
  const route = selectedProviderRoute.value
  const header = { Accept: 'application/json' }
  if (['gemini-api-key', 'interactions-api-key', 'vertex-api-key'].includes(route)) header['x-goog-api-key'] = '$TOKEN$'
  else if (route === 'claude-api-key') { header['x-api-key'] = '$TOKEN$'; header['anthropic-version'] = '2023-06-01' }
  else header.Authorization = 'Bearer $TOKEN$'
  const generation = ++discoveryGeneration
  discovering.value = true
  try {
    const seen = new Set()
    const models = []
    let pageToken = ''
    for (let page = 0; page < (['gemini-api-key', 'interactions-api-key'].includes(route) ? 20 : 1); page++) {
      const pageURL = new URL(url)
      if (pageToken) pageURL.searchParams.set('pageToken', pageToken)
      const response = await fetchAPI('/api-call', { method: 'POST', body: { auth_index: authIndex, method: 'GET', url: pageURL.href, header, data: '' } })
      if (generation !== discoveryGeneration || !providerEditorOpen.value) return
      if (response?.status_code < 200 || response?.status_code >= 300) {
        discoveryError.value = `Upstream returned HTTP ${response?.status_code || 'error'}.`
        return
      }
      let payload
      try { payload = JSON.parse(response.body) } catch { discoveryError.value = 'Upstream did not return JSON.'; return }
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : payload?.models
      if (!Array.isArray(list)) { discoveryError.value = 'Expected a data or models array in the upstream response.'; return }
      for (const item of list) {
        const name = typeof item === 'string' ? item : item && typeof item === 'object' ? (item.id || item.name || item.model || item.value) : ''
        const normalized = typeof name === 'string' ? (['gemini-api-key', 'interactions-api-key'].includes(route) ? name.replace(/^\/?models\//i, '') : name).trim() : ''
        if (!normalized || seen.has(normalized.toLowerCase())) continue
        seen.add(normalized.toLowerCase())
        models.push({ name: normalized })
      }
      pageToken = typeof payload?.nextPageToken === 'string' ? payload.nextPageToken : ''
      if (!pageToken) break
    }
    discoveredModels.value = models
    if (!models.length) discoveryError.value = 'No model IDs found in the upstream response.'
  } catch {
    if (generation === discoveryGeneration) discoveryError.value = 'The request failed. Check the endpoint and saved credential.'
  } finally {
    if (generation === discoveryGeneration) discovering.value = false
  }
}

function clearDiscoveryResults() {
  discoveryGeneration++
  discovering.value = false
  discoveredModels.value = []
  selectedDiscovered.value = []
  discoveryError.value = ''
}

function toggleDiscoveredModel(name, checked) {
  selectedDiscovered.value = checked
    ? [...selectedDiscovered.value, name]
    : selectedDiscovered.value.filter(item => item !== name)
}

function applyDiscoveredModels() {
  const existing = new Set(providerForm.value.models.map(model => String(model.name || '').trim().toLowerCase()))
  for (const model of discoveredModels.value) {
    if (!selectedDiscovered.value.includes(model.name) || existing.has(model.name.toLowerCase())) continue
    providerForm.value.models.push({ name: model.name, alias: '' })
    existing.add(model.name.toLowerCase())
  }
  selectedDiscovered.value = []
  discoveredModels.value = []
}

function addProviderModel() { providerForm.value.models.push({ name: '', alias: '', 'display-name': '', 'force-mapping': false }) }
function removeProviderModel(index) { providerForm.value.models.splice(index, 1) }

function loadGuidedEntry(entry) {
  clearDiscoveryResults()
  discoveryURL.value = ''
  providerForm.value = JSON.parse(JSON.stringify(entry))
  if (providerEditorMode.value === 'edit') {
    if (isCompat.value) providerForm.value['api-key-entries'] = (providerForm.value['api-key-entries'] || []).map(key => ({ ...key, 'api-key': '' }))
    else providerForm.value['api-key'] = ''
  }
  if (!Array.isArray(providerForm.value.models)) providerForm.value.models = []
  if (isCompat.value && !Array.isArray(providerForm.value['api-key-entries'])) providerForm.value['api-key-entries'] = []
  providerForm.value.models = providerForm.value.models.map(model => ({ ...model, 'display-name': model['display-name'] || '', 'force-mapping': Boolean(model['force-mapping']) }))
  excludedModelsText.value = Array.isArray(entry['excluded-models']) ? entry['excluded-models'].join('\n') : ''
  requestRetryText.value = entry['request-retry'] == null ? '' : String(entry['request-retry'])
  coolingPolicy.value = entry['disable-cooling'] == null ? 'inherit' : entry['disable-cooling'] ? 'disabled' : 'enabled'
  headersJSON.value = JSON.stringify(entry.headers || {}, null, 2)
  const cloak = entry.cloak && typeof entry.cloak === 'object' && !Array.isArray(entry.cloak) ? entry.cloak : null
  cloakEnabled.value = cloak !== null
  cloakMode.value = cloak?.mode || 'auto'
  cloakStrictMode.value = cloak?.['strict-mode'] === true
  cloakSensitiveWordsText.value = Array.isArray(cloak?.['sensitive-words']) ? cloak['sensitive-words'].join('\n') : ''
  cloakCacheUserID.value = cloak?.['cache-user-id'] == null ? 'inherit' : cloak['cache-user-id'] ? 'enabled' : 'disabled'
  providerJSON.value = JSON.stringify(withoutCredentials(entry), null, 2)
  editorView.value = 'guided'
}

function parseProviderJSON() {
  let value
  try {
    value = JSON.parse(providerJSON.value)
  } catch {
    editorError.value = 'Invalid JSON. Check the syntax before continuing.'
    return null
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    editorError.value = 'The provider entry must be one JSON object.'
    return null
  }
  return value
}

function validHeaders(headers) {
  return headers && !Array.isArray(headers) && typeof headers === 'object' && Object.values(headers).every(item => typeof item === 'string')
}

function rawHeaders(value) {
  if (!Object.hasOwn(value, 'headers')) return providerForm.value.headers || {}
  if (!validHeaders(value.headers)) {
    editorError.value = 'Headers must be a JSON object with string values.'
    return null
  }
  return value.headers
}

function guidedEntry() {
  const value = JSON.parse(JSON.stringify(providerForm.value))
  const priority = Number(value.priority)
  if (value.priority !== undefined && (String(value.priority).trim() === '' || !Number.isSafeInteger(priority))) {
    editorError.value = 'Priority must be a whole number.'
    return null
  }
  if (value.priority !== undefined) value.priority = priority
  const retry = requestRetryText.value.trim()
  if (retry && (!/^\d+$/.test(retry) || !Number.isSafeInteger(Number(retry)))) { editorError.value = 'Request retry must be a non-negative whole number.'; return null }
  if (retry) value['request-retry'] = Number(retry)
  else if (providerEditorMode.value === 'edit') value['request-retry'] = null
  else delete value['request-retry']
  if (coolingPolicy.value === 'inherit') {
    if (providerEditorMode.value === 'edit') value['disable-cooling'] = null
    else delete value['disable-cooling']
  } else value['disable-cooling'] = coolingPolicy.value === 'disabled'
  value.models = value.models.map(model => { const result = { ...model }; if (!String(result['display-name'] || '').trim()) delete result['display-name']; else result['display-name'] = result['display-name'].trim(); if (!result['force-mapping']) delete result['force-mapping']; return result })
  try {
    const headers = JSON.parse(headersJSON.value)
    if (!validHeaders(headers)) throw new Error()
    value.headers = headers
  } catch {
    editorError.value = 'Headers must be a JSON object with string values.'
    return null
  }
  if (selectedProviderRoute.value === 'claude-api-key') {
    if (cloakEnabled.value) {
      if (!cloakModeOptions.some(option => option.value === cloakMode.value)) {
        editorError.value = 'Select a valid cloaking mode.'
        return null
      }
      const cloak = value.cloak && typeof value.cloak === 'object' && !Array.isArray(value.cloak) ? value.cloak : {}
      value.cloak = { ...cloak, mode: cloakMode.value, 'strict-mode': cloakStrictMode.value, 'sensitive-words': cloakSensitiveWordsText.value.split('\n').map(word => word.trim()).filter(Boolean) }
      if (cloakCacheUserID.value === 'inherit') delete value.cloak['cache-user-id']
      else value.cloak['cache-user-id'] = cloakCacheUserID.value === 'enabled'
    } else delete value.cloak
  }
  if (!isCompat.value) value['excluded-models'] = excludedModelsText.value.split('\n').map(item => item.trim()).filter(Boolean)
  if (isCompat.value && !String(value.name || '').trim()) {
    editorError.value = 'Provider name is required.'
    return null
  }
  if (requiresBaseURL.value && !String(value['base-url'] || '').trim()) {
    editorError.value = 'Base URL is required for this provider.'
    return null
  }
  if (providerEditorMode.value === 'create' && !isCompat.value && !String(value['api-key'] || '').trim() && !String(value['base-url'] || '').trim()) {
    editorError.value = 'Enter an API key or a base URL.'
    return null
  }
  if (value.models.some(model => !model || typeof model !== 'object' || !String(model.name || '').trim())) {
    editorError.value = 'Every model needs an upstream name.'
    return null
  }
  if (isCompat.value && value['api-key-entries'].some(key => !key || typeof key !== 'object' || (!String(key['api-key'] || '').trim() && !(key.id && editingProviderEntry.value?.['api-key-entries']?.some(saved => saved.id === key.id))))) {
    editorError.value = 'Every API key entry needs a key.'
    return null
  }
  return value
}

function switchEditorView(view) {
  if (view === editorView.value) return
  editorError.value = ''
  if (view === 'json') {
    const value = guidedEntry()
    if (!value) return
    providerForm.value = { ...providerForm.value, headers: value.headers }
    providerJSON.value = JSON.stringify(withoutCredentials(value), null, 2)
  } else {
    const value = parseProviderJSON()
    if (!value) return
    const headers = rawHeaders(value)
    if (!headers) return
    const credentials = providerForm.value
    const savedDiscoveryURL = discoveryURL.value
    loadGuidedEntry(value)
    discoveryURL.value = savedDiscoveryURL
    if (isCompat.value) providerForm.value['api-key-entries'] = credentials['api-key-entries'] || []
    else providerForm.value['api-key'] = credentials['api-key'] || ''
    providerForm.value.headers = headers
    headersJSON.value = JSON.stringify(headers, null, 2)
  }
  editorView.value = view
}

function formatProviderJSON() {
  try {
    providerJSON.value = JSON.stringify(JSON.parse(providerJSON.value), null, 2)
    editorError.value = ''
  } catch {
    editorError.value = 'Invalid JSON. Check the syntax before continuing.'
  }
}

async function saveProviderEntry() {
  editorError.value = ''
  const value = editorView.value === 'json' ? parseProviderJSON() : guidedEntry()
  if (!value) return
  if (editorView.value === 'json') {
    if (isCompat.value) value['api-key-entries'] = providerForm.value['api-key-entries'] || []
    else value['api-key'] = providerForm.value['api-key'] || ''
    const headers = rawHeaders(value)
    if (!headers) return
    value.headers = headers
  }
  if (isCompat.value && !String(value.name || '').trim()) {
    editorError.value = 'Provider name is required.'
    return
  }
  if (isCompat.value && (!Array.isArray(value['api-key-entries']) || value['api-key-entries'].some(key => !key || (!String(key['api-key'] || '').trim() && !(providerEditorMode.value === 'edit' && key.id && editingProviderEntry.value?.['api-key-entries']?.some(saved => saved.id === key.id)))))) {
    editorError.value = 'Every API key entry needs a key.'
    return
  }
  if (providerEditorMode.value === 'edit') {
    delete value.disabled
    if (isCompat.value) {
      value['api-key-entries'] = (value['api-key-entries'] || []).map(key => ({ ...key, 'api-key': key['api-key'] || editingProviderEntry.value['api-key-entries']?.find(saved => saved.id === key.id)?.['api-key'] || '' }))
    } else value['api-key'] = value['api-key'] || editingProviderEntry.value['api-key'] || ''
  }

  savingProvider.value = true
  try {
    if (providerEditorMode.value === 'create') {
      await fetchAPI(`/${selectedProviderRoute.value}`, {
        method: 'PUT',
        body: [...providerEntries.value, value]
      })
    } else {
      await fetchAPI(`/${selectedProviderRoute.value}`, {
        method: 'PATCH',
        body: providerPatchBody(editingProviderEntry.value, editingProviderIndex.value, value)
      })
    }
    providerEditorOpen.value = false
    await refreshWorkspace()
    void refreshCategoryStats()
    emit('changed')
    toast.add({ title: providerEditorMode.value === 'create' ? 'Provider entry created' : 'Provider entry updated', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error) {
    editorError.value = 'Could not save the provider entry. Check the fields and try again.'
  } finally {
    savingProvider.value = false
  }
}

function confirmProviderDelete(entry) {

  deleteTarget.value = entry
  deleteTargetIndex.value = providerEntries.value.indexOf(entry)
  deleteOpen.value = true
}

async function performDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const params = providerDeleteQuery(deleteTarget.value, deleteTargetIndex.value)
    await fetchAPI(`/${selectedProviderRoute.value}?${params}`, { method: 'DELETE' })
    deleteOpen.value = false
    await refreshWorkspace()
    void refreshCategoryStats()
    emit('changed')
    toast.add({ title: 'Provider entry deleted', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error) {
    toast.add({ title: 'Delete failed', description: 'Could not delete the provider entry.', color: 'error' })
  } finally {
    deleting.value = false
  }
}


function withoutCredentials(entry) {
  const copy = JSON.parse(JSON.stringify(entry))
  delete copy['api-key']
  delete copy['api-key-entries']
  delete copy.headers
  return copy
}

function providerPatchBody(entry, index, value) {
  if (entry?.id) return { id: entry.id, value }
  if (entry?.uuid) return { uuid: entry.uuid, value }
  if (selectedProviderRoute.value === 'openai-compatibility' && entry?.name) return { name: entry.name, value }
  return { index, value }
}

function providerDeleteQuery(entry, index) {
  if (entry?.id) return `id=${encodeURIComponent(entry.id)}`
  if (entry?.uuid) return `uuid=${encodeURIComponent(entry.uuid)}`
  if (entry?.auth_index) return `auth_index=${encodeURIComponent(entry.auth_index)}`
  if (selectedProviderRoute.value === 'openai-compatibility' && entry?.name) return `name=${encodeURIComponent(entry.name)}`
  return `index=${encodeURIComponent(index)}`
}

function providerEntryLabel(entry) {
  return entry?.name || entry?.identifier || entry?.auth_index || entry?.id || `${selectedProvider.value.label} entry`
}

function safeEndpoint(value) {
  if (!value) return 'Default endpoint'
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`
  } catch {
    return 'Custom endpoint'
  }
}


</script>
