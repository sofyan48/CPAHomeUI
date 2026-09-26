<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Models</h1>
        <p class="mt-1 max-w-3xl text-sm text-[var(--ui-text-muted)]">
          Browse models currently available through active credentials or the complete static catalog.
          Static entries are grouped by channel and retain their authoritative billing providers.
        </p>
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
      <UCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Shown</p>
        <p class="mt-2 text-2xl font-bold">{{ filteredModels.length }}</p>
      </UCard>
      <UCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Providers</p>
        <p class="mt-2 text-2xl font-bold">{{ providerCount }}</p>
      </UCard>
      <UCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Channels</p>
        <p class="mt-2 text-2xl font-bold">{{ channelCount }}</p>
      </UCard>
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

    <UCard :ui="{ body: { padding: '' } }">
      <UTable :columns="columns" :data="filteredModels" :loading="pending" @select="showDetails">
        <template #identity-cell="{ row }">
          <div class="min-w-0">
            <p class="truncate font-mono text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ rowValue(row).id }}</p>
            <p v-if="rowValue(row).display_name && rowValue(row).display_name !== rowValue(row).id" class="truncate text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).display_name }}</p>
          </div>
        </template>
        <template #channel-cell="{ row }">
          <UBadge v-if="rowValue(row).channel" color="primary" variant="subtle" size="sm">{{ rowValue(row).channel }}</UBadge>
          <span v-else class="text-sm text-[var(--ui-text-muted)]">Runtime</span>
        </template>
        <template #providers-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UBadge v-for="provider in rowValue(row).providers" :key="provider" color="neutral" variant="subtle" size="sm">{{ provider }}</UBadge>
          </div>
        </template>
        <template #type-cell="{ row }">
          <span class="text-sm">{{ rowValue(row).type || rowValue(row).owned_by || '—' }}</span>
        </template>
        <template #empty>
          <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
            <UIcon name="i-tabler-box" class="mb-3 size-8 text-[var(--ui-text-muted)]" />
            <p class="font-medium">{{ search ? 'No matching models' : 'No models found' }}</p>
            <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Try another catalog, channel, or search term.</p>
          </div>
        </template>
      </UTable>
    </UCard>

    <UModal v-model:open="detailsOpen" title="Model details" description="Model metadata returned by the management API.">
      <template #body>
        <div v-if="selectedModel" class="space-y-5">
          <div class="rounded-xl bg-[var(--ui-bg-muted)] p-4">
            <p class="font-mono text-lg font-semibold">{{ selectedModel.id }}</p>
            <p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ selectedModel.display_name || 'No display name' }}</p>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label="Channel" :value="selectedModel.channel || 'Runtime registry'" />
            <DetailItem label="Type" :value="selectedModel.type || '—'" />
            <DetailItem label="Owned by" :value="selectedModel.owned_by || '—'" />
            <DetailItem label="Created" :value="selectedModel.created ? formatCreated(selectedModel.created) : '—'" />
          </div>
          <div>
            <p class="mb-2 text-sm font-medium">Authoritative providers</p>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="provider in selectedModel.providers" :key="provider" color="primary" variant="subtle">{{ provider }}</UBadge>
              <span v-if="!selectedModel.providers.length" class="text-sm text-[var(--ui-text-muted)]">No billing provider identity</span>
            </div>
          </div>
          <div class="flex justify-end border-t border-[var(--ui-border)] pt-4">
            <UButton color="neutral" variant="ghost" @click="detailsOpen = false">Close</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const rowValue = (row) => row?.original ?? row
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
const columns = [
  { accessorKey: 'identity', header: 'Model' },
  { accessorKey: 'channel', header: 'Channel' },
  { accessorKey: 'providers', header: 'Providers' },
  { accessorKey: 'type', header: 'Type' }
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
      .filter(model => Array.isArray(model.providers) && model.providers.length)
      .map(model => ({ ...model, channel: model.channel || '' }))
  }
  if (!rawModels.value || typeof rawModels.value !== 'object') return []
  return Object.entries(rawModels.value).flatMap(([catalogChannel, entries]) => (Array.isArray(entries) ? entries : [])
    .filter(model => Array.isArray(model.providers) && model.providers.length)
    .map(model => ({ ...model, channel: catalogChannel })))
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

function showDetails(row) {
  selectedModel.value = rowValue(row)
  detailsOpen.value = true
}
function formatCreated(value) {
  const date = new Date(Number(value) * 1000)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
}
function errorMessage(error) {
  return error?.data?.message || error?.data?.error || error?.response?._data?.message || error?.response?._data?.error || error?.message || 'Unexpected request error.'
}
</script>
