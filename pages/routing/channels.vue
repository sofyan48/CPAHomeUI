<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold">Channel Groups</h1>
        <p class="text-sm text-[var(--ui-text-muted)] mt-1">Restrict which auth records a client API key may use for upstream providers.</p>
      </div>
      <UButton color="primary" icon="i-heroicons-plus" @click="isCreateModalOpen = true">
        New Channel Group
      </UButton>
    </div>
    
    <div class="mb-4 flex gap-4">
      <UInput 
        v-model="search"
        placeholder="Search channel groups..." 
        icon="i-heroicons-magnifying-glass-20-solid"
        class="max-w-sm flex-1"
      />
      <UButton color="neutral" variant="ghost" icon="i-heroicons-arrow-path" @click="refresh()" />
    </div>

    <UCard :ui="{ body: { padding: '' } }">
      <UTable :columns="columns" :data="filteredGroups" :loading="pending">
        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-10">
            <span class="text-sm text-[var(--ui-text-muted)]">No channel groups found</span>
          </div>
        </template>
        <template #enabled-data="{ row }">
          <UBadge :color="row.enabled ? 'success' : 'error'" variant="subtle" size="sm">
            {{ row.enabled ? 'Active' : 'Disabled' }}
          </UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="flex justify-end gap-2">
            <UButton size="sm" color="neutral" variant="ghost" icon="i-heroicons-pencil-square" />
          </div>
        </template>
      </UTable>
    </UCard>

    <UModal v-model:open="isCreateModalOpen" title="Create Channel Group" description="Add a new channel grouping for upstream credentials.">
      <template #body>
        <form @submit.prevent="submitCreate" class="space-y-4">
          <UFormField label="Channel Name" required>
            <UInput v-model="form.channel_name" placeholder="e.g. premium-tier, openai-fallback" class="w-full" autofocus />
          </UFormField>
          
          <UFormField label="Status">
            <div class="flex items-center gap-2">
              <USwitch v-model="form.enabled" />
              <span class="text-sm">{{ form.enabled ? 'Active' : 'Disabled' }}</span>
            </div>
          </UFormField>

          <div class="flex justify-end gap-3 pt-4 border-t border-[var(--ui-border)]">
            <UButton color="neutral" variant="ghost" @click="isCreateModalOpen = false">Cancel</UButton>
            <UButton type="submit" color="primary" :loading="isSubmitting">Create Group</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const search = ref('')

const isCreateModalOpen = ref(false)
const isSubmitting = ref(false)
const form = ref({
  channel_name: '',
  enabled: true
})

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'channel_name', header: 'Channel Name' },
  { accessorKey: 'enabled', header: 'Status' },
  { accessorKey: 'created_at', header: 'Created At' },
  { accessorKey: 'actions', header: 'Actions' },
]

const { data, pending, refresh } = await useAsyncData(
  'channel-groups',
  () => fetchAPI('/channel-groups')
)

const groupsList = computed(() => {
  if (data.value && Array.isArray(data.value.channel_groups)) {
    return data.value.channel_groups
  }
  return []
})

const filteredGroups = computed(() => {
  if (!search.value) return groupsList.value
  return groupsList.value.filter((group) => {
    return group.channel_name?.toLowerCase().includes(search.value.toLowerCase())
  })
})

const submitCreate = async () => {
  isSubmitting.value = true
  try {
    await fetchAPI('/channel-groups', {
      method: 'POST',
      body: {
        channel_name: form.value.channel_name,
        disabled: !form.value.enabled
      }
    })
    isCreateModalOpen.value = false
    form.value.channel_name = ''
    form.value.enabled = true
    refresh()
  } catch (error) {
    console.error("Failed to create channel group", error)
  } finally {
    isSubmitting.value = false
  }
}
</script>
