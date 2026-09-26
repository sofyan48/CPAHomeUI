<template>
  <section class="grid w-full gap-5">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Client access keys</h1>
          <UBadge color="primary" variant="subtle">{{ keys.length }} keys configured</UBadge>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="loading" @click="syncData">
          {{ loading ? 'Syncing' : 'Sync data' }}
        </UButton>
        <UButton icon="i-heroicons-plus" @click="openCreate">New access key</UButton>
      </div>
    </header>

    <UAlert
      v-if="primaryError"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-triangle"
      title="Access keys could not be loaded"
      :description="primaryError"
    />

    <AdminDataPanel
      v-else
      title="Access keys"
      description="These keys grant clients access to the Home Center server; they are not model provider keys."
      class="min-w-0"
    >
      <template #actions>
        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <UButton color="neutral" variant="outline" icon="i-heroicons-arrows-right-left" :disabled="loading" @click="openReplace">
            Replace all
          </UButton>
          <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Filter keys" class="w-full sm:w-72" />
        </div>
      </template>

      <div class="p-4">
        <div
          v-if="selectedIDs.size"
          class="mb-3 flex flex-col gap-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <span class="text-sm font-medium">{{ selectedIDs.size }} keys selected</span>
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="outline" size="sm" :disabled="allFilteredSelected || !filteredKeys.length || bulkDeleting" @click="toggleAllFiltered(true)">
              Select filtered
            </UButton>
            <UButton color="neutral" variant="ghost" size="sm" :disabled="bulkDeleting" @click="clearSelection">Clear selection</UButton>
            <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" :disabled="bulkDeleting" @click="openBulkDelete">
              Delete selected
            </UButton>
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-[var(--ui-border)]">
          <UTable :columns="columns" :data="filteredKeys" :loading="loading" class="access-keys-table table-fixed sm:min-w-[952px]">
            <template #select-header>
              <UCheckbox
                :model-value="allFilteredSelected"
                :indeterminate="someFilteredSelected"
                :disabled="loading || bulkDeleting || !filteredKeys.length"
                aria-label="Select all keys in the current list"
                @update:model-value="toggleAllFiltered(Boolean($event))"
              />
            </template>

            <template #select-cell="{ row }">
              <UCheckbox
                :model-value="selectedIDs.has(keyIdentity(rowValue(row)))"
                :disabled="bulkDeleting"
                :aria-label="`Select access key ${keySummary(rowValue(row))}`"
                @update:model-value="toggleSelected(rowValue(row), Boolean($event))"
              />
            </template>

            <template #number-cell="{ row }">
              <span class="font-mono text-xs text-[var(--ui-text-muted)]">#{{ rowValue(row)._number }}</span>
            </template>

            <template #identity-cell="{ row }">
              <div class="min-w-0">
                <button
                  v-if="rowValue(row).display_name"
                  type="button"
                  class="block max-w-full truncate text-left text-sm font-medium hover:underline"
                  @click="openDetail(rowValue(row))"
                >
                  {{ rowValue(row).display_name }}
                </button>
                <button
                  v-if="stableIdentifier(rowValue(row))"
                  type="button"
                  class="block max-w-full truncate text-left font-mono text-xs font-medium hover:underline"
                  @click="openDetail(rowValue(row))"
                >
                  {{ stableIdentifier(rowValue(row)) }}
                </button>
                <p v-else class="truncate text-xs text-[var(--ui-text-muted)]">No stable identifier</p>
                <div class="mt-1 flex min-w-0 items-center gap-1.5">
                  <p class="min-w-0 truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ maskKey(rowValue(row).api_key) }}</p>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-heroicons-clipboard"
                    :aria-label="`Copy key ${maskKey(rowValue(row).api_key)}`"
                    @click="copyText(rowValue(row).api_key, 'Access key copied.')"
                  />
                </div>
              </div>
            </template>

            <template #owner-cell="{ row }">
              <span v-if="rowValue(row).user_id">{{ ownerLabel(rowValue(row)) }}</span>
              <span v-else class="text-[var(--ui-text-muted)]">Unassigned</span>
            </template>

            <template #channels-cell="{ row }">
              <span class="block max-w-[220px] truncate">{{ groupList(rowValue(row).channels, channelName) }}</span>
            </template>

            <template #model_groups-cell="{ row }">
              <span class="block max-w-[220px] truncate">{{ groupList(rowValue(row).model_groups, modelGroupName) }}</span>
            </template>

            <template #length-cell="{ row }">{{ rowValue(row).api_key.length }}</template>

            <template #status-cell>
              <span class="inline-flex items-center gap-1.5 rounded-md border border-primary-500/30 bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-500">
                <UIcon name="i-heroicons-check-circle" class="size-3" />
                Accepted
              </span>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex justify-end">
                <UDropdownMenu :items="rowActions(rowValue(row))" :content="{ align: 'end' }">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-heroicons-ellipsis-horizontal"
                    :aria-label="`Actions for ${keySummary(rowValue(row))}`"
                  />
                </UDropdownMenu>
              </div>
            </template>

            <template #empty>
              <div class="px-6 py-12 text-center text-sm text-[var(--ui-text-muted)]">No access keys match the current filter.</div>
            </template>
          </UTable>
        </div>
      </div>
    </AdminDataPanel>

    <USlideover
      v-model:open="formOpen"
      :title="editingKey ? 'Update downstream key' : 'New downstream key'"
      :description="editingKey ? keySummary(editingKey) : 'Create access key'"
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <form id="access-key-form" class="grid gap-4" @submit.prevent="submitKey">
          <UFormField v-if="displayNameSupported" label="Display name" hint="Optional, up to 128 characters. Renaming does not change the key value, owner, or scopes.">
            <UInput v-model="form.display_name" class="w-full" maxlength="128" placeholder="e.g. Production key" :disabled="submitting" />
          </UFormField>

          <UFormField label="Key value" required :error="formFieldError">
            <div class="flex gap-2">
              <UInput
                v-model="form.api_key"
                :type="formSecretVisible ? 'text' : 'password'"
                class="min-w-0 flex-1 font-mono"
                autocomplete="off"
                placeholder="sk-..."
                :disabled="submitting"
                @input="formFieldError = ''"
              />
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                :icon="formSecretVisible ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                :aria-label="formSecretVisible ? 'Hide' : 'Reveal'"
                @click="formSecretVisible = !formSecretVisible"
              />
            </div>
          </UFormField>

          <UButton type="button" color="neutral" variant="outline" icon="i-heroicons-sparkles" :disabled="submitting" @click="generateKey">
            Generate key
          </UButton>

          <UAlert v-if="formError" color="error" variant="subtle" :description="formError" />

          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <UButton type="button" color="neutral" variant="outline" :disabled="submitting" @click="cancelForm">Cancel</UButton>
            <UButton type="submit" :loading="submitting">{{ editingKey ? 'Save key' : 'Create key' }}</UButton>
          </div>
        </form>
      </template>
    </USlideover>

    <USlideover v-model:open="detailOpen" title="Key detail" :description="detailTarget ? keySummary(detailTarget) : 'Select a key or create a new one.'" :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <div v-if="detailTarget" class="space-y-5">
          <div class="rounded-md border border-[var(--ui-border)] p-3">
            <p class="text-xs text-[var(--ui-text-muted)]">Secret value</p>
            <p class="mt-2 break-all font-mono text-sm">{{ detailSecretVisible ? detailTarget.api_key : maskKey(detailTarget.api_key) }}</p>
            <div class="mt-3 flex gap-2">
              <UButton color="neutral" variant="outline" size="sm" :icon="detailSecretVisible ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" @click="detailSecretVisible = !detailSecretVisible">
                {{ detailSecretVisible ? 'Hide' : 'Reveal' }}
              </UButton>
              <UButton color="neutral" variant="outline" size="sm" icon="i-heroicons-clipboard" @click="copyText(detailTarget.api_key, 'Access key copied.')">Copy</UButton>
            </div>
          </div>

          <dl class="grid gap-3 text-sm">
            <div v-if="displayNameSupported" class="rounded-md border border-[var(--ui-border)] px-3 py-2.5">
              <dt class="text-xs text-[var(--ui-text-muted)]">Display name</dt>
              <dd class="mt-1 break-words font-mono text-xs">{{ detailTarget.display_name || 'No display name' }}</dd>
            </div>
            <div class="rounded-md border border-[var(--ui-border)] px-3 py-2.5">
              <dt class="text-xs text-[var(--ui-text-muted)]">Owner</dt>
              <dd class="mt-1 break-words font-mono text-xs">{{ detailTarget.user_id ? ownerLabel(detailTarget) : 'Unassigned' }}</dd>
            </div>
            <div class="rounded-md border border-[var(--ui-border)] px-3 py-2.5">
              <dt class="text-xs text-[var(--ui-text-muted)]">Credential scope</dt>
              <dd class="mt-1 break-words font-mono text-xs">{{ groupList(detailTarget.channels, channelName) }}</dd>
            </div>
            <div class="rounded-md border border-[var(--ui-border)] px-3 py-2.5">
              <dt class="text-xs text-[var(--ui-text-muted)]">Model scope</dt>
              <dd class="mt-1 break-words font-mono text-xs">{{ groupList(detailTarget.model_groups, modelGroupName) }}</dd>
            </div>
          </dl>

          <div class="grid gap-2">
            <UButton icon="i-heroicons-pencil-square" @click="openEdit(detailTarget)">Edit</UButton>
            <UButton color="error" variant="outline" icon="i-heroicons-trash" @click="openDelete(detailTarget)">Delete</UButton>
          </div>
        </div>
      </template>
    </USlideover>

    <USlideover
      v-model:open="replaceOpen"
      title="Replace all access keys"
      description="This uses PUT /api-keys and replaces the entire downstream key list. Enter one key per line."
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <div class="space-y-5">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            description="Submitting this will overwrite the key list. Existing ownership and access scopes are preserved for unchanged keys; new keys start unrestricted."
          />
          <UFormField label="Keys">
            <UTextarea v-model="replaceText" :rows="14" class="w-full font-mono text-xs" :disabled="replacing" />
          </UFormField>
          <UAlert v-if="replaceError" color="error" variant="subtle" :description="replaceError" />
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <UButton color="neutral" variant="outline" :disabled="replacing" @click="closeReplace">Cancel</UButton>
            <UButton color="warning" icon="i-heroicons-arrows-right-left" :disabled="replacing" @click="openReplaceConfirmation">Replace all</UButton>
          </div>
        </div>
      </template>
    </USlideover>

    <UModal
      v-model:open="replaceConfirmOpen"
      title="Replace all access keys"
      description="Replace all access keys with the entered list? Existing scope bindings are preserved only for unchanged keys."
    >
      <template #body>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" :disabled="replacing" @click="replaceConfirmOpen = false">Cancel</UButton>
          <UButton color="error" :loading="replacing" @click="replaceAll">Replace all</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Delete access key?" :description="deleteTarget ? `Delete access key ${keySummary(deleteTarget)}?` : ''">
      <template #body>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" :disabled="deleting" @click="deleteOpen = false">Cancel</UButton>
          <UButton color="error" :loading="deleting" @click="deleteOne">Delete</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="bulkDeleteOpen" title="Delete selected access keys?" :description="`Delete ${selectedKeys.length} selected access keys?`">
      <template #body>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" :disabled="bulkDeleting" @click="bulkDeleteOpen = false">Cancel</UButton>
          <UButton color="error" :loading="bulkDeleting" @click="deleteSelected">Delete selected</UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

<script setup>
const { fetchAPI, fetchRaw } = useApi()
const { supports } = useCapabilities()
const toast = useToast()

const rowValue = row => row?.original ?? row
const search = ref('')
const loading = ref(false)
const primaryError = ref('')
const keysResponse = ref(null)
const usersResponse = ref(null)
const channelsResponse = ref(null)
const modelGroupsResponse = ref(null)
const collectionETag = ref('')
const selectedIDs = ref(new Set())

const formOpen = ref(false)
const formError = ref('')
const formFieldError = ref('')
const formSecretVisible = ref(false)
const submitting = ref(false)
const editingKey = ref(null)
const form = reactive({ api_key: '', display_name: '' })

const detailOpen = ref(false)
const detailTarget = ref(null)
const detailSecretVisible = ref(false)

const replaceOpen = ref(false)
const replaceConfirmOpen = ref(false)
const replaceText = ref('')
const replaceError = ref('')
const replacing = ref(false)
const replaceSnapshot = ref([])
const replaceETag = ref('')

const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

const bulkDeleteOpen = ref(false)
const bulkDeleting = ref(false)

const columns = [
  { accessorKey: 'select', header: '' },
  { accessorKey: 'number', header: 'No.' },
  { accessorKey: 'identity', header: 'Name / key' },
  { accessorKey: 'owner', header: 'Owner' },
  { accessorKey: 'channels', header: 'Credential scope' },
  { accessorKey: 'model_groups', header: 'Model scope' },
  { accessorKey: 'length', header: 'Length' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'actions', header: 'Actions' }
]

const rawEntries = computed(() => {
  const payload = keysResponse.value
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.api_key_entries)) return payload.api_key_entries
  const legacy = payload?.['api-keys'] || payload?.api_keys
  return Array.isArray(legacy) ? legacy.map((apiKey, index) => ({ api_key: apiKey, _legacyIndex: index })) : []
})

const displayNameSupported = computed(() => {
  const payload = keysResponse.value
  return Boolean(payload && (Object.prototype.hasOwnProperty.call(payload, 'items') || Object.prototype.hasOwnProperty.call(payload, 'api_key_entries')))
})

const keys = computed(() => rawEntries.value.map((entry, index) => ({
  ...entry,
  id: entry.id ?? entry.api_key_id ?? null,
  identifier: entry.identifier ?? entry.api_key_identifier ?? null,
  api_key: String(entry.api_key ?? entry['api-key'] ?? entry.key ?? entry.value ?? ''),
  display_name: entry.display_name ?? '',
  user_id: entry.user_id ?? entry['user-id'] ?? null,
  channels: Array.isArray(entry.channels) ? entry.channels : [],
  model_groups: Array.isArray(entry.model_groups) ? entry.model_groups : (Array.isArray(entry['model-groups']) ? entry['model-groups'] : []),
  _index: Number.isInteger(entry._legacyIndex) ? entry._legacyIndex : index,
  _number: index + 1
})).filter(entry => entry.api_key))

const users = computed(() => Array.isArray(usersResponse.value?.users) ? usersResponse.value.users : [])
const channels = computed(() => Array.isArray(channelsResponse.value?.channel_groups) ? channelsResponse.value.channel_groups : [])
const modelGroups = computed(() => Array.isArray(modelGroupsResponse.value?.model_groups) ? modelGroupsResponse.value.model_groups : [])

const filteredKeys = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return keys.value
  return keys.value.filter(key => [
    key.display_name,
    key.api_key,
    maskKey(key.api_key),
    stableIdentifier(key),
    String(key._number),
    ownerLabel(key),
    ...key.channels.map(channelName),
    ...key.model_groups.map(modelGroupName)
  ].some(value => String(value || '').toLowerCase().includes(query)))
})

const selectedKeys = computed(() => keys.value.filter(key => selectedIDs.value.has(keyIdentity(key))))
const selectedFilteredKeys = computed(() => filteredKeys.value.filter(key => selectedIDs.value.has(keyIdentity(key))))
const allFilteredSelected = computed(() => Boolean(filteredKeys.value.length) && selectedFilteredKeys.value.length === filteredKeys.value.length)
const someFilteredSelected = computed(() => selectedFilteredKeys.value.length > 0 && !allFilteredSelected.value)
const replacementKeys = computed(() => replaceText.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean))

async function loadPrimary() {
  const response = await fetchRaw('/api-keys')
  keysResponse.value = response._data
  collectionETag.value = response.headers?.get?.('etag') || ''
}

async function loadSupplemental(path, target) {
  try {
    target.value = await fetchAPI(path)
  } catch {
    target.value = null
  }
}

async function syncData() {
  loading.value = true
  primaryError.value = ''
  try {
    await loadPrimary()
    const tasks = []
    if (supports('users', true)) tasks.push(loadSupplemental('/users', usersResponse))
    else usersResponse.value = null
    if (supports('access_groups', true)) {
      tasks.push(loadSupplemental('/channel-groups', channelsResponse))
      tasks.push(loadSupplemental('/model-groups', modelGroupsResponse))
    } else {
      channelsResponse.value = null
      modelGroupsResponse.value = null
    }
    await Promise.all(tasks)
    const validIdentities = new Set(keys.value.map(keyIdentity))
    selectedIDs.value = new Set([...selectedIDs.value].filter(identity => validIdentities.has(identity)))
  } catch (error) {
    keysResponse.value = null
    collectionETag.value = ''
    primaryError.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingKey.value = null
  form.api_key = generatedKey()
  form.display_name = ''
  formError.value = ''
  formFieldError.value = ''
  formSecretVisible.value = false
  formOpen.value = true
}

function openEdit(key) {
  detailOpen.value = false
  editingKey.value = key
  form.api_key = key.api_key
  form.display_name = key.display_name || ''
  formError.value = ''
  formFieldError.value = ''
  formSecretVisible.value = false
  formOpen.value = true
}

function cancelForm() {
  if (editingKey.value) {
    formOpen.value = false
    openDetail(editingKey.value)
    return
  }
  formOpen.value = false
}

async function submitKey() {
  formError.value = ''
  formFieldError.value = ''
  const apiKey = form.api_key.trim()
  if (!apiKey) {
    formFieldError.value = 'Key value is required.'
    return
  }

  submitting.value = true
  const wasEditing = Boolean(editingKey.value)
  try {
    if (editingKey.value) {
      const value = { api_key: apiKey }
      if (displayNameSupported.value) value.display_name = form.display_name.trim() || null
      if (editingKey.value.id !== null) {
        await fetchAPI('/api-keys', { method: 'PATCH', body: { api_key_id: editingKey.value.id, value } })
      } else {
        await fetchAPI('/api-keys', { method: 'PATCH', body: { index: editingKey.value._index, value } })
      }
    } else {
      const body = { api_key: apiKey }
      if (displayNameSupported.value && form.display_name.trim()) body.display_name = form.display_name.trim()
      await fetchAPI('/api-keys', { method: 'POST', body })
    }
    formOpen.value = false
    await syncData()
    toast.add({ title: wasEditing ? 'Access key updated.' : 'Access key created.', color: 'success' })
  } catch (error) {
    formError.value = errorMessage(error)
  } finally {
    submitting.value = false
  }
}

function openDetail(key) {
  detailTarget.value = key
  detailSecretVisible.value = false
  detailOpen.value = true
}

function openReplace() {
  replaceSnapshot.value = keys.value.map(key => ({ ...key, channels: [...key.channels], model_groups: [...key.model_groups] }))
  replaceETag.value = collectionETag.value
  replaceText.value = replaceSnapshot.value.map(key => key.api_key).join('\n')
  replaceError.value = ''
  replaceConfirmOpen.value = false
  replaceOpen.value = true
}

function closeReplace() {
  replaceOpen.value = false
  replaceConfirmOpen.value = false
  replaceSnapshot.value = []
  replaceETag.value = ''
}

function openReplaceConfirmation() {
  replaceError.value = ''
  replaceConfirmOpen.value = true
}

async function replaceAll() {
  replacing.value = true
  replaceError.value = ''
  try {
    const existingBySecret = new Map(replaceSnapshot.value.map(key => [key.api_key, key]))
    const entries = replacementKeys.value.map(apiKey => {
      const existing = existingBySecret.get(apiKey)
      if (!existing) return { api_key: apiKey }
      return {
        api_key: apiKey,
        ...(displayNameSupported.value ? { display_name: existing.display_name || null } : {}),
        user_id: existing.user_id ?? null,
        channels: [...existing.channels],
        model_groups: [...existing.model_groups]
      }
    })
    const headers = replaceETag.value ? { 'If-Match': replaceETag.value } : {}
    await fetchAPI('/api-keys', { method: 'PUT', headers, body: { api_key_entries: entries } })
    closeReplace()
    selectedIDs.value = new Set()
    await syncData()
    toast.add({ title: 'Access key list replaced.', color: 'success' })
  } catch (error) {
    replaceConfirmOpen.value = false
    replaceError.value = error?.statusCode === 412
      ? 'The access key list changed after this sheet was opened. Sync data and try again.'
      : errorMessage(error)
  } finally {
    replacing.value = false
  }
}

function openDelete(key) {
  detailOpen.value = false
  deleteTarget.value = key
  deleteOpen.value = true
}

async function requestDelete(key) {
  const query = key.id !== null ? `id=${encodeURIComponent(key.id)}` : `index=${encodeURIComponent(key._index)}`
  await fetchAPI(`/api-keys?${query}`, { method: 'DELETE' })
}

async function deleteOne() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const identity = keyIdentity(deleteTarget.value)
    await requestDelete(deleteTarget.value)
    selectedIDs.value = new Set([...selectedIDs.value].filter(value => value !== identity))
    deleteOpen.value = false
    await syncData()
    toast.add({ title: 'Access key deleted.', color: 'success' })
  } catch (error) {
    toast.add({ title: 'Access key could not be deleted', description: errorMessage(error), color: 'error' })
  } finally {
    deleting.value = false
  }
}

function openBulkDelete() {
  bulkDeleteOpen.value = true
}

async function deleteSelected() {
  const targets = [...selectedKeys.value].sort((left, right) => right._index - left._index)
  if (!targets.length) return
  bulkDeleting.value = true
  try {
    for (const key of targets) await requestDelete(key)
    bulkDeleteOpen.value = false
    selectedIDs.value = new Set()
    await syncData()
    toast.add({ title: `${targets.length} access keys deleted.`, color: 'success' })
  } catch (error) {
    toast.add({ title: 'Selected access keys could not be deleted', description: errorMessage(error), color: 'error' })
    await syncData()
  } finally {
    bulkDeleting.value = false
  }
}

function rowActions(key) {
  return [[
    { label: 'View', icon: 'i-heroicons-eye', onSelect: () => openDetail(key) },
    { label: 'Edit', icon: 'i-heroicons-pencil-square', onSelect: () => openEdit(key) },
    ...(stableIdentifier(key) ? [{ label: 'Copy identifier', icon: 'i-heroicons-clipboard-document', onSelect: () => copyText(stableIdentifier(key), 'Identifier copied.') }] : []),
    { label: 'Delete', icon: 'i-heroicons-trash', color: 'error', onSelect: () => openDelete(key) }
  ]]
}

function toggleSelected(key, checked) {
  const next = new Set(selectedIDs.value)
  const identity = keyIdentity(key)
  if (checked) next.add(identity)
  else next.delete(identity)
  selectedIDs.value = next
}

function toggleAllFiltered(checked) {
  const next = new Set(selectedIDs.value)
  for (const key of filteredKeys.value) {
    if (checked) next.add(keyIdentity(key))
    else next.delete(keyIdentity(key))
  }
  selectedIDs.value = next
}

function clearSelection() {
  selectedIDs.value = new Set()
}

function generatedKey() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return `sk-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function generateKey() {
  form.api_key = generatedKey()
  formFieldError.value = ''
}

async function copyText(value, title) {
  try {
    await navigator.clipboard.writeText(String(value || ''))
    toast.add({ title, color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy value', color: 'error' })
  }
}

function keyIdentity(key) {
  return key.id !== null ? `id:${key.id}` : `value:${key.api_key}`
}

function stableIdentifier(key) {
  if (key.identifier) return String(key.identifier)
  return key.id !== null ? `api-key-${key.id}` : ''
}

function keySummary(key) {
  const identifier = stableIdentifier(key)
  const masked = maskKey(key.api_key)
  const identity = identifier ? `${identifier} · ${masked}` : masked
  return key.display_name ? `${key.display_name} · ${identity}` : identity
}

function maskKey(value) {
  const text = String(value || '')
  if (text.length <= 10) return '•'.repeat(Math.max(text.length, 6))
  return `${text.slice(0, 5)}${'•'.repeat(Math.min(16, text.length - 9))}${text.slice(-4)}`
}

function ownerLabel(key) {
  if (!key.user_id) return 'Unassigned'
  const user = users.value.find(item => Number(item.id) === Number(key.user_id))
  return user?.username || user?.display_name || `#${key.user_id}`
}

function channelName(id) {
  const group = channels.value.find(item => Number(item.id) === Number(id))
  return group?.channel_name || group?.name || `#${id}`
}

function modelGroupName(id) {
  const group = modelGroups.value.find(item => Number(item.id) === Number(id))
  return group?.group_name || group?.name || `#${id}`
}

function groupList(ids, resolveName) {
  return ids.length ? ids.map(resolveName).join(', ') : 'Unrestricted'
}

function errorMessage(error) {
  const data = error?.data
  if (typeof data === 'string' && data.trim()) return data
  return data?.message || data?.error || error?.response?._data?.message || error?.response?._data?.error || error?.message || 'Unexpected request error.'
}

await syncData()
</script>

<style scoped>
.access-keys-table :deep(th:first-child),
.access-keys-table :deep(td:first-child) {
  width: 44px;
}

.access-keys-table :deep(th:last-child),
.access-keys-table :deep(td:last-child) {
  position: sticky;
  right: 0;
  z-index: 2;
  width: 88px;
  min-width: 88px;
  text-align: right;
  background: var(--ui-bg);
  box-shadow: -1px 0 0 var(--ui-border);
}

@media (max-width: 1023px) {
  .access-keys-table :deep(th:nth-child(2)),
  .access-keys-table :deep(td:nth-child(2)),
  .access-keys-table :deep(th:nth-child(4)),
  .access-keys-table :deep(td:nth-child(4)),
  .access-keys-table :deep(th:nth-child(5)),
  .access-keys-table :deep(td:nth-child(5)),
  .access-keys-table :deep(th:nth-child(6)),
  .access-keys-table :deep(td:nth-child(6)),
  .access-keys-table :deep(th:nth-child(7)),
  .access-keys-table :deep(td:nth-child(7)) {
    display: none;
  }

  .access-keys-table {
    min-width: 0;
  }
}
</style>
