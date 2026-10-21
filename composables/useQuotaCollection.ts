import { computed, onScopeDispose, ref, watch } from 'vue'
import { useNuxtApp } from '#imports'
import { useApi } from '~/composables/useApi'
import { useCapabilities } from '~/composables/useCapabilities'
import { quotaCollectionMessage, quotaCollectionSettled, type QuotaCollectionEntry } from '~/composables/upstreamQuota'

const scopes = new WeakMap<object, ReturnType<typeof createState>>()
function createState() {
  return { ids: ref(new Set<string>()), all: ref(false), revision: ref(0), details: ref<Record<string, any>>({}) }
}

export function useQuotaCollection() {
  const app = useNuxtApp()
  if (!scopes.has(app)) scopes.set(app, createState())
  const state = scopes.get(app)!
  const { fetchAPI, token, resolveUrl } = useApi()
  const { supports } = useCapabilities()
  const toast = useToast()
  const controllers = new Set<AbortController>()
  let generation = 0
  let disposed = false
  const ownedIDs = new Set<string>()
  let ownsAll = false
  const cancel = () => {
    state.ids.value = new Set([...state.ids.value].filter(id => !ownedIDs.has(id)))
    ownedIDs.clear()
    if (ownsAll) state.all.value = false
    ownsAll = false
    generation++
    for (const controller of controllers) controller.abort()
    controllers.clear()
  }
  watch(token, () => {
    cancel()
    state.ids.value = new Set()
    state.all.value = false
    state.details.value = {}
  }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; cancel() })

  async function collect(id?: string) {
    if (disposed || state.all.value || (id ? state.ids.value.has(id) : state.ids.value.size > 0)) return null
    if (!supports('quota_recollect', true) || !supports('quota_snapshots', true) || (id && !supports('quota_snapshot_details', true))) {
      toast.add({ title: 'Quota collection unavailable', description: 'This Home deployment does not support tracked quota collection.', color: 'warning' })
      return null
    }
    const controller = new AbortController()
    controllers.add(controller)
    const signal = controller.signal
    const owner = generation
    const session = token.value
    const endpoint = resolveUrl('/quota/credentials')
    const current = () => !disposed && owner === generation && token.value === session && resolveUrl('/quota/credentials') === endpoint
    const check = () => { signal.throwIfAborted(); if (!current()) throw new DOMException('Cancelled', 'AbortError') }
    if (id) { ownedIDs.add(id); state.ids.value = new Set([...state.ids.value, id]) }
    else { ownsAll = true; state.all.value = true }
    let timedOut = false
    let posted = false
    const timeout = setTimeout(() => { timedOut = true; controller.abort() }, 35_000)
    const readDetail = async () => {
      const detail = await fetchAPI<any>(`/quota/credentials/${encodeURIComponent(id!)}`, { signal })
      check()
      state.details.value = { ...state.details.value, [id!]: detail }
      state.revision.value++
      return [detail.credential as QuotaCollectionEntry]
    }
    const readList = async (ids?: string[]) => {
      if (ids && !ids.length) return []
      const entries: QuotaCollectionEntry[] = []
      for (let offset = 0; ; offset += 200) {
        const result = await fetchAPI<{ items: QuotaCollectionEntry[]; total: number }>('/quota/credentials', {
          signal, query: ids ? { ids: ids.slice(offset, offset + 200).join(','), limit: 200 } : { limit: 200, offset, sort: 'label_asc' }
        })
        check()
        entries.push(...result.items)
        if (offset + 200 >= (ids ? ids.length : result.total)) break
      }
      return entries
    }
    const wait = () => new Promise<void>((resolve, reject) => {
      check()
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 1000)
      signal.addEventListener('abort', abort, { once: true })
    })
    try {
      // Always fetch a baseline before POST; observation freshness can come from passive headers.
      const baseline = new Map((id ? await readDetail() : await readList()).map(entry => [entry.credential_id, { ...entry }]))
      check()
      const result = await fetchAPI<{ accepted: number }>('/quota/collect', { method: 'POST', body: id ? { credential_ids: [id] } : {}, signal })
      posted = true
      check()
      toast.add({ title: result.accepted ? 'Quota collection queued' : 'No new collection queued', description: result.accepted ? `${result.accepted} accepted. Waiting for persisted results…` : 'Credentials may already be queued, disabled, or unsupported.', color: 'info' })
      const tracked = [...baseline.values()].filter(entry => entry.credential_status !== 'disabled' && entry.credential_type !== 'provider_api_key' && entry.quota_status !== 'unsupported' && entry.collection_status !== 'unsupported')
      if (!result.accepted && !tracked.some(entry => entry.collection_status === 'collecting')) return { completion: 'not-started' }
      const completed = new Set<string>()
      for (let poll = 0; poll < 30; poll++) {
        await wait()
        const entries = id ? await readDetail() : await readList(tracked.map(entry => entry.credential_id))
        check()
        state.revision.value++
        for (const entry of entries) {
          const previous = baseline.get(entry.credential_id)
          // Bulk acceptance counts newly queued work, not probes already leased at baseline.
          if (previous && quotaCollectionSettled(entry, previous) && (id || !result.accepted || previous.last_attempt_at !== entry.last_attempt_at)) completed.add(entry.credential_id)
        }
        const required = result.accepted || tracked.filter(entry => entry.collection_status === 'collecting').length
        if (completed.size >= required) {
          const failed = entries.filter(entry => completed.has(entry.credential_id) && ['partial', 'failed'].includes(entry.collection_status || ''))
          toast.add({ title: failed.length ? 'Quota collection settled with errors' : 'Quota collection completed', description: failed.length ? (id ? quotaCollectionMessage(state.details.value[id]?.collection?.error) : `${failed.length} credential(s) reported partial or failed collection. Inspect quota details.`) : 'New persisted collection results are available.', color: failed.length ? 'warning' : 'success' })
          return { completion: 'settled' }
        }
      }
      toast.add({ title: 'Quota collection still pending', description: 'No confirmed completion within 30 polls. Home may still be working; refresh later. No additional collection was submitted.', color: 'warning' })
      return { completion: 'pending' }
    } catch (error: any) {
      if (!current() || (signal.aborted && !timedOut)) return null
      toast.add({ title: timedOut ? 'Quota collection status unconfirmed' : 'Quota collection unavailable', description: timedOut ? 'Tracking timed out. Home may still be working; refresh before retrying.' : `${error?.message || 'Could not read quota collection status.'}${posted ? ' Collection may still be running; refresh before retrying.' : ''}`, color: 'warning' })
      return { completion: 'pending' }
    } finally {
      clearTimeout(timeout)
      controllers.delete(controller)
      if (current()) {
        if (id) { ownedIDs.delete(id); state.ids.value = new Set([...state.ids.value].filter(value => value !== id)) }
        else { ownsAll = false; state.all.value = false }
      }
    }
  }
  return { collect, collectingAll: computed(() => state.all.value), collectingIDs: computed(() => state.ids.value), revision: computed(() => state.revision.value), details: computed(() => state.details.value) }
}
