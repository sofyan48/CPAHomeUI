<template>
  <div class="user-shell relative text-[var(--ui-text)]" :class="workspaceRoute ? 'h-dvh overflow-hidden bg-gradient-to-br from-sky-50 via-slate-50 to-blue-100 dark:from-slate-950 dark:via-neutral-950 dark:to-slate-900' : 'user-shell--public min-h-screen'">
    <template v-if="workspaceRoute">
      <div class="pointer-events-none absolute -top-32 right-0 size-96 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" aria-hidden="true" />
      <div class="pointer-events-none absolute bottom-0 left-1/3 size-80 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10" aria-hidden="true" />
      <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" @click="closeMobile" />
      <aside
        id="workspace-sidebar"
        class="user-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white/95 shadow-[4px_0_24px_rgba(14,165,233,0.08)] backdrop-blur-xl transition-[width,transform] duration-200 dark:border-white/10 dark:bg-neutral-950/95 lg:bg-white/30 lg:dark:bg-neutral-900/30"
        :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', sidebarHidden ? 'lg:w-16' : 'lg:w-64', 'lg:translate-x-0']"
      >
        <div class="flex h-16 shrink-0 items-center justify-between gap-1 border-b border-slate-200 px-3 dark:border-white/10" :class="sidebarHidden ? 'lg:flex-col lg:justify-center lg:gap-0 lg:px-1' : ''">
          <NuxtLink to="/app" class="flex min-w-0 items-center gap-2" :class="sidebarHidden ? 'lg:hidden' : ''" @click="closeMobile">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[var(--ui-primary)] shadow-sm dark:border-white/10 dark:bg-neutral-900"><UIcon name="i-tabler-terminal-2" class="size-5" /></span>
            <span class="min-w-0 leading-tight"><span class="block truncate text-sm font-bold text-[var(--ui-text-highlighted)]">CPAHome</span><span class="block truncate text-xs text-[var(--ui-text-muted)]">User workspace</span></span>
          </NuxtLink>
          <NuxtLink v-if="sidebarHidden" to="/app" class="hidden size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[var(--ui-primary)] dark:border-white/10 dark:bg-neutral-900 lg:flex" aria-label="CPAHome dashboard"><UIcon name="i-tabler-terminal-2" class="size-4" /></NuxtLink>
          <UButton class="lg:hidden" icon="i-tabler-x" color="neutral" variant="ghost" aria-label="Close navigation" @click="closeMobile" />
          <UButton class="hidden lg:inline-flex" :icon="sidebarHidden ? 'i-tabler-layout-sidebar-left-expand' : 'i-tabler-layout-sidebar-left-collapse'" color="neutral" variant="ghost" size="xs" :aria-label="sidebarHidden ? 'Expand sidebar' : 'Collapse sidebar'" :aria-expanded="!sidebarHidden" aria-controls="workspace-sidebar" @click="sidebarHidden = !sidebarHidden" />
        </div>
        <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2" aria-label="User workspace">
          <UButton
            v-for="item in workspaceNavigation" :key="item.to" :to="item.to" :icon="item.icon"
            :color="isActive(item.to) ? 'primary' : 'neutral'" :variant="isActive(item.to) ? 'soft' : 'ghost'" class="w-full rounded-lg"
            :class="sidebarHidden ? 'lg:justify-center' : 'justify-start'"
            :aria-label="item.label" :title="sidebarHidden ? item.label : undefined"
            :aria-current="isActive(item.to) ? 'page' : undefined" @click="closeMobile"
          ><span :class="sidebarHidden ? 'lg:hidden' : ''">{{ item.label }}</span></UButton>
        </nav>
        <div class="flex shrink-0 items-center gap-1 border-t border-slate-200 p-2 dark:border-white/10" :class="sidebarHidden ? 'lg:flex-col' : ''">
          <UButton to="/app/profile" icon="i-tabler-user-circle" color="neutral" variant="ghost" class="min-w-0 flex-1 rounded-lg" :class="sidebarHidden ? 'lg:w-full lg:justify-center' : 'justify-start'" aria-label="Profile" :title="sidebarHidden ? 'Profile' : undefined" :aria-current="route.path === '/app/profile' ? 'page' : undefined" @click="closeMobile"><span :class="sidebarHidden ? 'lg:hidden' : ''">Profile</span></UButton>
          <UButton icon="i-tabler-logout" color="neutral" variant="ghost" aria-label="Log out" title="Log out" @click="logout" />
          <ThemeSwitcher />
        </div>
      </aside>
      <div class="relative flex h-full min-w-0 flex-col transition-[padding] duration-200" :class="sidebarHidden ? 'lg:pl-16' : 'lg:pl-64'">
        <header class="user-shell__header z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/50 px-4 backdrop-blur-xl sm:px-5 lg:px-6 dark:border-white/10 dark:bg-neutral-900/50">
          <div class="flex min-w-0 items-center gap-3">
            <UButton class="lg:hidden" icon="i-tabler-menu-2" color="neutral" variant="ghost" aria-label="Open navigation" aria-controls="workspace-sidebar" :aria-expanded="mobileOpen" @click="openMobile" />
            <div class="min-w-0"><p class="truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ pageTitle }}</p><p class="truncate text-xs text-[var(--ui-text-muted)]">{{ pageSubtitle }}</p></div>
          </div>
        </header>
        <main class="min-h-0 w-full flex-1 overflow-y-auto px-4 py-5 sm:p-5 lg:p-6"><slot /></main>
      </div>
    </template>

    <template v-else>
      <header class="user-shell__header sticky top-0 z-30 border-b border-[var(--ui-border)] bg-[var(--glass-soft)] backdrop-blur">
        <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <NuxtLink :to="homeTarget" class="flex min-w-0 items-center gap-3" aria-label="Back to home"><span class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[var(--ui-primary)] shadow-sm dark:border-white/10 dark:bg-neutral-900"><UIcon name="i-tabler-terminal-2" class="size-5" /></span><span class="min-w-0"><span class="block truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">CPAHome</span><span class="block truncate text-xs text-[var(--ui-text-muted)]">{{ pageSubtitle }}</span></span></NuxtLink>
          <div class="flex shrink-0 items-center gap-2"><ThemeSwitcher /><template v-if="route.path === '/app/models'"><UButton :to="homeTarget" color="neutral" variant="ghost" size="sm" icon="i-tabler-home">Home</UButton><UButton v-if="!token" to="/app/login" color="neutral" variant="ghost" size="sm">Sign in</UButton></template></div>
        </div>
      </header>
      <main class="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6"><slot /></main>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { token, clearSession, loadCurrentUser, hydrateSession } = useUserApi()
const mobileOpen = ref(false)
const sidebarHidden = ref(false)
const openMobile = () => { mobileOpen.value = true }
const closeMobile = () => { mobileOpen.value = false }
const publicPaths = new Set(['/app/login', '/app/register', '/app/forgot-password', '/app/reset-password', '/app/verify-email', '/app/models'])
const workspaceNavigation = [
  { label: 'Dashboard', to: '/app', icon: 'i-tabler-layout-dashboard' },
  { label: 'Model Catalog', to: '/app/models', icon: 'i-tabler-box-multiple' },
  { label: 'API Key', to: '/app/api-keys', icon: 'i-tabler-key' },
  { label: 'Setting', to: '/app/settings', icon: 'i-tabler-settings' }
]
const workspaceRoute = computed(() => ['/app', '/app/api-keys', '/app/settings', '/app/profile'].includes(route.path) || (route.path === '/app/models' && Boolean(token.value)))
const pageTitles: Record<string, string> = { '/app': 'Dashboard', '/app/models': 'Model Catalog', '/app/api-keys': 'API Key', '/app/settings': 'Setting', '/app/profile': 'Profile' }
const accessSubtitles: Record<string, string> = { '/app/login': 'User login', '/app/register': 'Create account', '/app/models': 'Model catalog', '/app/forgot-password': 'Password recovery', '/app/reset-password': 'Reset password', '/app/verify-email': 'Verify email' }
const pageTitle = computed(() => pageTitles[route.path] || 'User workspace')
const pageSubtitle = computed(() => workspaceRoute.value
  ? route.path === '/app'
    ? 'Billing and account overview'
    : route.path === '/app/models'
      ? 'Browse models available through Home'
      : route.path === '/app/api-keys'
        ? 'Manage client access credentials'
        : route.path === '/app/profile'
          ? 'Account profile and security summary'
          : 'Account and sign-in security'
  : accessSubtitles[route.path] || 'User access')
const homeTarget = computed(() => token.value ? '/app' : '/')
const isActive = (to: string) => route.path === to

const ensureSession = async () => {
  hydrateSession()
  if (publicPaths.has(route.path)) return
  if (!token.value) { await router.replace({ path: '/app/login', query: { redirect: route.fullPath } }); return }
  try { await loadCurrentUser() }
  catch (cause: any) {
    if (cause?.statusCode !== 401 && token.value) return
    clearSession()
    await router.replace({ path: '/app/login', query: { redirect: route.fullPath } })
  }
}
const logout = async () => { clearSession(); await router.replace('/app/login') }
watch(() => route.fullPath, () => { closeMobile(); void ensureSession() })
onMounted(ensureSession)
</script>

<style scoped>
.user-shell--public { background: var(--workbench-bg); }
.user-sidebar :deep(a[aria-current="page"]) { background: color-mix(in oklch, var(--ui-primary) 12%, transparent); color: var(--ui-primary); }
</style>
