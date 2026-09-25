<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Models (Catalog & Registry)</h1>
      <UButton color="primary" @click="refresh()">
        Refresh Models
      </UButton>
    </div>
    
    <div class="mb-4 flex gap-4 items-center">
      <div class="w-48">
        <label class="block text-xs font-semibold text-[var(--ui-text-muted)] mb-1">Source / Scope</label>
        <USelect v-model="scope" :options="['available', 'static']" class="w-full" />
      </div>
      <div class="flex-1">
        <label class="block text-xs font-semibold text-[var(--ui-text-muted)] mb-1">Search Models</label>
        <UInput 
          v-model="search"
          placeholder="Search by ID or Provider..." 
          icon="i-heroicons-magnifying-glass-20-solid"
          class="w-full max-w-md"
        />
      </div>
    </div>

    <UCard :ui="{ body: { padding: '' } }">
      <UTable :columns="columns" :data="filteredModels" :loading="pending">
        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-10">
            <span class="text-sm text-[var(--ui-text-muted)]">No models found in "{{ scope }}" scope.</span>
          </div>
        </template>
        <template #id-data="{ row }">
          <span class="font-mono text-sm font-semibold">{{ row.id || row.model }}</span>
        </template>
        <template #providers-data="{ row }">
          <div class="flex gap-1 flex-wrap" v-if="row.providers && row.providers.length">
            <UBadge v-for="p in row.providers" :key="p" size="sm" variant="subtle">{{ p }}</UBadge>
          </div>
          <span v-else class="text-xs text-[var(--ui-text-muted)] italic">No Billing Identity</span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()

const scope = ref('available')
const search = ref('')

const columns = [
  { accessorKey: 'id', header: 'Model Identifier' },
  { accessorKey: 'object', header: 'Type' },
  { accessorKey: 'owned_by', header: 'Owned By' },
  { accessorKey: 'providers', header: 'Authoritative Providers' },
]

const { data, pending, refresh } = await useAsyncData(
  'models',
  () => fetchAPI(`/models?scope=${scope.value}`),
  { watch: [scope] }
)

const modelsList = computed(() => {
  if (data.value && Array.isArray(data.value.data)) {
    return data.value.data
  }
  return []
})

const filteredModels = computed(() => {
  if (!search.value) return modelsList.value
  const q = search.value.toLowerCase()
  return modelsList.value.filter((model) => {
    return (
      (model.id && model.id.toLowerCase().includes(q)) ||
      (model.model && model.model.toLowerCase().includes(q)) ||
      (model.owned_by && model.owned_by.toLowerCase().includes(q)) ||
      (model.providers && model.providers.some(p => p.toLowerCase().includes(q)))
    )
  })
})
</script>
