<template>
  <AdminDataPanel title="Proxy pool" description="Globally scoped proxy records. Changes are applied immediately.">
    <template #actions><AppButton color="neutral" variant="ghost" icon="i-tabler-refresh" :loading="loading" @click="loadPools" /><AppButton size="sm" icon="i-tabler-plus" :disabled="unsupported" @click="openCreate">New proxy</AppButton></template>

    <div v-if="unsupported || loadError" class="p-4">
    <UAlert
      v-if="unsupported"
      color="warning"
      variant="subtle"
      icon="i-tabler-alert-triangle"
      title="Proxy pools are not supported"
      description="This Home instance does not expose the proxy-pool Management API. Upgrade Home to create and manage proxy-pool records."
    />
    <UAlert
      v-else-if="loadError"
      color="error"
      variant="subtle"
      icon="i-tabler-alert-circle"
      title="Proxy pools could not be loaded"
      :description="loadError"
    />
    </div>

        <AppTable :columns="columns" :data="sortedPools" :loading="loading" class="min-w-[1180px]">
          <template #name-cell="{ row }">
            <span class="font-medium text-[var(--ui-text-highlighted)]">{{ rowValue(row).name }}</span>
          </template>

          <template #proxy_url-cell="{ row }">
            <span class="block max-w-80 truncate font-mono text-xs" :title="rowValue(row).proxy_url">{{ rowValue(row).proxy_url }}</span>
          </template>

          <template #state-cell="{ row }">
            <div class="flex items-center gap-2">
              <USwitch
                :model-value="Boolean(rowValue(row).enabled)"
                :disabled="Boolean(togglingId)"
                :aria-label="`${rowValue(row).enabled ? 'Disable' : 'Enable'} ${rowValue(row).name}`"
                @update:model-value="toggleEnabled(rowValue(row), Boolean($event))"
              />
              <span class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).enabled ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </template>

          <template #scope-cell="{ row }">
            <UBadge color="neutral" variant="subtle">{{ rowValue(row).scope || 'global' }}</UBadge>
          </template>

          <template #priority-cell="{ row }">
            <span class="tabular-nums">{{ rowValue(row).priority ?? 0 }}</span>
          </template>

          <template #last_test-cell="{ row }">
            <div class="min-w-36">
              <UBadge v-if="rowValue(row).last_test_result" :color="testColor(rowValue(row).last_test_result)" variant="subtle">
                {{ rowValue(row).last_test_result }}
              </UBadge>
              <span v-else class="text-sm text-[var(--ui-text-muted)]">Not tested</span>
              <p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ formatDate(rowValue(row).last_tested_at) }}</p>
            </div>
          </template>

          <template #note-cell="{ row }">
            <span class="block max-w-56 truncate text-sm text-[var(--ui-text-muted)]" :title="rowValue(row).note || ''">{{ rowValue(row).note || '—' }}</span>
          </template>

          <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><AdminTableAction action="test" label="Test proxy" :loading="testingId === rowValue(row).id" :disabled="Boolean(testingId)" @click="testPool(rowValue(row))" /><AdminTableAction action="edit" label="Edit proxy" @click="openEdit(rowValue(row))" /><AdminTableAction action="delete" :label="`Delete ${rowValue(row).name}`" destructive @click="confirmDelete(rowValue(row))" /></div></template>

          <template #empty>
            <div class="py-12 text-center text-sm text-[var(--ui-text-muted)]">
              {{ unsupported ? 'Proxy pools are unavailable on this Home instance.' : 'No proxy-pool records.' }}
            </div>
          </template>
        </AppTable>

    <AppModal v-model:open="formOpen" :title="editingId ? 'Edit proxy' : 'New proxy'" description="Proxy-pool changes take effect immediately.">
      <template #body>
        <form class="space-y-4" @submit.prevent="savePool">
          <UFormField label="Name" required :error="formErrors.name">
            <UInput v-model="form.name" class="w-full" autocomplete="off" placeholder="Primary proxy" />
          </UFormField>

          <UFormField label="Proxy URL" required :error="formErrors.proxy_url" help="Supported schemes: http, https, socks5, socks5h.">
            <UInput v-model="form.proxy_url" class="w-full" autocomplete="off" placeholder="http://127.0.0.1:7890" />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Priority" required :error="formErrors.priority">
              <UInput v-model="form.priority" type="number" step="1" class="w-full" />
            </UFormField>
            <UFormField label="Scope">
              <UInput model-value="global" readonly class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Note">
            <UTextarea v-model="form.note" :rows="3" class="w-full" placeholder="Optional operator note" />
          </UFormField>

          <label class="flex items-center justify-between gap-4 rounded-lg border border-[var(--ui-border)] p-3">
            <span>
              <span class="block text-sm font-medium text-[var(--ui-text-highlighted)]">Enabled</span>
              <span class="block text-xs text-[var(--ui-text-muted)]">Store this proxy in the enabled state.</span>
            </span>
            <USwitch v-model="form.enabled" />
          </label>

          <UAlert v-if="formError" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Proxy could not be saved" :description="formError" />

          <div class="flex justify-end gap-2">
            <AppButton type="button" color="neutral" variant="ghost" :disabled="saving" @click="closeForm">Cancel</AppButton>
            <AppButton type="submit" :loading="saving">{{ editingId ? 'Save changes' : 'Create proxy' }}</AppButton>
          </div>
        </form>
      </template>
    </AppModal>

    <AppModal v-model:open="deleteOpen" title="Delete proxy">
      <template #body>
        <div class="space-y-5">
          <UAlert color="warning" variant="subtle" icon="i-tabler-alert-triangle" title="This proxy record will be deleted" :description="deleteTarget?.name || deleteTarget?.proxy_url" />
          <p class="text-sm text-[var(--ui-text-muted)]">This action cannot be undone.</p>
          <div class="flex justify-end gap-2">
            <AppButton color="neutral" variant="ghost" :disabled="deleting" @click="closeDelete">Cancel</AppButton>
            <AppButton color="error" :loading="deleting" @click="deletePool">Delete</AppButton>
          </div>
        </div>
      </template>
    </AppModal>
  </AdminDataPanel>
</template>

<script setup lang="ts">
interface ProxyPool {
  id: string
  name: string
  proxy_url: string
  enabled: boolean
  scope: string
  priority: number
  last_tested_at?: string | null
  last_test_result?: string | null
  note?: string
  updated_at?: string
}

interface ProxyPoolResponse {
  items?: ProxyPool[]
  proxy_pool?: ProxyPool
  result?: string
  message?: string
}

const { fetchAPI } = useApi()
const toast = useToast()

const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'proxy_url', header: 'URL' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'scope', header: 'Scope' },
  { accessorKey: 'priority', header: 'Priority' },
  { accessorKey: 'last_test', header: 'Last test' },
  { accessorKey: 'note', header: 'Note' },
  { accessorKey: 'actions', header: 'Actions', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]

const pools = ref<ProxyPool[]>([])
const loading = ref(false)
const unsupported = ref(false)
const loadError = ref('')
const testingId = ref('')
const togglingId = ref('')
const formOpen = ref(false)
const saving = ref(false)
const editingId = ref('')
const formError = ref('')
const formErrors = reactive({ name: '', proxy_url: '', priority: '' })
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteTarget = ref<ProxyPool | null>(null)
const emptyForm = () => ({ name: '', proxy_url: '', enabled: true, priority: '0', note: '' })
const form = reactive(emptyForm())

const sortedPools = computed(() => [...pools.value].sort((left, right) => {
  const priority = Number(left.priority || 0) - Number(right.priority || 0)
  return priority || String(left.name || '').localeCompare(String(right.name || ''))
}))

const rowValue = (row: any): ProxyPool => row?.original ?? row
const errorMessage = (error: any, fallback: string) => error?.data?.message || error?.data?.error || error?.message || fallback
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '—'
const testColor = (result?: string | null) => result === 'passed' ? 'success' : result === 'failed' ? 'error' : 'neutral'

function isUnsupportedError(error: any) {
  const text = errorMessage(error, '').toLowerCase()
  return error?.statusCode === 404 || text.includes('not found') || text.includes('not-found') || text.includes('not_found')
}

function replacePool(pool: ProxyPool) {
  const index = pools.value.findIndex(item => item.id === pool.id)
  if (index === -1) pools.value = [...pools.value, pool]
  else pools.value = pools.value.map(item => item.id === pool.id ? pool : item)
}

async function loadPools() {
  loading.value = true
  loadError.value = ''
  try {
    const response = await fetchAPI<ProxyPoolResponse>('/proxy/proxy-pools')
    pools.value = Array.isArray(response?.items) ? response.items : []
    unsupported.value = false
  } catch (error: any) {
    if (isUnsupportedError(error)) {
      unsupported.value = true
      pools.value = []
    } else {
      loadError.value = errorMessage(error, 'Unable to load proxy pools.')
    }
  } finally {
    loading.value = false
  }
}

function resetValidation() {
  formError.value = ''
  formErrors.name = ''
  formErrors.proxy_url = ''
  formErrors.priority = ''
}

function openCreate() {
  if (unsupported.value) return
  editingId.value = ''
  Object.assign(form, emptyForm())
  resetValidation()
  formOpen.value = true
}

function openEdit(pool: ProxyPool) {
  editingId.value = pool.id
  Object.assign(form, {
    name: pool.name || '',
    proxy_url: pool.proxy_url || '',
    enabled: Boolean(pool.enabled),
    priority: String(pool.priority ?? 0),
    note: pool.note || ''
  })
  resetValidation()
  formOpen.value = true
}

function validateForm() {
  resetValidation()
  const name = form.name.trim()
  const proxyURL = form.proxy_url.trim()
  const priority = Number(form.priority)

  if (!name) formErrors.name = 'Name is required.'
  if (!proxyURL) {
    formErrors.proxy_url = 'Proxy URL is required.'
  } else {
    try {
      const parsed = new URL(proxyURL)
      if (!['http:', 'https:', 'socks5:', 'socks5h:'].includes(parsed.protocol)) formErrors.proxy_url = 'Use an http, https, socks5, or socks5h URL.'
      else if (!parsed.hostname) formErrors.proxy_url = 'Proxy URL must include a host.'
    } catch {
      formErrors.proxy_url = 'Enter a valid proxy URL.'
    }
  }
  if (!Number.isInteger(priority)) formErrors.priority = 'Priority must be an integer.'

  return !formErrors.name && !formErrors.proxy_url && !formErrors.priority
}

async function savePool() {
  if (!validateForm()) return
  saving.value = true
  formError.value = ''
  const body = {
    name: form.name.trim(),
    proxy_url: form.proxy_url.trim(),
    enabled: Boolean(form.enabled),
    priority: Number(form.priority),
    scope: 'global',
    note: form.note.trim()
  }

  try {
    const response = editingId.value
      ? await fetchAPI<ProxyPoolResponse>(`/proxy/proxy-pools/${encodeURIComponent(editingId.value)}`, { method: 'PATCH', body })
      : await fetchAPI<ProxyPoolResponse>('/proxy/proxy-pools', { method: 'POST', body })
    if (response?.proxy_pool) replacePool(response.proxy_pool)
    formOpen.value = false
    toast.add({ title: editingId.value ? 'Proxy updated' : 'Proxy created', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error: any) {
    formError.value = errorMessage(error, 'Unable to save the proxy.')
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(pool: ProxyPool, enabled: boolean) {
  if (togglingId.value || pool.enabled === enabled) return
  togglingId.value = pool.id
  try {
    const response = await fetchAPI<ProxyPoolResponse>(`/proxy/proxy-pools/${encodeURIComponent(pool.id)}`, { method: 'PATCH', body: { enabled } })
    replacePool(response?.proxy_pool || { ...pool, enabled })
    toast.add({ title: enabled ? 'Proxy enabled' : 'Proxy disabled', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'State update failed', description: errorMessage(error, 'Unable to update the proxy state.'), color: 'error' })
  } finally {
    togglingId.value = ''
  }
}

async function testPool(pool: ProxyPool) {
  if (testingId.value) return
  testingId.value = pool.id
  try {
    const response = await fetchAPI<ProxyPoolResponse>(`/proxy/proxy-pools/${encodeURIComponent(pool.id)}/test`, { method: 'POST' })
    const result = response?.result || 'failed'
    replacePool({ ...pool, last_test_result: result, last_tested_at: new Date().toISOString() })
    toast.add({
      title: result === 'passed' ? 'Proxy test passed' : 'Proxy test failed',
      description: response?.message,
      color: result === 'passed' ? 'success' : 'error'
    })
  } catch (error: any) {
    toast.add({ title: 'Proxy test failed', description: errorMessage(error, 'Unable to test the proxy.'), color: 'error' })
  } finally {
    testingId.value = ''
  }
}

function closeForm() {
  formOpen.value = false
}

function closeDelete() {
  deleteOpen.value = false
}

function confirmDelete(pool: ProxyPool) {
  deleteTarget.value = pool
  deleteOpen.value = true
}

async function deletePool() {
  if (!deleteTarget.value || deleting.value) return
  deleting.value = true
  const target = deleteTarget.value
  try {
    await fetchAPI(`/proxy/proxy-pools/${encodeURIComponent(target.id)}`, { method: 'DELETE' })
    pools.value = pools.value.filter(pool => pool.id !== target.id)
    deleteOpen.value = false
    deleteTarget.value = null
    toast.add({ title: 'Proxy deleted', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error: any) {
    toast.add({ title: 'Delete failed', description: errorMessage(error, 'Unable to delete the proxy.'), color: 'error' })
  } finally {
    deleting.value = false
  }
}

onMounted(loadPools)
</script>
