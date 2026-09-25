<template>
  <div class="min-h-screen bg-[var(--ui-bg)] text-[var(--ui-text)]">
    <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" @click="mobileOpen = false" />

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] transition-transform duration-200 md:translate-x-0"
      :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 items-center justify-between border-b border-[var(--ui-border)] px-5">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-3" @click="mobileOpen = false">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/20">
            <UIcon name="i-heroicons-command-line" class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="truncate font-semibold text-[var(--ui-text-highlighted)]">CLIProxyAPI Home</p>
            <p class="truncate text-xs text-[var(--ui-text-muted)]">Management console</p>
          </div>
        </NuxtLink>
        <UButton class="md:hidden" icon="i-heroicons-x-mark" color="neutral" variant="ghost" @click="mobileOpen = false" />
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <div v-for="section in visibleSections" :key="section.label" class="mb-5">
          <p v-if="section.label" class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ui-text-dimmed)]">
            {{ section.label }}
          </p>
          <div class="space-y-1">
            <UButton
              v-for="item in section.items"
              :key="item.to"
              :to="item.to"
              :icon="item.icon"
              color="neutral"
              variant="ghost"
              class="w-full justify-start"
              active-class="bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300"
              @click="mobileOpen = false"
            >
              {{ item.label }}
            </UButton>
          </div>
        </div>
      </nav>

      <div class="border-t border-[var(--ui-border)] p-4">
        <div class="rounded-xl bg-[var(--ui-bg-muted)] p-3">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full" :class="capabilitiesError ? 'bg-amber-500' : 'bg-emerald-500'" />
            <span class="text-xs font-medium text-[var(--ui-text-highlighted)]">{{ capabilitiesError ? 'Capability check failed' : 'Connected' }}</span>
          </div>
          <p class="mt-1 truncate text-xs text-[var(--ui-text-muted)]">{{ versionLabel }}</p>
        </div>
      </div>
    </aside>

    <div class="min-h-screen md:pl-72">
      <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-bg)]/90 px-4 backdrop-blur md:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <UButton class="md:hidden" icon="i-heroicons-bars-3" color="neutral" variant="ghost" @click="mobileOpen = true" />
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ pageTitle }}</p>
            <p class="hidden truncate text-xs text-[var(--ui-text-muted)] sm:block">Secure Home management session</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            icon="i-heroicons-arrow-path"
            color="neutral"
            variant="ghost"
            :loading="capabilitiesLoading"
            aria-label="Refresh capabilities"
            @click="refreshCapabilities(true)"
          />
          <UButton icon="i-heroicons-arrow-right-on-rectangle" color="neutral" variant="soft" @click="handleLogout">
            <span class="hidden sm:inline">Logout</span>
          </UButton>
        </div>
      </header>

      <main class="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <UAlert
          v-if="capabilitiesError"
          class="mb-6"
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
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
}

const route = useRoute()
const router = useRouter()
const { token } = useApi()
const {
  serverInfo,
  loading: capabilitiesLoading,
  error: capabilitiesError,
  supports,
  refreshCapabilities,
  resetCapabilities
} = useCapabilities()

const mobileOpen = ref(false)

const navigationSections: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: '',
    items: [
      { label: 'Dashboard', to: '/', icon: 'i-heroicons-squares-2x2' },
      { label: 'System', to: '/system', icon: 'i-heroicons-server-stack', capability: 'topology' }
    ]
  },
  {
    label: 'Routing',
    items: [
      { label: 'Models', to: '/routing/models', icon: 'i-heroicons-cube' },
      { label: 'Channel groups', to: '/routing/channels', icon: 'i-heroicons-arrows-right-left', capability: 'access_groups' },
      { label: 'Model groups', to: '/routing/model-groups', icon: 'i-heroicons-rectangle-group', capability: 'access_groups' }
    ]
  },
  {
    label: 'Access',
    items: [
      { label: 'Users', to: '/access/users', icon: 'i-heroicons-users', capability: 'users' },
      { label: 'Client API keys', to: '/access/api-keys', icon: 'i-heroicons-key' },
      { label: 'Provider credentials', to: '/access/providers', icon: 'i-heroicons-identification' }
    ]
  },
  {
    label: 'Observability',
    items: [
      { label: 'Usage', to: '/observability/usage', icon: 'i-heroicons-chart-bar-square', capability: 'usage_records' },
      { label: 'Logs', to: '/observability/logs', icon: 'i-heroicons-document-text', capability: 'logs' }
    ]
  }
]

const visibleSections = computed(() => navigationSections
  .map(section => ({
    ...section,
    items: section.items.filter(item => !item.capability || supports(item.capability, true))
  }))
  .filter(section => section.items.length))

const pageTitle = computed(() => {
  for (const section of navigationSections) {
    const exact = section.items.find(item => item.to === route.path)
    if (exact) return exact.label
  }
  return 'Management'
})

const versionLabel = computed(() => {
  const version = serverInfo.value.home_version
  const commit = serverInfo.value.home_commit
  if (version && commit) return `${version} · ${commit.slice(0, 8)}`
  return version || 'CLIProxyAPI Home'
})

watch(() => route.fullPath, () => { mobileOpen.value = false })

onMounted(async () => {
  if (!token.value) {
    await router.replace({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await refreshCapabilities()
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403 || error?.statusCode === 404) {
      token.value = null
      resetCapabilities()
      await router.replace({ path: '/login', query: { redirect: route.fullPath } })
    }
  }
})

const handleLogout = async () => {
  token.value = null
  resetCapabilities()
  await router.replace('/login')
}
</script>
