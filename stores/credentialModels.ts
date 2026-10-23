import { defineStore } from 'pinia'

const cacheTTL = 30_000
const maxEntries = 100

type CacheEntry = {
  value?: unknown
  cachedAt?: number
  pending?: Promise<unknown>
}

export const useCredentialModelsStore = defineStore('credentialModels', () => {
  // Keep responses and session identity out of serialized Pinia state and devtools keys.
  const entries = new Map<string, CacheEntry>()
  let origin = ''
  let sessionToken = ''
  let generation = 0

  const invalidate = () => {
    generation++
    entries.clear()
  }

  const clear = () => {
    invalidate()
    origin = ''
    sessionToken = ''
  }

  const setScope = (nextOrigin: string, nextToken: string) => {
    if (origin === nextOrigin && sessionToken === nextToken) return
    invalidate()
    origin = nextOrigin
    sessionToken = nextToken
  }

  const fetchModels = <T>(credentialId: string, fetcher: () => Promise<T>, refresh = false): Promise<T> => {
    const now = Date.now()
    for (const [key, entry] of entries) {
      if (!entry.pending && (entry.cachedAt === undefined || now - entry.cachedAt >= cacheTTL)) entries.delete(key)
    }

    const cached = entries.get(credentialId)
    if (!refresh && cached) {
      if (cached.pending) return cached.pending as Promise<T>
      if (cached.cachedAt !== undefined) return Promise.resolve(cached.value as T)
    }

    entries.delete(credentialId)
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!)
    const entry: CacheEntry = {}
    const requestGeneration = generation
    entries.set(credentialId, entry)
    const request = Promise.resolve().then(fetcher).then((value) => {
      if (requestGeneration === generation && entries.get(credentialId) === entry) {
        entry.value = value
        entry.cachedAt = Date.now()
      }
      return value
    }).finally(() => {
      if (entries.get(credentialId) !== entry) return
      entry.pending = undefined
      if (entry.cachedAt === undefined) entries.delete(credentialId)
    })
    entry.pending = request
    return request
  }

  return { setScope, fetchModels, invalidate, clear }
})
