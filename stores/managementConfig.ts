import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useManagementConfigStore = defineStore('managementConfig', () => {
  const cachedValues = shallowRef(new Map<string, { value: any, cachedAt: number }>())
  const pendingRequests = new Map<string, Promise<any>>()
  let generation = 0

  const invalidate = () => {
    generation++
    cachedValues.value = new Map()
    pendingRequests.clear()
  }

  const fetchConfig = (cacheKey: string, fetcher: () => Promise<any>) => {
    const cached = cachedValues.value.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < 1000) return Promise.resolve(cached.value)

    const pendingRequest = pendingRequests.get(cacheKey)
    if (pendingRequest) return pendingRequest

    const requestGeneration = generation
    const request = fetcher().then((configRoot) => {
      if (requestGeneration === generation) {
        const nextValues = new Map(cachedValues.value)
        nextValues.set(cacheKey, { value: configRoot, cachedAt: Date.now() })
        cachedValues.value = nextValues
      }
      return configRoot
    }).finally(() => {
      if (pendingRequests.get(cacheKey) === request) pendingRequests.delete(cacheKey)
    })
    pendingRequests.set(cacheKey, request)
    return request
  }

  return { cachedValues, fetchConfig, invalidate }
})
