import { computed, onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'

// Each usage surface owns its timer; hidden/offline views never enqueue refreshes.
export function useUsageRefresh(eligible: Ref<boolean>, refresh: () => Promise<unknown>, interval = 60_000) {
  const enabled = ref(false)
  const visible = ref(false)
  const online = ref(false)
  const busy = ref(false)
  const lastUpdated = ref<Date | null>(null)
  const active = computed(() => enabled.value && eligible.value && visible.value && online.value)
  const status = computed(() => !enabled.value ? 'Automatic refresh off' : !online.value ? 'Paused while offline' : !visible.value ? 'Paused while hidden' : !eligible.value ? 'Paused for this view, range, or open details' : `Refresh every ${interval / 1000}s`)
  let timer: ReturnType<typeof setInterval> | undefined
  async function tick() {
    if (!active.value || busy.value) return
    busy.value = true
    try { await refresh(); lastUpdated.value = new Date() }
    catch { /* The owning surface displays request failures. */ }
    finally { busy.value = false }
  }
  function updateEnvironment() {
    visible.value = document.visibilityState === 'visible'
    online.value = navigator.onLine
  }
  watch(active, value => {
    if (timer) clearInterval(timer)
    timer = value ? setInterval(tick, interval) : undefined
  }, { flush: 'sync' })
  onMounted(() => {
    updateEnvironment()
    document.addEventListener('visibilitychange', updateEnvironment)
    window.addEventListener('online', updateEnvironment)
    window.addEventListener('offline', updateEnvironment)
  })
  onScopeDispose(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', updateEnvironment)
    window.removeEventListener('online', updateEnvironment)
    window.removeEventListener('offline', updateEnvironment)
  })
  return { enabled, active, status, busy, lastUpdated }
}
