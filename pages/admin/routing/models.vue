<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Models</h1>

      </div>
      <UButton color="primary" icon="i-tabler-refresh" :loading="pending" @click="refresh">Refresh</UButton>
    </div>

    <UAlert
      v-if="pageError"
      color="error"
      variant="subtle"
      icon="i-tabler-alert-triangle"
      title="Unable to load models"
      :description="pageError"
    />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <AppCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Shown</p>
        <p class="mt-2 text-2xl font-bold">{{ filteredModels.length }}</p>
      </AppCard>
      <AppCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Providers</p>
        <p class="mt-2 text-2xl font-bold">{{ providerCount }}</p>
      </AppCard>
      <AppCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Channels</p>
        <p class="mt-2 text-2xl font-bold">{{ channelCount }}</p>
      </AppCard>
    </div>

    <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
      <UFormField label="Catalog" class="w-full lg:w-48">
        <USelect v-model="scope" :items="scopeOptions" value-key="value" label-key="label" class="w-full" />
      </UFormField>
      <UFormField v-if="scope === 'static'" label="Channel" class="w-full lg:w-56">
        <USelectMenu :model-value="channel || allChannelsValue" @update:model-value="channel = $event === allChannelsValue ? '' : $event" :items="channelOptions" value-key="value" label-key="label" class="w-full" :search-input="{ placeholder: 'Search channels...' }" />
      </UFormField>
      <UFormField label="Search" class="w-full lg:max-w-md lg:flex-1">
        <UInput v-model="search" icon="i-tabler-search" placeholder="Model ID, name, provider, or channel..." class="w-full" />
      </UFormField>
    </div>

    <div v-if="pending && !modelsList.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <USkeleton v-for="index in 8" :key="index" class="h-52 rounded-xl" />
    </div>
    <div v-else-if="filteredModels.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AppCard v-for="model in filteredModels" :key="`${model.channel}:${model.id}`" class="min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h2 class="truncate font-semibold text-[var(--ui-text-highlighted)]" :title="model.display_name || model.id">{{ model.display_name || model.id }}</h2>
            <p class="mt-1 break-all font-mono text-xs text-[var(--ui-text-muted)]">{{ model.id }}</p>
          </div>
          <UBadge v-if="model.channel" color="primary" variant="subtle" size="sm">{{ model.channel }}</UBadge>
        </div>
        <div class="mt-4">
          <p class="text-xs font-medium text-[var(--ui-text-muted)]">Providers</p>
          <div v-if="model.providers.length" class="mt-2 flex flex-wrap gap-1">
            <UBadge v-for="provider in model.providers" :key="provider" color="neutral" variant="subtle" size="sm">{{ provider }}</UBadge>
          </div>
          <p v-else class="mt-2 text-xs text-[var(--ui-text-muted)]">No provider information</p>
        </div>
        <div class="mt-4 flex items-center justify-between gap-2 border-t border-[var(--ui-border)] pt-3">
          <span class="truncate text-xs text-[var(--ui-text-muted)]">{{ model.type || model.owned_by || '—' }}</span>
          <UButton color="neutral" variant="outline" size="xs" :aria-label="`View details for ${model.id}`" @click="showDetails(model)">Details</UButton>
        </div>
      </AppCard>
    </div>
    <div v-else-if="!pending" class="rounded-xl border border-dashed border-[var(--ui-border)] px-6 py-14 text-center">
      <UIcon name="i-tabler-box" class="mx-auto mb-3 size-8 text-[var(--ui-text-muted)]" />
      <p class="font-medium">{{ search ? 'No matching models' : 'No models found' }}</p>
      <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Try another catalog, channel, or search term.</p>
    </div>

    <USlideover v-model:open="detailsOpen" side="right" title="Model details" description="Model metadata returned by the management API." :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <div v-if="selectedModel" class="space-y-5">
          <div class="rounded-xl bg-[var(--ui-bg-muted)] p-4">
            <p class="font-mono text-lg font-semibold">{{ selectedModel.id }}</p>
            <p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ selectedModel.display_name || 'No display name' }}</p>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="Channel" :value="selectedModel.channel || 'Runtime registry'" />
            <DetailItem label="Object" :value="selectedModel.object || '—'" />
            <DetailItem label="Type" :value="selectedModel.type || '—'" />
            <DetailItem label="Owned by" :value="selectedModel.owned_by || '—'" />
            <DetailItem label="Name" :value="selectedModel.name || '—'" />
            <DetailItem label="Version" :value="selectedModel.version || '—'" />
            <DetailItem label="Created" :value="selectedModel.created ? formatCreated(selectedModel.created) : '—'" />
            <DetailItem label="Context length" :value="formatLimit(selectedModel.context_length || selectedModel.inputTokenLimit)" />
            <DetailItem label="Input token limit" :value="formatLimit(selectedModel.inputTokenLimit)" />
            <DetailItem label="Output token limit" :value="formatLimit(selectedModel.outputTokenLimit || selectedModel.max_completion_tokens)" />
            <DetailItem label="Max completion tokens" :value="formatLimit(selectedModel.max_completion_tokens)" />
            <DetailItem label="Configuration updates" :value="selectedModel.support_configuration_update ? 'Supported' : 'Not declared'" />
          </div>
          <div v-if="selectedModel.description">
            <p class="mb-2 text-sm font-medium">Description</p>
            <p class="whitespace-pre-wrap text-sm text-[var(--ui-text-muted)]">{{ selectedModel.description }}</p>
          </div>
          <div>
            <p class="mb-2 text-sm font-medium">Authoritative providers</p>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="provider in selectedModel.providers" :key="provider" color="primary" variant="subtle">{{ provider }}</UBadge>
              <span v-if="!selectedModel.providers.length" class="text-sm text-[var(--ui-text-muted)]">No billing provider identity</span>
            </div>
          </div>
          <div v-for="group in modelMetadataGroups" :key="group.label">
            <p class="mb-2 text-sm font-medium">{{ group.label }}</p>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="value in group.values" :key="value" color="neutral" variant="subtle">{{ value }}</UBadge>
            </div>
          </div>
          <details v-if="hasCapabilityMetadata" class="rounded-xl border border-[var(--ui-border)] px-4 py-3 text-sm">
            <summary class="cursor-pointer font-medium">Capability metadata</summary>
            <pre class="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--ui-text-muted)]">{{ capabilityMetadata }}</pre>
          </details>
          <div class="flex justify-end border-t border-[var(--ui-border)] pt-4">
            <UButton color="neutral" variant="ghost" @click="detailsOpen = false">Close</UButton>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()

const scope = ref('available')
const channel = ref('')
const search = ref('')
const pageError = ref('')
const detailsOpen = ref(false)
const selectedModel = ref(null)

const allChannelsValue = '__all_channels__'
const scopeOptions = [
  { label: 'Available now', value: 'available' },
  { label: 'Static catalog', value: 'static' }
]

async function loadModels() {
  pageError.value = ''
  try {
    return await fetchAPI(`/models?scope=${scope.value}`)
  } catch (error) {
    pageError.value = errorMessage(error)
    return { models: scope.value === 'static' ? {} : [] }
  }
}

const { data, pending, refresh } = await useAsyncData('routing-models', loadModels, { watch: [scope] })

const rawModels = computed(() => data.value?.models)
const modelsList = computed(() => {
  if (Array.isArray(rawModels.value)) {
    return rawModels.value
      .filter(model => model?.id)
      .map(model => ({ ...model, providers: Array.isArray(model.providers) ? model.providers : [], channel: model.channel || '' }))
  }
  if (!rawModels.value || typeof rawModels.value !== 'object') return []
  return Object.entries(rawModels.value).flatMap(([catalogChannel, entries]) => (Array.isArray(entries) ? entries : [])
    .filter(model => model?.id)
    .map(model => ({ ...model, providers: Array.isArray(model.providers) ? model.providers : [], channel: catalogChannel })))
})
const channelOptions = computed(() => [
  { label: 'All static channels', value: allChannelsValue },
  ...[...new Set(modelsList.value.map(model => model.channel).filter(Boolean))].sort().map(value => ({ label: value, value }))
])
const filteredModels = computed(() => {
  const query = search.value.trim().toLowerCase()
  return modelsList.value.filter(model => {
    if (scope.value === 'static' && channel.value && model.channel !== channel.value) return false
    if (!query) return true
    return [model.id, model.display_name, model.owned_by, model.type, model.channel, ...(model.providers || [])]
      .some(value => String(value || '').toLowerCase().includes(query))
  })
})
const providerCount = computed(() => new Set(modelsList.value.flatMap(model => model.providers || [])).size)
const channelCount = computed(() => new Set(modelsList.value.map(model => model.channel).filter(Boolean)).size)
const modelMetadataGroups = computed(() => {
  if (!selectedModel.value) return []
  return [
    { label: 'Generation methods', values: selectedModel.value.supportedGenerationMethods },
    { label: 'Supported parameters', values: selectedModel.value.supported_parameters },
    { label: 'Input modalities', values: selectedModel.value.supportedInputModalities },
    { label: 'Output modalities', values: selectedModel.value.supportedOutputModalities }
  ].filter(group => Array.isArray(group.values) && group.values.length)
})
const capabilityMetadata = computed(() => JSON.stringify({
  thinking: selectedModel.value?.thinking,
  native_capabilities: selectedModel.value?.native_capabilities
}, null, 2))
const hasCapabilityMetadata = computed(() => Boolean(selectedModel.value?.thinking || selectedModel.value?.native_capabilities))

function showDetails(row) {
  selectedModel.value = row
  detailsOpen.value = true
}
function formatCreated(value) {
  const date = new Date(Number(value) * 1000)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
}
function formatLimit(value) {
  const limit = Number(value)
  return Number.isFinite(limit) && limit > 0 ? limit.toLocaleString() : '—'
}
function errorMessage(error) {
  return error?.data?.message || error?.data?.error || error?.response?._data?.message || error?.response?._data?.error || error?.message || 'Unexpected request error.'
}
</script>
