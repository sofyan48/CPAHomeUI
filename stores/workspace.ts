import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWorkspaceStore = defineStore('workspace', () => {
  const values = ref<Record<string, unknown>>({})
  const generations = new Map<string, number>()
  const syncLoaders = new Map<symbol, { key: string; load: () => Promise<unknown> | unknown }>()
  const syncing = ref(false)

  const registerSync = (key: string, load: () => Promise<unknown> | unknown) => {
    const id = Symbol(key)
    syncLoaders.set(id, { key, load })
    return () => { syncLoaders.delete(id) }
  }

  const sync = async (prefix: string) => {
    if (syncing.value) return
    syncing.value = true
    try {
      const loaders = [...syncLoaders.values()].filter(loader => loader.key.startsWith(prefix))
      const results = await Promise.allSettled(loaders.map(loader => Promise.resolve().then(loader.load)))
      const failed = results.find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
    } finally {
      syncing.value = false
    }
  }

  const initialize = (key: string, value: unknown) => {
    const generation = (generations.get(key) || 0) + 1
    generations.set(key, generation)
    values.value[key] = value
    return generation
  }

  const isCurrent = (key: string, generation: number) => generations.get(key) === generation

  const write = (key: string, generation: number, value: unknown) => {
    if (isCurrent(key, generation)) values.value[key] = value
  }

  const clear = (prefix: string) => {
    for (const key of generations.keys()) {
      if (!key.startsWith(prefix)) continue
      generations.set(key, (generations.get(key) || 0) + 1)
      delete values.value[key]
    }
  }

  return { values, syncing, initialize, isCurrent, write, clear, registerSync, sync }
})
