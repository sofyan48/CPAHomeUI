<template>
  <div class="relative h-dvh w-full overflow-hidden bg-gradient-to-br from-sky-50 via-white to-sky-100 text-[var(--ui-text)] dark:from-sky-950 dark:via-neutral-950 dark:to-sky-900">
    <div aria-hidden="true" class="pointer-events-none absolute -left-40 -top-40 size-96 rounded-full bg-sky-300/15 blur-[100px] dark:bg-sky-700/5" />
    <div aria-hidden="true" class="pointer-events-none absolute left-1/2 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/5 blur-[120px] dark:bg-sky-600/5" />
    <div aria-hidden="true" class="pointer-events-none absolute -bottom-40 -right-40 size-[600px] rounded-full bg-sky-200/25 blur-[120px] dark:bg-sky-800/5" />

    <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" @click="closeMobile" />

    <aside
      id="management-sidebar"
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white/95 shadow-[4px_0_24px_0_rgba(14,165,233,0.08)] backdrop-blur-xl transition-[transform,width] duration-200 dark:border-white/10 dark:bg-neutral-950/95 lg:translate-x-0 lg:bg-white/30 lg:dark:bg-neutral-900/30"
      :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', sidebarCollapsed ? 'lg:w-16' : 'lg:w-64']"
    >
      <div class="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 px-3 dark:border-white/10" :class="sidebarCollapsed ? 'lg:justify-center lg:px-1' : ''">
        <NuxtLink to="/admin/dashboard" class="flex min-w-0 flex-1 items-center gap-2" :class="sidebarCollapsed ? 'lg:hidden' : ''" title="CPAHome" @click="closeMobile">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[var(--ui-primary)] shadow-sm dark:border-white/10 dark:bg-neutral-900">
            <UIcon name="i-tabler-terminal-2" class="size-5" />
          </div>
          <div class="min-w-0 leading-tight">
            <p class="truncate text-sm font-bold text-[var(--ui-text-highlighted)]">CPAHome</p>
            <p class="truncate text-[11px] text-[var(--ui-text-muted)]">AI Gateway Management</p>
          </div>
        </NuxtLink>
        <AppButton
          class="hidden lg:inline-flex"
          :icon="sidebarCollapsed ? 'i-tabler-layout-sidebar-left-expand' : 'i-tabler-layout-sidebar-left-collapse'"
          color="neutral"
          variant="ghost"
          :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-expanded="!sidebarCollapsed"
          aria-controls="management-sidebar"
          @click="toggleSidebar"
        />
        <AppButton class="lg:hidden" icon="i-tabler-x" color="neutral" variant="ghost" aria-label="Close navigation" @click="closeMobile" />
      </div>

      <nav aria-label="Management" class="min-h-0 flex-1 overflow-y-auto px-3 py-4" :class="sidebarCollapsed ? 'lg:px-2' : ''">
        <div v-for="section in visibleSections" :key="section.label" class="mb-5">
          <p class="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]" :class="sidebarCollapsed ? 'lg:sr-only' : ''">
            {{ section.label }}
          </p>
          <div class="space-y-1" :class="sidebarCollapsed && section.label !== 'Operate' ? 'lg:border-t lg:border-slate-200 lg:pt-2 dark:lg:border-white/10' : ''">
            <AppButton
              v-for="item in section.items"
              :key="item.to"
              :to="item.to"
              :icon="item.icon"
              :color="isActive(item) ? 'primary' : 'neutral'"
              :variant="isActive(item) ? 'soft' : 'ghost'"
              class="w-full justify-start"
              :class="[sidebarCollapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : '', isActive(item) ? 'bg-sky-100/70 text-[var(--ui-primary)] dark:bg-sky-900/30' : '']"
              :aria-label="item.label"
              :aria-current="isActive(item) ? 'page' : undefined"
              :title="sidebarCollapsed ? item.label : undefined"
              @click="closeMobile"
            >
              <span :class="sidebarCollapsed ? 'lg:hidden' : ''">{{ item.label }}</span>
            </AppButton>
          </div>
        </div>
      </nav>

      <div class="flex shrink-0 items-center gap-2 border-t border-slate-200 p-3 dark:border-white/10" :class="sidebarCollapsed ? 'lg:flex-col lg:p-2' : ''">
        <NuxtLink
          to="/admin/connect"
          class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-neutral-900 lg:bg-white/50 lg:dark:bg-neutral-900/50"
          :class="sidebarCollapsed ? 'lg:flex lg:w-full lg:justify-center lg:p-2' : ''"
          :title="sidebarCollapsed ? (capabilitiesError ? 'Connection failed' : 'Connected') : undefined"
          @click="closeMobile"
        >
          <div class="flex items-center gap-2">
            <span class="size-2 shrink-0 rounded-full" :class="capabilitiesError ? 'bg-amber-500' : 'bg-emerald-500'" />
            <span class="truncate text-xs font-medium" :class="sidebarCollapsed ? 'lg:hidden' : ''">{{ capabilitiesError ? 'Connection failed' : 'Connected' }}</span>
          </div>

        </NuxtLink>
        <ThemeSwitcher />
        <AppButton icon="i-tabler-logout" color="neutral" variant="ghost" aria-label="Logout" title="Logout" @click="handleLogout" />
      </div>
    </aside>

    <div class="relative z-10 flex h-full min-h-0 min-w-0 flex-col transition-[padding] duration-200" :class="sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col border-l border-slate-200 bg-white/50 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/50">
        <header class="z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/30 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/30 sm:px-5">
          <div class="flex min-w-0 items-center gap-2">
            <AppButton class="lg:hidden" icon="i-tabler-menu-2" color="neutral" variant="ghost" aria-label="Open navigation" aria-controls="management-sidebar" :aria-expanded="mobileOpen" @click="openMobile" />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ pageTitle }}</p>
              <p class="hidden truncate text-xs text-[var(--ui-text-muted)] sm:block">{{ pageSubtitle }}</p>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <AppButton
              icon="i-tabler-refresh"
              color="neutral"
              variant="ghost"
              :loading="capabilitiesLoading"
              aria-label="Refresh capabilities"
              @click="refreshCapabilities(true)"
            />

          </div>
        </header>

        <main class="workbench-main min-h-0 flex-1 overflow-y-auto !px-2 !py-4 sm:!p-5 lg:!p-6">
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
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useManagementSessionStore } from '~/stores/managementSession'

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
const { rememberSession: managementRemember } = storeToRefs(useManagementSessionStore())
const {

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
      { label: 'Models', to: '/admin/routing/models', icon: 'i-tabler-box-multiple', subtitle: 'Available models and providers' },
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
      ? route.path === '/admin/config' || (route.path.startsWith('/admin/routing/') && route.path !== '/admin/routing/models')
      : route.path === item.to

const currentNavigation = computed(() => navigationSections.flatMap(section => section.items).find(isActive))
const pageTitle = computed(() => currentNavigation.value?.label || 'Management')
const pageSubtitle = computed(() => currentNavigation.value?.subtitle || '')


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
