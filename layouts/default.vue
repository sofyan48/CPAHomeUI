<template>
  <div class="workbench-shell min-h-screen text-[var(--ui-text)]">
    <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" @click="closeMobile" />

    <aside
      id="management-sidebar"
      class="workbench-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-[transform,width] duration-200 lg:translate-x-0"
      :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', sidebarCollapsed ? 'lg:w-13' : 'lg:w-56']"
    >
      <div class="flex h-14 items-center justify-between border-b border-[var(--workbench-sidebar-border)] px-4" :class="sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''">
        <NuxtLink to="/admin/dashboard" class="flex min-w-0 items-center gap-3" title="Home Center" @click="closeMobile">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--workbench-sidebar-primary)] text-slate-950">
            <UIcon name="i-tabler-terminal-2" class="size-5" />
          </div>
          <div class="min-w-0" :class="sidebarCollapsed ? 'lg:hidden' : ''">
            <p class="workbench-brand truncate text-sm font-semibold">Home Center</p>
            <p class="workbench-muted truncate text-[11px]">AI Gateway Management Console</p>
          </div>
        </NuxtLink>
        <UButton class="lg:hidden" icon="i-tabler-x" color="neutral" variant="ghost" aria-label="Close navigation" @click="closeMobile" />
      </div>

      <nav aria-label="Management" class="flex-1 overflow-y-auto px-3 py-4" :class="sidebarCollapsed ? 'lg:px-1.5' : ''">
        <div v-for="section in visibleSections" :key="section.label" class="mb-5">
          <p class="workbench-section-title mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60" :class="sidebarCollapsed ? 'lg:sr-only' : ''">
            {{ section.label }}
          </p>
          <div class="space-y-1" :class="sidebarCollapsed && section.label !== 'Operate' ? 'lg:border-t lg:border-[var(--workbench-sidebar-border)] lg:pt-2' : ''">
            <UButton
              v-for="item in section.items"
              :key="item.to"
              :to="item.to"
              :icon="item.icon"
              color="neutral"
              variant="ghost"
              class="w-full justify-start"
              :class="sidebarCollapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : ''"
              :aria-label="item.label"
              :aria-current="isActive(item) ? 'page' : undefined"
              :title="sidebarCollapsed ? item.label : undefined"
              @click="closeMobile"
            >
              <span :class="sidebarCollapsed ? 'lg:hidden' : ''">{{ item.label }}</span>
            </UButton>
          </div>
        </div>
      </nav>

      <div class="border-t border-[var(--workbench-sidebar-border)] p-3" :class="sidebarCollapsed ? 'lg:p-1.5' : ''">
        <NuxtLink to="/admin/connect" class="block rounded-md bg-[var(--workbench-sidebar-accent)] p-3" :class="sidebarCollapsed ? 'lg:flex lg:justify-center lg:p-2' : ''" :title="sidebarCollapsed ? `${capabilitiesError ? 'Connection failed' : 'Connected'} · ${versionLabel}` : undefined">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full" :class="capabilitiesError ? 'bg-amber-500' : 'bg-emerald-500'" />
            <span class="workbench-brand text-xs font-medium" :class="sidebarCollapsed ? 'lg:hidden' : ''">{{ capabilitiesError ? 'Connection failed' : 'Connected' }}</span>
          </div>
          <p class="workbench-muted mt-1 truncate text-[11px]" :class="sidebarCollapsed ? 'lg:hidden' : ''">{{ versionLabel }}</p>
        </NuxtLink>
      </div>
    </aside>

    <div class="min-h-screen transition-[padding] duration-200" :class="sidebarCollapsed ? 'lg:pl-13' : 'lg:pl-56'">
      <header class="workbench-header sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur lg:px-5">
        <div class="flex min-w-0 items-center gap-3">
          <UButton class="lg:hidden" icon="i-tabler-menu-2" color="neutral" variant="ghost" aria-label="Open navigation" @click="openMobile" />
          <UButton
            class="hidden lg:inline-flex"
            :icon="sidebarCollapsed ? 'i-tabler-chevron-right' : 'i-tabler-chevron-left'"
            color="neutral"
            variant="ghost"
            :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            :aria-expanded="!sidebarCollapsed"
            aria-controls="management-sidebar"
            @click="toggleSidebar"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ pageTitle }}</p>
            <p class="hidden truncate text-xs text-[var(--ui-text-muted)] sm:block">{{ pageSubtitle }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <ThemeSwitcher />
          <UButton
            icon="i-tabler-refresh"
            color="neutral"
            variant="ghost"
            :loading="capabilitiesLoading"
            aria-label="Refresh capabilities"
            @click="refreshCapabilities(true)"
          />
          <UButton icon="i-tabler-logout" color="neutral" variant="soft" @click="handleLogout">
            <span class="hidden sm:inline">Logout</span>
          </UButton>
        </div>
      </header>

      <main class="workbench-main">
        <UAlert
          v-if="capabilitiesError"
          class="mb-6"
          color="warning"
          variant="subtle"
          icon="i-tabler-alert-triangle"
          title="Could not refresh server capabilities"
          :description="capabilitiesError"
        />
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
interface NavigationItem {
  label: string
  to: string
  icon: string
  capability?: string
  subtitle?: string
}

function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }

const route = useRoute()
const router = useRouter()
const { token, apiBase } = useApi()
const managementRemember = useCookie<boolean>('management_remember')
const {
  serverInfo,
  loading: capabilitiesLoading,
  error: capabilitiesError,
  supports,
  refreshCapabilities,
  resetCapabilities
} = useCapabilities()

const mobileOpen = ref(false)
const sidebarCollapsed = ref(false)
const closeMobile = () => {
  mobileOpen.value = false
}
const openMobile = () => {
  mobileOpen.value = true
}

const navigationSections: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Operate',
    items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: 'i-tabler-grid-dots', subtitle: 'Runtime overview' }]
  },
  {
    label: 'Gateway',
    items: [
      { label: 'Upstream', to: '/admin/upstream', icon: 'i-tabler-cloud-upload', subtitle: 'Credentials and model providers' },
      { label: 'Access keys', to: '/admin/access-keys', icon: 'i-tabler-key', subtitle: 'Client access control' },
      { label: 'Users & Access', to: '/admin/users', icon: 'i-tabler-users', subtitle: 'Users and access', capability: 'users' }
    ]
  },
  {
    label: 'Observe',
    items: [
      { label: 'Usage & Requests', to: '/admin/usage', icon: 'i-tabler-chart-bar', subtitle: 'Usage analysis and request diagnostics', capability: 'usage_records' },
      { label: 'Call Diagnostics', to: '/admin/diagnostics', icon: 'i-tabler-tools', subtitle: 'Call health and request logs' },
      { label: 'Runtime Logs', to: '/admin/logs', icon: 'i-tabler-file-text', subtitle: 'Gateway runtime and request error logs', capability: 'logs' }
    ]
  },
  {
    label: 'Finance',
    items: [{ label: 'Billing & Reports', to: '/admin/billing', icon: 'i-tabler-cash-banknote', subtitle: 'Billing and reports' }]
  },
  {
    label: 'Control',
    items: [
      { label: 'System config', to: '/admin/config', icon: 'i-tabler-adjustments-horizontal', subtitle: 'Gateway core settings' },
      { label: 'Plugins', to: '/admin/plugins', icon: 'i-tabler-puzzle', subtitle: 'Plugin store and node reports' },
      { label: 'System Info', to: '/admin/system-nodes', icon: 'i-tabler-server-2', subtitle: 'Runtime and diagnostics', capability: 'topology' }
    ]
  }
]

const visibleSections = computed(() => navigationSections
  .map(section => ({
    ...section,
    items: section.items.filter(item => !item.capability || supports(item.capability, true))
  }))
  .filter(section => section.items.length))

const isActive = (item: NavigationItem) => item.to === '/admin/upstream'
  ? ['/admin/upstream', '/admin/providers', '/admin/credentials', '/admin/quota'].includes(route.path)
  : item.to === '/admin/usage'
    ? ['/admin/usage', '/admin/request-events'].includes(route.path)
    : item.to === '/admin/config'
      ? route.path === '/admin/config' || route.path.startsWith('/admin/routing/')
      : route.path === item.to

const currentNavigation = computed(() => navigationSections.flatMap(section => section.items).find(isActive))
const pageTitle = computed(() => currentNavigation.value?.label || 'Management')
const pageSubtitle = computed(() => currentNavigation.value?.subtitle || '')

const versionLabel = computed(() => {
  const version = serverInfo.value.home_version
  const commit = serverInfo.value.home_commit
  if (version && commit) return `${version} · ${commit.slice(0, 8)}`
  return version || 'CLIProxyAPI Home'
})

watch(() => route.fullPath, () => { mobileOpen.value = false })

onMounted(async () => {
  if (!token.value) {
    await router.replace({ path: '/admin/connect', query: { redirect: route.fullPath } })
    return
  }
  try {
    await refreshCapabilities()
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403 || error?.statusCode === 404) {
      token.value = null
      resetCapabilities()
      await router.replace({ path: '/admin/connect', query: { redirect: route.fullPath } })
    }
  }
})

const handleLogout = async () => {
  token.value = null
  managementRemember.value = false
  resetCapabilities()
  await router.replace('/admin/connect')
}
</script>
