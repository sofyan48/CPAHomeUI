<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold">Upstream proxies</h1>
        <p class="mt-1 max-w-3xl text-sm text-[var(--ui-text-muted)]">Set the active global upstream proxy and maintain testable proxy-pool records.</p>
      </div>
      <UButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="loading" @click="loadAll">Refresh</UButton>
    </div>

    <UAlert v-if="errorMessage" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Proxy request failed" :description="errorMessage" />

    <AppCard>
      <template #header>
        <div>
          <h2 class="font-semibold">Active global proxy</h2>
          <p class="text-xs text-[var(--ui-text-muted)]">Used by runtime outbound traffic and by diagnostics when a selected credential has no proxy.</p>
        </div>
      </template>
      <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="saveGlobalProxy">
        <UFormField label="Proxy URL" class="flex-1">
          <UInput v-model="globalProxy" placeholder="http://127.0.0.1:7890" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-tabler-check" :loading="savingGlobal">Save</UButton>
        <UButton color="neutral" variant="outline" icon="i-tabler-x" :loading="savingGlobal" @click="clearGlobalProxy">Clear</UButton>
      </form>
    </AppCard>

    <UAlert color="info" variant="subtle" icon="i-tabler-info-circle" title="Pool records are informational" description="Proxy-pool records can be stored and tested, but they do not currently alter runtime priority, auth selection, dispatch, or outbound routing. Only the global proxy above is active." />

    <AppCard :ui="{ body: 'p-0' }">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-semibold">Proxy pool</h2>
            <p class="text-xs text-[var(--ui-text-muted)]">{{ pools.length }} stored proxy records</p>
          </div>
          <UButton icon="i-tabler-plus" @click="openCreate">Add proxy</UButton>
        </div>
      </template>
      <AppTable :columns="columns" :data="pools" :loading="loading">
        <template #identity-cell="{ row }">
          <div class="min-w-48">
            <p class="font-medium">{{ value(row).name }}</p>
            <p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ value(row).proxy_url }}</p>
          </div>
        </template>
        <template #status-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UBadge :color="value(row).enabled ? 'success' : 'neutral'" variant="subtle">{{ value(row).enabled ? 'Enabled' : 'Disabled' }}</UBadge>
            <UBadge v-if="value(row).last_test_result" :color="value(row).last_test_result === 'passed' ? 'success' : 'error'" variant="subtle">{{ value(row).last_test_result }}</UBadge>
          </div>
          <p v-if="value(row).last_tested_at" class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ formatDate(value(row).last_tested_at) }}</p>
        </template>
        <template #priority-cell="{ row }"><span class="tabular-nums">{{ value(row).priority }}</span></template>
        <template #note-cell="{ row }"><span class="text-sm text-[var(--ui-text-muted)]">{{ value(row).note || '—' }}</span></template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton size="sm" color="neutral" variant="ghost" icon="i-tabler-antenna-bars-5" :loading="testingId === value(row).id" @click="testPool(value(row))">Test</UButton>
            <UButton size="sm" color="neutral" variant="ghost" icon="i-tabler-pencil" @click="openEdit(value(row))">Edit</UButton>
            <UButton size="sm" color="error" variant="ghost" icon="i-tabler-trash" @click="removePool(value(row))" />
          </div>
        </template>
        <template #empty><div class="py-12 text-center text-sm text-[var(--ui-text-muted)]">No proxy-pool records.</div></template>
      </AppTable>
    </AppCard>

    <UModal v-model:open="formOpen" :title="editing ? 'Edit proxy record' : 'Add proxy record'" description="Store a globally scoped proxy endpoint for operator testing.">
      <template #body>
        <form class="space-y-4" @submit.prevent="savePool">
          <UFormField label="Name" required><UInput v-model="form.name" class="w-full" /></UFormField>
          <UFormField label="Proxy URL" required><UInput v-model="form.proxy_url" placeholder="http://127.0.0.1:7890" class="w-full" /></UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Priority"><UInput v-model.number="form.priority" type="number" class="w-full" /></UFormField>
            <UFormField label="Scope"><UInput model-value="global" disabled class="w-full" /></UFormField>
          </div>
          <UFormField label="Note"><UTextarea v-model="form.note" :rows="3" class="w-full" /></UFormField>
          <label class="flex items-center justify-between rounded-lg border border-[var(--ui-border)] p-3">
            <span class="text-sm font-medium">Enabled</span><USwitch v-model="form.enabled" />
          </label>
          <p v-if="formError" class="text-sm text-red-600 dark:text-red-400">{{ formError }}</p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="formOpen = false">Cancel</UButton>
            <UButton type="submit" :loading="savingPool">{{ editing ? 'Save changes' : 'Create proxy' }}</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup>

const { fetchAPI } = useApi()
const toast = useToast()
const loading = ref(false)
const savingGlobal = ref(false)
const savingPool = ref(false)
const testingId = ref('')
const errorMessage = ref('')
const formError = ref('')
const globalProxy = ref('')
const poolsResponse = ref(null)
const formOpen = ref(false)
const editing = ref(null)
const emptyForm = () => ({ name: '', proxy_url: '', enabled: true, priority: 0, note: '' })
const form = ref(emptyForm())
const pools = computed(() => Array.isArray(poolsResponse.value?.items) ? poolsResponse.value.items : [])
const columns = [
  { accessorKey: 'identity', header: 'Proxy' }, { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'priority', header: 'Priority' }, { accessorKey: 'note', header: 'Note' }, { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]
const value = row => row?.original || row
const formatDate = input => input ? new Date(input).toLocaleString() : '—'
const message = (error, fallback) => error?.data?.message || error?.data?.error || error?.message || fallback

async function loadAll() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [proxy, pool] = await Promise.all([fetchAPI('/proxy-url'), fetchAPI('/proxy/proxy-pools')])
    globalProxy.value = proxy?.['proxy-url'] || ''
    poolsResponse.value = pool
  } catch (error) { errorMessage.value = message(error, 'Unable to load proxy configuration.') }
  finally { loading.value = false }
}
async function saveGlobalProxy() {
  savingGlobal.value = true
  try {
    if (!globalProxy.value.trim()) await fetchAPI('/proxy-url', { method: 'DELETE' })
    else await fetchAPI('/proxy-url', { method: 'PATCH', body: { value: globalProxy.value.trim() } })
    toast.add({ title: 'Global proxy saved', color: 'success' })
    await loadAll()
  } catch (error) { errorMessage.value = message(error, 'Unable to save the global proxy.') }
  finally { savingGlobal.value = false }
}
async function clearGlobalProxy() { globalProxy.value = ''; await saveGlobalProxy() }
function openCreate() { editing.value = null; form.value = emptyForm(); formError.value = ''; formOpen.value = true }
function openEdit(pool) {
  editing.value = pool
  form.value = { name: pool.name || '', proxy_url: pool.proxy_url || '', enabled: Boolean(pool.enabled), priority: Number(pool.priority) || 0, note: pool.note || '' }
  formError.value = ''; formOpen.value = true
}
async function savePool() {
  if (!form.value.name.trim() || !form.value.proxy_url.trim()) { formError.value = 'Name and proxy URL are required.'; return }
  savingPool.value = true; formError.value = ''
  const body = { ...form.value, name: form.value.name.trim(), proxy_url: form.value.proxy_url.trim(), scope: 'global', note: form.value.note.trim() }
  try {
    if (editing.value) await fetchAPI(`/proxy/proxy-pools/${encodeURIComponent(editing.value.id)}`, { method: 'PATCH', body })
    else await fetchAPI('/proxy/proxy-pools', { method: 'POST', body })
    formOpen.value = false; toast.add({ title: editing.value ? 'Proxy updated' : 'Proxy created', color: 'success' }); await loadAll()
  } catch (error) { formError.value = message(error, 'Unable to save proxy record.') }
  finally { savingPool.value = false }
}
async function testPool(pool) {
  testingId.value = pool.id; errorMessage.value = ''
  try {
    const result = await fetchAPI(`/proxy/proxy-pools/${encodeURIComponent(pool.id)}/test`, { method: 'POST' })
    toast.add({ title: result?.result === 'passed' ? 'Proxy test passed' : 'Proxy test failed', description: result?.message, color: result?.result === 'passed' ? 'success' : 'error' })
    await loadAll()
  } catch (error) { errorMessage.value = message(error, 'Unable to test proxy.') }
  finally { testingId.value = '' }
}
async function removePool(pool) {
  if (!window.confirm(`Delete proxy record “${pool.name}”?`)) return
  try { await fetchAPI(`/proxy/proxy-pools/${encodeURIComponent(pool.id)}`, { method: 'DELETE' }); toast.add({ title: 'Proxy deleted', color: 'success' }); await loadAll() }
  catch (error) { errorMessage.value = message(error, 'Unable to delete proxy.') }
}
onMounted(loadAll)
</script>
