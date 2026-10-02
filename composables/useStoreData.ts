import { onMounted, onScopeDispose, watch, type WatchSource } from 'vue'
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useDataSync } from '~/composables/useDataSync'

interface StoreDataOptions<T> {
  default?: () => T
  lazy?: boolean
  immediate?: boolean
  watch?: WatchSource[]
}

export const useStoreData = <T>(key: string, handler: () => Promise<T>, options: StoreDataOptions<T> = {}) => {
  const data = useWorkspaceState<T | undefined>(`${key}:data`, () => options.default?.())
  const pending = useWorkspaceState(`${key}:pending`, () => options.immediate !== false)
  const error = useWorkspaceState<unknown>(`${key}:error`, () => null)
  let version = 0
  let disposed = false

  const refresh = async () => {
    const requestVersion = ++version
    pending.value = true
    error.value = null
    try {
      const response = await handler()
      if (!disposed && requestVersion === version) data.value = response
    } catch (cause) {
      if (!disposed && requestVersion === version) error.value = cause
    } finally {
      if (!disposed && requestVersion === version) pending.value = false
    }
  }

  if (options.immediate !== false) useDataSync(key, async () => {
    await refresh()
    if (error.value) throw error.value
  })
  if (options.watch?.length) watch(options.watch, () => { void refresh() })
  if (options.immediate !== false) onMounted(() => { void refresh() })
  onScopeDispose(() => { disposed = true; version++; pending.value = false })

  return { data, pending, error, refresh }
}
