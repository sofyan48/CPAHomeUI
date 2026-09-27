<template>
  <div class="space-y-7">
    <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-4xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">Find the right model</h1>
        <p class="mt-2 max-w-2xl text-[var(--ui-text-muted)]">Browse models available to your API keys, including pricing and observed availability.</p>
      </div>
      <UButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="loading || capabilityLoading" @click="refreshCatalog">Refresh</UButton>
    </section>

    <UAlert v-if="catalogUnsupported" color="warning" variant="subtle" title="Model catalog unavailable" description="This Home server does not support the public model catalog endpoint." />

    <template v-else>
      <UAlert v-if="capabilityError" color="warning" variant="subtle" title="Unable to check model catalog capabilities" :description="`${capabilityError} The catalog was requested directly instead.`" />
      <UAlert v-if="error" color="error" variant="subtle" title="Unable to load models" :description="error" />
      <UAlert v-if="accessibleWarning" color="warning" variant="subtle" title="Your key access could not be loaded" :description="accessibleWarning" />

      <div v-if="token && accessLoaded && access" class="text-sm text-[var(--ui-text-muted)]">
        {{ access.reason === 'no_api_keys' ? 'No API keys yet — create one to access models.' : access.restricted ? `Access limited to your model groups (${access.api_key_count} keys).` : `All served models accessible (${access.api_key_count} keys).` }}
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UInput v-model="search" aria-label="Search models" icon="i-tabler-search" placeholder="Search models or capabilities..." />
        <USelect :model-value="inputModality || noFilterValue" @update:model-value="inputModality = $event === noFilterValue ? '' : String($event)" aria-label="Input modality" :items="modalityOptions" value-key="value" label-key="label" />
        <USelect v-model="sortBy" aria-label="Sort models" :items="sortOptions" value-key="value" label-key="label" />
      </div>

      <fieldset class="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--ui-border)] px-3 py-2.5">
        <legend class="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-dimmed)]">Required capabilities</legend>
        <UButton v-for="option in capabilityOptions" :key="option.value" type="button" size="xs" :color="selectedCapabilities.includes(option.value) ? 'primary' : 'neutral'" :variant="selectedCapabilities.includes(option.value) ? 'soft' : 'outline'" :icon="selectedCapabilities.includes(option.value) ? 'i-tabler-check' : undefined" :aria-pressed="selectedCapabilities.includes(option.value)" @click="setCapability(option.value, !selectedCapabilities.includes(option.value))">{{ option.label }}</UButton>
      </fieldset>

      <p class="text-xs text-[var(--ui-text-muted)]">{{ filteredModels.length }} of {{ models.length }} models · Unknown modalities and capabilities do not match support filters. Availability is observed cluster-wide, not a guarantee.</p>

      <div v-if="(loading || !catalogReady) && !models.length" class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <USkeleton v-for="index in 12" :key="index" class="h-52 rounded-xl" />
      </div>
      <div v-else class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <AppCard v-for="model in filteredModels" :key="model.id" class="min-w-0" :ui="{ body: 'flex h-full flex-col p-3 sm:p-3' }">
          <div class="flex items-start justify-between gap-2">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ui-bg-muted)] text-[var(--ui-text-highlighted)]">
              <UIcon :name="modelLogoIcon(model)" class="size-6" aria-hidden="true" />
            </div>
            <UBadge v-if="token" color="success" variant="subtle" size="sm">Available</UBadge>
          </div>
          <div class="mt-3 min-w-0">
            <p class="truncate text-sm font-semibold text-[var(--ui-text-highlighted)]" :title="model.display_name || model.id">{{ model.display_name || model.id }}</p>
            <div class="mt-0.5 flex min-w-0 items-center gap-0.5">
              <code class="truncate text-[10px] text-[var(--ui-text-muted)]" :title="model.id">{{ model.id }}</code>
              <UButton color="neutral" variant="ghost" size="xs" icon="i-tabler-copy" :aria-label="`Copy model ID ${model.id}`" @click.stop="copyModelId(model.id)" />
            </div>
          </div>
          <p v-if="model.pricing?.status === 'published'" class="mt-3 text-xs font-medium leading-5">From {{ credits(lowestPrice(model, 'input')) }} in / {{ credits(lowestPrice(model, 'output')) }} out / 1M tokens</p>
          <p v-else class="mt-3 text-xs text-[var(--ui-text-muted)]">Price not published</p>
          <div class="mt-auto pt-3">
            <UButton block color="neutral" variant="outline" size="xs" :aria-label="`View details for ${model.display_name || model.id}`" @click="openDetails(model, $event)">Details</UButton>
          </div>
        </AppCard>
      </div>
      <div v-if="catalogReady && !loading && !error && !filteredModels.length" class="rounded-2xl border border-dashed border-[var(--ui-border)] py-16 text-center text-sm text-[var(--ui-text-muted)]">{{ models.length ? 'No models match your filters.' : 'No models are currently served.' }}</div>
    </template>

    <USlideover v-model:open="detailOpen" :title="selectedModel?.display_name || selectedModel?.id || 'Model details'" :description="selectedModel?.id" :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <div v-if="selectedModel" class="space-y-6 text-sm">
          <div class="flex items-center gap-3">
            <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--ui-bg-muted)] text-[var(--ui-text-highlighted)]">
              <UIcon :name="modelLogoIcon(selectedModel)" class="size-7" aria-hidden="true" />
            </div>
            <div class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] px-3 py-2">
              <code class="min-w-0 flex-1 break-all text-xs">{{ selectedModel.id }}</code>
              <UButton color="neutral" variant="outline" size="xs" icon="i-tabler-copy" @click="copyModelId(selectedModel.id)">Copy ID</UButton>
            </div>
          </div>
          <p class="text-[var(--ui-text-muted)]">{{ selectedModel.description || 'No description has been published.' }}</p>
          <dl class="grid gap-3 sm:grid-cols-2">
            <div v-for="item in modelFacts(selectedModel)" :key="item.label"><dt class="text-xs text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="break-words font-medium">{{ item.value }}</dd></div>
          </dl>

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
          <section v-if="selectedModel.pricing" class="space-y-1"><h3 class="font-semibold">Pricing</h3>
            <p v-if="selectedModel.pricing.status === 'published'">From {{ credits(lowestPrice(selectedModel, 'input')) }} in / {{ credits(lowestPrice(selectedModel, 'output')) }} out / 1M tokens</p>
            <p v-else>No price published. This does not mean free.</p>
          </section>
          <p v-if="!selectedModel.pricing && !selectedModel.availability" class="text-xs text-[var(--ui-text-muted)]">Sign in to see pricing and observed availability for models covered by your keys.</p>
        </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { token, fetchAPI, loadCapabilities } = useUserApi()
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

const capabilityOrder: CapabilityFilter[] = ['tools', 'structuredOutput', 'reasoning']
const validSorts = new Set(['name', 'price-asc', 'price-desc'])
const queryKeys = ['q', 'provider', 'modality', 'caps', 'mine', 'sort'] as const
const noFilterValue = '__no_filter__'
const publicCatalog = ref<CatalogModel[]>([])
const models = ref<CatalogModel[]>([])
const loading = ref(false)
const capabilityLoading = ref(true)
const catalogReady = ref(false)
const catalogUnsupported = ref(false)
const error = ref('')
const capabilityError = ref('')
const accessibleWarning = ref('')
const access = ref<AccessSummary | null>(null)
const accessLoaded = ref(false)
const search = ref(validQueryString(route.query.q))

const inputModality = ref(validQueryString(route.query.modality))
const selectedCapabilities = ref<CapabilityFilter[]>(parseCapabilities(route.query.caps))
const mineOnly = ref(route.query.mine === 'true')
const sortBy = ref(validSorts.has(validQueryString(route.query.sort)) ? validQueryString(route.query.sort) : 'name')
const selectedModel = ref<CatalogModel | null>(null)
const detailOpen = ref(false)
const detailTrigger = ref<HTMLElement | null>(null)
let loadGeneration = 0
const capabilityOptions: { label: string; value: CapabilityFilter }[] = [{ label: 'Tools', value: 'tools' }, { label: 'Structured output', value: 'structuredOutput' }, { label: 'Reasoning', value: 'reasoning' }]
const sortOptions = [{ label: 'Name A–Z', value: 'name' }, { label: 'Lowest opening price', value: 'price-asc' }, { label: 'Highest opening price', value: 'price-desc' }]

const modalityOptions = computed(() => [{ label: 'Any input modality', value: noFilterValue }, ...Array.from(new Set(models.value.flatMap(model => model.modalities?.input || []).filter(Boolean))).sort().map(value => ({ label: `Accepts ${value}`, value }))])
const filteredModels = computed(() => {
  const query = search.value.trim().toLowerCase()
  return models.value.filter(model =>
    (!inputModality.value || model.modalities?.status === 'known' && model.modalities.input?.includes(inputModality.value)) &&
    selectedCapabilities.value.every(capability => supportsCapability(model, capability)) &&
    (!query || [model.id, model.display_name, model.description, ...capabilityLabels(model)].some(value => String(value || '').toLowerCase().includes(query)))
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
  void loadModels()
})
watch(() => route.query, applyRouteQuery)
watch([search, inputModality, selectedCapabilities, mineOnly, sortBy], () => { void syncRouteQuery() }, { deep: true })
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

  const nextModality = validQueryString(route.query.modality)
  const nextCapabilities = parseCapabilities(route.query.caps)
  const nextSort = validQueryString(route.query.sort)
  search.value = nextSearch

  inputModality.value = nextModality
  selectedCapabilities.value = nextCapabilities
  mineOnly.value = Boolean(token.value) && route.query.mine === 'true'
  sortBy.value = validSorts.has(nextSort) ? nextSort : 'name'
}
async function syncRouteQuery() {
  const query = { ...route.query }
  for (const key of queryKeys) delete query[key]
  if (search.value) query.q = search.value

  if (inputModality.value) query.modality = inputModality.value
  if (selectedCapabilities.value.length) query.caps = capabilityOrder.filter(item => selectedCapabilities.value.includes(item)).join(',')
  if (token.value && mineOnly.value) query.mine = 'true'
  if (sortBy.value !== 'name') query.sort = sortBy.value
  const unchanged = queryKeys.every(key => normalizedQueryValue(route.query[key]) === normalizedQueryValue(query[key]))
  if (!unchanged) await router.replace({ query })
}
function normalizedQueryValue(value: unknown) { return typeof value === 'string' ? value : '' }
function validateCatalogFilters() {
  const modalities = new Set(models.value.flatMap(model => model.modalities?.input || []))
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
function modelLogoIcon(model: CatalogModel) {
  const identity = [model.id, model.display_name, ...(model.providers || [])].join(' ').toLowerCase()
  if (/claude|anthropic/.test(identity)) return 'i-tabler-sparkles'
  if (/gemini|gemma|google|vertex|palm/.test(identity)) return 'i-tabler-brand-google'
  if (/gpt|openai|o1|o3|o4|codex/.test(identity)) return 'i-tabler-brand-openai'
  if (/grok|xai/.test(identity)) return 'i-tabler-brand-x'
  if (/llama|meta/.test(identity)) return 'i-tabler-brand-meta'
  if (/mistral|mixtral/.test(identity)) return 'i-tabler-wind'
  if (/deepseek/.test(identity)) return 'i-tabler-fish'
  if (/qwen|qwq|alibaba/.test(identity)) return 'i-tabler-cloud-computing'
  if (/kimi|moonshot/.test(identity)) return 'i-tabler-moon-stars'
  if (/cohere|command-r/.test(identity)) return 'i-tabler-affiliate'
  if (/amazon|nova|titan/.test(identity)) return 'i-tabler-brand-amazon'
  if (/microsoft|phi-/.test(identity)) return 'i-tabler-brand-windows'
  if (/perplexity|sonar/.test(identity)) return 'i-tabler-search'
  return 'i-tabler-robot'
}
async function refreshCatalog() {
  capabilityLoading.value = true
  capabilityError.value = ''
  const capabilityRequest = loadCapabilities().catch((cause: any) => {
    if (!isNotFound(cause)) capabilityError.value = cause?.message || 'Unable to load server capabilities.'
  }).finally(() => { capabilityLoading.value = false })
  await Promise.all([capabilityRequest, loadModels()])
}
async function loadModels() {
  const generation = ++loadGeneration
  const tokenSnapshot = token.value
  loading.value = true
  catalogUnsupported.value = false
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
      if (isNotFound(publicResult.reason)) {
        catalogUnsupported.value = true
        publicCatalog.value = []
        models.value = []
        access.value = null
        accessLoaded.value = false
      } else {
        error.value = errorMessage(publicResult.reason, 'Unable to load models.')
      }
      return
    }
    const publicModels = Array.isArray(publicResult.value.models) ? publicResult.value.models : []
    publicCatalog.value = publicModels.map(model => ({ ...model }))
    if (!tokenSnapshot) {
      models.value = publicCatalog.value.map(model => ({ ...model }))
      access.value = null
      accessLoaded.value = false
    } else if (accessibleResult.status === 'fulfilled' && accessibleResult.value) {
      const publicByID = new Map(publicCatalog.value.map(model => [normalizedModelId(model.id), model]))
      const accessibleModels = Array.isArray(accessibleResult.value.models) ? accessibleResult.value.models : []
      models.value = accessibleModels.map(model => {
        const publicModel = publicByID.get(normalizedModelId(model.id))
        return { ...publicModel, ...model, id: publicModel?.id || model.id, accessible: true }
      })
      access.value = accessibleResult.value.access || null
      accessLoaded.value = true
    } else {
      models.value = []
      access.value = null
      accessLoaded.value = false
      const warning = accessibleResult.status === 'rejected' ? errorMessage(accessibleResult.reason, 'Unable to load your key access.') : 'Unable to load your key access.'
      accessibleWarning.value = warning
    }
    validateCatalogFilters()
    if (selectedModel.value) selectedModel.value = models.value.find(model => normalizedModelId(model.id) === normalizedModelId(selectedModel.value?.id || '')) || selectedModel.value
  } finally {
    if (generation === loadGeneration) {
      loading.value = false
      catalogReady.value = true
    }
  }
}
function errorMessage(cause: any, fallback: string) { return cause?.message || fallback }
function isNotFound(cause: any) { return cause?.statusCode === 404 || cause?.status === 404 }
function normalizedModelId(id: string) { return String(id || '').trim().toLowerCase() }
async function copyModelId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    toast.add({ title: 'Model ID copied', color: 'success' })
  } catch {
    toast.add({ title: 'Unable to copy model ID', color: 'error' })
  }
}
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


onMounted(() => {
  void syncRouteQuery()
  void refreshCatalog()
})
</script>
