<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold">Model Groups</h1>
        <p class="text-sm text-[var(--ui-text-muted)] mt-1">Restrict which model IDs a client API key may use. Can override credential selection via specific Channels.</p>
      </div>
      <UButton color="primary" icon="i-heroicons-plus" @click="isCreateModalOpen = true">
        New Model Group
      </UButton>
    </div>
    
    <div class="mb-4 flex gap-4">
      <UInput 
        v-model="search"
        placeholder="Search model groups..." 
        icon="i-heroicons-magnifying-glass-20-solid"
        class="max-w-sm flex-1"
      />
      <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path" @click="refreshGroups()" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-1">
        <UCard :ui="{ body: { padding: '' } }">
          <UTable :columns="groupColumns" :data="filteredGroups" :loading="pendingGroups" @select="selectGroup">
            <template #empty-state>
              <div class="flex flex-col items-center justify-center py-6">
                <span class="text-sm text-[var(--ui-text-muted)]">No model groups found</span>
              </div>
            </template>
            <template #enabled-data="{ row }">
              <UBadge :color="row.enabled ? 'success' : 'error'" variant="subtle" size="sm">
                {{ row.enabled ? 'Active' : 'Disabled' }}
              </UBadge>
            </template>
          </UTable>
        </UCard>
      </div>

      <div class="lg:col-span-2">
        <UCard v-if="selectedGroup" :ui="{ body: { padding: '' } }">
          <template #header>
            <div class="flex justify-between items-center">
              <div>
                <h3 class="font-semibold text-lg">{{ selectedGroup.group_name }}</h3>
                <p class="text-xs text-[var(--ui-text-muted)]">Model bindings for this group</p>
              </div>
              <UButton size="sm" color="neutral" variant="outline" icon="i-heroicons-plus" @click="openAddDetailModal">
                Add Model
              </UButton>
            </div>
          </template>

          <UTable :columns="detailColumns" :data="detailsList" :loading="pendingDetails">
            <template #empty-state>
              <div class="flex flex-col items-center justify-center py-10">
                <span class="text-sm text-[var(--ui-text-muted)]">No models bound to this group yet.</span>
              </div>
            </template>
            <template #channels-data="{ row }">
              <div class="flex gap-1 flex-wrap" v-if="row.channels && row.channels.length">
                <UBadge v-for="c in row.channels" :key="c" size="sm" variant="subtle">Ch: {{ c }}</UBadge>
              </div>
              <span v-else class="text-xs text-[var(--ui-text-muted)] italic">Inherit</span>
            </template>
            <template #actions-data="{ row }">
              <div class="flex justify-end gap-2">
                <UButton size="sm" color="error" variant="ghost" icon="i-heroicons-trash" @click="removeDetail(row.id)" />
              </div>
            </template>
          </UTable>
        </UCard>
        
        <div v-else class="flex flex-col items-center justify-center h-48 border border-dashed border-[var(--ui-border)] rounded-lg bg-[var(--ui-bg-muted)]">
          <span class="text-sm text-[var(--ui-text-muted)]">Select a group to view and manage its models.</span>
        </div>
      </div>
    </div>

    <UModal v-model:open="isCreateModalOpen" title="Create Model Group" description="Add a new model grouping.">
      <template #body>
        <form @submit.prevent="submitCreateGroup" class="space-y-4">
          <UFormField label="Group Name" required>
            <UInput v-model="formGroup.group_name" placeholder="e.g. premium-models, internal-only" class="w-full" autofocus />
          </UFormField>
          
          <UFormField label="Status">
            <div class="flex items-center gap-2">
              <USwitch v-model="formGroup.enabled" />
              <span class="text-sm">{{ formGroup.enabled ? 'Active' : 'Disabled' }}</span>
            </div>
          </UFormField>

          <div class="flex justify-end gap-3 pt-4 border-t border-[var(--ui-border)]">
            <UButton color="neutral" variant="ghost" @click="isCreateModalOpen = false">Cancel</UButton>
            <UButton type="submit" color="primary" :loading="isSubmittingGroup">Create Group</UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="isDetailModalOpen" title="Add Model Binding" description="Bind a model to this group, optionally forcing specific channel groups.">
      <template #body>
        <form @submit.prevent="submitAddDetail" class="space-y-4">
          <UFormField label="Model ID" required>
            <UInput v-model="formDetail.model_id" placeholder="e.g. gpt-4" class="w-full" autofocus />
          </UFormField>

          <UFormField label="Channel Group IDs (Optional)">
            <UInput v-model="formDetail.channels_raw" placeholder="e.g. 1, 2, 3 (comma separated)" class="w-full" />
            <p class="text-xs text-[var(--ui-text-muted)] mt-1">Leave empty to inherit API key's channels.</p>
          </UFormField>
          
          <div class="flex justify-end gap-3 pt-4 border-t border-[var(--ui-border)]">
            <UButton color="neutral" variant="ghost" @click="isDetailModalOpen = false">Cancel</UButton>
            <UButton type="submit" color="primary" :loading="isSubmittingDetail">Bind Model</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()

// === MASTER VIEW ===
const search = ref('')
const selectedGroup = ref(null)

const groupColumns = [
  { accessorKey: 'group_name', header: 'Group Name' },
  { accessorKey: 'enabled', header: 'Status' },
]

const { data: groupsData, pending: pendingGroups, refresh: refreshGroups } = await useAsyncData(
  'model-groups',
  () => fetchAPI('/model-groups')
)

const groupsList = computed(() => {
  if (groupsData.value && Array.isArray(groupsData.value.model_groups)) {
    return groupsData.value.model_groups
  }
  return []
})

const filteredGroups = computed(() => {
  if (!search.value) return groupsList.value
  return groupsList.value.filter((g) => g.group_name?.toLowerCase().includes(search.value.toLowerCase()))
})

const selectGroup = (row) => {
  selectedGroup.value = row
  refreshDetails()
}

// === CREATE GROUP ===
const isCreateModalOpen = ref(false)
const isSubmittingGroup = ref(false)
const formGroup = ref({ group_name: '', enabled: true })

const submitCreateGroup = async () => {
  isSubmittingGroup.value = true
  try {
    await fetchAPI('/model-groups', {
      method: 'POST',
      body: {
        group_name: formGroup.value.group_name,
        disabled: !formGroup.value.enabled
      }
    })
    isCreateModalOpen.value = false
    formGroup.value.group_name = ''
    refreshGroups()
  } catch (error) {
    console.error(error)
  } finally {
    isSubmittingGroup.value = false
  }
}

// === DETAILS VIEW ===
const detailColumns = [
  { accessorKey: 'model_id', header: 'Model ID' },
  { accessorKey: 'channels', header: 'Forced Channels' },
  { accessorKey: 'actions', header: 'Actions' },
]

const { data: detailsData, pending: pendingDetails, refresh: refreshDetails } = await useAsyncData(
  'model-group-details',
  () => {
    if (!selectedGroup.value) return null
    return fetchAPI(`/model-group-details?model_group_id=${selectedGroup.value.id}`)
  },
  { immediate: false }
)

const detailsList = computed(() => {
  if (detailsData.value && Array.isArray(detailsData.value.model_group_details)) {
    return detailsData.value.model_group_details
  }
  return []
})

// === CREATE DETAIL ===
const isDetailModalOpen = ref(false)
const isSubmittingDetail = ref(false)
const formDetail = ref({ model_id: '', channels_raw: '' })

const openAddDetailModal = () => {
  formDetail.value.model_id = ''
  formDetail.value.channels_raw = ''
  isDetailModalOpen.value = true
}

const submitAddDetail = async () => {
  isSubmittingDetail.value = true
  try {
    const channelArr = formDetail.value.channels_raw
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '')
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n))

    await fetchAPI('/model-group-details', {
      method: 'POST',
      body: {
        model_group_id: selectedGroup.value.id,
        model_id: formDetail.value.model_id,
        channels: channelArr
      }
    })
    isDetailModalOpen.value = false
    refreshDetails()
  } catch (error) {
    console.error(error)
  } finally {
    isSubmittingDetail.value = false
  }
}

const removeDetail = async (id) => {
  if(!confirm("Are you sure you want to remove this model binding?")) return
  try {
    await fetchAPI(`/model-group-details/${id}`, { method: 'DELETE' })
    refreshDetails()
  } catch (error) {
    console.error(error)
  }
}
</script>
