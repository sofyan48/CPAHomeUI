<template>
  <div class="space-y-7">
    <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <UBadge color="primary" variant="subtle">Model catalog</UBadge>
        <h1 class="mt-3 text-4xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">Find the right model</h1>
        <p class="mt-2 max-w-2xl text-[var(--ui-text-muted)]">Browse the complete public catalog. Sign in to see which models your API keys can use, plus pricing and observed availability.</p>
      </div>
      <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="loading || capabilityLoading" @click="refreshCatalog">Refresh</UButton>
    </section>

    <UAlert v-if="capabilityError && !catalogEnabled" color="error" variant="subtle" title="Unable to check model catalog support" :description="capabilityError" />
    <UAlert v-else-if="!capabilityLoading && !catalogEnabled" color="warning" variant="subtle" title="Model catalog unavailable" description="This Home server does not advertise the model_catalog capability." />

    <template v-if="catalogEnabled">
      <UAlert v-if="error" color="error" variant="subtle" title="Unable to load models" :description="error" />
      <UAlert v-if="accessibleWarning" color="warning" variant="subtle" title="Your key access could not be loaded" :description="accessibleWarning" />

      <div v-if="token && accessLoaded && access" class="text-sm text-[var(--ui-text-muted)]">
        {{ access.reason === 'no_api_keys' ? 'No API keys yet — create one to access models.' : access.restricted ? `Access limited to your model groups (${access.api_key_count} keys).` : `All served models accessible (${access.api_key_count} keys).` }}
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UInput v-model="search" aria-label="Search models" icon="i-heroicons-magnifying-glass" placeholder="Search models, providers, or capabilities..." />
        <USelectMenu :model-value="provider || noFilterValue" @update:model-value="provider = $event === noFilterValue ? '' : String($event)" aria-label="Provider" :items="providerOptions" value-key="value" label-key="label" :search-input="{ placeholder: 'Search providers...' }" />
        <USelect :model-value="inputModality || noFilterValue" @update:model-value="inputModality = $event === noFilterValue ? '' : String($event)" aria-label="Input modality" :items="modalityOptions" value-key="value" label-key="label" />
        <USelect v-model="sortBy" aria-label="Sort models" :items="sortOptions" value-key="value" label-key="label" />
        <div v-if="token" class="flex items-center rounded-lg border border-[var(--ui-border)] px-3 py-2">
          <UCheckbox v-model="mineOnly" label="My keys only" :disabled="!accessLoaded" />
        </div>
      </div>

      <fieldset class="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-[var(--ui-border)] px-4 py-3">
        <legend class="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-dimmed)]">Required capabilities</legend>
        <UCheckbox :model-value="selectedCapabilities.includes('tools')" label="Tools" @update:model-value="setCapability('tools', Boolean($event))" />
        <UCheckbox :model-value="selectedCapabilities.includes('structuredOutput')" label="Structured output" @update:model-value="setCapability('structuredOutput', Boolean($event))" />
        <UCheckbox :model-value="selectedCapabilities.includes('reasoning')" label="Reasoning" @update:model-value="setCapability('reasoning', Boolean($event))" />
      </fieldset>

      <p class="text-xs text-[var(--ui-text-muted)]">{{ filteredModels.length }} of {{ models.length }} models · Unknown modalities and capabilities do not match support filters. Availability is observed cluster-wide, not a guarantee.</p>

      <div v-if="loading && !models.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="index in 6" :key="index" class="h-72 rounded-xl" />
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UCard v-for="model in filteredModels" :key="model.id" class="flex flex-col">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0"><p class="truncate text-lg font-semibold text-[var(--ui-text-highlighted)]">{{ model.display_name || model.id }}</p><code class="text-xs text-[var(--ui-text-muted)]">{{ model.id }}</code></div>
            <div class="flex shrink-0 flex-col items-end gap-1.5">
              <UBadge v-if="model.accessible === true" color="success" variant="subtle">Your keys</UBadge>
              <UBadge v-else-if="model.accessible === false" color="neutral" variant="subtle">Outside your keys</UBadge>
              <UBadge v-if="model.availability" :color="availabilityColor(model)" variant="subtle">{{ availabilityLabel(model) }}</UBadge>
            </div>
          </div>
          <p class="mt-4 line-clamp-3 min-h-15 text-sm leading-5 text-[var(--ui-text-muted)]">{{ model.description || 'No description has been published for this model.' }}</p>
          <div class="mt-4 flex flex-wrap gap-1.5">
            <UBadge v-for="name in model.providers || []" :key="name" color="neutral" variant="subtle">{{ name }}</UBadge>
            <UBadge v-for="name in capabilityLabels(model)" :key="name" color="info" variant="subtle">{{ name }}</UBadge>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--ui-border)] pt-4 text-sm">
            <div><p class="text-xs text-[var(--ui-text-muted)]">Context</p><p class="mt-1 font-medium">{{ formatTokens(model.context_length) }}</p></div>
            <div><p class="text-xs text-[var(--ui-text-muted)]">Output</p><p class="mt-1 font-medium">{{ formatTokens(model.max_output_tokens) }}</p></div>
          </div>
          <div v-if="model.pricing?.status === 'published'" class="mt-4 rounded-xl bg-[var(--ui-bg-muted)] p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-dimmed)]">Lowest listed price / 1M tokens</p>
            <p class="mt-1 text-sm font-medium">Input {{ credits(lowestPrice(model, 'input')) }} · Output {{ credits(lowestPrice(model, 'output')) }} credits</p>
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">Lowest listed rates; provider, tier, and input size affect charges.</p>
          </div>
          <UButton class="mt-4" color="neutral" variant="outline" size="sm" :aria-label="`View details for ${model.display_name || model.id}`" @click="openDetails(model, $event)">View details</UButton>
        </UCard>
      </div>
      <div v-if="!loading && !error && !filteredModels.length" class="rounded-2xl border border-dashed border-[var(--ui-border)] py-16 text-center text-sm text-[var(--ui-text-muted)]">{{ models.length ? 'No models match your filters.' : 'No models are currently served.' }}</div>
    </template>

    <div v-else-if="capabilityLoading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="index in 6" :key="index" class="h-72 rounded-xl" />
    </div>

    <UModal v-model:open="detailOpen" :title="selectedModel?.display_name || selectedModel?.id || 'Model details'" :description="selectedModel?.id">
      <template #body>
        <div v-if="selectedModel" class="max-h-[70vh] space-y-6 overflow-y-auto text-sm">
          <p class="text-[var(--ui-text-muted)]">{{ selectedModel.description || 'No description has been published.' }}</p>
          <dl class="grid gap-3 sm:grid-cols-2">
            <div v-for="item in modelFacts(selectedModel)" :key="item.label"><dt class="text-xs text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="break-words font-medium">{{ item.value }}</dd></div>
          </dl>
          <section><h3 class="font-semibold">Serving providers</h3><p class="mt-1">{{ selectedModel.providers?.length ? selectedModel.providers.join(', ') : 'Not published' }}</p></section>
          <section><h3 class="font-semibold">Modalities</h3><p class="mt-1">Input: {{ modalityText(selectedModel, 'input') }}</p><p>Output: {{ modalityText(selectedModel, 'output') }}</p></section>
          <section class="space-y-1"><h3 class="font-semibold">Capabilities</h3>
            <p>Reasoning: {{ capabilityText(selectedModel.capabilities?.reasoning?.status) }}</p>
            <p v-if="selectedModel.capabilities?.reasoning?.levels?.length">Levels: {{ selectedModel.capabilities.reasoning.levels.join(', ') }}</p>
            <p v-if="selectedModel.capabilities?.reasoning?.budget && Object.keys(selectedModel.capabilities.reasoning.budget).length">Thinking budget: {{ budgetText(selectedModel.capabilities.reasoning.budget) }}</p>
            <p>Tool calling: {{ capabilityText(selectedModel.capabilities?.tool_calling?.status) }}</p>
            <p>Structured output: {{ capabilityText(selectedModel.capabilities?.structured_output?.status) }}</p>
            <p>Parameters: {{ selectedModel.capabilities?.parameters?.length ? selectedModel.capabilities.parameters.join(', ') : 'Not published' }}</p>
            <p>Generation methods: {{ selectedModel.capabilities?.generation_methods?.length ? selectedModel.capabilities.generation_methods.join(', ') : 'Not published' }}</p>
          </section>
          <section v-if="selectedModel.availability" class="space-y-1"><h3 class="font-semibold">Observed availability</h3>
            <p>{{ availabilityLabel(selectedModel) }} · {{ selectedModel.availability.sample_count }} samples{{ selectedModel.availability.window ? ` (minimum ${selectedModel.availability.window.min_samples}, ${selectedModel.availability.window.hours}h window)` : '' }}</p>
            <template v-if="selectedModel.availability.status === 'observed'">
              <p>Successes: {{ selectedModel.availability.success_count ?? 'Not published' }} · Failures: {{ selectedModel.availability.failed_count ?? 'Not published' }}</p>
              <p>Average latency: {{ duration(selectedModel.availability.avg_latency_ms) }} · First token: {{ duration(selectedModel.availability.avg_ttft_ms) }}</p>
              <p>Output throughput: {{ selectedModel.availability.output_tokens_per_second == null ? 'Not published' : `${selectedModel.availability.output_tokens_per_second} tokens/s` }}</p>
            </template>
            <p v-if="selectedModel.availability.window">Window: {{ dateText(selectedModel.availability.window.from) }} – {{ dateText(selectedModel.availability.window.to) }}</p>
            <p>Last observed: {{ dateText(selectedModel.availability.last_observed_at) }}</p>
          </section>
          <section v-if="selectedModel.pricing" class="space-y-3"><h3 class="font-semibold">Pricing · credits</h3>
            <p v-if="selectedModel.pricing.status !== 'published'">No price published. This does not mean free.</p>
            <div v-for="offer in selectedModel.pricing.providers || []" :key="offer.provider" class="space-y-3 rounded-xl border border-[var(--ui-border)] p-3">
              <h4 class="font-semibold">{{ offer.provider }}</h4>
              <div v-for="tier in offer.tiers" :key="tier.service_tier" class="space-y-2">
                <p class="font-medium">{{ tier.is_default ? 'Default tier' : `Tier: ${tier.service_tier}` }}</p>
                <div v-for="rung in tier.rungs" :key="rung.min_input_tokens" class="rounded-lg bg-[var(--ui-bg-muted)] p-3">
                  <p class="font-medium">From {{ rung.min_input_tokens.toLocaleString() }} input tokens</p>
                  <dl class="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <div v-for="price in rungPrices(rung)" :key="price.label"><dt class="text-[var(--ui-text-muted)]">{{ price.label }}</dt><dd>{{ credits(price.value) }}</dd></div>
                  </dl>
                </div>
              </div>
            </div>
            <p v-if="selectedModel.pricing.status === 'published'" class="text-xs text-[var(--ui-text-muted)]">Token prices are per 1M tokens; request price is per request. The last threshold reached in the selected tier applies.</p>
          </section>
          <p v-if="!selectedModel.pricing && !selectedModel.availability" class="text-xs text-[var(--ui-text-muted)]">Sign in to see pricing and observed availability for models covered by your keys.</p>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const route = useRoute()
const router = useRouter()
const { token, fetchAPI, capabilities, loadCapabilities } = useUserApi()
type CapabilityFilter = 'tools' | 'structuredOutput' | 'reasoning'
type CatalogModel = Omit<UserModel, 'availability'> & {
  accessible?: boolean
  availability?: NonNullable<UserModel['availability']> & {
    window?: { from: string; to: string; hours: number; min_samples: number }
    success_count?: number
    failed_count?: number
    output_tokens_per_second?: number
    first_observed_at?: string
  }
}
type AccessSummary = { restricted: boolean; api_key_count: number; reason: string }
type Rung = NonNullable<NonNullable<UserModel['pricing']>['providers']>[number]['tiers'][number]['rungs'][number]
const capabilityOrder: CapabilityFilter[] = ['tools', 'structuredOutput', 'reasoning']
const validSorts = new Set(['name', 'price-asc', 'price-desc'])
const queryKeys = ['q', 'provider', 'modality', 'caps', 'mine', 'sort'] as const
const noFilterValue = '__no_filter__'
const publicCatalog = ref<CatalogModel[]>([])
const models = ref<CatalogModel[]>([])
const loading = ref(false)
const capabilityLoading = ref(true)
const error = ref('')
const capabilityError = ref('')
const accessibleWarning = ref('')
const access = ref<AccessSummary | null>(null)
const accessLoaded = ref(false)
const search = ref(validQueryString(route.query.q))
const provider = ref(validQueryString(route.query.provider))
const inputModality = ref(validQueryString(route.query.modality))
const selectedCapabilities = ref<CapabilityFilter[]>(parseCapabilities(route.query.caps))
const mineOnly = ref(route.query.mine === 'true')
const sortBy = ref(validSorts.has(validQueryString(route.query.sort)) ? validQueryString(route.query.sort) : 'name')
const selectedModel = ref<CatalogModel | null>(null)
const detailOpen = ref(false)
const detailTrigger = ref<HTMLElement | null>(null)
let loadGeneration = 0
const catalogEnabled = computed(() => capabilities.value.model_catalog === true)
const sortOptions = [{ label: 'Name A–Z', value: 'name' }, { label: 'Lowest opening price', value: 'price-asc' }, { label: 'Highest opening price', value: 'price-desc' }]
const providerOptions = computed(() => [{ label: 'All providers', value: noFilterValue }, ...Array.from(new Set(models.value.flatMap(model => model.providers || []).filter(Boolean))).sort().map(value => ({ label: value, value }))])
const modalityOptions = computed(() => [{ label: 'Any input modality', value: noFilterValue }, ...Array.from(new Set(models.value.flatMap(model => model.modalities?.input || []).filter(Boolean))).sort().map(value => ({ label: `Accepts ${value}`, value }))])
const filteredModels = computed(() => {
  const query = search.value.trim().toLowerCase()
  return models.value.filter(model =>
    (!mineOnly.value || !accessLoaded.value || model.accessible === true) &&
    (!provider.value || model.providers?.includes(provider.value)) &&
    (!inputModality.value || model.modalities?.status === 'known' && model.modalities.input?.includes(inputModality.value)) &&
    selectedCapabilities.value.every(capability => supportsCapability(model, capability)) &&
    (!query || [model.id, model.display_name, model.description, ...(model.providers || []), ...capabilityLabels(model)].some(value => String(value || '').toLowerCase().includes(query)))
  ).sort((a, b) => {
    const name = (a.display_name || a.id).localeCompare(b.display_name || b.id)
    if (sortBy.value === 'name') return name
    const aPrice = openingPrice(a)
    const bPrice = openingPrice(b)
    if (aPrice == null && bPrice == null) return name
    if (aPrice == null) return 1
    if (bPrice == null) return -1
    return (sortBy.value === 'price-desc' ? bPrice - aPrice : aPrice - bPrice) || name
  })
})

watch(token, () => {
  loadGeneration++
  models.value = publicCatalog.value.map(model => ({ ...model }))
  access.value = null
  accessLoaded.value = false
  accessibleWarning.value = ''
  if (!token.value) mineOnly.value = false
  if (catalogEnabled.value) void loadModels()
})
watch(() => route.query, applyRouteQuery)
watch([search, provider, inputModality, selectedCapabilities, mineOnly, sortBy], () => { void syncRouteQuery() }, { deep: true })
watch(detailOpen, open => {
  if (!open && detailTrigger.value) {
    const trigger = detailTrigger.value
    detailTrigger.value = null
    void nextTick(() => trigger.focus())
  }
})

function validQueryString(value: unknown) { return typeof value === 'string' && value.length <= 200 ? value : '' }
function parseCapabilities(value: unknown) {
  if (typeof value !== 'string') return []
  const requested = new Set(value.split(','))
  return capabilityOrder.filter(capability => requested.has(capability))
}
function applyRouteQuery() {
  const nextSearch = validQueryString(route.query.q)
  const nextProvider = validQueryString(route.query.provider)
  const nextModality = validQueryString(route.query.modality)
  const nextCapabilities = parseCapabilities(route.query.caps)
  const nextSort = validQueryString(route.query.sort)
  search.value = nextSearch
  provider.value = nextProvider
  inputModality.value = nextModality
  selectedCapabilities.value = nextCapabilities
  mineOnly.value = Boolean(token.value) && route.query.mine === 'true'
  sortBy.value = validSorts.has(nextSort) ? nextSort : 'name'
}
async function syncRouteQuery() {
  const query = { ...route.query }
  for (const key of queryKeys) delete query[key]
  if (search.value) query.q = search.value
  if (provider.value) query.provider = provider.value
  if (inputModality.value) query.modality = inputModality.value
  if (selectedCapabilities.value.length) query.caps = capabilityOrder.filter(item => selectedCapabilities.value.includes(item)).join(',')
  if (token.value && mineOnly.value) query.mine = 'true'
  if (sortBy.value !== 'name') query.sort = sortBy.value
  const unchanged = queryKeys.every(key => normalizedQueryValue(route.query[key]) === normalizedQueryValue(query[key]))
  if (!unchanged) await router.replace({ query })
}
function normalizedQueryValue(value: unknown) { return typeof value === 'string' ? value : '' }
function validateCatalogFilters() {
  const providers = new Set(models.value.flatMap(model => model.providers || []))
  const modalities = new Set(models.value.flatMap(model => model.modalities?.input || []))
  if (provider.value && !providers.has(provider.value)) provider.value = ''
  if (inputModality.value && !modalities.has(inputModality.value)) inputModality.value = ''
}
function setCapability(capability: CapabilityFilter, enabled: boolean) {
  const selected = new Set(selectedCapabilities.value)
  if (enabled) selected.add(capability)
  else selected.delete(capability)
  selectedCapabilities.value = capabilityOrder.filter(item => selected.has(item))
}
function supportsCapability(model: CatalogModel, capability: CapabilityFilter) {
  if (capability === 'tools') return model.capabilities?.tool_calling?.status === 'supported'
  if (capability === 'structuredOutput') return model.capabilities?.structured_output?.status === 'supported'
  return model.capabilities?.reasoning?.status === 'supported'
}
async function refreshCatalog() {
  capabilityLoading.value = true
  capabilityError.value = ''
  try {
    await loadCapabilities()
  } catch (cause: any) {
    capabilityError.value = cause?.message || 'Unable to load server capabilities.'
  } finally {
    capabilityLoading.value = false
  }
  if (!catalogEnabled.value) {
    loadGeneration++
    publicCatalog.value = []
    models.value = []
    return
  }
  await loadModels()
}
async function loadModels() {
  const generation = ++loadGeneration
  const tokenSnapshot = token.value
  loading.value = true
  error.value = ''
  accessibleWarning.value = ''
  const publicRequest = fetchAPI<{ models?: CatalogModel[] }>('/models', { auth: false })
  const accessibleRequest = tokenSnapshot
    ? fetchAPI<{ models?: CatalogModel[]; access?: AccessSummary }>('/models/accessible', { auth: true })
    : Promise.resolve(null)
  const [publicResult, accessibleResult] = await Promise.allSettled([publicRequest, accessibleRequest])
  if (generation !== loadGeneration) return
  try {
    if (publicResult.status === 'rejected') {
      error.value = errorMessage(publicResult.reason, 'Unable to load models.')
      return
    }
    const publicModels = Array.isArray(publicResult.value.models) ? publicResult.value.models : []
    publicCatalog.value = publicModels.map(model => ({ ...model }))
    if (!tokenSnapshot) {
      models.value = publicCatalog.value.map(model => ({ ...model }))
      access.value = null
      accessLoaded.value = false
    } else if (accessibleResult.status === 'fulfilled' && accessibleResult.value) {
      const accessibleModels = Array.isArray(accessibleResult.value.models) ? accessibleResult.value.models : []
      const merged = new Map(publicCatalog.value.map(model => [model.id, { ...model, accessible: false } as CatalogModel]))
      for (const model of accessibleModels) merged.set(model.id, { ...(merged.get(model.id) || {}), ...model, accessible: true })
      models.value = Array.from(merged.values())
      access.value = accessibleResult.value.access || null
      accessLoaded.value = true
    } else {
      models.value = publicCatalog.value.map(model => ({ ...model }))
      access.value = null
      accessLoaded.value = false
      const warning = accessibleResult.status === 'rejected' ? errorMessage(accessibleResult.reason, 'Unable to load your key access.') : 'Unable to load your key access.'
      accessibleWarning.value = `${warning} The public catalog is still available.`
    }
    validateCatalogFilters()
    if (selectedModel.value) selectedModel.value = models.value.find(model => model.id === selectedModel.value?.id) || selectedModel.value
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}
function errorMessage(cause: any, fallback: string) { return cause?.message || fallback }
function openDetails(model: CatalogModel, event: MouseEvent) {
  detailTrigger.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  selectedModel.value = model
  detailOpen.value = true
}
function capabilityLabels(model: UserModel) {
  const labels: string[] = []
  if (model.capabilities?.reasoning?.status === 'supported') labels.push('Reasoning')
  if (model.capabilities?.tool_calling?.status === 'supported') labels.push('Tools')
  if (model.capabilities?.structured_output?.status === 'supported') labels.push('Structured output')
  for (const modality of model.modalities?.input || []) if (modality !== 'text') labels.push(modality)
  return labels
}
function formatTokens(value?: number) { if (!value) return 'Not published'; return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value) }
function availabilityColor(model: CatalogModel) { const rate = model.availability?.availability_rate; return typeof rate !== 'number' ? 'neutral' : rate >= 0.98 ? 'success' : rate >= 0.9 ? 'warning' : 'error' }
function availabilityLabel(model: CatalogModel) { const rate = model.availability?.availability_rate; return model.availability?.status === 'observed' && typeof rate === 'number' ? `${(rate * 100).toFixed(1)}% observed` : 'Insufficient data' }
function lowestPrice(model: UserModel, kind: 'input' | 'output') {
  if (model.pricing?.status !== 'published') return null
  const values = (model.pricing.providers || []).flatMap(item => item.tiers.flatMap(tier => tier.rungs.map(rung => kind === 'input' ? rung.input_price_per_million : rung.output_price_per_million))).filter(Number.isFinite)
  return values.length ? Math.min(...values) : null
}
function openingPrice(model: UserModel) {
  if (model.pricing?.status !== 'published') return null
  const values = (model.pricing.providers || []).flatMap(provider => provider.tiers.flatMap(tier => {
    const openingRung = [...tier.rungs].sort((a, b) => a.min_input_tokens - b.min_input_tokens)[0]
    return openingRung && Number.isFinite(openingRung.input_price_per_million) ? [openingRung.input_price_per_million] : []
  }))
  return values.length ? Math.min(...values) : null
}
function credits(value: number | null) { return value == null ? 'Not published' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value) }
function modalityText(model: UserModel, direction: 'input' | 'output') { return model.modalities?.status === 'known' && model.modalities[direction]?.length ? model.modalities[direction].join(', ') : 'Not published' }
function capabilityText(status?: string) { return status === 'supported' ? 'Supported' : status === 'unsupported' ? 'Unsupported' : 'Not published' }
function budgetText(budget: Record<string, unknown>) { return Object.entries(budget).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ') }
function duration(ms?: number) { return ms == null ? 'Not published' : `${ms.toLocaleString()} ms` }
function dateText(value?: string) { return value ? new Date(value).toLocaleString() : 'Not published' }
function modelFacts(model: UserModel) { return [
  { label: 'Model ID', value: model.id }, { label: 'Context', value: formatTokens(model.context_length) },
  { label: 'Maximum output', value: formatTokens(model.max_output_tokens) }, { label: 'Version', value: model.version || 'Not published' },
  { label: 'Owner', value: model.owned_by || 'Not published' }, { label: 'Type', value: model.type || 'Not published' }
] }
function rungPrices(rung: Rung) { return [
  { label: 'Input / 1M', value: rung.input_price_per_million }, { label: 'Output / 1M', value: rung.output_price_per_million },
  { label: 'Cache read / 1M', value: rung.cache_read_price_per_million }, { label: 'Cache write / 1M', value: rung.cache_write_price_per_million },
  { label: 'Per request', value: rung.request_price }
] }

onMounted(() => {
  void syncRouteQuery()
  void refreshCatalog()
})
</script>
