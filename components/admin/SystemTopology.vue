<template>
  <section class="grid w-full gap-4">
    <AppCard v-if="loading && !loaded" class="min-h-36">
      <div class="flex min-h-28 items-center justify-center text-[var(--ui-text-muted)]">
        <UIcon name="i-tabler-loader-2" class="mr-2 size-5 animate-spin" /> Loading system information…
      </div>
    </AppCard>

    <AppCard v-else-if="fatalError" class="mx-auto w-full max-w-5xl">
      <div class="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div class="flex min-w-0 gap-4">
          <div class="flex size-11 shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-600">
            <UIcon name="i-tabler-alert-triangle" class="size-5" />
          </div>
          <div>
            <h1 class="text-xl font-semibold">Runtime and diagnostics could not be loaded</h1>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-[var(--ui-text-muted)]">{{ fatalError }}</p>
          </div>
        </div>
        <AppButton color="neutral" variant="outline" icon="i-tabler-refresh" @click="refreshSystem">Retry</AppButton>
      </div>
    </AppCard>

    <template v-else>
      <AppCard :ui="{ body: 'p-5' }">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div class="flex min-w-0 gap-4">
            <div class="flex size-11 shrink-0 items-center justify-center rounded-md border" :class="verdictClasses.icon">
              <UIcon :name="verdictIcon" class="size-5" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-semibold tracking-normal">{{ verdict.title }}</h1>
                <UBadge :color="verdictColor" variant="subtle">{{ verdict.badge }}</UBadge>
              </div>
              <p class="mt-2 max-w-3xl text-sm leading-6 text-[var(--ui-text-muted)]">{{ verdict.description }}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <UBadge color="neutral" variant="subtle">Runtime: {{ runtimeLabel }}</UBadge>
                <UBadge color="neutral" variant="subtle">Capabilities checked {{ formatDate(probedAt) }}</UBadge>
                <UBadge color="neutral" variant="subtle">Last synced: {{ formatDate(fetchedAt) }}</UBadge>
              </div>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <AppSyncButton :loading="loading" @click="refreshSystem" />
            <AppButton color="neutral" variant="outline" icon="i-tabler-square-terminal" @click="openDiagnostics">Diagnostics</AppButton>
          </div>
        </div>
        <div class="mt-5 grid gap-2 border-t border-[var(--ui-border)] pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <div v-for="fact in verdictFacts" :key="fact.label" class="rounded-md border px-3 py-2 text-xs font-medium" :class="toneClasses(fact.tone)">{{ fact.label }}</div>
        </div>
      </AppCard>

      <UAlert v-if="issues.length" color="warning" variant="subtle" icon="i-tabler-alert-triangle" title="Some diagnostic data could not be loaded">
        <template #description>
          <div class="mt-2 grid gap-1">
            <p v-for="issue in issues" :key="`${issue.scope}:${issue.message}`"><strong>{{ issue.scope }}</strong> · {{ issue.message }}</p>
          </div>
        </template>
      </UAlert>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <AppCard v-for="stat in summaryCards" :key="stat.label" :ui="{ body: 'p-3' }">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-medium text-[var(--ui-text-muted)]">{{ stat.label }}</p>
              <p class="mt-1.5 truncate text-lg font-semibold" :title="stat.value">{{ stat.value }}</p>
            </div>
            <div class="flex size-7 shrink-0 items-center justify-center rounded-md border" :class="toneClasses(stat.tone)">
              <UIcon :name="stat.icon" class="size-4" />
            </div>
          </div>
          <p class="mt-2 line-clamp-2 text-xs leading-5 text-[var(--ui-text-muted)]" :title="stat.detail">{{ stat.detail }}</p>
        </AppCard>
      </div>

      <AppCard :ui="{ body: 'p-4' }">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-base font-semibold">Home / CPA topology</h2>
              <UBadge :color="nodesSupported ? 'info' : 'warning'" variant="subtle">{{ topologySourceLabel }}</UBadge>
            </div>
            <p class="mt-1 text-xs leading-5 text-[var(--ui-text-muted)]">{{ topologyDescription }}</p>
          </div>
          <AppButton icon="i-tabler-plus" class="lg:shrink-0" @click="openEnrollment">Add node</AppButton>
        </div>

        <div class="mt-4">
          <div v-if="!nodesSupported" class="rounded-md border border-dashed p-8 text-center text-sm text-[var(--ui-text-muted)]">The current {{ runtimeLabel }} runtime does not expose the node query route.</div>
          <div v-else-if="!homeGroups.length" class="rounded-md border border-dashed p-8 text-center text-sm text-[var(--ui-text-muted)]">The node route is available, but there are no connection records yet.</div>
          <div v-else class="grid gap-3">
            <div class="flex flex-wrap gap-2">
              <UBadge color="info" variant="subtle">{{ homeGroups.length }} Home</UBadge>
              <UBadge color="neutral" variant="subtle">{{ nodes.length }} CPA</UBadge>
            </div>

            <section v-for="group in homeGroups" :key="group.id" class="overflow-hidden rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-muted)]/20">
              <div class="px-3 py-3">
                <div class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div class="min-w-0">
                    <p class="text-xs font-medium text-[var(--ui-text-muted)]">Home address</p>
                    <p class="mt-1 truncate font-mono text-sm">{{ group.unknown ? 'Unknown Home' : group.label }}</p>
                  </div>
                  <div class="flex flex-wrap gap-2 lg:justify-end">
                    <UBadge v-if="group.unknown" color="warning" variant="subtle">Partial data</UBadge>
                    <UBadge :color="roleColor(group.role)" variant="subtle">{{ roleLabel(group.role) }}</UBadge>
                    <UBadge :color="healthColor(group.health)" variant="subtle">{{ healthLabel(group.health) }}</UBadge>
                    <UBadge :color="group.cpaCount > 0 && group.healthyCpaCount === group.cpaCount ? 'success' : 'warning'" variant="subtle">{{ group.healthyCpaCount }} / {{ group.cpaCount }} healthy</UBadge>
                  </div>
                </div>
                <div class="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
                  <InfoField label="Home role" :value="roleLabel(group.role)" />
                  <InfoField label="CPA count" :value="String(group.cpaCount)" />
                  <InfoField label="Clients" :value="String(group.clientCount)" />
                  <InfoField label="Connected since" :value="formatDate(group.startedAt)" />
                  <InfoField label="Last seen" :value="formatDate(group.lastSeenAt)" />
                </div>
                <p v-if="group.unknown" class="mt-3 text-xs leading-5 text-[var(--ui-text-muted)]">These CPAs cannot be matched to a Home yet.</p>
              </div>

              <div class="bg-[var(--ui-bg-muted)]/30">
                <div v-if="!group.nodes.length" class="border-t border-[var(--ui-border)] px-3 py-6 text-center text-sm text-[var(--ui-text-muted)]">This Home has no CPA connection records yet.</div>
                <div v-for="node in group.nodes" :key="nodeKey(node)" class="grid gap-3 border-t border-[var(--ui-border)] px-3 py-3 lg:grid-cols-[minmax(120px,0.65fr)_minmax(0,2.6fr)_auto] lg:items-start">
                  <div class="min-w-0">
                    <p class="text-xs font-medium text-[var(--ui-text-muted)]">{{ node.node_name ? 'CPA node name' : 'CPA node IP' }}</p>
                    <div class="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                      <p class="truncate text-sm" :class="node.node_name ? 'font-medium' : 'font-mono'">{{ node.node_name || node.ip || 'Unknown node' }}</p>
                      <AppButton v-if="node.node_id" color="neutral" variant="ghost" size="xs" icon="i-tabler-pencil" :aria-label="`Rename ${node.node_name || node.ip || 'node'}`" @click="openRename(node)" />
                      <UBadge :color="healthColor(nodeHealth(node))" variant="subtle">{{ healthLabel(nodeHealth(node)) }}</UBadge>
                    </div>
                    <p v-if="node.node_name" class="mt-1 truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ node.ip || 'N/A' }}</p>
                  </div>
                  <div class="grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(72px,0.45fr)]">
                    <InfoField label="CPA node ID" :value="node.node_id || 'N/A'" />
                    <InfoField label="Connected time" :value="formatDate(node.connected_time)" />
                    <InfoField label="Last seen" :value="formatDate(node.last_seen_at)" />
                    <InfoField label="Clients" :value="String(node.client_count ?? 0)" />
                  </div>
                  <div class="flex items-center lg:justify-self-end">
                    <UBadge :color="pluginReportColor(node.plugin_report_state)" variant="subtle">{{ pluginReportLabel(node.plugin_report_state) }}</UBadge>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </AppCard>

      <AppCard :ui="{ body: 'p-4' }">
        <h2 class="text-base font-semibold">Runtime configuration signals</h2>
        <p class="mt-1 text-xs leading-5 text-[var(--ui-text-muted)]">Read-only signals for diagnostic logs and routing policy state.</p>
        <div v-if="configSnapshot" class="mt-3 grid gap-3 lg:grid-cols-2">
          <ConfigSignals title="Diagnostic logs" :items="diagnosticSignals" />
          <ConfigSignals title="Routing runtime" :items="runtimeSignals" />
        </div>
        <div v-else class="mt-3 rounded-md border border-dashed p-8 text-center text-sm text-[var(--ui-text-muted)]">No config summary yet.</div>
      </AppCard>

      <USlideover v-model:open="diagnosticsOpen" title="Management API diagnostic request" description="Send one upstream request from the server to diagnose connectivity, credential, or upstream API issues." :ui="{ content: 'sm:max-w-xl' }">
        <template #body>
          <div class="space-y-4">
            <UAlert color="warning" variant="subtle" icon="i-tabler-shield-exclamation" title="High-privilege diagnostic action" description="This tool sends one upstream request from the server. Use it only to diagnose connection, credential, or upstream API issues. Avoid sending production-sensitive data." />
            <form class="space-y-4" @submit.prevent="runDiagnostic">
              <div class="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                <UFormField label="Method"><USelect v-model="diagnostic.method" :items="methods" class="w-full" /></UFormField>
                <UFormField label="Target URL" required><UInput v-model="diagnostic.url" placeholder="https://api.example.com/v1/ping" class="w-full" /></UFormField>
              </div>
              <UFormField label="Credential index"><UInput v-model="diagnostic.authIndex" placeholder="Optional, leave blank to use the default credential" class="w-full" /></UFormField>
              <UFormField label="Headers JSON"><UTextarea v-model="diagnostic.headers" :rows="6" class="w-full font-mono text-xs" /></UFormField>
              <UFormField label="Body"><UTextarea v-model="diagnostic.data" :rows="6" placeholder="Optional, body is sent as written" class="w-full font-mono text-xs" /></UFormField>
              <UAlert v-if="diagnosticError" color="error" variant="subtle" :description="diagnosticError" />
              <AppButton type="submit" icon="i-tabler-player-play" :loading="diagnosticLoading">Send diagnostic request</AppButton>
            </form>
            <div v-if="diagnosticResult" class="rounded-md border border-[var(--ui-border)] p-3">
              <p class="text-sm font-medium">Response status: {{ diagnosticResult.status_code ?? 'N/A' }}</p>
              <pre class="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--ui-bg-muted)] p-3 text-xs">{{ diagnosticOutput }}</pre>
            </div>
          </div>
        </template>
      </USlideover>

      <AppModal v-model:open="enrollmentOpen" title="Node enrollment token" :description="enrollment ? 'Configure the credential on the node you want to enroll. Store it securely; closing this panel does not revoke the token.' : 'Name this node so you can identify it later, then generate its credential.'">
        <template #body>
          <div v-if="enrollment" class="space-y-4">
            <div v-if="enrollment.id"><p class="text-xs font-medium text-[var(--ui-text-muted)]">Client ID</p><p class="mt-2 break-all font-mono text-sm">{{ enrollment.id }}</p></div>
            <div v-if="enrollment.node_name"><p class="text-xs font-medium text-[var(--ui-text-muted)]">Node name</p><p class="mt-2 text-sm">{{ enrollment.node_name }}</p></div>
            <div><p class="text-xs font-medium text-[var(--ui-text-muted)]">Credential</p><pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-3 font-mono text-xs leading-5">{{ enrollment.home_jwt }}</pre></div>
            <div class="flex justify-end"><AppButton icon="i-tabler-copy" @click="copyJWT">Copy credential</AppButton></div>
          </div>
          <form v-else class="space-y-4" @submit.prevent="generateEnrollment">
            <UFormField label="Node name" hint="Optional. Up to 128 characters. You can rename the node later.">
              <UInput v-model="nodeName" maxlength="128" placeholder="e.g. us-east-gateway" class="w-full" />
            </UFormField>
            <UAlert v-if="enrollmentError" color="error" variant="subtle" :description="enrollmentError" />
            <div class="flex justify-end"><AppButton type="submit" :loading="generating">Generate credential</AppButton></div>
          </form>
        </template>
      </AppModal>

      <AppModal v-model:open="renameOpen" title="Rename CPA node" description="Give this CPA node a recognizable name. Names are console labels only and do not need to be unique.">
        <template #body>
          <form class="space-y-4" @submit.prevent="saveRename">
            <UFormField label="Node name" hint="Up to 128 characters. Leave empty to clear the name.">
              <UInput v-model="renameValue" maxlength="128" placeholder="e.g. us-east-gateway" class="w-full" />
            </UFormField>
            <UAlert v-if="renameError" color="error" variant="subtle" :description="renameError" />
            <div class="flex justify-end gap-2">
              <AppButton type="button" color="neutral" variant="outline" :disabled="renaming" @click="closeRename">Cancel</AppButton>
              <AppButton type="submit" :loading="renaming">Save name</AppButton>
            </div>
          </form>
        </template>
      </AppModal>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useDataSync } from '~/composables/useDataSync'
const InfoField = defineComponent({
  props: { label: { type: String, required: true }, value: { type: String, required: true } },
  template: '<div class="min-w-0"><p class="text-xs font-medium text-[var(--ui-text-muted)]">{{ label }}</p><p class="mt-1 truncate font-mono text-xs" :title="value">{{ value }}</p></div>'
})

const ConfigSignals = defineComponent({
  props: { title: { type: String, required: true }, items: { type: Array as PropType<Array<{ label: string, value: string, tone: string }>>, required: true } },
  template: '<section class="rounded-md bg-[var(--ui-bg-muted)]/40 p-3"><h3 class="text-sm font-semibold">{{ title }}</h3><div class="mt-2 flex flex-wrap gap-2"><div v-for="item in items" :key="item.label" class="inline-flex max-w-full items-center gap-2 rounded-md bg-[var(--ui-bg)] px-2.5 py-2"><span class="truncate text-xs font-medium text-[var(--ui-text-muted)]">{{ item.label }}</span><span class="rounded px-1.5 py-0.5 text-xs font-medium" :class="item.tone === \'success\' ? \'bg-emerald-500/10 text-emerald-600\' : item.tone === \'warning\' ? \'bg-amber-500/10 text-amber-600\' : \'bg-[var(--ui-bg-muted)] text-[var(--ui-text-muted)]\'">{{ item.value }}</span></div></div></section>'
})

const { fetchAPI, apiBase } = useApi()
const { capabilities, serverInfo, supports, refreshCapabilities } = useCapabilities()
const toast = useToast()

const topology = useWorkspaceState<any>('admin:system-topology:topology', () => (null))
const nodesResponse = useWorkspaceState<any>('admin:system-topology:nodesResponse', () => (null))
const configSnapshot = useWorkspaceState<any>('admin:system-topology:configSnapshot', () => (null))
const latestVersion = useWorkspaceState('admin:system-topology:latestVersion', () => (''))
const loading = useWorkspaceState('admin:system-topology:loading', () => (false))
const loaded = useWorkspaceState('admin:system-topology:loaded', () => (false))
const fatalError = useWorkspaceState('admin:system-topology:fatalError', () => (''))
const issues = useWorkspaceState<Array<{ scope: string, message: string }>>('admin:system-topology:issues', () => ([]))
const fetchedAt = useWorkspaceState<Date | null>('admin:system-topology:fetchedAt', () => (null))
const probedAt = useWorkspaceState<Date | null>('admin:system-topology:probedAt', () => (null))
const diagnosticsOpen = ref(false)
const diagnosticLoading = useWorkspaceState('admin:system-topology:diagnosticLoading', () => (false))
const diagnosticError = useWorkspaceState('admin:system-topology:diagnosticError', () => (''))
const diagnosticResult = useWorkspaceState<any>('admin:system-topology:diagnosticResult', () => (null))
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const diagnostic = reactive({ method: 'GET', url: '', authIndex: '', headers: '{}', data: '' })
const enrollmentOpen = ref(false)
const enrollment = useWorkspaceState<any>('admin:system-topology:enrollment', () => (null))
const nodeName = ref('')
const generating = useWorkspaceState('admin:system-topology:generating', () => (false))
const enrollmentError = useWorkspaceState('admin:system-topology:enrollmentError', () => (''))
const renameOpen = ref(false)
const renameTarget = ref<any>(null)
const renameValue = ref('')
const renaming = useWorkspaceState('admin:system-topology:renaming', () => (false))
const renameError = ref('')

const homes = computed<any[]>(() => Array.isArray(topology.value?.homes) ? topology.value.homes : [])
const nodes = computed<any[]>(() => Array.isArray(nodesResponse.value?.nodes) ? nodesResponse.value.nodes : Array.isArray(topology.value?.cpas) ? topology.value.cpas : [])
const nodesSupported = computed(() => supports('topology', false) || supports('nodes', false))
const topologySource = computed(() => topology.value ? 'topology' : nodesResponse.value ? 'nodes' : 'unsupported')
const topologySourceLabel = computed(() => topologySource.value === 'topology' ? 'Cluster topology' : topologySource.value === 'nodes' ? 'Partial topology' : 'Unavailable')
const runtimeLabel = computed(() => supports('topology', false) ? 'Home cluster' : supports('nodes', false) || serverInfo.value.home_version ? 'Home runtime' : 'CPA')
const currentVersion = computed(() => serverInfo.value.home_version || configSnapshot.value?.version || configSnapshot.value?.['version'] || 'Unknown')
const summary = computed(() => topology.value?.summary || {})
const inferredHomeCount = computed(() => new Set(nodes.value.map(node => homeKey(node)).filter(key => key !== 'unknown-home')).size)
const homeCount = computed(() => summary.value.home_count ?? homes.value.length ?? inferredHomeCount.value)
const healthyHomeCount = computed(() => summary.value.healthy_home_count ?? homes.value.filter(home => homeHealth(home) === 'healthy').length)
const cpaCount = computed(() => summary.value.cpa_count ?? nodes.value.length)
const healthyCpaCount = computed(() => summary.value.healthy_cpa_count ?? nodes.value.filter(node => nodeHealth(node) === 'healthy').length)
const attentionCount = computed(() => summary.value.attention_count ?? issues.value.length + nodes.value.filter(node => nodeHealth(node) !== 'healthy' || !['reported_ok', 'not_required'].includes(node.plugin_report_state)).length)
const masterHome = computed(() => topology.value?.master?.id || homes.value.find(home => home.is_master)?.id || 'N/A')

const homeGroups = computed(() => {
  const groups = new Map<string, any>()
  for (const home of homes.value) {
    const id = home.id || endpoint(home.ip, home.port) || 'unknown-home'
    groups.set(id, { id, label: home.id || endpoint(home.ip, home.port) || 'unknown-home', home, nodes: [] })
  }
  for (const node of nodes.value) {
    const id = homeKey(node)
    if (!groups.has(id)) groups.set(id, { id, label: endpoint(node.home_ip, node.home_port) || 'unknown-home', home: null, nodes: [] })
    groups.get(id).nodes.push(node)
  }
  return Array.from(groups.values()).map(group => {
    const home = group.home
    const latestSeen = [home?.last_seen_at, ...group.nodes.map((node: any) => node.last_seen_at)].filter(Boolean).sort().at(-1)
    const startedAt = home?.started_at || group.nodes.map((node: any) => node.connected_time).filter(Boolean).sort().at(0)
    return {
      ...group,
      unknown: !home && group.id === 'unknown-home',
      role: home?.role || (home?.is_master ? 'master' : 'unknown'),
      health: homeHealth(home),
      cpaCount: home?.cpa_count ?? group.nodes.length,
      healthyCpaCount: home?.healthy_cpa_count ?? group.nodes.filter((node: any) => nodeHealth(node) === 'healthy').length,
      clientCount: home?.client_count ?? group.nodes.reduce((total: number, node: any) => total + (node.client_count || 0), 0),
      lastSeenAt: latestSeen,
      startedAt
    }
  }).sort((a, b) => a.label.localeCompare(b.label))
})

const verdictLevel = computed(() => {
  if (issues.value.length) return 'degraded'
  if (!nodesSupported.value) return 'limited'
  if (!configSnapshot.value && currentVersion.value === 'Unknown') return 'unavailable'
  return 'ready'
})
const verdict = computed(() => ({
  ready: { title: 'System information is synced', badge: 'Normal', description: 'Version, config, and node connection state are synced for the current runtime assessment.' },
  limited: { title: 'System information is synced', badge: 'Nodes unavailable', description: 'This runtime does not expose the node query route. Use version and config summary as the primary signals.' },
  degraded: { title: 'System information partially failed to sync', badge: 'Partial failure', description: 'The page continues to show loaded information. Resolve failed items before making a full assessment.' },
  unavailable: { title: 'System information is unavailable', badge: 'Unavailable', description: 'Key diagnostic routes did not return usable data. Check the Management API, management key, and runtime diagnostic capabilities.' }
}[verdictLevel.value]))
const verdictColor = computed<any>(() => verdictLevel.value === 'ready' ? 'success' : verdictLevel.value === 'limited' ? 'info' : verdictLevel.value === 'degraded' ? 'warning' : 'error')
const verdictIcon = computed(() => verdictLevel.value === 'ready' ? 'i-tabler-circle-check' : verdictLevel.value === 'limited' ? 'i-tabler-info-circle' : 'i-tabler-alert-triangle')
const verdictClasses = computed(() => ({ icon: toneClasses(verdictLevel.value === 'ready' ? 'success' : verdictLevel.value === 'limited' ? 'info' : 'warning') }))
const verdictFacts = computed(() => [
  { label: `Version info: ${currentVersion.value === 'Unknown' ? 'N/A' : 'Available'}`, tone: currentVersion.value === 'Unknown' ? 'warning' : 'success' },
  { label: nodesSupported.value ? homeCount.value > 0 ? `Node records: ${nodes.value.length} CPA / ${homeCount.value} Home` : `Node records: ${nodes.value.length}` : 'Node route: unavailable', tone: nodesSupported.value ? nodes.value.length ? 'success' : 'neutral' : 'info' },
  { label: issues.value.length ? `Load issues: ${issues.value.length}` : 'No load issues', tone: issues.value.length ? 'warning' : 'success' }
])
const summaryCards = computed(() => [
  { label: 'Version', value: currentVersion.value, detail: `Latest: ${latestVersion.value || 'Unknown'}`, tone: currentVersion.value === 'Unknown' ? 'warning' : 'success', icon: 'i-tabler-tag' },
  { label: 'Endpoint', value: apiBase, detail: `Master: ${masterHome.value}`, tone: apiBase ? 'info' : 'warning', icon: 'i-tabler-link' },
  { label: 'Home', value: nodesSupported.value ? String(homeCount.value) : 'N/A', detail: topology.value ? `${healthyHomeCount.value} / ${homeCount.value} healthy` : homeCount.value ? `${homeCount.value} inferred` : 'No Home list yet', tone: homeCount.value ? 'info' : 'warning', icon: 'i-tabler-building' },
  { label: 'CPA', value: String(cpaCount.value), detail: `${healthyCpaCount.value} / ${cpaCount.value} healthy`, tone: cpaCount.value ? 'success' : 'neutral', icon: 'i-tabler-server-2' },
  { label: 'Attention', value: String(attentionCount.value), detail: attentionCount.value ? 'Topology needs review' : 'No attention items', tone: attentionCount.value ? 'warning' : 'success', icon: 'i-tabler-alert-triangle' },
  { label: 'Config', value: configSnapshot.value ? 'Available' : 'N/A', detail: configSnapshot.value ? 'Summary loaded' : 'Summary unavailable', tone: configSnapshot.value ? 'success' : 'warning', icon: 'i-tabler-adjustments' }
])
const topologyDescription = computed(() => nodesSupported.value ? topology.value ? `${cpaCount.value} CPA, ${homeCount.value} Home` : nodes.value.length ? `${nodes.value.length} CPA nodes across ${inferredHomeCount.value} Home nodes` : 'Node route is available, no connection records yet' : 'This runtime does not expose node queries')
const diagnosticSignals = computed(() => [signal('Request logs', configSnapshot.value?.['request-log']), signal('Usage statistics', configSnapshot.value?.['usage-statistics-enabled']), signal('File logging', configSnapshot.value?.['logging-to-file'])])
const runtimeSignals = computed(() => [signal('Debug mode', configSnapshot.value?.debug, true), signal('Proxy endpoint', Boolean(configSnapshot.value?.['proxy-url'])), { label: 'Routing strategy', value: configSnapshot.value?.routing?.strategy || 'Unknown', tone: configSnapshot.value?.routing?.strategy ? 'neutral' : 'warning' }])
const diagnosticOutput = computed(() => diagnosticResult.value?.body || JSON.stringify(diagnosticResult.value?.header || diagnosticResult.value?.headers || {}, null, 2))

function toneClasses(tone: string) {
  if (tone === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  if (tone === 'info') return 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400'
  if (tone === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (tone === 'danger') return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
  return 'border-[var(--ui-border)] bg-[var(--ui-bg-muted)] text-[var(--ui-text-muted)]'
}
function endpoint(ip?: string, port?: number) { return ip ? port ? `${ip}:${port}` : ip : '' }
function homeKey(node: any) { return node.home_id || endpoint(node.home_ip, node.home_port) || 'unknown-home' }
function nodeKey(node: any) { return node.node_id || `${node.ip || 'node'}:${node.connected_time || ''}` }
function nodeHealth(node: any) { return node.health || (node.healthy === true ? 'healthy' : node.healthy === false ? 'stale' : 'unknown') }
function homeHealth(home: any) { return home?.health || (home?.healthy === true ? 'healthy' : home?.healthy === false ? 'stale' : 'unknown') }
function healthLabel(value: string) { return value === 'healthy' ? 'Healthy' : value === 'stale' ? 'Stale' : 'Unknown' }
function healthColor(value: string): any { return value === 'healthy' ? 'success' : value === 'stale' ? 'error' : 'warning' }
function roleLabel(value: string) { return value === 'master' ? 'Master' : value === 'follower' ? 'Follower' : 'Unknown role' }
function roleColor(value: string): any { return value === 'master' ? 'success' : value === 'follower' ? 'info' : 'warning' }
function pluginReportLabel(value?: string) { return ({ not_required: 'Not required', missing_report: 'Missing report', reported_partial: 'Partial report', reported_failed: 'Report failed', reported_ok: 'Report OK' } as Record<string, string>)[value || ''] || 'Report unknown' }
function pluginReportColor(value?: string): any { return value === 'reported_ok' || value === 'not_required' ? 'success' : value === 'reported_failed' || value === 'missing_report' ? 'error' : 'warning' }
function formatDate(value?: string | Date | null) { if (!value) return 'N/A'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString() }
function signal(label: string, value: unknown, warn = false) { return { label, value: value ? 'Enabled' : 'Disabled', tone: value ? warn ? 'warning' : 'success' : 'neutral' } }
function errorMessage(error: any, fallback: string) { return error?.data?.message || error?.data?.error || error?.message || fallback }

async function refreshSystem() {
  if (loading.value) return
  loading.value = true
  fatalError.value = ''
  issues.value = []
  try {
    await refreshCapabilities(true)
    probedAt.value = new Date()
    const requests: Array<{ scope: string, run: () => Promise<void> }> = [
      { scope: 'Latest version', run: async () => { const value: any = await fetchAPI('/server/latest-version'); latestVersion.value = String(value?.['latest-version'] || value?.latest_version || '') } },
      { scope: 'Config summary', run: async () => { configSnapshot.value = await fetchAPI('/config') } }
    ]
    if (supports('nodes', true)) requests.push({ scope: 'Node connections', run: async () => { nodesResponse.value = await fetchAPI('/nodes') } })
    if (supports('topology', false)) requests.push({ scope: 'Cluster topology', run: async () => { topology.value = await fetchAPI('/topology') } })
    const results = await Promise.allSettled(requests.map(item => item.run()))
    results.forEach((result, index) => {
      const request = requests[index]
      if (result.status === 'rejected' && request) issues.value.push({ scope: request.scope, message: errorMessage(result.reason, 'Request failed') })
    })
    fetchedAt.value = new Date()
    loaded.value = true
    if (results.every(result => result.status === 'rejected')) fatalError.value = 'Check the management endpoint, management key, and system diagnostic routes.'
  } catch (error: any) {
    fatalError.value = errorMessage(error, 'Check the management endpoint, management key, and system diagnostic routes.')
  } finally {
    loading.value = false
  }
}
function openDiagnostics() { diagnosticsOpen.value = true }
function closeRename() { renameOpen.value = false }
function openEnrollment() { enrollment.value = null; nodeName.value = ''; enrollmentError.value = ''; enrollmentOpen.value = true }
async function generateEnrollment() {
  generating.value = true; enrollmentError.value = ''
  try { enrollment.value = await fetchAPI('/certificates/clients', { method: 'POST', body: { node_name: nodeName.value.trim() } }); toast.add({ title: 'Node client created', color: 'success' }) }
  catch (error: any) { enrollmentError.value = errorMessage(error, 'Unable to generate credential.') }
  finally { generating.value = false }
}
async function copyJWT() { if (!enrollment.value?.home_jwt) return; await navigator.clipboard.writeText(enrollment.value.home_jwt); toast.add({ title: 'Credential copied to clipboard', color: 'success' }) }
function openRename(node: any) { renameTarget.value = node; renameValue.value = node.node_name || ''; renameError.value = ''; renameOpen.value = true }
async function saveRename() {
  if (!renameTarget.value?.node_id) return
  renaming.value = true; renameError.value = ''
  try {
    const result: any = await fetchAPI(`/nodes/${encodeURIComponent(renameTarget.value.node_id)}`, { method: 'PATCH', body: { node_name: renameValue.value.trim() || null } })
    const name = result?.node_name ?? (renameValue.value.trim() || null)
    for (const node of nodes.value) if (node.node_id === renameTarget.value.node_id) node.node_name = name
    if (Array.isArray(topology.value?.cpas)) for (const node of topology.value.cpas) if (node.node_id === renameTarget.value.node_id) node.node_name = name
    renameOpen.value = false
    toast.add({ title: name ? 'Node name updated' : 'Node name cleared', color: 'success' })
  } catch (error: any) { renameError.value = errorMessage(error, 'Unable to rename the node.') }
  finally { renaming.value = false }
}
async function runDiagnostic() {
  diagnosticError.value = ''; diagnosticResult.value = null
  if (!diagnostic.url.trim()) { diagnosticError.value = 'Enter a target URL.'; return }
  let headers: Record<string, string>
  try { headers = JSON.parse(diagnostic.headers || '{}'); if (!headers || Array.isArray(headers) || typeof headers !== 'object') throw new Error() }
  catch { diagnosticError.value = 'Headers must be a valid JSON object.'; return }
  diagnosticLoading.value = true
  try {
    diagnosticResult.value = await fetchAPI('/requests/api-call', { method: 'POST', body: { auth_index: diagnostic.authIndex || undefined, method: diagnostic.method, url: diagnostic.url.trim(), header: headers, data: diagnostic.data } })
    toast.add({ title: 'Diagnostic request completed', color: 'success' })
  } catch (error: any) { diagnosticError.value = errorMessage(error, 'The diagnostic request failed.') }
  finally { diagnosticLoading.value = false }
}

useDataSync('admin:system-topology:sync', refreshSystem)
onMounted(refreshSystem)
</script>
