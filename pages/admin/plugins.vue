<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Plugins</h1><p class="mt-1 text-sm text-[var(--ui-text-muted)]">Inspect installed plugins, browse configured stores, and manage registry authentication.</p></div><AppButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="pending" @click="refreshAll">Refresh</AppButton></div>
    <UAlert v-if="pageError" color="error" variant="subtle" title="Plugin data could not be loaded" :description="pageError" />
    <div class="grid gap-4 sm:grid-cols-3"><AppCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Configured / registered</p><p class="mt-2 text-2xl font-bold">{{ installed.length }}</p></AppCard><AppCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Store entries</p><p class="mt-2 text-2xl font-bold">{{ store.length }}</p></AppCard><AppCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Auth rules</p><p class="mt-2 text-2xl font-bold">{{ authRules.length }}</p></AppCard></div>
    <UAlert v-if="operation" :color="operation.error ? 'error' : 'info'" variant="subtle" :title="operation.title" :description="operation.error || operation.detail" />
    <AppCard v-if="operation?.response && !operation.error"><div class="space-y-1 text-sm"><p>Configuration status: <strong>{{ operation.response.status }}</strong><span v-if="operation.response.version"> · version {{ operation.response.version }}</span><span v-if="operation.response.source_name"> · {{ operation.response.source_name }}</span></p><p v-if="operation.response.task">Delete task #{{ operation.response.task.id }} · {{ operation.response.task.operation }} · target {{ operation.response.target_node_type || operation.response.task.target_node_type }}<span v-if="operation.response.target_node_id || operation.response.task.target_node_id"> / {{ operation.response.target_node_id || operation.response.task.target_node_id }}</span></p><p v-if="operation.response.configured_removed !== undefined">Configuration removed: {{ operation.response.configured_removed ? 'yes' : 'no' }}</p><p v-if="operation.response.plugins_enabled === false">Plugins are globally disabled.</p><p v-if="operation.response.restart_required">Restart required.</p><p v-if="operation.response.task">Task created; node completion is not reported by this response.</p><p v-else>Configuration updated; node rollout is not reported by this response.</p></div></AppCard>
        <AppCard>
          <div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-semibold">CPA plugin reports</h2><p class="text-xs text-[var(--ui-text-muted)]">Self-reported observations from active nodes, not proof of rollout completion. Delete reports may remain after uninstall.</p></div><AppButton color="neutral" variant="ghost" size="sm" icon="i-tabler-refresh" :loading="nodesLoading" @click="startNodePolling">Refresh reports</AppButton></div>
          <UAlert v-if="nodesError" class="mt-3" color="error" variant="subtle" title="Node reports could not be loaded" :description="nodesError" />
          <div v-if="nodesResponse" class="mt-4 space-y-3 text-sm">
            <p class="text-[var(--ui-text-muted)]">{{ nodesResponse.plugin_report_required ? 'Plugin reports required by current configuration' : 'No plugin reports required by current configuration' }} · {{ activeNodes.length }} active CPA nodes</p>
            <p v-if="!activeNodes.length" class="text-[var(--ui-text-muted)]">No active CPA nodes to report rollout. Previously stored reports do not confirm current deployment.</p>
            <div v-for="(node, index) in activeNodes" :key="`${node.node_id || node.ip}-${index}`" class="rounded-lg border border-[var(--ui-border)] p-3">
              <div class="flex flex-wrap items-center gap-2"><strong>{{ node.node_name || node.node_id || node.ip || 'Unknown node' }}</strong><span v-if="node.node_name && node.node_id" class="text-xs text-[var(--ui-text-muted)]">{{ node.node_id }}</span><UBadge :color="reportColor(node.plugin_report_state)" variant="subtle">{{ reportLabel(node.plugin_report_state) }}</UBadge><UBadge v-if="!node.healthy" color="warning" variant="subtle">node unhealthy</UBadge></div>
              <div v-for="(report, reportIndex) in node.plugin_report_statuses || []" :key="reportIndex" class="mt-2 break-words text-xs text-[var(--ui-text-muted)]"><p>{{ report.task || 'Plugin task' }} · {{ report.status || 'unknown' }}<span v-if="report.phase"> · {{ report.phase }}</span><span v-if="report.updated_at"> · {{ report.updated_at }}</span></p><p v-for="(item, itemIndex) in report.plugins || []" :key="itemIndex" class="pl-3">{{ item.id }} · install: {{ item.install_status || 'unknown' }} · load: {{ item.load_status || 'unknown' }}<span v-if="item.error"> · {{ item.error }}</span></p><p v-if="report.error" class="pl-3">{{ report.error }}</p></div>
            </div>
            <p v-if="pollExpired" class="text-xs text-[var(--ui-text-muted)]">Automatic report refresh has stopped. Refresh reports to check again.</p>
          </div>
        </AppCard>
    <div class="border-b border-[var(--ui-border)]"><div class="flex gap-1"><AppButton v-for="item in sections" :key="item.value" color="neutral" :variant="section === item.value ? 'soft' : 'ghost'" @click="section = item.value">{{ item.label }}</AppButton></div></div>

    <section v-if="section === 'installed'" class="space-y-4">
      <UAlert v-if="pluginsResponse && !pluginsResponse.plugins_enabled" color="warning" variant="subtle" title="Plugins are globally disabled" description="Configured plugins will not become effective until the runtime plugin switch is enabled." />
      <div class="grid gap-4 lg:grid-cols-2"><AppCard v-for="plugin in installed" :key="plugin.id"><div class="flex items-start justify-between gap-4"><div class="min-w-0"><div class="flex items-center gap-2"><p class="font-semibold">{{ plugin.metadata?.name || plugin.id }}</p><UBadge :color="plugin.effective_enabled ? 'success' : 'neutral'" variant="subtle">{{ plugin.effective_enabled ? 'effective' : plugin.enabled ? 'enabled' : 'disabled' }}</UBadge></div><p class="mt-1 font-mono text-xs text-[var(--ui-text-muted)]">{{ plugin.id }}<span v-if="plugin.metadata?.version"> · {{ plugin.metadata.version }}</span></p><p v-if="plugin.metadata?.author" class="mt-2 text-sm text-[var(--ui-text-muted)]">by {{ plugin.metadata.author }}</p></div><AppButton v-if="plugin.configured" color="error" variant="ghost" size="sm" icon="i-tabler-trash" :loading="busyPlugin === plugin.id" :disabled="!!busyPlugin" aria-label="Uninstall plugin" @click="uninstall(plugin.id)" /></div><div class="mt-4 flex flex-wrap gap-1"><UBadge v-if="plugin.registered" color="info" variant="subtle">registered</UBadge><UBadge v-if="plugin.configured" color="neutral" variant="subtle">configured</UBadge><UBadge v-if="plugin.supports_oauth" color="primary" variant="subtle">OAuth: {{ plugin.oauth_provider || 'supported' }}</UBadge></div><AppButton color="neutral" variant="link" size="sm" class="mt-3" @click="selectedInstalled = selectedInstalled === plugin.id ? '' : plugin.id">{{ selectedInstalled === plugin.id ? 'Hide details' : 'Details' }}</AppButton><div v-if="selectedInstalled === plugin.id" class="mt-3 space-y-2 break-words text-sm text-[var(--ui-text-muted)]"><p>Configured: {{ plugin.configured ? 'yes' : 'no' }} · Registered on Home: {{ plugin.registered ? 'yes' : 'no' }} · Enabled: {{ plugin.enabled ? 'yes' : 'no' }} · Effective: {{ plugin.effective_enabled ? 'yes' : 'no' }}</p><p v-if="plugin.path">Path: <code>{{ plugin.path }}</code></p><p v-if="plugin.metadata?.github_repository">Repository: <a v-if="safeURL(plugin.metadata.github_repository)" :href="safeURL(plugin.metadata.github_repository)" target="_blank" rel="noopener noreferrer" class="underline">{{ plugin.metadata.github_repository }}</a><span v-else> {{ plugin.metadata.github_repository }}</span></p><p v-for="field in plugin.config_fields || []" :key="field.name">{{ field.name }} ({{ field.type }})<span v-if="field.description"> — {{ field.description }}</span><span v-if="field.enum_values?.length"> · options: {{ field.enum_values.join(', ') }}</span></p><p v-for="menu in plugin.menus || []" :key="menu.path">Menu: {{ menu.menu }} · {{ menu.path }}<span v-if="menu.description"> — {{ menu.description }}</span></p></div></AppCard><p v-if="!installed.length" class="py-12 text-center text-sm text-[var(--ui-text-muted)] lg:col-span-2">No plugins are configured or registered.</p></div>
    </section>

    <section v-else-if="section === 'store'" class="space-y-4">
      <UAlert v-if="storeResponse && !storeResponse.plugins_enabled" color="warning" variant="subtle" title="Plugins are globally disabled" description="Installing a manifest does not enable plugins globally." />
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><UInput v-model="storeSearch" icon="i-tabler-search" placeholder="Search store..." class="w-full"/><USelect v-model="sourceFilter" :items="sourceOptions" value-key="value" label-key="label" aria-label="Catalog source" class="w-full"/><USelect v-model="statusFilter" :items="statusOptions" value-key="value" label-key="label" aria-label="Plugin status" class="w-full"/><USelect v-model="installFilter" :items="installOptions" value-key="value" label-key="label" aria-label="Install type" class="w-full"/></div>
      <p class="text-xs text-[var(--ui-text-muted)]">{{ filteredStore.length }} of {{ store.length }} entries · {{ storeResponse?.plugins_dir || 'plugins' }}</p>
      <div v-if="storeResponse?.sources?.length" class="flex flex-wrap gap-2 text-xs"><span class="text-[var(--ui-text-muted)]">Sources:</span><span v-for="source in storeResponse.sources" :key="source.id">{{ source.name || source.id }}<span v-if="source.url" class="text-[var(--ui-text-muted)]"> ({{ source.url }})</span></span></div>
      <UAlert v-for="failure in storeResponse?.source_errors || []" :key="failure.source_id" color="warning" variant="subtle" :title="`Store source failed: ${failure.source_name || failure.source_id}`" :description="failure.message" />
      <div class="grid gap-4 lg:grid-cols-2"><AppCard v-for="plugin in filteredStore" :key="plugin.store_id || `${plugin.source_id}/${plugin.id}`"><div class="flex h-full flex-col"><div class="flex items-start justify-between gap-4"><div><div class="flex items-center gap-2"><p class="font-semibold">{{ plugin.name || plugin.id }}</p><UBadge v-if="plugin.update_available" color="warning" variant="subtle">update</UBadge></div><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ plugin.author || 'Unknown author' }} · {{ plugin.version || 'unversioned' }} · {{ plugin.source_name || plugin.source_id }}</p></div><UBadge :color="plugin.installed ? 'success' : 'neutral'" variant="subtle">{{ plugin.installed ? `installed ${plugin.installed_version}` : plugin.install_type }}</UBadge></div><p class="mt-3 flex-1 text-sm text-[var(--ui-text-muted)]">{{ plugin.description || 'No description provided.' }}</p><div class="mt-4 flex flex-wrap gap-1"><UBadge v-for="tag in plugin.tags || []" :key="tag" color="neutral" variant="subtle" size="sm">{{ tag }}</UBadge><UBadge v-if="plugin.auth_required" color="warning" variant="subtle" size="sm">auth required</UBadge></div><div class="mt-4 flex flex-wrap items-center justify-between gap-3"><AppButton color="neutral" variant="link" size="sm" @click="selectedStore = selectedStore === (plugin.store_id || `${plugin.source_id}/${plugin.id}`) ? '' : (plugin.store_id || `${plugin.source_id}/${plugin.id}`)">{{ selectedStore === (plugin.store_id || `${plugin.source_id}/${plugin.id}`) ? 'Hide details' : 'Details' }}</AppButton><div class="flex gap-2"><AppButton v-if="plugin.installed" color="error" variant="outline" size="sm" :loading="busyPlugin === plugin.id" :disabled="!!busyPlugin" @click="uninstall(plugin.id)">Uninstall</AppButton><AppButton v-if="!plugin.installed || plugin.update_available" size="sm" :loading="busyPlugin === plugin.id" :disabled="!!busyPlugin" @click="install(plugin)">{{ plugin.update_available ? 'Update' : 'Install' }}</AppButton></div></div><div v-if="selectedStore === (plugin.store_id || `${plugin.source_id}/${plugin.id}`)" class="mt-3 space-y-2 break-words text-sm text-[var(--ui-text-muted)]"><p>ID: <code>{{ plugin.id }}</code> · Source: {{ plugin.source_name || plugin.source_id }}<span v-if="plugin.source_url"> · {{ plugin.source_url }}</span></p><p>Install type: {{ plugin.install_type }} · Configured: {{ plugin.configured ? 'yes' : 'no' }} · Registered: {{ plugin.registered ? 'yes' : 'no' }} · Enabled: {{ plugin.enabled ? 'yes' : 'no' }} · Effective: {{ plugin.effective_enabled ? 'yes' : 'no' }}</p><p v-if="plugin.installed">Installed version: {{ plugin.installed_version || 'unknown' }}</p><p v-if="plugin.platforms?.length">Platforms: {{ plugin.platforms.map(platform => `${platform.goos}/${platform.goarch}`).join(', ') }}</p><p v-if="plugin.license">License: {{ plugin.license }}</p><p v-if="plugin.path">Path: <code>{{ plugin.path }}</code></p><p v-for="link in ['repository', 'homepage']" :key="link" v-show="plugin[link]">{{ link }}: <a v-if="safeURL(plugin[link])" :href="safeURL(plugin[link])" target="_blank" rel="noopener noreferrer" class="underline">{{ plugin[link] }}</a><span v-else> {{ plugin[link] }}</span></p></div></div></AppCard><p v-if="!filteredStore.length" class="py-12 text-center text-sm text-[var(--ui-text-muted)] lg:col-span-2">No matching store plugins.</p></div>
    </section>

    <section v-else class="space-y-4">
      <div class="flex justify-end"><AppButton icon="i-tabler-plus" @click="openAuthCreate">New auth rule</AppButton></div>
      <AppCard :ui="{ body: 'p-0' }"><AppTable :columns="authColumns" :data="authRules"><template #identity-cell="{ row }"><div><p class="font-medium">{{ value(row).name }}</p><p class="mt-1 font-mono text-xs text-[var(--ui-text-muted)]">{{ value(row).match }}</p></div></template><template #type-cell="{ row }"><div><UBadge color="neutral" variant="subtle">{{ value(row).auth_type }}</UBadge><p v-if="value(row).header_name" class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ value(row).header_name }}</p></div></template><template #scope-cell="{ row }"><div class="flex flex-wrap gap-1"><UBadge v-for="scope in value(row).apply_to || []" :key="scope" color="info" variant="subtle" size="sm">{{ scope }}</UBadge><span v-if="!value(row).apply_to?.length" class="text-sm text-[var(--ui-text-muted)]">All requests</span></div></template><template #status-cell="{ row }"><UBadge :color="value(row).enabled ? 'success' : 'neutral'" variant="subtle">{{ value(row).enabled ? 'enabled' : 'disabled' }}</UBadge></template><template #actions-cell="{ row }"><div class="flex justify-end gap-1"><AdminTableAction action="edit" label="Edit authentication rule" @click="openAuthEdit(value(row))" /><AdminTableAction action="delete" label="Delete authentication rule" destructive @click="deleteAuth(value(row))" /></div></template><template #empty><div class="py-14 text-center text-sm text-[var(--ui-text-muted)]">No plugin-store authentication rules.</div></template></AppTable></AppCard>
    </section>

    <AppModal v-model:open="authOpen" :title="editingAuth ? 'Edit store auth rule' : 'Create store auth rule'" description="Secrets are write-only and are never returned by the API."><template #body><form class="space-y-4" @submit.prevent="saveAuth"><div class="grid gap-4 sm:grid-cols-2"><UFormField label="Name" required><UInput v-model="authForm.name" class="w-full"/></UFormField><UFormField label="URL match" required><UInput v-model="authForm.match" class="w-full" placeholder="https://github.com/owner/"/></UFormField></div><div class="grid gap-4 sm:grid-cols-2"><UFormField label="Authentication type" required><USelect v-model="authForm.auth_type" :items="authTypes" value-key="value" label-key="label" class="w-full"/></UFormField></div><fieldset class="space-y-2"><legend class="text-sm font-medium">Apply to</legend><div class="flex flex-wrap gap-4"><UCheckbox v-for="scope in authScopes" :key="scope" :model-value="authForm.apply_to.includes(scope)" :label="scope" @update:model-value="toggleScope(scope, $event)"/></div><p class="text-xs text-[var(--ui-text-muted)]">Select none to apply to all requests.</p></fieldset><UFormField v-if="['bearer', 'github-token'].includes(authForm.auth_type)" label="Token"><UInput v-model="authForm.token" type="password" class="w-full" :placeholder="editingAuth ? 'Leave blank to keep existing' : ''"/></UFormField><div v-if="authForm.auth_type === 'basic'" class="grid gap-4 sm:grid-cols-2"><UFormField label="Username"><UInput v-model="authForm.username" class="w-full"/></UFormField><UFormField label="Password"><UInput v-model="authForm.password" type="password" class="w-full" :placeholder="editingAuth ? 'Leave blank to keep existing' : ''"/></UFormField></div><div v-if="authForm.auth_type === 'header'" class="grid gap-4 sm:grid-cols-2"><UFormField label="Header name"><UInput v-model="authForm.header_name" class="w-full"/></UFormField><UFormField label="Header value"><UInput v-model="authForm.header_value" type="password" class="w-full" :placeholder="editingAuth ? 'Leave blank to keep existing' : ''"/></UFormField></div><UCheckbox v-model="authForm.enabled" label="Enabled"/><UAlert v-if="authError" color="error" variant="subtle" :description="authError"/><div class="flex justify-end gap-3"><AppButton color="neutral" variant="ghost" type="button" @click="authOpen = false">Cancel</AppButton><AppButton type="submit" :loading="savingAuth">Save</AppButton></div></form></template></AppModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const toast = useToast()
const value = row => row?.original ?? row
const section = ref('installed')
const sections = [{ label: 'Installed', value: 'installed' }, { label: 'Store', value: 'store' }, { label: 'Store authentication', value: 'auth' }]
const pageError = ref('')
const storeSearch = ref('')
const sourceFilter = ref('all')
const statusFilter = ref('all')
const installFilter = ref('all')
const selectedInstalled = ref('')
const selectedStore = ref('')
const operation = ref(null)
const busyPlugin = ref('')
const authOpen = ref(false)
const editingAuth = ref(null)
const authError = ref('')
const savingAuth = ref(false)
const emptyAuth = () => ({ name: '', match: '', apply_to: [], auth_type: 'bearer', token: '', username: '', password: '', header_name: '', header_value: '', enabled: true })
const authForm = reactive(emptyAuth())
const authTypes = [{ label: 'No authentication', value: 'none' }, { label: 'Bearer token', value: 'bearer' }, { label: 'Basic authentication', value: 'basic' }, { label: 'Custom header', value: 'header' }, { label: 'GitHub token', value: 'github-token' }]
const authScopes = ['registry', 'metadata', 'artifact']
const authColumns = [{ accessorKey: 'identity', header: 'Rule' }, { accessorKey: 'type', header: 'Type' }, { accessorKey: 'scope', header: 'Scope' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }]
async function loadAll() { pageError.value = ''; const result = {}; const failures = []; await Promise.all([['plugins', '/plugins'], ['store', '/plugins/store'], ['auth', '/plugin-store-auth']].map(async ([key, path]) => { try { result[key] = await fetchAPI(path) } catch (error) { failures.push(`${key}: ${message(error)}`); result[key] = key === 'auth' ? { items: [] } : { plugins: [] } } })); pageError.value = failures.join(' · '); return result }
const { data, pending, refresh: refreshData } = await useAsyncData('management-plugins', loadAll)
const nodesResponse = ref(null)
const nodesError = ref('')
const nodesLoading = ref(false)
const pollExpired = ref(false)
const activeNodes = computed(() => Array.isArray(nodesResponse.value?.nodes) ? nodesResponse.value.nodes : [])
const pollDuration = 60000
const pollInterval = 5000
let pollUntil = 0
let pollTimer
let pollGeneration = 0
function reportLabel(state) {
  return ({ not_required: 'Not required', missing_report: 'Pending report', reported_partial: 'Partial report', reported_failed: 'Failed report', reported_ok: 'Reported OK' })[state] || 'Report unavailable'
}
function reportColor(state) {
  return ({ not_required: 'neutral', missing_report: 'warning', reported_partial: 'warning', reported_failed: 'error', reported_ok: 'success' })[state] || 'neutral'
}
function scheduleNodePoll(generation) {
  if (generation !== pollGeneration || document.hidden) return
  clearTimeout(pollTimer)
  const remaining = pollUntil - Date.now()
  if (remaining <= 0) { pollExpired.value = true; return }
  pollTimer = setTimeout(() => { pollTimer = undefined; void loadNodes(generation) }, Math.min(pollInterval, remaining))
}
async function loadNodes(generation) {
  if (generation !== pollGeneration || document.hidden || nodesLoading.value) return
  nodesLoading.value = true
  try {
    const response = await fetchAPI('/nodes')
    if (generation !== pollGeneration) return
    nodesResponse.value = response
    nodesError.value = ''
  } catch (error) {
    if (generation === pollGeneration) nodesError.value = message(error)
  } finally {
    nodesLoading.value = false
    scheduleNodePoll(pollGeneration)
  }
}
function startNodePolling() {
  if (import.meta.server) return
  clearTimeout(pollTimer)
  pollGeneration++
  pollUntil = Date.now() + pollDuration
  pollExpired.value = false
  if (!nodesLoading.value) void loadNodes(pollGeneration)
  else scheduleNodePoll(pollGeneration)
}
function onVisibilityChange() {
  clearTimeout(pollTimer)
  if (!document.hidden) {
    if (pollUntil > Date.now()) { if (!nodesLoading.value) void loadNodes(pollGeneration); else scheduleNodePoll(pollGeneration) }
    else pollExpired.value = true
  }
}
onMounted(() => { document.addEventListener('visibilitychange', onVisibilityChange); startNodePolling() })
onUnmounted(() => { pollGeneration++; clearTimeout(pollTimer); document.removeEventListener('visibilitychange', onVisibilityChange) })
async function refreshAll() { await refreshData(); startNodePolling() }
const pluginsResponse = computed(() => data.value?.plugins || null)
const storeResponse = computed(() => data.value?.store || null)
const installed = computed(() => Array.isArray(pluginsResponse.value?.plugins) ? pluginsResponse.value.plugins : [])
const store = computed(() => Array.isArray(storeResponse.value?.plugins) ? storeResponse.value.plugins : [])
const authRules = computed(() => Array.isArray(data.value?.auth?.items) ? data.value.auth.items : [])
const sourceOptions = computed(() => [{ label: 'All sources', value: 'all' }, ...(storeResponse.value?.sources || []).map(source => ({ label: source.name || source.id, value: source.id }))])
const statusOptions = [{ label: 'All statuses', value: 'all' }, { label: 'Installed', value: 'installed' }, { label: 'Not installed', value: 'available' }, { label: 'Updates available', value: 'updates' }, { label: 'Effective', value: 'effective' }, { label: 'Disabled', value: 'disabled' }]
const installOptions = computed(() => [{ label: 'All install types', value: 'all' }, ...[...new Set(store.value.map(item => item.install_type).filter(Boolean))].map(type => ({ label: type, value: type }))])
const filteredStore = computed(() => {
  const q = storeSearch.value.trim().toLowerCase()
  return store.value.filter(item =>
    (sourceFilter.value === 'all' || item.source_id === sourceFilter.value) &&
    (installFilter.value === 'all' || item.install_type === installFilter.value) &&
    (statusFilter.value === 'all' || (statusFilter.value === 'installed' && item.installed) || (statusFilter.value === 'available' && !item.installed) || (statusFilter.value === 'updates' && item.update_available) || (statusFilter.value === 'effective' && item.effective_enabled) || (statusFilter.value === 'disabled' && item.configured && !item.effective_enabled)) &&
    (!q || [item.id, item.name, item.description, item.author, item.source_name, ...(item.tags || [])].some(v => String(v || '').toLowerCase().includes(q)))
  )
})
function safeURL(raw) { try { const url = new URL(raw); return ['http:', 'https:'].includes(url.protocol) ? url.href : '' } catch { return '' } }
async function install(plugin) {
  if (busyPlugin.value || !confirm(`${plugin.update_available ? 'Update' : 'Install'} ${plugin.name || plugin.id} from ${plugin.source_name || plugin.source_id}${plugin.version ? ` (version ${plugin.version})` : ' (latest release)'}? This updates the shared plugin configuration; node rollout is not reported by this operation.`)) return
  busyPlugin.value = plugin.id
  operation.value = { title: `Installing ${plugin.name || plugin.id}`, detail: 'Waiting for Home…' }
  try {
    const response = await fetchAPI(`/plugins/store/${encodeURIComponent(plugin.id)}/install`, { method: 'POST', query: { source: plugin.source_id || undefined }, body: plugin.version ? { version: plugin.version } : {} })
    operation.value = { title: `${plugin.name || plugin.id}: ${response.status}`, response }
    toast.add({ title: `${plugin.name || plugin.id}: ${response.status}`, description: 'Configuration updated; check CPA plugin reports for node observations.', color: 'info' })
    await refreshAll()
  } catch (error) { operation.value = { title: 'Install failed', error: message(error) }; toast.add({ title: 'Install failed', description: message(error), color: 'error' }) } finally { busyPlugin.value = '' }
}
async function uninstall(id) {
  if (busyPlugin.value || !confirm(`Uninstall ${id} from the entire Home/CPA cluster? This removes its shared configuration and creates a delete task for all nodes.`)) return
  busyPlugin.value = id
  operation.value = { title: `Uninstalling ${id}`, detail: 'Waiting for Home…' }
  try {
    const response = await fetchAPI(`/plugins/store/${encodeURIComponent(id)}/uninstall`, { method: 'POST' })
    operation.value = { title: `${id}: ${response.status}`, response }
    toast.add({ title: `${id}: ${response.status}`, description: 'Configuration updated; node completion is not confirmed.', color: 'info' })
    await refreshAll()
  } catch (error) { operation.value = { title: 'Uninstall failed', error: message(error) }; toast.add({ title: 'Uninstall failed', description: message(error), color: 'error' }) } finally { busyPlugin.value = '' }
}
function assignAuth(values) { Object.assign(authForm, emptyAuth(), values) }
function openAuthCreate() { editingAuth.value = null; assignAuth({}); authError.value = ''; authOpen.value = true }
function openAuthEdit(rule) { editingAuth.value = rule; assignAuth({ name: rule.name, match: rule.match, apply_to: [...(rule.apply_to || [])], auth_type: rule.auth_type, header_name: rule.header_name || '', enabled: rule.enabled }); authError.value = ''; authOpen.value = true }
function toggleScope(scope, checked) { authForm.apply_to = checked ? [...authForm.apply_to, scope] : authForm.apply_to.filter(value => value !== scope) }
function validateAuth() {
  if (!authForm.name.trim()) return 'Name is required.'
  const match = authForm.match.trim()
  try {
    const url = new URL(match)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || match.includes('?') || match.includes('#')) return 'URL match must be an absolute HTTPS URL without credentials, query, or fragment.'
  } catch { return 'URL match must be an absolute HTTPS URL.' }
  if (!authTypes.some(type => type.value === authForm.auth_type)) return 'Select a valid authentication type.'
  if (!Array.isArray(authForm.apply_to) || authForm.apply_to.some(scope => !authScopes.includes(scope))) return 'Select valid request scopes.'
  const needsCredentials = !editingAuth.value || editingAuth.value.auth_type !== authForm.auth_type || !editingAuth.value.credentials_configured
  if (['bearer', 'github-token'].includes(authForm.auth_type) && needsCredentials && !authForm.token) return 'Token is required.'
  if (authForm.auth_type === 'basic' && needsCredentials && (!authForm.username || !authForm.password)) return 'Username and password are required.'
  if (authForm.auth_type === 'header') {
    if (!authForm.header_name.trim() || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(authForm.header_name.trim())) return 'Enter a valid HTTP header name.'
    if (needsCredentials && !authForm.header_value) return 'Header value is required.'
  }
  const secret = ['bearer', 'github-token'].includes(authForm.auth_type) ? authForm.token : authForm.auth_type === 'header' ? authForm.header_value : ''
  if (/[\x00-\x08\x0A-\x1F\x7F]/.test(secret)) return 'Token or header value contains invalid HTTP header characters.'
  return ''
}
function authPayload() {
  const payload = { name: authForm.name.trim(), match: authForm.match.trim(), apply_to: [...authForm.apply_to], auth_type: authForm.auth_type, enabled: authForm.enabled }
  if (['bearer', 'github-token'].includes(authForm.auth_type) && authForm.token) payload.token = authForm.token
  if (authForm.auth_type === 'basic') {
    if (authForm.username) payload.username = authForm.username
    if (authForm.password) payload.password = authForm.password
  }
  if (authForm.auth_type === 'header') {
    payload.header_name = authForm.header_name.trim()
    if (authForm.header_value) payload.header_value = authForm.header_value
  }
  return payload
}
async function saveAuth() { authError.value = validateAuth(); if (authError.value) return; savingAuth.value = true; try { if (editingAuth.value) await fetchAPI(`/plugin-store-auth/${editingAuth.value.id}`, { method: 'PATCH', body: authPayload() }); else await fetchAPI('/plugin-store-auth', { method: 'POST', body: authPayload() }); authOpen.value = false; await refreshAll(); toast.add({ title: 'Store auth rule saved', color: 'success' }) } catch (error) { authError.value = message(error) } finally { savingAuth.value = false } }
async function deleteAuth(rule) { if (!confirm(`Delete auth rule ${rule.name}?`)) return; try { await fetchAPI(`/plugin-store-auth/${rule.id}`, { method: 'DELETE' }); await refreshAll(); toast.add({ title: 'Store auth rule deleted', color: 'success' }) } catch (error) { toast.add({ title: 'Delete failed', description: message(error), color: 'error' }) } }
function message(error) { return error?.data?.message || error?.data?.error || error?.message || 'Unexpected request error.' }
</script>
