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

          <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><AdminTableAction action="view" label="View provider" @click="openProviderDetail(rowValue(row))" /><AdminTableAction action="edit" label="Edit provider" @click="openProviderEdit(rowValue(row))" /><AdminTableAction action="duplicate" label="Duplicate provider" @click="duplicateProvider(rowValue(row))" /><AdminTableAction action="delete" label="Delete provider" destructive @click="confirmProviderDelete(rowValue(row))" /></div></template>

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
      :ui="{ content: 'sm:max-w-2xl' }"
      :title="providerEditorMode === 'detail' ? 'Provider details' : providerEditorMode === 'edit' ? `Edit model key · ${selectedProvider.label}` : `New model key · ${selectedProvider.label}`"
      description="Configure model provider credentials and settings."
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
        <form v-else novalidate class="max-h-[75vh] space-y-4 overflow-y-auto pr-1" @submit.prevent="saveProviderEntry">
          <UAlert
            v-if="editorError"
            color="error"
            variant="subtle"
            icon="i-tabler-alert-circle"
            title="Invalid provider entry"
            :description="editorError"
          />


            <div class="grid gap-4">
              <UFormField v-if="isCompat" label="Model provider name" required><UInput v-model="providerForm.name" class="w-full" placeholder="my-upstream" /></UFormField>
              <UFormField label="Model service key" :required="providerEditorMode === 'create'"><UInput v-model="providerKey" type="password" autocomplete="new-password" class="w-full" :placeholder="providerEditorMode === 'edit' ? 'Leave blank to keep the current key' : 'Enter API key'" /></UFormField>
              <UFormField label="Base URL" :required="requiresBaseURL"><UInput v-model="providerForm['base-url']" type="url" class="w-full" placeholder="https://api.example.com" /></UFormField>
              <UFormField v-if="!isCompat" label="Proxy URL"><UInput v-model="providerForm['proxy-url']" type="url" class="w-full" placeholder="http://127.0.0.1:7890" /></UFormField>
              <UFormField label="Model prefix"><UInput v-model="providerForm.prefix" class="w-full" /></UFormField>
              <UFormField label="Priority"><UInput v-model="providerForm.priority" type="number" step="1" class="w-full" /></UFormField>
              <UFormField label="Request retry rounds" hint="Blank inherits global; 0 disables retry rounds"><UInput v-model="requestRetryText" type="number" min="0" step="1" class="w-full" placeholder="Inherit global" /></UFormField>
              <UCheckbox v-model="providerForm['disable-cooling']" label="Disable cooling" />
            </div>
            <UCheckbox v-if="supportsWebsockets" v-model="providerForm.websockets" label="WebSocket support" />
            <UCheckbox v-if="isCompat" v-model="providerForm.disabled" label="Disabled" />
            <details v-if="selectedProviderRoute === 'claude-api-key'" class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
              <summary class="cursor-pointer font-medium">Cloak configuration</summary>
              <div class="mt-3 space-y-3">
                <UFormField label="Cloak mode" hint="Auto cloaks clients other than Claude Code."><USelect v-model="cloakMode" :items="cloakModeOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
                <UCheckbox v-model="cloakStrictMode" label="Strict mode" />
                <UFormField label="Sensitive words" hint="One word per line; obfuscated in system instructions."><UTextarea v-model="cloakSensitiveWordsText" :rows="3" class="w-full" /></UFormField>
                <UFormField label="Cache user ID"><USelect v-model="cloakCacheUserID" :items="cloakCacheOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
              </div>
            </details>

            <details class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
              <summary class="cursor-pointer font-medium">Custom models</summary>
              <div class="mt-3 flex justify-end"><UButton type="button" size="sm" color="neutral" variant="outline" icon="i-tabler-plus" @click="addProviderModel">Add model</UButton></div>

              <div v-if="supportsDiscovery" class="space-y-3 rounded-lg border border-[var(--ui-border)] p-3">
                <p class="text-sm font-medium">Discover models</p>
                <p class="text-xs text-[var(--ui-text-muted)]">Fetch available models from the upstream provider.</p>
                <div class="flex flex-wrap items-center gap-2">
                  <UButton type="button" color="neutral" variant="outline" icon="i-tabler-search" :loading="discovering" :disabled="!discoveryReady" @click="discoverModels">{{ discoveryLoaded ? 'Reload' : 'Discover models' }}</UButton>
                  <span class="text-xs text-[var(--ui-text-muted)]">{{ discoveryAuthLabel }} · {{ requiresBaseURL ? providerForm['base-url']?.trim() ? 'Base URL set' : 'Base URL required' : 'Default Base URL available' }}</span>
                </div>
                <UAlert v-if="discoveryError" color="error" variant="subtle" title="Discovery failed" :description="discoveryError" />
                <div v-if="discoveryVisible" class="space-y-2">
                  <UInput v-model="discoverySearch" icon="i-tabler-search" placeholder="Search models..." class="w-full" />
                  <p v-if="discoveryLoaded && !discoveredModels.length" class="text-xs text-[var(--ui-text-muted)]">No models found.</p>
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm">{{ selectedDiscovered.length }} of {{ discoveredModels.length }} selected</p>
                    <div class="flex gap-2"><UButton type="button" size="sm" color="neutral" variant="ghost" @click="selectAllDiscoveredModels">Select all</UButton><UButton type="button" size="sm" color="neutral" variant="ghost" @click="selectedDiscovered = []">Clear</UButton></div>
                  </div>
                  <div class="max-h-40 space-y-1 overflow-y-auto">
                    <UCheckbox v-for="model in filteredDiscoveredModels" :key="model.name" :model-value="existingModelNames.has(model.name.toLowerCase()) || selectedDiscovered.includes(model.name)" :disabled="existingModelNames.has(model.name.toLowerCase())" :label="existingModelNames.has(model.name.toLowerCase()) ? `${model.name} · Already added` : model.alias ? `${model.name} · ${model.alias}` : model.name" @update:model-value="toggleDiscoveredModel(model.name, $event)" />
                  </div>
                  <div class="flex justify-end gap-2"><UButton type="button" size="sm" color="neutral" variant="ghost" @click="discoveryVisible = false">Close</UButton><UButton type="button" size="sm" color="primary" :disabled="!selectedDiscovered.length" @click="applyDiscoveredModels">Apply</UButton></div>
                </div>
              </div>
              <div v-for="(model, index) in providerForm.models" :key="index" class="space-y-2 rounded-lg bg-[var(--ui-bg-muted)] p-3">
                <div class="grid gap-2 sm:grid-cols-2"><UFormField label="Model ID"><UInputMenu v-model="model.name" :items="modelSuggestions" create-item class="w-full" placeholder="Search catalog or enter model" @create="model.name = $event.trim()" /></UFormField><UFormField label="Alias"><UInput v-model="model.alias" class="w-full" /></UFormField><UFormField v-if="supportsModelMapping" label="Display name"><UInput v-model="model['display-name']" class="w-full" /></UFormField><div class="flex items-end justify-between gap-2"><UCheckbox v-if="supportsModelMapping" v-model="model['force-mapping']" label="Force response model mapping" /><UButton type="button" color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove model" :disabled="providerForm.models.length <= 1" @click="removeProviderModel(index)" /></div></div>
              </div>
            </details>
            <details class="rounded-lg border border-[var(--ui-border)] p-4"><summary class="cursor-pointer font-medium">Excluded models</summary><UTextarea v-model="excludedModelsText" :rows="3" class="mt-3 w-full" placeholder="Separate model IDs with commas or new lines" /></details>
            <details class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
              <summary class="cursor-pointer font-medium">Request headers</summary>
              <div class="mt-3 space-y-3">
                <div class="flex justify-end"><UButton type="button" size="sm" color="neutral" variant="outline" icon="i-tabler-plus" @click="headerRows.push({ name: '', value: '' })">Add header</UButton></div>
                <div v-for="(header, index) in headerRows" :key="index" class="flex items-end gap-2">
                <UFormField label="Header name" class="flex-1"><UInput v-model="header.name" class="w-full" /></UFormField>
                <UFormField label="Header value" class="flex-1"><UInput v-model="header.value" class="w-full" /></UFormField>
                <UButton type="button" color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove header" :disabled="headerRows.length <= 1" @click="headerRows.splice(index, 1)" />
              </div>
              </div>
            </details>
            <div v-if="supportsTest" class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
              <UFormField label="Test model"><USelect v-model="testModel" :items="testModelOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
              <UButton type="button" color="neutral" variant="outline" :loading="testingConnection" @click="testProviderConnection">Test connectivity</UButton>
              <UAlert v-if="testError" color="error" variant="subtle" title="Connectivity test failed" :description="testError" />
              <UAlert v-if="testSuccess" color="success" variant="subtle" title="Connectivity test succeeded" />
            </div>
          <div class="flex items-center justify-between border-t border-[var(--ui-border)] pt-4">
            <span class="text-xs text-[var(--ui-text-muted)]">Leave the key blank when editing to keep it.</span>
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
const providerForm = ref({})
const excludedModelsText = ref('')
const headerRows = ref([{ name: '', value: '' }])
const providerKey = ref('')
const cloakMode = ref('')
const cloakStrictMode = ref(false)
const cloakSensitiveWordsText = ref('')
const cloakCacheUserID = ref('inherit')
const cloakModeOptions = [{ label: 'Not set', value: '' }, { label: 'Auto', value: 'auto' }, { label: 'Always', value: 'always' }, { label: 'Never', value: 'never' }]
const cloakCacheOptions = [{ label: 'Use default', value: 'inherit' }, { label: 'Cache per API key', value: 'enabled' }, { label: 'Generate for each request', value: 'disabled' }]
const requestRetryText = ref('')

const isCompat = computed(() => selectedProviderRoute.value === 'openai-compatibility')
const supportsWebsockets = computed(() => ['codex-api-key', 'xai-api-key'].includes(selectedProviderRoute.value))
const supportsTest = computed(() => ['claude-api-key', 'openai-compatibility'].includes(selectedProviderRoute.value))
const testModel = ref('')
const testModelOptions = computed(() => [{ label: 'Auto (first custom model)', value: '' }, ...providerForm.value.models.filter(model => String(model.name || '').trim()).map(model => ({ label: model.alias?.trim() ? `${model.name} · ${model.alias}` : model.name, value: model.name }))])
const testError = ref('')
const testSuccess = ref(false)
const testingConnection = ref(false)
const supportsModelMapping = computed(() => ['interactions-api-key', 'codex-api-key'].includes(selectedProviderRoute.value))
const requiresBaseURL = computed(() => ['codex-api-key', 'xai-api-key', 'openai-compatibility'].includes(selectedProviderRoute.value))
const supportsDiscovery = computed(() => ['gemini-api-key', 'interactions-api-key', 'claude-api-key', 'codex-api-key', 'openai-compatibility'].includes(selectedProviderRoute.value))
const discoveredModels = ref([])
const discoverySearch = ref('')
const discoveryVisible = ref(false)
const discoveryLoaded = ref(false)
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
const discoveryHeaders = computed(() => Object.fromEntries(headerRows.value.filter(row => row.name.trim()).map(row => [row.name.trim(), row.value])))
const discoveryAuthLabel = computed(() => providerKey.value.trim() ? 'Entered key' : discoveryAuthIndex.value ? 'Saved credential' : hasProviderAuthHeader.value ? 'Authentication header' : 'Authentication required')
const hasProviderAuthHeader = computed(() => Object.entries(discoveryHeaders.value).some(([name, value]) =>
  name.toLowerCase() === (['gemini-api-key', 'interactions-api-key'].includes(selectedProviderRoute.value) ? 'x-goog-api-key' : selectedProviderRoute.value === 'claude-api-key' ? 'x-api-key' : 'authorization') && String(value).trim()))
const discoveryReady = computed(() => (providerKey.value.trim() || discoveryAuthIndex.value || hasProviderAuthHeader.value) && (!requiresBaseURL.value || String(providerForm.value['base-url'] || '').trim()))
const existingModelNames = computed(() => new Set(providerForm.value.models.map(model => String(model.name || '').trim().toLowerCase()).filter(Boolean)))
const filteredDiscoveredModels = computed(() => discoveredModels.value.filter(model => `${model.name} ${model.alias || ''} ${model.description || ''}`.toLowerCase().includes(discoverySearch.value.trim().toLowerCase())))
const defaultDiscoveryURL = computed(() => {
  const rawBase = String(providerForm.value['base-url'] || '').trim().replace(/\/+$/, '')
  const base = rawBase && !/^https?:\/\//i.test(rawBase) ? `https://${rawBase}` : rawBase
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
  discoveryVisible.value = true
  discoveryError.value = ''
  selectedDiscovered.value = []
  const route = selectedProviderRoute.value
  const key = providerKey.value.trim()
  const authIndex = discoveryAuthIndex.value
  let url
  try {
    url = new URL(defaultDiscoveryURL.value)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) throw new Error()
  } catch {
    discoveryError.value = 'Enter a valid HTTP or HTTPS Base URL without embedded credentials.'
    return
  }
  const header = { ...discoveryHeaders.value }
  const addHeader = (name, value) => {
    if (!Object.keys(header).some(item => item.toLowerCase() === name.toLowerCase()) && value) header[name] = value
  }
  if (['gemini-api-key', 'interactions-api-key'].includes(route)) addHeader('x-goog-api-key', key || (authIndex ? '$TOKEN$' : ''))
  else if (route === 'claude-api-key') {
    addHeader('x-api-key', key || (authIndex ? '$TOKEN$' : ''))
    addHeader('anthropic-version', '2023-06-01')
  } else addHeader('Authorization', key ? `Bearer ${key}` : authIndex ? 'Bearer $TOKEN$' : '')
  const generation = ++discoveryGeneration
  discovering.value = true
  try {
    const seen = new Set()
    const models = []
    let pageToken = ''
    for (let page = 0; page < (['gemini-api-key', 'interactions-api-key'].includes(route) ? 20 : 1); page++) {
      const pageURL = new URL(url)
      if (pageToken) pageURL.searchParams.set('pageToken', pageToken)
      const request = (requestHeader, index) => fetchAPI('/api-call', { method: 'POST', body: { auth_index: index || undefined, method: 'GET', url: pageURL.href, header: requestHeader } })
      let response
      try {
        response = await request(header, authIndex)
        if (!response?.status_code || response.status_code < 200 || response.status_code >= 300) throw new Error(`Upstream returned HTTP ${response?.status_code || 'error'}.`)
      } catch (error) {
        if (route !== 'openai-compatibility' || !(key || authIndex || Object.keys(header).length)) throw error
        response = await request({}, '')
      }
      if (generation !== discoveryGeneration || !providerEditorOpen.value) return
      if (!response?.status_code || response.status_code < 200 || response.status_code >= 300) throw new Error(`Upstream returned HTTP ${response?.status_code || 'error'}.`)
      let payload
      try { payload = JSON.parse(response.body) } catch { throw new Error('Upstream did not return JSON.') }
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : payload?.models
      if (!Array.isArray(list)) throw new Error('Expected a data or models array in the upstream response.')
      for (const item of list) {
        const name = typeof item === 'string' ? item : item && typeof item === 'object' ? (item.id || item.name || item.model || item.value) : ''
        const normalized = typeof name === 'string' ? (['gemini-api-key', 'interactions-api-key'].includes(route) ? name.replace(/^\/?models\//i, '') : name).trim() : ''
        if (!normalized || seen.has(normalized.toLowerCase())) continue
        seen.add(normalized.toLowerCase())
        models.push({ name: normalized, alias: typeof item?.alias === 'string' ? item.alias : '', description: typeof item?.description === 'string' ? item.description : '' })
      }
      pageToken = typeof payload?.nextPageToken === 'string' ? payload.nextPageToken : ''
      if (!pageToken) break
    }
    discoveredModels.value = models
    discoveryLoaded.value = true
  } catch (error) {
    if (generation === discoveryGeneration) discoveryError.value = error?.message || 'Could not discover models.'
  } finally {
    if (generation === discoveryGeneration) discovering.value = false
  }
}

async function testProviderConnection() {
  testError.value = ''
  testSuccess.value = false
  const model = testModel.value.trim() || providerForm.value.models.find(item => String(item.name || '').trim())?.name.trim()
  const authIndex = discoveryAuthIndex.value
  const key = providerKey.value.trim()
  const headers = Object.fromEntries(headerRows.value.filter(row => row.name.trim()).map(row => [row.name.trim(), row.value]))
  const hasAuthHeader = Object.entries(headers).some(([name, value]) =>
    (selectedProviderRoute.value === 'claude-api-key' ? name.toLowerCase() === 'x-api-key' : name.toLowerCase() === 'authorization') && String(value).trim())
  if (!model) { testError.value = 'Select a model to test.'; return }
  if (!key && !authIndex && !hasAuthHeader) { testError.value = 'Enter a model service key or authentication header.'; return }
  const base = String(providerForm.value['base-url'] || '').trim().replace(/\/+$/, '')
  if (isCompat.value && !base) { testError.value = 'Base URL is required.'; return }
  const claude = selectedProviderRoute.value === 'claude-api-key'
  const endpoint = claude
    ? `${(base || 'https://api.anthropic.com').replace(/\/v1\/messages$/i, '').replace(/\/v1(?:\/.*)?$/i, '')}/v1/messages`
    : /\/chat\/completions$/i.test(base) ? base : /\/v1$/i.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`
  try {
    const url = new URL(endpoint)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error()
  } catch { testError.value = 'Enter a valid HTTP or HTTPS Base URL without embedded credentials.'; return }
  const header = { 'Content-Type': 'application/json', ...headers }
  const authHeader = claude ? 'x-api-key' : 'Authorization'
  if (!Object.keys(header).some(name => name.toLowerCase() === authHeader.toLowerCase())) header[authHeader] = key ? claude ? key : `Bearer ${key}` : '$TOKEN$'
  if (claude && !Object.keys(header).some(name => name.toLowerCase() === 'anthropic-version')) header['anthropic-version'] = '2023-06-01'
  const data = claude ? { model, max_tokens: 8, messages: [{ role: 'user', content: 'Hi' }] } : { model, messages: [{ role: 'user', content: 'Hi' }], stream: false, max_tokens: 5 }
  testingConnection.value = true
  try {
    const response = await fetchAPI('/api-call', { method: 'POST', body: { auth_index: authIndex || undefined, method: 'POST', url: endpoint, header, data: JSON.stringify(data) } })
    if (!response?.status_code || response.status_code < 200 || response.status_code >= 300) throw new Error(`Upstream returned HTTP ${response?.status_code || 'error'}.`)
    testSuccess.value = true
  } catch (error) {
    testError.value = error?.message || 'Connection failed.'
  } finally {
    testingConnection.value = false
  }
}

function clearDiscoveryResults() {
  discoveryGeneration++
  discovering.value = false
  discoveredModels.value = []
  selectedDiscovered.value = []
  discoveryError.value = ''
  discoverySearch.value = ''
  discoveryVisible.value = false
  discoveryLoaded.value = false
}

function selectAllDiscoveredModels() {
  selectedDiscovered.value = [...new Set([...selectedDiscovered.value, ...filteredDiscoveredModels.value.filter(model => !existingModelNames.value.has(model.name.toLowerCase())).map(model => model.name)])]
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
    if (providerForm.value.models.length === 1 && !String(providerForm.value.models[0].name || '').trim() && !String(providerForm.value.models[0].alias || '').trim()) providerForm.value.models.splice(0, 1)
    providerForm.value.models.push({ name: model.name, alias: model.alias || '' })
    existing.add(model.name.toLowerCase())
  }
  selectedDiscovered.value = []
}

function addProviderModel() { providerForm.value.models.push({ name: '', alias: '', 'display-name': '', 'force-mapping': false }) }
function removeProviderModel(index) { providerForm.value.models.splice(index, 1) }

function loadGuidedEntry(entry) {
  clearDiscoveryResults()
  providerForm.value = JSON.parse(JSON.stringify(entry))
  if (providerEditorMode.value === 'edit') {
    if (isCompat.value) providerForm.value['api-key-entries'] = (providerForm.value['api-key-entries'] || []).map(key => ({ ...key, 'api-key': '' }))
    else providerForm.value['api-key'] = ''
  }
  if (!Array.isArray(providerForm.value.models)) providerForm.value.models = []
  if (isCompat.value && !Array.isArray(providerForm.value['api-key-entries'])) providerForm.value['api-key-entries'] = []
  providerKey.value = ''
  if (providerEditorMode.value === 'create' && !isCompat.value) providerKey.value = providerForm.value['api-key'] || ''
  if (providerEditorMode.value === 'create' && isCompat.value) providerKey.value = providerForm.value['api-key-entries']?.[0]?.['api-key'] || ''
  if (!providerForm.value.models.length) providerForm.value.models = [{ name: '', alias: '' }]
  if (providerEditorMode.value === 'create') providerForm.value.priority = ''
  providerForm.value.models = providerForm.value.models.map(model => ({ ...model, 'display-name': model['display-name'] || '', 'force-mapping': Boolean(model['force-mapping']) }))
  excludedModelsText.value = Array.isArray(entry['excluded-models']) ? entry['excluded-models'].filter(model => String(model).trim() !== '*').join('\n') : ''
  testModel.value = String(entry['test-model'] || '')
  testError.value = ''
  testSuccess.value = false
  requestRetryText.value = entry['request-retry'] == null ? '' : String(entry['request-retry'])
  providerForm.value['disable-cooling'] = Boolean(entry['disable-cooling'])
  headerRows.value = Object.entries(entry.headers || {}).map(([name, value]) => ({ name, value: typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '' }))
  if (!headerRows.value.length) headerRows.value = [{ name: '', value: '' }]
  const cloak = entry.cloak && typeof entry.cloak === 'object' && !Array.isArray(entry.cloak) ? entry.cloak : null
  cloakMode.value = cloak?.mode || ''
  cloakStrictMode.value = cloak?.['strict-mode'] === true
  cloakSensitiveWordsText.value = Array.isArray(cloak?.['sensitive-words']) ? cloak['sensitive-words'].join('\n') : ''
  cloakCacheUserID.value = cloak?.['cache-user-id'] == null ? 'inherit' : cloak['cache-user-id'] ? 'enabled' : 'disabled'

}


function guidedEntry() {
  const value = JSON.parse(JSON.stringify(providerForm.value))
  const priority = value.priority === '' || value.priority == null ? 0 : Number(value.priority)
  if (!Number.isSafeInteger(priority)) {
    editorError.value = 'Priority must be a whole number.'
    return null
  }
  value.priority = priority
  const retry = requestRetryText.value.trim()
  if (retry && (!/^\d+$/.test(retry) || !Number.isSafeInteger(Number(retry)))) { editorError.value = 'Request retry must be a non-negative whole number.'; return null }
  if (retry) value['request-retry'] = Number(retry)
  else if (providerEditorMode.value === 'edit') value['request-retry'] = null
  else delete value['request-retry']
  value['disable-cooling'] = Boolean(value['disable-cooling'])
  for (const model of value.models) {
    if (!String(model.name || '').trim() && (String(model.alias || '').trim() || String(model['display-name'] || '').trim() || model['force-mapping'])) {
      editorError.value = 'Model ID is required when a model row has other values.'
      return null
    }
  }
  value.models = value.models.filter(model => String(model.name || '').trim()).map(model => {
    const result = { ...model, name: model.name.trim() }
    if (!String(result.alias || '').trim() || result.alias.trim() === result.name) delete result.alias
    else result.alias = result.alias.trim()
    if (!supportsModelMapping.value || !String(result['display-name'] || '').trim()) delete result['display-name']
    else result['display-name'] = result['display-name'].trim()
    if (!supportsModelMapping.value || !result['force-mapping']) delete result['force-mapping']
    return result
  })
  value.headers = {}
  for (const header of headerRows.value) {
    const name = header.name.trim()
    if (!name && header.value.trim()) { editorError.value = 'Header name is required when a value is entered.'; return null }
    if (name) value.headers[name] = header.value
  }
  if (selectedProviderRoute.value === 'claude-api-key') {
    if (cloakMode.value || cloakStrictMode.value || cloakCacheUserID.value !== 'inherit' || cloakSensitiveWordsText.value.trim()) {
      if (!cloakModeOptions.some(option => option.value === cloakMode.value)) {
        editorError.value = 'Select a valid cloaking mode.'
        return null
      }
      const cloak = value.cloak && typeof value.cloak === 'object' && !Array.isArray(value.cloak) ? value.cloak : {}
      value.cloak = { ...cloak, 'strict-mode': cloakStrictMode.value, 'cache-user-id': cloakCacheUserID.value === 'enabled', 'sensitive-words': cloakSensitiveWordsText.value.split(/[,\n]/).map(word => word.trim()).filter(Boolean) }
      if (cloakMode.value) value.cloak.mode = cloakMode.value
      else delete value.cloak.mode
    } else delete value.cloak
  }
  value['excluded-models'] = excludedModelsText.value.split(/[,\n]/).map(item => item.trim()).filter(Boolean)
  value['base-url'] = String(value['base-url'] || '').trim()
  value.prefix = String(value.prefix || '').trim()
  if (!isCompat.value) {
    value['proxy-url'] = String(value['proxy-url'] || '').trim()
    if (value['proxy-url']) {
      try {
        if (!['http:', 'https:', 'socks5:', 'socks5h:'].includes(new URL(value['proxy-url']).protocol)) throw new Error()
      } catch { editorError.value = 'Proxy URL must use http, https, socks5, or socks5h.'; return null }
    }
  }
  if (isCompat.value && !String(value.name || '').trim()) {
    editorError.value = 'Provider name is required.'
    return null
  }
  if (requiresBaseURL.value && !String(value['base-url'] || '').trim()) {
    editorError.value = 'Base URL is required for this provider.'
    return null
  }
  if (providerEditorMode.value === 'create' && !providerKey.value.trim()) {
    editorError.value = 'Model service key is required.'
    return null
  }
  if (isCompat.value) {
    value.name = value.name.trim()
    if (testModel.value.trim()) value['test-model'] = testModel.value.trim()
    else delete value['test-model']
    delete value['proxy-url']
    if (providerKey.value.trim()) value['api-key-entries'] = [{ 'api-key': providerKey.value.trim() }]
    else delete value['api-key-entries']
  } else if (providerKey.value.trim()) value['api-key'] = providerKey.value.trim()
  else delete value['api-key']
  const payload = {
    priority: value.priority,
    headers: value.headers,
    models: value.models,
    'excluded-models': value['excluded-models'],
    'disable-cooling': value['disable-cooling']
  }
  for (const field of ['name', 'base-url', 'proxy-url', 'prefix']) {
    if (value[field]) payload[field] = value[field]
  }
  if (Object.hasOwn(value, 'request-retry')) payload['request-retry'] = value['request-retry']
  if (supportsWebsockets.value) payload.websockets = Boolean(value.websockets)
  if (isCompat.value) {
    payload.disabled = Boolean(value.disabled)
    if (value['test-model']) payload['test-model'] = value['test-model']
    if (value['api-key-entries']) payload['api-key-entries'] = value['api-key-entries']
  } else if (value['api-key']) payload['api-key'] = value['api-key']
  if (selectedProviderRoute.value === 'claude-api-key' && value.cloak) payload.cloak = value.cloak
  return payload
}


async function saveProviderEntry() {
  editorError.value = ''
  const value = guidedEntry()
  if (!value) return
  if (isCompat.value && !String(value.name || '').trim()) {
    editorError.value = 'Provider name is required.'
    return
  }
  if (providerEditorMode.value === 'create' && !providerKey.value.trim()) {
    editorError.value = 'Model service key is required.'
    return
  }
  if (isCompat.value && providerEditorMode.value === 'edit' && !providerKey.value.trim()) delete value['api-key-entries']
  if (providerEditorMode.value === 'edit' && !providerKey.value.trim()) delete value['api-key']

  savingProvider.value = true
  try {
    if (providerEditorMode.value === 'create') {
      const current = await fetchAPI(`/${selectedProviderRoute.value}`)
      await fetchAPI(`/${selectedProviderRoute.value}`, {
        method: 'PUT',
        body: [...entriesFromResponse(current, selectedProvider.value), value]
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
