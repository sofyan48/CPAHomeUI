<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Model Groups</h1>
        <p class="mt-1 max-w-3xl text-sm text-[var(--ui-text-muted)]">
          Define reusable model allowlists. Each model may optionally be restricted to selected channel groups.
        </p>
      </div>
      <UButton color="primary" icon="i-heroicons-plus" @click="openCreateGroup">New model group</UButton>
    </div>

    <UAlert v-if="pageError" color="error" variant="subtle" icon="i-heroicons-exclamation-triangle" title="Unable to load model groups" :description="pageError" />

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Search model groups..." class="w-full sm:max-w-sm" />
      <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="pending" @click="refreshWorkspace">Refresh</UButton>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
      <UCard :ui="{ body: { padding: '' } }">
        <template #header>
          <div>
            <p class="font-semibold">Groups</p>
            <p class="text-xs text-[var(--ui-text-muted)]">Select a group to manage its model bindings.</p>
          </div>
        </template>
        <UTable :columns="groupColumns" :data="filteredGroups" :loading="pending" @select="selectGroup">
          <template #identity-cell="{ row }">
            <button type="button" class="w-full text-left" @click.stop="selectGroup(rowValue(row))">
              <p class="font-medium text-[var(--ui-text-highlighted)]">{{ rowValue(row).group_name }}</p>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">Group #{{ rowValue(row).id }}</p>
            </button>
          </template>
          <template #status-cell="{ row }">
            <UBadge :color="rowValue(row).disabled ? 'error' : 'success'" variant="subtle" size="sm">{{ rowValue(row).disabled ? 'Disabled' : 'Active' }}</UBadge>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-pencil-square" aria-label="Edit group" @click.stop="openEditGroup(rowValue(row))" />
              <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" aria-label="Delete group" @click.stop="confirmDelete('group', rowValue(row))" />
            </div>
          </template>
          <template #empty>
            <div class="px-6 py-12 text-center text-sm text-[var(--ui-text-muted)]">{{ search ? 'No matching model groups.' : 'No model groups yet.' }}</div>
          </template>
        </UTable>
      </UCard>

      <UCard v-if="selectedGroup" :ui="{ body: { padding: '' } }">
        <template #header>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <p class="text-lg font-semibold">{{ selectedGroup.group_name }}</p>
                <UBadge :color="selectedGroup.disabled ? 'error' : 'success'" variant="subtle" size="sm">{{ selectedGroup.disabled ? 'Disabled' : 'Active' }}</UBadge>
              </div>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ details.length }} model binding{{ details.length === 1 ? '' : 's' }}</p>
            </div>
            <UButton color="primary" variant="soft" icon="i-heroicons-plus" @click="openCreateDetail">Add model</UButton>
          </div>
        </template>
        <UTable :columns="detailColumns" :data="details" :loading="detailsPending">
          <template #model-cell="{ row }">
            <div class="min-w-0">
              <p class="truncate font-mono text-sm font-semibold">{{ rowValue(row).model_id }}</p>
              <p v-if="modelById(rowValue(row).model_id)?.display_name" class="mt-1 truncate text-xs text-[var(--ui-text-muted)]">{{ modelById(rowValue(row).model_id).display_name }}</p>
            </div>
          </template>
          <template #channels-cell="{ row }">
            <div v-if="rowValue(row).channels?.length" class="flex max-w-md flex-wrap gap-1">
              <UBadge v-for="id in rowValue(row).channels" :key="id" color="primary" variant="subtle" size="sm">{{ channelName(id) }}</UBadge>
            </div>
            <span v-else class="text-sm text-[var(--ui-text-muted)]">Inherit API key scope</span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-pencil-square" aria-label="Edit model binding" @click="openEditDetail(rowValue(row))" />
              <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" aria-label="Delete model binding" @click="confirmDelete('detail', rowValue(row))" />
            </div>
          </template>
          <template #empty>
            <div class="flex flex-col items-center px-6 py-14 text-center">
              <UIcon name="i-heroicons-cube-transparent" class="mb-3 size-8 text-[var(--ui-text-muted)]" />
              <p class="font-medium">No models in this group</p>
              <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Add a model and optionally select channel groups allowed to execute it.</p>
            </div>
          </template>
        </UTable>
      </UCard>

      <div v-else class="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-8 text-center">
        <UIcon name="i-heroicons-rectangle-group" class="mb-3 size-8 text-[var(--ui-text-muted)]" />
        <p class="font-medium">Select a model group</p>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Its model bindings will appear here.</p>
      </div>
    </div>

    <UModal v-model:open="groupFormOpen" :title="editingGroup ? 'Edit model group' : 'Create model group'" description="Model groups are reusable model allowlists for client API keys.">
      <template #body>
        <form class="space-y-5" @submit.prevent="submitGroup">
          <UAlert v-if="formError" color="error" variant="subtle" icon="i-heroicons-exclamation-circle" title="Could not save model group" :description="formError" />
          <UFormField label="Group name" required>
            <UInput v-model="groupForm.group_name" class="w-full" placeholder="premium-models" autofocus />
          </UFormField>
          <UFormField label="Status">
            <div class="flex items-center gap-3 rounded-lg border border-[var(--ui-border)] p-3">
              <USwitch v-model="groupForm.enabled" />
              <div>
                <p class="text-sm font-medium">{{ groupForm.enabled ? 'Active' : 'Disabled' }}</p>
                <p class="text-xs text-[var(--ui-text-muted)]">Disabled groups do not contribute model access.</p>
              </div>
            </div>
          </UFormField>
          <div class="flex justify-end gap-3 border-t border-[var(--ui-border)] pt-4">
            <UButton color="neutral" variant="ghost" type="button" @click="groupFormOpen = false">Cancel</UButton>
            <UButton color="primary" type="submit" :loading="submitting">{{ editingGroup ? 'Save changes' : 'Create group' }}</UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="detailFormOpen" :title="editingDetail ? 'Edit model binding' : 'Add model binding'" description="Choose a catalog model or enter a canonical model ID manually.">
      <template #body>
        <form class="space-y-5" @submit.prevent="submitDetail">
          <UAlert v-if="formError" color="error" variant="subtle" icon="i-heroicons-exclamation-circle" title="Could not save model binding" :description="formError" />
          <UFormField label="Catalog model" hint="Optional">
            <USelectMenu v-model="detailForm.suggested_model_id" :items="modelOptions" value-key="value" label-key="label" class="w-full" placeholder="Search catalog models..." :search-input="{ placeholder: 'Search model ID or name...' }" @update:model-value="applyModelSuggestion" />
          </UFormField>
          <UFormField label="Model ID" required>
            <UInput v-model="detailForm.model_id" class="w-full font-mono" placeholder="gpt-5.5" autofocus />
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">Request-option suffixes such as “(high)” are stripped by the backend.</p>
          </UFormField>
          <fieldset class="rounded-lg border border-[var(--ui-border)] p-4">
            <legend class="px-1 text-sm font-medium">Allowed channel groups</legend>
            <p class="mb-3 text-xs text-[var(--ui-text-muted)]">Leave all unchecked to inherit the client API key's credential scope.</p>
            <div v-if="channels.length" class="max-h-56 space-y-2 overflow-auto pr-1">
              <UCheckbox
                v-for="channel in channels"
                :key="channel.id"
                :model-value="detailForm.channels.includes(channel.id)"
                :label="`${channel.channel_name}${channel.disabled ? ' (disabled)' : ''}`"
                @update:model-value="toggleChannel(channel.id, $event)"
              />
            </div>
            <p v-else class="text-sm text-[var(--ui-text-muted)]">No channel groups configured.</p>
          </fieldset>
          <div class="flex justify-end gap-3 border-t border-[var(--ui-border)] pt-4">
            <UButton color="neutral" variant="ghost" type="button" @click="detailFormOpen = false">Cancel</UButton>
            <UButton color="primary" type="submit" :loading="submitting">{{ editingDetail ? 'Save changes' : 'Add model' }}</UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" :title="deleteKind === 'group' ? 'Delete model group' : 'Remove model binding'" description="This action soft-deletes the selected record.">
      <template #body>
        <div class="space-y-5">
          <UAlert color="warning" variant="subtle" icon="i-heroicons-exclamation-triangle" title="Confirm deletion" :description="deleteDescription" />
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
const { fetchAPI } = useApi()
const toast = useToast()
const rowValue = (row) => row?.original ?? row
const search = ref('')
const pageError = ref('')
const selectedGroupId = ref(null)
const groupFormOpen = ref(false)
const detailFormOpen = ref(false)
const formError = ref('')
const submitting = ref(false)
const editingGroup = ref(null)
const editingDetail = ref(null)
const deleteOpen = ref(false)
const deleteKind = ref('')
const deleteTarget = ref(null)
const deleting = ref(false)
const groupForm = ref({ group_name: '', enabled: true })
const detailForm = ref({ model_id: '', suggested_model_id: '', channels: [] })

const groupColumns = [
  { accessorKey: 'identity', header: 'Model group' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'actions', header: '' }
]
const detailColumns = [
  { accessorKey: 'model', header: 'Model' },
  { accessorKey: 'channels', header: 'Credential scope' },
  { accessorKey: 'actions', header: '' }
]

async function loadWorkspace() {
  pageError.value = ''
  try {
    const [groupsResponse, channelsResponse, modelsResponse, staticModelsResponse] = await Promise.all([
      fetchAPI('/model-groups'),
      fetchAPI('/channel-groups'),
      fetchAPI('/models?scope=available'),
      fetchAPI('/models?scope=static').catch(() => ({ models: {} }))
    ])
    return { groupsResponse, channelsResponse, modelsResponse, staticModelsResponse }
  } catch (error) {
    pageError.value = errorMessage(error)
    return { groupsResponse: { model_groups: [] }, channelsResponse: { channel_groups: [] }, modelsResponse: { models: [] } }
  }
}
const { data, pending, refresh: refreshWorkspace } = await useAsyncData('routing-model-groups', loadWorkspace)
const groups = computed(() => Array.isArray(data.value?.groupsResponse?.model_groups) ? data.value.groupsResponse.model_groups : [])
const channels = computed(() => Array.isArray(data.value?.channelsResponse?.channel_groups) ? data.value.channelsResponse.channel_groups : [])
const models = computed(() => {
  const available = Array.isArray(data.value?.modelsResponse?.models) ? data.value.modelsResponse.models : []
  const staticGroups = data.value?.staticModelsResponse?.models
  const staticModels = staticGroups && typeof staticGroups === 'object' && !Array.isArray(staticGroups)
    ? Object.values(staticGroups).flatMap(group => Array.isArray(group) ? group : [])
    : []
  return [...new Map([...staticModels, ...available]
    .filter(model => model?.id)
    .map(model => [model.id, model])).values()]
})
const selectedGroup = computed(() => groups.value.find(group => group.id === selectedGroupId.value) || null)
const filteredGroups = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return groups.value
  return groups.value.filter(group => [group.id, group.group_name].some(value => String(value || '').toLowerCase().includes(query)))
})
const modelOptions = computed(() => [...models.value]
  .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
  .map(model => ({ value: model.id, label: `${model.display_name || model.id} · ${model.id}` })))

async function loadDetails() {
  if (!selectedGroupId.value) return { model_group_details: [] }
  try {
    return await fetchAPI(`/model-group-details?model_group_id=${selectedGroupId.value}`)
  } catch (error) {
    pageError.value = errorMessage(error)
    return { model_group_details: [] }
  }
}
const { data: detailsData, pending: detailsPending, refresh: refreshDetails } = await useAsyncData('routing-model-group-details', loadDetails, { immediate: false })
const details = computed(() => Array.isArray(detailsData.value?.model_group_details) ? detailsData.value.model_group_details : [])
const deleteDescription = computed(() => {
  if (!deleteTarget.value) return ''
  return deleteKind.value === 'group'
    ? `${deleteTarget.value.group_name} and all of its model bindings will be deleted.`
    : `${deleteTarget.value.model_id} will be removed from ${selectedGroup.value?.group_name || 'this group'}.`
})

async function selectGroup(row) {
  selectedGroupId.value = rowValue(row).id
  await refreshDetails()
}
function openCreateGroup() {
  editingGroup.value = null
  groupForm.value = { group_name: '', enabled: true }
  formError.value = ''
  groupFormOpen.value = true
}
function openEditGroup(group) {
  editingGroup.value = group
  groupForm.value = { group_name: group.group_name || '', enabled: !group.disabled }
  formError.value = ''
  groupFormOpen.value = true
}
async function submitGroup() {
  formError.value = ''
  const groupName = groupForm.value.group_name.trim()
  if (!groupName) return void (formError.value = 'Group name is required.')
  submitting.value = true
  try {
    const response = await fetchAPI(editingGroup.value ? `/model-groups/${editingGroup.value.id}` : '/model-groups', {
      method: editingGroup.value ? 'PATCH' : 'POST',
      body: { group_name: groupName, disabled: !groupForm.value.enabled }
    })
    groupFormOpen.value = false
    await refreshWorkspace()
    if (!editingGroup.value && response?.model_group?.id) selectedGroupId.value = response.model_group.id
    if (editingGroup.value?.id === selectedGroupId.value) selectedGroupId.value = editingGroup.value.id
    if (selectedGroupId.value) await refreshDetails()
    toast.add({ title: editingGroup.value ? 'Model group updated' : 'Model group created', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (error) {
    formError.value = errorMessage(error)
  } finally {
    submitting.value = false
  }
}
function openCreateDetail() {
  editingDetail.value = null
  detailForm.value = { model_id: '', suggested_model_id: '', channels: [] }
  formError.value = ''
  detailFormOpen.value = true
}
function openEditDetail(detail) {
  editingDetail.value = detail
  detailForm.value = {
    model_id: detail.model_id || '',
    suggested_model_id: models.value.some(model => model.id === detail.model_id) ? detail.model_id : '',
    channels: Array.isArray(detail.channels) ? [...detail.channels] : []
  }
  formError.value = ''
  detailFormOpen.value = true
}
function applyModelSuggestion(value) {
  if (value) detailForm.value.model_id = value
}
function toggleChannel(id, checked) {
  const ids = detailForm.value.channels
  if (checked && !ids.includes(id)) ids.push(id)
  if (!checked) detailForm.value.channels = ids.filter(value => value !== id)
}
async function submitDetail() {
  formError.value = ''
  const modelId = detailForm.value.model_id.trim()
  if (!modelId) return void (formError.value = 'Model ID is required.')
  submitting.value = true
  try {
    await fetchAPI(editingDetail.value ? `/model-group-details/${editingDetail.value.id}` : '/model-group-details', {
      method: editingDetail.value ? 'PATCH' : 'POST',
      body: { model_group_id: selectedGroupId.value, model_id: modelId, channels: [...detailForm.value.channels] }
    })
    detailFormOpen.value = false
    await refreshDetails()
    toast.add({ title: editingDetail.value ? 'Model binding updated' : 'Model added', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (error) {
    formError.value = errorMessage(error)
  } finally {
    submitting.value = false
  }
}
function confirmDelete(kind, target) {
  deleteKind.value = kind
  deleteTarget.value = target
  deleteOpen.value = true
}
async function performDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await fetchAPI(deleteKind.value === 'group' ? `/model-groups/${deleteTarget.value.id}` : `/model-group-details/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteOpen.value = false
    if (deleteKind.value === 'group') {
      if (selectedGroupId.value === deleteTarget.value.id) selectedGroupId.value = null
      await refreshWorkspace()
    } else {
      await refreshDetails()
    }
    toast.add({ title: deleteKind.value === 'group' ? 'Model group deleted' : 'Model binding removed', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (error) {
    toast.add({ title: 'Delete failed', description: errorMessage(error), color: 'error', icon: 'i-heroicons-exclamation-circle' })
  } finally {
    deleting.value = false
  }
}
function modelById(id) {
  return models.value.find(model => model.id === id)
}
function channelName(id) {
  const channel = channels.value.find(item => item.id === id)
  return channel ? `${channel.channel_name}${channel.disabled ? ' (disabled)' : ''}` : `Channel #${id}`
}
function errorMessage(error) {
  return error?.data?.message || error?.data?.error || error?.response?._data?.message || error?.response?._data?.error || error?.message || 'Unexpected request error.'
}
</script>
