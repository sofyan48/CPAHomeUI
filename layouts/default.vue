<template>
  <div class="admin-console relative h-dvh w-full overflow-hidden bg-[var(--ui-bg)] text-[var(--ui-text)]">
    <div v-if="mobileOpen" aria-hidden="true" class="admin-navigation-overlay fixed inset-0 z-40 lg:hidden" @click="closeMobile" />

    <aside
      id="management-sidebar"
      ref="sidebarElement"
      :role="mobileOpen ? 'dialog' : undefined"
      :aria-modal="mobileOpen ? true : undefined"
      :aria-label="t('shell.management')"
      :inert="!desktopViewport && !mobileOpen"
      class="admin-sidebar fixed inset-y-0 left-0 z-50 flex w-64 max-w-[calc(100vw-2rem)] flex-col border-r border-[var(--ui-border)] bg-[var(--ui-bg-muted)] transition-[transform,width] duration-200 motion-reduce:transition-none lg:translate-x-0"
      @keydown="handleSidebarKeydown"
      :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', sidebarCollapsed ? 'lg:w-16' : 'lg:w-64']"
    >
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--ui-border)] px-4" :class="sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''">
        <NuxtLink to="/admin/dashboard" class="admin-brand flex min-w-0 flex-1 items-center gap-3 rounded-md" :class="sidebarCollapsed ? 'lg:flex-none' : ''" title="CPAHome" aria-label="CPAHome" @click="closeMobile">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] text-[var(--ui-primary)]">
            <UIcon name="i-tabler-terminal-2" class="size-5" />
          </div>
          <div class="min-w-0 leading-tight" :class="sidebarCollapsed ? 'lg:hidden' : ''">
            <p class="truncate text-sm font-bold text-[var(--ui-text-highlighted)]">CPAHome</p>
            <p class="truncate text-[11px] text-[var(--ui-text-muted)]">{{ t('shell.tagline') }}</p>
          </div>
        </NuxtLink>

        <AppButton class="lg:hidden" icon="i-tabler-x" color="neutral" variant="ghost" :aria-label="t('shell.closeNavigation')" @click="closeMobile" />
      </div>

      <nav :aria-label="t('shell.management')" class="min-h-0 flex-1 overflow-y-auto px-2 py-3" :class="sidebarCollapsed ? 'lg:px-2' : ''">
        <div v-for="section in visibleSections" :key="section.label" class="mb-3 last:mb-0">
          <p class="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]" :class="sidebarCollapsed ? 'lg:sr-only' : ''">
            {{ section.label }}
          </p>
          <div class="space-y-1" :class="sidebarCollapsed && section.label !== t('nav.operate') ? 'lg:border-t lg:border-[var(--ui-border)] lg:pt-2' : ''">
            <AppButton
              v-for="item in section.items"
              :key="item.to"
              :to="item.to"
              :icon="item.icon"
              :color="isActive(item) ? 'primary' : 'neutral'"
              :variant="isActive(item) ? 'soft' : 'ghost'"
              size="lg"
              class="admin-nav-item relative w-full justify-start rounded-md"
              :class="[sidebarCollapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : '', isActive(item) ? 'admin-nav-item-active' : '']"
              :aria-label="item.label"
              :aria-current="isActive(item) ? 'page' : undefined"
              :title="sidebarCollapsed ? item.label : undefined"
              @click="closeMobile"
            >
              <span class="min-w-0 truncate" :class="sidebarCollapsed ? 'lg:hidden' : ''">{{ item.label }}</span>
            </AppButton>
          </div>
        </div>
      </nav>

      <div class="flex shrink-0 items-center gap-1 border-t border-[var(--ui-border)] p-2" :class="sidebarCollapsed ? 'lg:flex-col' : ''">
        <button
          type="button"
          :aria-label="t('shell.manageConnection')"
          class="admin-connection-status flex min-w-0 flex-1 items-center gap-2 rounded-md p-3 text-left"
          :class="sidebarCollapsed ? 'lg:w-full lg:justify-center lg:px-0' : ''"
          :title="connectionStatus.label"
          @click="openConnection"
        >
          <div class="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" class="size-2 shrink-0 rounded-full" :class="connectionStatus.dot" />
            <span role="status" class="truncate text-xs font-medium" :class="sidebarCollapsed ? 'lg:sr-only' : ''">{{ connectionStatus.label }}</span>
          </div>

        </button>
        <AppButton icon="i-tabler-plug-off" color="neutral" variant="ghost" :aria-label="t('shell.disconnect')" :title="t('shell.disconnect')" :disabled="!token" @click="handleDisconnect" />

      </div>
    </aside>

    <div :inert="mobileOpen" class="relative z-10 flex h-full min-h-0 min-w-0 flex-col transition-[padding] duration-200 motion-reduce:transition-none" :class="sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--ui-bg)]">
        <header class="admin-workspace-header z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 sm:gap-3 sm:px-5">
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <AppButton class="shrink-0 lg:hidden" icon="i-tabler-menu-2" color="neutral" variant="ghost" :aria-label="t('shell.openNavigation')" aria-controls="management-sidebar" :aria-expanded="mobileOpen" @click="openMobile" />
            <AppButton
              class="hidden shrink-0 lg:inline-flex"
              :icon="sidebarCollapsed ? 'i-tabler-layout-sidebar-left-expand' : 'i-tabler-layout-sidebar-left-collapse'"
              color="neutral"
              variant="ghost"
              :aria-label="sidebarCollapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')"
              :title="sidebarCollapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')"
              :aria-expanded="!sidebarCollapsed"
              aria-controls="management-sidebar"
              @click="toggleSidebar"
            />
            <div class="flex min-w-0 items-center gap-3">
              <p class="truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ pageTitle }}</p>
              <span aria-hidden="true" class="hidden h-4 w-px shrink-0 bg-[var(--ui-border)] xl:block" />
              <p class="hidden truncate text-xs text-[var(--ui-text-muted)] xl:block">{{ pageSubtitle }}</p>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1 sm:gap-2">
            <AppButton class="hidden w-44 justify-between md:inline-flex" icon="i-tabler-search" color="neutral" variant="outline" :aria-label="t('shell.search')" aria-haspopup="dialog" @click="openCommands">
              <span class="min-w-0 flex-1 truncate text-left">{{ t('shell.search') }}</span>
              <kbd class="rounded bg-[var(--ui-bg-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ui-text-muted)]">⌘ K</kbd>
            </AppButton>
            <AppButton class="md:hidden" icon="i-tabler-search" color="neutral" variant="ghost" :aria-label="t('shell.search')" :title="t('shell.search')" aria-haspopup="dialog" @click="openCommands" />
            <ThemeSwitcher />
            <ConsoleLanguageSwitcher />
            <AppButton icon="i-tabler-plug" color="neutral" variant="ghost" :aria-label="t('shell.manageConnection')" :title="t('shell.manageConnection')" aria-haspopup="dialog" @click="openConnection" />
            <AppButton
              icon="i-tabler-refresh"
              color="neutral"
              variant="ghost"
              :loading="syncing"
              :disabled="syncing || !token"
              :aria-label="t('shell.sync')"
              :title="t('shell.sync')"
              @click="syncData"
            />

          </div>
        </header>

        <main class="workbench-main min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] !p-4 sm:!p-5 lg:!p-6">
          <UAlert
            v-if="capabilitiesError"
            class="mb-6"
            color="warning"
            variant="subtle"
            icon="i-tabler-alert-triangle"
            :title="t('shell.capabilitiesError')"
            :description="capabilitiesError"
          />
          <slot />
        </main>
      </div>
    </div>
    <AdminCommandPalette v-model:open="commandOpen" :groups="commandGroups" :disabled="connectionOpen || mobileOpen" />
    <AdminConnectionDialog v-model:open="connectionOpen" :status-label="connectionStatus.label" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useConsoleLocale } from '~/composables/useConsoleLocale'
import { useManagementSessionStore } from '~/stores/managementSession'
import { useManagementConfigStore } from '~/stores/managementConfig'
import { useWorkspaceStore } from '~/stores/workspace'

interface NavigationItem {
  label: string
  to: string
  icon: string
  capability?: string
  subtitle?: string
}

function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }

const { t } = useConsoleLocale()
const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()
const { token } = useApi()
const { rememberSession: managementRemember } = storeToRefs(useManagementSessionStore())
const {
  loading: capabilitiesLoading,
  loaded: capabilitiesLoaded,
  error: capabilitiesError,
  supports,
  refreshCapabilities,
  resetCapabilities
} = useCapabilities()

const workspace = useWorkspaceStore()
const managementConfig = useManagementConfigStore()
const commandOpen = ref(false)
const connectionOpen = ref(false)
const connectionStatus = computed(() => {
  if (!token.value) return { label: t('connection.disconnected'), dot: 'bg-[var(--ui-text-dimmed)]' }
  if (capabilitiesLoading.value) return { label: t('connection.checking'), dot: 'motion-safe:animate-pulse bg-[var(--ui-primary)]' }
  if (capabilitiesError.value) return { label: t('connection.failed'), dot: 'bg-[var(--ui-warning)]' }
  if (capabilitiesLoaded.value) return { label: t('connection.connected'), dot: 'bg-[var(--ui-success)]' }
  return { label: t('connection.checking'), dot: 'motion-safe:animate-pulse bg-[var(--ui-primary)]' }
})
const openConnection = () => {
  commandOpen.value = false
  closeMobile()
  connectionOpen.value = true
}
const openCommands = () => {
  connectionOpen.value = false
  closeMobile()
  commandOpen.value = true
}
const syncing = ref(false)
const toast = useToast()
const syncData = async () => {
  if (syncing.value || !token.value) return
  syncing.value = true
  try {
    managementConfig.invalidate()
    const results = await Promise.allSettled([refreshCapabilities(true), workspace.sync('admin:')])
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
    toast.add({ title: t('shell.syncSuccess'), color: 'success' })
  } catch (cause: any) {
    toast.add({ title: t('shell.syncFailed'), description: cause?.message || t('shell.syncError'), color: 'error' })
  } finally {
    syncing.value = false
  }
}

const mobileOpen = ref(false)
const sidebarCollapsed = ref(false)
const sidebarElement = ref<HTMLElement | null>(null)
const desktopViewport = ref(false)
let mobileTrigger: HTMLElement | null = null
const closeMobile = () => {
  if (!mobileOpen.value) return
  mobileOpen.value = false
  nextTick(() => mobileTrigger?.focus())
}
const openMobile = () => {
  mobileTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  mobileOpen.value = true
  nextTick(() => sidebarElement.value?.querySelector<HTMLElement>('a, button')?.focus())
}
const handleSidebarKeydown = (event: KeyboardEvent) => {
  if (!mobileOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMobile()
    return
  }
  if (event.key !== 'Tab') return
  const controls = Array.from(sidebarElement.value?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') || [])
    .filter(element => element.getClientRects().length > 0)
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

onMounted(() => {
  const desktopQuery = window.matchMedia('(min-width: 1024px)')
  const updateViewport = () => {
    desktopViewport.value = desktopQuery.matches
    if (desktopQuery.matches) closeMobile()
  }
  updateViewport()
  desktopQuery.addEventListener('change', updateViewport)
  onBeforeUnmount(() => desktopQuery.removeEventListener('change', updateViewport))
})

const navigationSections = computed<Array<{ label: string; items: NavigationItem[] }>>(() => [
  {
    label: t('nav.operate'),
    items: [{ label: t('nav.dashboard'), to: '/admin/dashboard', icon: 'i-tabler-grid-dots', subtitle: t('nav.dashboardDescription') }]
  },
  {
    label: t('nav.gateway'),
    items: [
      { label: t('nav.upstream'), to: '/admin/upstream', icon: 'i-tabler-cloud-upload', subtitle: t('nav.upstreamDescription') },
      { label: t('nav.models'), to: '/admin/routing/models', icon: 'i-tabler-box-multiple', subtitle: t('nav.modelsDescription') },
      { label: t('nav.accessKeys'), to: '/admin/access-keys', icon: 'i-tabler-key', subtitle: t('nav.accessKeysDescription') },
      { label: t('nav.users'), to: '/admin/users', icon: 'i-tabler-users', subtitle: t('nav.usersDescription'), capability: 'users' }
    ]
  },
  {
    label: t('nav.observe'),
    items: [
      { label: t('nav.usage'), to: '/admin/usage', icon: 'i-tabler-chart-bar', subtitle: t('nav.usageDescription'), capability: 'usage_records' },
      { label: t('nav.diagnostics'), to: '/admin/diagnostics', icon: 'i-tabler-tools', subtitle: t('nav.diagnosticsDescription') },
      { label: t('nav.logs'), to: '/admin/logs', icon: 'i-tabler-file-text', subtitle: t('nav.logsDescription'), capability: 'logs' }
    ]
  },
  {
    label: t('nav.finance'),
    items: [{ label: t('nav.billing'), to: '/admin/billing', icon: 'i-tabler-cash-banknote', subtitle: t('nav.billingDescription') }]
  },
  {
    label: t('nav.control'),
    items: [
      { label: t('nav.config'), to: '/admin/config', icon: 'i-tabler-adjustments-horizontal', subtitle: t('nav.configDescription') },
      { label: t('nav.plugins'), to: '/admin/plugins', icon: 'i-tabler-puzzle', subtitle: t('nav.pluginsDescription') },
      { label: t('nav.system'), to: '/admin/system-nodes', icon: 'i-tabler-server-2', subtitle: t('nav.systemDescription'), capability: 'topology' }
    ]
  }
])

const visibleSections = computed(() => navigationSections.value
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

const currentNavigation = computed(() => navigationSections.value.flatMap(section => section.items).find(isActive))
const pageTitle = computed(() => currentNavigation.value?.label || t('shell.management'))
const pageSubtitle = computed(() => currentNavigation.value?.subtitle || '')

const commandGroups = computed(() => [
  ...visibleSections.value.map(section => ({
    id: section.label,
    label: section.label,
    items: section.items.map(item => ({
      label: item.label,
      description: item.subtitle,
      icon: item.icon,
      onSelect: () => {
        commandOpen.value = false
        closeMobile()
        void router.push(item.to)
      }
    }))
  })),
  {
    id: 'actions',
    label: t('shell.globalActions'),
    items: [
      { label: t('shell.manageConnection'), description: t('shell.connectionDescription'), icon: 'i-tabler-plug', onSelect: openConnection },
      { label: t('shell.sync'), icon: 'i-tabler-refresh', disabled: syncing.value || !token.value, onSelect: () => { commandOpen.value = false; void syncData() } },
      { label: sidebarCollapsed.value ? t('shell.expandSidebar') : t('shell.collapseSidebar'), icon: 'i-tabler-layout-sidebar', onSelect: () => { commandOpen.value = false; toggleSidebar() } },
      ...[
        { label: t('shell.lightTheme'), value: 'light', icon: 'i-tabler-sun' },
        { label: t('shell.darkTheme'), value: 'dark', icon: 'i-tabler-moon' },
        { label: t('shell.systemTheme'), value: 'system', icon: 'i-tabler-device-desktop' }
      ].map(theme => ({ label: theme.label, icon: theme.icon, onSelect: () => { colorMode.preference = theme.value; commandOpen.value = false } })),
      { label: t('shell.disconnect'), icon: 'i-tabler-plug-off', disabled: !token.value, onSelect: () => { commandOpen.value = false; handleDisconnect() } }
    ]
  }
])

watch(() => route.fullPath, () => { closeMobile(); commandOpen.value = false })

onMounted(async () => {
  if (!token.value) {
    openConnection()
    return
  }
  try {
    await refreshCapabilities()
  } catch {
    // Keep the workspace in place; the connection dialog can repair the session.
  }
})

const handleDisconnect = () => {
  token.value = null
  managementRemember.value = false
  resetCapabilities()
  openConnection()
}
</script>

<style scoped>
.admin-navigation-overlay {
  background: color-mix(in srgb, var(--ui-text-highlighted) 35%, transparent);
}

.admin-brand:focus-visible,
.admin-connection-status:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.admin-connection-status:hover {
  background: var(--ui-bg-elevated);
}

.admin-nav-item-active {
  background: color-mix(in srgb, var(--ui-primary) 12%, var(--ui-bg-muted));
  color: var(--ui-primary);
}

.admin-nav-item-active::before {
  position: absolute;
  inset-block: 0.5rem;
  inset-inline-start: 0;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--ui-primary);
  content: '';
}

@media (max-width: 639px) {
  .admin-workspace-header {
    gap: 0.25rem;
    padding-inline: 0.5rem;
  }
}
</style>
