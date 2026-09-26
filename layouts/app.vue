<template>
  <div class="user-shell min-h-screen text-[var(--ui-text)]">
    <template v-if="workspaceRoute">
      <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" @click="closeMobile" />
      <aside id="workspace-sidebar" class="user-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--ui-border)] bg-[var(--glass-card-strong)] transition-transform" :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', sidebarHidden ? 'lg:-translate-x-full' : 'lg:translate-x-0']">
        <div class="flex h-16 items-center justify-between border-b border-[var(--ui-border)] px-4">
          <NuxtLink to="/app" class="flex min-w-0 items-center gap-3" @click="closeMobile"><img src="/favicon.png" alt="" class="size-9 rounded-md" /><span class="min-w-0"><span class="block truncate text-sm font-semibold">CPAHome</span><span class="block truncate text-xs text-[var(--ui-text-muted)]">User workspace</span></span></NuxtLink>
          <UButton class="lg:hidden" icon="i-tabler-x" color="neutral" variant="ghost" aria-label="Close navigation" @click="closeMobile" />
        </div>
        <nav class="flex-1 space-y-1 p-3" aria-label="User workspace">
          <UButton v-for="item in workspaceNavigation" :key="item.to" :to="item.to" :icon="item.icon" color="neutral" variant="ghost" class="w-full justify-start" :aria-current="isActive(item.to) ? 'page' : undefined" @click="closeMobile">{{ item.label }}</UButton>
        </nav>
        <div class="flex items-center gap-2 border-t border-[var(--ui-border)] p-3"><UButton to="/app/profile" icon="i-tabler-user-circle" color="neutral" variant="ghost" class="min-w-0 flex-1 justify-start" :aria-current="route.path === '/app/profile' ? 'page' : undefined" @click="closeMobile">Profile</UButton><ThemeSwitcher /></div>
      </aside>
      <div class="min-h-screen transition-[padding] duration-200" :class="sidebarHidden ? 'lg:pl-0' : 'lg:pl-64'">
        <header class="user-shell__header sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--ui-border)] bg-[var(--glass-soft)] px-4 backdrop-blur sm:px-6">
          <div class="flex min-w-0 items-center gap-3">
            <UButton class="lg:hidden" icon="i-tabler-menu-2" color="neutral" variant="ghost" aria-label="Open navigation" @click="openMobile" />
            <UButton class="hidden lg:inline-flex" :icon="sidebarHidden ? 'i-tabler-layout-sidebar-left-expand' : 'i-tabler-layout-sidebar-left-collapse'" color="neutral" variant="ghost" :aria-label="sidebarHidden ? 'Show sidebar' : 'Hide sidebar'" :aria-expanded="!sidebarHidden" aria-controls="workspace-sidebar" @click="sidebarHidden = !sidebarHidden" />
            <div><p class="text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ pageTitle }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ pageSubtitle }}</p></div>
          </div>
          <UButton color="neutral" variant="ghost" size="sm" icon="i-tabler-logout" @click="logout">Log out</UButton>
        </header>
        <main class="w-full px-4 pb-16 pt-6 sm:px-6"><slot /></main>
      </div>
    </template>

    <template v-else>
      <header class="user-shell__header sticky top-0 z-30 border-b border-[var(--ui-border)] bg-[var(--glass-soft)] backdrop-blur">
        <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <NuxtLink :to="homeTarget" class="flex min-w-0 items-center gap-3" aria-label="Back to home"><img src="/favicon.png" alt="" class="size-9 shrink-0 rounded-md" /><span class="min-w-0"><span class="block truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">CPAHome</span><span class="block truncate text-xs text-[var(--ui-text-muted)]">{{ pageSubtitle }}</span></span></NuxtLink>
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
  catch { clearSession(); await router.replace({ path: '/app/login', query: { redirect: route.fullPath } }) }
}
const logout = async () => { clearSession(); await router.replace('/app/login') }
watch(() => route.fullPath, () => { closeMobile(); void ensureSession() })
onMounted(ensureSession)
</script>

<style scoped>
.user-shell { background: var(--workbench-bg); }
.user-sidebar :deep(a[aria-current="page"]) { background: color-mix(in oklch, var(--ui-primary) 12%, transparent); color: var(--ui-primary); }
</style>
