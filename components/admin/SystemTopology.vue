<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">System topology</h1>
        <p class="mt-2 text-sm text-[var(--ui-text-muted)]">Inspect Home ownership, CPA heartbeat health, and operator-managed node names.</p>
      </div>
      <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="loading" @click="refreshSystem">
        Refresh
      </UButton>
    </section>

    <UAlert v-if="errorMessage" color="error" variant="subtle" icon="i-heroicons-exclamation-circle" title="System data could not be loaded" :description="errorMessage" />

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="stat in stats" :key="stat.label">
        <p class="text-sm text-[var(--ui-text-muted)]">{{ stat.label }}</p>
        <div class="mt-2 flex items-end justify-between gap-3">
          <p class="text-3xl font-bold text-[var(--ui-text-highlighted)]">{{ stat.value }}</p>
          <UIcon :name="stat.icon" class="size-6" :class="stat.color" />
        </div>
      </UCard>
    </section>

    <UCard v-if="topologyAvailable">
      <template #header>
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-semibold text-[var(--ui-text-highlighted)]">Home instances</h2>
            <p class="text-xs text-[var(--ui-text-muted)]">Shared-cluster heartbeat and CPA ownership</p>
          </div>
          <UBadge :color="topology?.summary?.missing_master ? 'error' : 'success'" variant="subtle">
            {{ topology?.summary?.missing_master ? 'Master missing' : 'Master available' }}
          </UBadge>
        </div>
      </template>

      <div class="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <div v-for="home in homes" :key="home.id" class="rounded-2xl border border-[var(--ui-border)] p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="healthDot(home.health)" />
                <p class="truncate font-mono text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ home.id }}</p>
              </div>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ home.role || 'unknown' }}{{ home.is_master ? ' · current master' : '' }}</p>
            </div>
            <UBadge :color="healthColor(home.health)" variant="subtle">{{ home.health || 'unknown' }}</UBadge>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg bg-[var(--ui-bg-muted)] p-2">
              <p class="text-lg font-semibold">{{ home.cpa_count || 0 }}</p>
              <p class="text-[10px] uppercase text-[var(--ui-text-dimmed)]">CPA</p>
            </div>
            <div class="rounded-lg bg-[var(--ui-bg-muted)] p-2">
              <p class="text-lg font-semibold">{{ home.healthy_cpa_count || 0 }}</p>
              <p class="text-[10px] uppercase text-[var(--ui-text-dimmed)]">Healthy</p>
            </div>
            <div class="rounded-lg bg-[var(--ui-bg-muted)] p-2">
              <p class="text-lg font-semibold">{{ home.client_count || 0 }}</p>
              <p class="text-[10px] uppercase text-[var(--ui-text-dimmed)]">Clients</p>
            </div>
          </div>
          <p class="mt-3 text-xs text-[var(--ui-text-dimmed)]">Last seen {{ formatDate(home.last_seen_at) }}</p>
        </div>
        <p v-if="!homes.length" class="py-8 text-center text-sm text-[var(--ui-text-muted)] lg:col-span-2">No Home instances reported.</p>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-semibold text-[var(--ui-text-highlighted)]">CPA nodes</h2>
            <p class="text-xs text-[var(--ui-text-muted)]">Active node snapshots; names are stored by Home</p>
          </div>
          <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Search nodes..." class="w-full sm:w-64" />
        </div>
      </template>

      <div v-if="typeof nodesResponse?.plugin_report_required === 'boolean' || Array.isArray(nodesResponse?.plugin_report_statuses)" class="mb-4 rounded-xl border border-[var(--ui-border)] p-4 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-medium text-[var(--ui-text-highlighted)]">Plugin reports</p>
          <UBadge v-if="typeof nodesResponse?.plugin_report_required === 'boolean'" :color="nodesResponse.plugin_report_required ? 'warning' : 'neutral'" variant="subtle">
            {{ nodesResponse.plugin_report_required ? 'Required' : 'Not required' }}
          </UBadge>
          <span v-if="Array.isArray(nodesResponse?.plugin_report_statuses)" class="text-xs text-[var(--ui-text-muted)]">{{ nodesResponse.plugin_report_statuses.length }} task reports</span>
        </div>
        <div v-if="Array.isArray(nodesResponse?.plugin_report_statuses) && nodesResponse.plugin_report_statuses.length" class="mt-3 max-h-48 space-y-2 overflow-y-auto">
          <div v-for="(report, index) in nodesResponse.plugin_report_statuses" :key="index" class="rounded-lg bg-[var(--ui-bg-muted)] p-2 text-xs">
            <p class="font-medium">{{ report.node_type || 'Node' }} {{ report.node_id || report.client_ip }} · {{ report.task }} · {{ report.status }}{{ report.phase ? ` (${report.phase})` : '' }}</p>
            <p v-for="(plugin, pluginIndex) in report.plugins" :key="pluginIndex" class="mt-1 text-[var(--ui-text-muted)]">
              {{ plugin.id }} · install: {{ plugin.install_status }}{{ plugin.load_status ? ` · load: ${plugin.load_status}` : '' }}{{ plugin.error ? ` · ${plugin.error}` : '' }}
            </p>
            <p v-if="report.error" class="mt-1 text-[var(--ui-text-muted)]">{{ report.error }}</p>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[860px] text-left text-sm">
          <thead class="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-dimmed)]">
            <tr>
              <th class="px-3 py-3 font-medium">Node</th>
              <th class="px-3 py-3 font-medium">Health</th>
              <th class="px-3 py-3 font-medium">Serving Home</th>
              <th class="px-3 py-3 font-medium">Connections</th>
              <th class="px-3 py-3 font-medium">Last seen</th>
              <th class="px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--ui-border)]">
            <tr v-for="node in filteredNodes" :key="node.node_id || node.ip" class="hover:bg-[var(--ui-bg-muted)]/60">
              <td class="px-3 py-4">
                <div v-if="editingId === node.node_id" class="flex max-w-sm items-center gap-2">
                  <UInput v-model="renameValue" size="sm" placeholder="Node name (empty clears)" class="flex-1" @keyup.enter="saveRename(node)" @keyup.esc="cancelRename" />
                  <UButton icon="i-heroicons-check" size="sm" :loading="renamingId === node.node_id" @click="saveRename(node)" />
                  <UButton icon="i-heroicons-x-mark" size="sm" color="neutral" variant="ghost" @click="cancelRename" />
                </div>
                <div v-else class="min-w-0">
                  <p class="font-medium text-[var(--ui-text-highlighted)]">{{ node.node_name || 'Unnamed node' }}</p>
                  <p class="mt-1 font-mono text-xs text-[var(--ui-text-muted)]">{{ node.node_id || 'No certificate ID' }}</p>
                  <p class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ node.ip }}</p>
                </div>
              </td>
              <td class="px-3 py-4">
                <UBadge :color="node.healthy ? 'success' : 'warning'" variant="subtle">{{ node.healthy ? 'healthy' : 'attention' }}</UBadge>
                <p v-if="node.state" class="mt-1 text-xs text-[var(--ui-text-dimmed)]">{{ node.state }}</p>
                <div v-if="node.plugin_report_state" class="mt-2">
                  <UBadge :color="pluginReportColor(node.plugin_report_state)" variant="subtle">Plugin: {{ node.plugin_report_state }}</UBadge>
                </div>
                <div v-if="Array.isArray(node.plugin_report_statuses) && node.plugin_report_statuses.length" class="mt-2 space-y-1 text-xs text-[var(--ui-text-muted)]">
                  <div v-for="(report, index) in node.plugin_report_statuses" :key="index">
                    <p>{{ report.task }} · {{ report.status }}{{ report.phase ? ` (${report.phase})` : '' }}</p>
                    <p v-for="(plugin, pluginIndex) in report.plugins" :key="pluginIndex" class="pl-2">
                      {{ plugin.id }} · install: {{ plugin.install_status }}{{ plugin.load_status ? ` · load: ${plugin.load_status}` : '' }}{{ plugin.error ? ` · ${plugin.error}` : '' }}
                    </p>
                    <p v-if="report.error" class="pl-2">{{ report.error }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-4 font-mono text-xs">{{ node.home_id || [node.home_ip, node.home_port].filter(Boolean).join(':') || '—' }}</td>
              <td class="px-3 py-4">{{ node.client_count ?? 0 }}</td>
              <td class="px-3 py-4 text-xs text-[var(--ui-text-muted)]">{{ formatDate(node.last_seen_at) }}</td>
              <td class="px-3 py-4 text-right">
                <UButton
                  v-if="node.node_id && editingId !== node.node_id"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-heroicons-pencil-square"
                  @click="startRename(node)"
                >Rename</UButton>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!filteredNodes.length" class="py-12 text-center">
          <UIcon name="i-heroicons-server-stack" class="mx-auto size-8 text-[var(--ui-text-dimmed)]" />
          <p class="mt-3 text-sm text-[var(--ui-text-muted)]">{{ search ? 'No nodes match your search.' : 'No connected CPA nodes.' }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { fetchAPI } = useApi()
const { supports, refreshCapabilities } = useCapabilities()

const topology = ref<any>(null)
const nodesResponse = ref<any>(null)
const loading = ref(false)
const errorMessage = ref('')
const search = ref('')
const editingId = ref('')
const renameValue = ref('')
const renamingId = ref('')

const topologyAvailable = computed(() => supports('topology', true))
const homes = computed<any[]>(() => Array.isArray(topology.value?.homes) ? topology.value.homes : [])
const nodes = computed<any[]>(() => {
  if (Array.isArray(nodesResponse.value?.nodes)) return nodesResponse.value.nodes
  if (Array.isArray(topology.value?.cpas)) return topology.value.cpas
  return []
})
const filteredNodes = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return nodes.value
  return nodes.value.filter(node => [node.node_name, node.node_id, node.ip, node.home_id, node.home_ip]
    .some(value => String(value || '').toLowerCase().includes(query)))
})

const stats = computed(() => [
  { label: 'Home instances', value: topology.value?.summary?.home_count ?? homes.value.length, icon: 'i-heroicons-building-office-2', color: 'text-indigo-500' },
  { label: 'Healthy Homes', value: topology.value?.summary?.healthy_home_count ?? homes.value.filter(home => home.healthy).length, icon: 'i-heroicons-heart', color: 'text-emerald-500' },
  { label: 'CPA nodes', value: topology.value?.summary?.cpa_count ?? nodes.value.length, icon: 'i-heroicons-server', color: 'text-sky-500' },
  { label: 'Needs attention', value: topology.value?.summary?.attention_count ?? nodes.value.filter(node => !node.healthy).length, icon: 'i-heroicons-exclamation-triangle', color: 'text-amber-500' }
])

function pluginReportColor(state: string) {
  if (state === 'reported_ok') return 'success'
  if (state === 'reported_failed' || state === 'missing_report') return 'error'
  if (state === 'reported_partial') return 'warning'
  return 'neutral'
}

function healthColor(health?: string) {
  if (health === 'healthy') return 'success'
  if (health === 'stale') return 'warning'
  return 'neutral'
}

function healthDot(health?: string) {
  if (health === 'healthy') return 'bg-emerald-500'
  if (health === 'stale') return 'bg-amber-500'
  return 'bg-slate-400'
}

function formatDate(value?: string) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const refreshSystem = async () => {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    await refreshCapabilities(true)
    const tasks: Array<Promise<void>> = [fetchAPI('/nodes').then(value => { nodesResponse.value = value })]
    if (supports('topology', true)) tasks.push(fetchAPI('/topology').then(value => { topology.value = value }))
    await Promise.all(tasks)
  } catch (error: any) {
    errorMessage.value = error?.message || 'Unable to load node and topology data.'
  } finally {
    loading.value = false
  }
}

function startRename(node: any) {
  editingId.value = node.node_id
  renameValue.value = node.node_name || ''
}

function cancelRename() {
  editingId.value = ''
  renameValue.value = ''
}

async function saveRename(node: any) {
  if (!node.node_id || renamingId.value) return
  renamingId.value = node.node_id
  errorMessage.value = ''
  try {
    const result = await fetchAPI<any>(`/nodes/${encodeURIComponent(node.node_id)}`, {
      method: 'PATCH',
      body: { node_name: renameValue.value.trim() || null }
    })
    node.node_name = result?.node_name ?? (renameValue.value.trim() || null)
    const topologyNode = Array.isArray(topology.value?.cpas)
      ? topology.value.cpas.find((item: any) => item.node_id === node.node_id)
      : null
    if (topologyNode) topologyNode.node_name = node.node_name
    cancelRename()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Unable to rename the node.'
  } finally {
    renamingId.value = ''
  }
}

onMounted(refreshSystem)
</script>
