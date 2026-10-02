import { computed, type Ref } from 'vue'
import { useWorkspaceStore } from '~/stores/workspace'

export const useWorkspaceState = <T>(key: string, factory: () => T): Ref<T> => {
  const store = useWorkspaceStore()
  const initial = factory()
  // Each mounted owner starts fresh; stale requests cannot overwrite a new owner.
  const generation = store.initialize(key, initial)
  return computed<T>({
    get: () => store.isCurrent(key, generation) ? store.values[key] as T : factory(),
    set: value => store.write(key, generation, value)
  })
}
