<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Channel Groups</h1>
        <p class="mt-1 max-w-3xl text-sm text-[var(--ui-text-muted)]">
          Group credential auth IDs into reusable routing scopes for client API keys and model-specific restrictions.
        </p>
      </div>
      <AppButton color="primary" icon="i-tabler-plus" @click="openCreateGroup">New channel group</AppButton>
    </div>

    <UAlert v-if="pageError" color="error" variant="subtle" icon="i-tabler-alert-triangle" title="Unable to load channel groups" :description="pageError" />

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UInput v-model="search" icon="i-tabler-search" placeholder="Search channel groups..." class="w-full sm:max-w-sm" />
      <AppButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="pending" @click="refreshWorkspace">Refresh</AppButton>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
      <AppCard :ui="{ body: 'p-0' }">
        <template #header>
          <div>
            <p class="font-semibold">Groups</p>
            <p class="text-xs text-[var(--ui-text-muted)]">Select a group to manage its credentials.</p>
          </div>
        </template>
        <AppTable :columns="groupColumns" :data="filteredGroups" :loading="pending" @select="selectGroup">
          <template #identity-cell="{ row }">
            <button type="button" class="w-full text-left" @click.stop="selectGroup(rowValue(row))">
              <p class="font-medium text-[var(--ui-text-highlighted)]">{{ rowValue(row).channel_name }}</p>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">Group #{{ rowValue(row).id }}</p>
            </button>
          </template>
          <template #status-cell="{ row }">
            <UBadge :color="rowValue(row).disabled ? 'error' : 'success'" variant="subtle" size="sm">{{ rowValue(row).disabled ? 'Disabled' : 'Active' }}</UBadge>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <AppButton color="neutral" variant="ghost" size="sm" icon="i-tabler-pencil" aria-label="Edit group" @click.stop="openEditGroup(rowValue(row))" />
              <AppButton color="error" variant="ghost" size="sm" icon="i-tabler-trash" aria-label="Delete group" @click.stop="confirmDelete('group', rowValue(row))" />
            </div>
          </template>
          <template #empty>
            <div class="px-6 py-12 text-center text-sm text-[var(--ui-text-muted)]">{{ search ? 'No matching channel groups.' : 'No channel groups yet.' }}</div>
          </template>
        </AppTable>
      </AppCard>

      <AppCard v-if="selectedGroup" :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <p class="text-lg font-semibold">{{ selectedGroup.channel_name }}</p>
                <UBadge :color="selectedGroup.disabled ? 'error' : 'success'" variant="subtle" size="sm">{{ selectedGroup.disabled ? 'Disabled' : 'Active' }}</UBadge>
              </div>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ details.length }} credential binding{{ details.length === 1 ? '' : 's' }}</p>
            </div>
            <AppButton color="primary" variant="soft" icon="i-tabler-plus" @click="openCreateDetail">Add credential</AppButton>
          </div>
        </template>
        <AppTable :columns="detailColumns" :data="details" :loading="detailsPending">
          <template #credential-cell="{ row }">
            <div class="min-w-0">
              <p class="truncate font-medium">{{ credentialLabel(rowValue(row).auth_id) }}</p>
              <p class="mt-1 break-all font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).auth_id }}</p>
            </div>
          </template>
          <template #provider-cell="{ row }">
            <span class="text-sm">{{ credentialById(rowValue(row).auth_id)?.provider || credentialById(rowValue(row).auth_id)?.type || 'Manual ID' }}</span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <AppButton color="neutral" variant="ghost" size="sm" icon="i-tabler-pencil" aria-label="Edit credential binding" @click="openEditDetail(rowValue(row))" />
              <AppButton color="error" variant="ghost" size="sm" icon="i-tabler-trash" aria-label="Delete credential binding" @click="confirmDelete('detail', rowValue(row))" />
            </div>
          </template>
          <template #empty>
            <div class="flex flex-col items-center px-6 py-14 text-center">
              <UIcon name="i-tabler-id" class="mb-3 size-8 text-[var(--ui-text-muted)]" />
              <p class="font-medium">No credentials in this group</p>
              <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Add an auth ID from the available credentials or enter one manually.</p>
            </div>
          </template>
        </AppTable>
      </AppCard>

      <div v-else class="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-8 text-center">
        <UIcon name="i-tabler-arrows-exchange" class="mb-3 size-8 text-[var(--ui-text-muted)]" />
        <p class="font-medium">Select a channel group</p>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">Its credential bindings will appear here.</p>
      </div>
    </div>

    <AppModal v-model:open="groupFormOpen" :title="editingGroup ? 'Edit channel group' : 'Create channel group'" description="Channel groups are reusable credential routing scopes.">
      <template #body>
        <form class="space-y-5" @submit.prevent="submitGroup">
          <UAlert v-if="formError" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Could not save channel group" :description="formError" />
          <UFormField label="Group name" required>
            <UInput v-model="groupForm.channel_name" class="w-full" placeholder="premium-tier" autofocus />
          </UFormField>
          <UFormField label="Status">
            <div class="flex items-center gap-3 rounded-lg border border-[var(--ui-border)] p-3">
              <USwitch v-model="groupForm.enabled" />
              <div>
                <p class="text-sm font-medium">{{ groupForm.enabled ? 'Active' : 'Disabled' }}</p>
                <p class="text-xs text-[var(--ui-text-muted)]">Disabled groups do not contribute eligible credentials.</p>
              </div>
            </div>
          </UFormField>
          <div class="flex justify-end gap-3 border-t border-[var(--ui-border)] pt-4">
            <AppButton color="neutral" variant="ghost" type="button" @click="groupFormOpen = false">Cancel</AppButton>
            <AppButton color="primary" type="submit" :loading="submitting">{{ editingGroup ? 'Save changes' : 'Create group' }}</AppButton>
          </div>
        </form>
      </template>
    </AppModal>

    <AppModal v-model:open="detailFormOpen" :title="editingDetail ? 'Edit credential binding' : 'Add credential binding'" description="The backend stores the credential's canonical auth_id.">
      <template #body>
        <form class="space-y-5" @submit.prevent="submitDetail">
          <UAlert v-if="formError" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Could not save credential binding" :description="formError" />
          <UFormField label="Credential suggestion" hint="Optional">
            <USelectMenu v-model="detailForm.suggested_auth_id" :items="credentialOptions" value-key="value" label-key="label" class="w-full" placeholder="Search credentials..." :search-input="{ placeholder: 'Search credential name, provider, or ID...' }" @update:model-value="applyCredentialSuggestion" />
          </UFormField>
          <UFormField label="Auth ID" required>
            <UInput v-model="detailForm.auth_id" class="w-full font-mono" placeholder="auth-db-id" autofocus />
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">You may enter an ID manually when the credential is not present in the current auth-files response.</p>
          </UFormField>
          <div class="flex justify-end gap-3 border-t border-[var(--ui-border)] pt-4">
            <AppButton color="neutral" variant="ghost" type="button" @click="detailFormOpen = false">Cancel</AppButton>
            <AppButton color="primary" type="submit" :loading="submitting">{{ editingDetail ? 'Save changes' : 'Add credential' }}</AppButton>
          </div>
        </form>
      </template>
    </AppModal>

    <AppModal v-model:open="deleteOpen" :title="deleteKind === 'group' ? 'Delete channel group' : 'Remove credential binding'" description="This action soft-deletes the selected record.">
      <template #body>
        <div class="space-y-5">
          <UAlert color="warning" variant="subtle" icon="i-tabler-alert-triangle" title="Confirm deletion" :description="deleteDescription" />
          <div class="flex justify-end gap-3">
            <AppButton color="neutral" variant="ghost" @click="deleteOpen = false">Cancel</AppButton>
            <AppButton color="error" :loading="deleting" @click="performDelete">Delete</AppButton>
          </div>
        </div>
      </template>
    </AppModal>
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
const groupForm = ref({ channel_name: '', enabled: true })
const detailForm = ref({ auth_id: '', suggested_auth_id: '' })

const groupColumns = [
  { accessorKey: 'identity', header: 'Channel group' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]
const detailColumns = [
  { accessorKey: 'credential', header: 'Credential' },
  { accessorKey: 'provider', header: 'Provider' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]

async function loadWorkspace() {
  pageError.value = ''
  try {
    const [groupsResponse, authResponse] = await Promise.all([fetchAPI('/channel-groups'), fetchAPI('/credentials')])
    return { groupsResponse, authResponse }
  } catch (error) {
    pageError.value = errorMessage(error)
    return { groupsResponse: { channel_groups: [] }, authResponse: { files: [] } }
  }
}
const { data, pending, refresh: refreshWorkspace } = await useAsyncData('routing-channel-groups', loadWorkspace)
const groups = computed(() => Array.isArray(data.value?.groupsResponse?.channel_groups) ? data.value.groupsResponse.channel_groups : [])
const credentials = computed(() => Array.isArray(data.value?.authResponse) ? data.value.authResponse : Array.isArray(data.value?.authResponse?.credentials) ? data.value.authResponse.credentials : Array.isArray(data.value?.authResponse?.files) ? data.value.authResponse.files : [])
const selectedGroup = computed(() => groups.value.find(group => group.id === selectedGroupId.value) || null)
const filteredGroups = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return groups.value
  return groups.value.filter(group => [group.id, group.channel_name].some(value => String(value || '').toLowerCase().includes(query)))
})
const credentialOptions = computed(() => credentials.value.map(auth => ({
  value: auth.id || auth.auth_index || '',
  label: `${auth.label || auth.email || auth.name || auth.id || auth.auth_index} · ${auth.provider || auth.type || 'unknown'} · ${auth.id || auth.auth_index}`
})).filter(option => option.value))

async function loadDetails() {
  if (!selectedGroupId.value) return { channel_group_details: [] }
  try {
    return await fetchAPI(`/channel-group-details?channel_group_id=${selectedGroupId.value}`)
  } catch (error) {
    pageError.value = errorMessage(error)
    return { channel_group_details: [] }
  }
}
const { data: detailsData, pending: detailsPending, refresh: refreshDetails } = await useAsyncData('routing-channel-group-details', loadDetails, { immediate: false })
const details = computed(() => Array.isArray(detailsData.value?.channel_group_details) ? detailsData.value.channel_group_details : [])
const deleteDescription = computed(() => {
  if (!deleteTarget.value) return ''
  return deleteKind.value === 'group'
    ? `${deleteTarget.value.channel_name} and all of its credential bindings will be deleted.`
    : `${credentialLabel(deleteTarget.value.auth_id)} will be removed from ${selectedGroup.value?.channel_name || 'this group'}.`
})

async function selectGroup(row) {
  selectedGroupId.value = rowValue(row).id
  await refreshDetails()
}
function openCreateGroup() {
  editingGroup.value = null
  groupForm.value = { channel_name: '', enabled: true }
  formError.value = ''
  groupFormOpen.value = true
}
function openEditGroup(group) {
  editingGroup.value = group
  groupForm.value = { channel_name: group.channel_name || '', enabled: !group.disabled }
  formError.value = ''
  groupFormOpen.value = true
}
async function submitGroup() {
  formError.value = ''
  const channelName = groupForm.value.channel_name.trim()
  if (!channelName) return void (formError.value = 'Group name is required.')
  submitting.value = true
  try {
    const response = await fetchAPI(editingGroup.value ? `/channel-groups/${editingGroup.value.id}` : '/channel-groups', {
      method: editingGroup.value ? 'PATCH' : 'POST',
      body: { channel_name: channelName, disabled: !groupForm.value.enabled }
    })
    groupFormOpen.value = false
    await refreshWorkspace()
    if (!editingGroup.value && response?.channel_group?.id) selectedGroupId.value = response.channel_group.id
    if (editingGroup.value?.id === selectedGroupId.value) selectedGroupId.value = editingGroup.value.id
    if (selectedGroupId.value) await refreshDetails()
    toast.add({ title: editingGroup.value ? 'Channel group updated' : 'Channel group created', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error) {
    formError.value = errorMessage(error)
  } finally {
    submitting.value = false
  }
}
function openCreateDetail() {
  editingDetail.value = null
  detailForm.value = { auth_id: '', suggested_auth_id: '' }
  formError.value = ''
  detailFormOpen.value = true
}
function openEditDetail(detail) {
  editingDetail.value = detail
  detailForm.value = { auth_id: detail.auth_id || '', suggested_auth_id: credentials.value.some(auth => (auth.id || auth.auth_index) === detail.auth_id) ? detail.auth_id : '' }
  formError.value = ''
  detailFormOpen.value = true
}
function applyCredentialSuggestion(value) {
  if (value) detailForm.value.auth_id = value
}
async function submitDetail() {
  formError.value = ''
  const authId = detailForm.value.auth_id.trim()
  if (!authId) return void (formError.value = 'Auth ID is required.')
  submitting.value = true
  try {
    await fetchAPI(editingDetail.value ? `/channel-group-details/${editingDetail.value.id}` : '/channel-group-details', {
      method: editingDetail.value ? 'PATCH' : 'POST',
      body: { channel_group_id: selectedGroupId.value, auth_id: authId }
    })
    detailFormOpen.value = false
    await refreshDetails()
    toast.add({ title: editingDetail.value ? 'Credential binding updated' : 'Credential added', color: 'success', icon: 'i-tabler-circle-check' })
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
    await fetchAPI(deleteKind.value === 'group' ? `/channel-groups/${deleteTarget.value.id}` : `/channel-group-details/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteOpen.value = false
    if (deleteKind.value === 'group') {
      if (selectedGroupId.value === deleteTarget.value.id) selectedGroupId.value = null
      await refreshWorkspace()
    } else {
      await refreshDetails()
    }
    toast.add({ title: deleteKind.value === 'group' ? 'Channel group deleted' : 'Credential binding removed', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error) {
    toast.add({ title: 'Delete failed', description: errorMessage(error), color: 'error', icon: 'i-tabler-alert-circle' })
  } finally {
    deleting.value = false
  }
}
function credentialById(authId) {
  return credentials.value.find(auth => auth.id === authId || auth.auth_index === authId)
}
function credentialLabel(authId) {
  const auth = credentialById(authId)
  return auth?.label || auth?.email || auth?.name || authId
}
function errorMessage(error) {
  return error?.data?.message || error?.data?.error || error?.response?._data?.message || error?.response?._data?.error || error?.message || 'Unexpected request error.'
}
</script>
