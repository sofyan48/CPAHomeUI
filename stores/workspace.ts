import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWorkspaceStore = defineStore('workspace', () => {
  const values = ref<Record<string, unknown>>({})
  const generations = new Map<string, number>()

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

  return { values, initialize, isCurrent, write, clear }
})
