<template>
  <div class="workbench-shell min-h-screen text-[var(--ui-text)]">
    <header class="workbench-header sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur sm:px-8">
      <NuxtLink to="/app" class="flex min-w-0 items-center gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--workbench-sidebar-primary)] text-slate-950"><UIcon name="i-heroicons-command-line" class="size-5" /></span>
        <span class="min-w-0"><span class="block truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">Home Center</span><span class="block truncate text-xs text-[var(--ui-text-muted)]">AI Gateway</span></span>
      </NuxtLink>
      <div class="flex items-center gap-2">
        <ThemeSwitcher />
        <UButton v-if="route.path !== '/app/models'" to="/app/models" color="neutral" variant="ghost" size="sm">Model catalog</UButton>
        <UButton v-if="token && route.path !== '/app'" to="/app" color="neutral" variant="ghost" size="sm">User workspace</UButton>
        <UButton v-if="token" color="neutral" variant="ghost" size="sm" @click="logout">Log out</UButton>
        <UButton v-else-if="route.path !== '/app/login'" to="/app/login" color="neutral" variant="ghost" size="sm">Sign in</UButton>
      </div>
    </header>
    <main class="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { token, clearSession, loadCurrentUser } = useUserApi()
const publicPaths = new Set(['/app/login', '/app/register', '/app/forgot-password', '/app/reset-password', '/app/verify-email', '/app/models'])
const ensureSession = async () => {
  if (publicPaths.has(route.path)) return
  if (!token.value) {
    await router.replace({ path: '/app/login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await loadCurrentUser()
  } catch {
    clearSession()
    await router.replace({ path: '/app/login', query: { redirect: route.fullPath } })
  }
}
const logout = async () => {
  clearSession()
  await router.replace('/app/login')
}
watch(() => route.fullPath, () => { void ensureSession() })
onMounted(ensureSession)
</script>
