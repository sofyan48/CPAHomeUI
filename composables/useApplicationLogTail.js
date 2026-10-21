import { computed, ref } from 'vue'

const maxRows = 2000
export const mergeLogRows = (current, incoming) => {
  const rows = new Map(current.map(row => [String(row.id), row]))
  for (const row of incoming) rows.set(String(row.id), row)
  return [...rows.values()].sort((a, b) => {
    const time = Date.parse(b.timestamp) - Date.parse(a.timestamp)
    if (time) return time
    return BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0
  })
}

export function useApplicationLogTail({ fetchAPI, params, limit, onError }) {
  const rows = ref([])
  const pending = ref([])
  const following = ref(false)
  const busy = ref(false)
  const anchor = ref(null)
  const hasOlder = ref(false)
  const truncated = ref(false)
  let generation = 0
  let controller = null

  const cancel = () => {
    generation += 1
    controller?.abort()
    controller = null
    busy.value = false
  }
  const reset = () => {
    cancel()
    rows.value = []
    pending.value = []
    anchor.value = null
    hasOlder.value = false
    truncated.value = false
  }
  const seed = response => {
    reset()
    rows.value = mergeLogRows([], response?.logs || [])
    anchor.value = response?.anchor_id || null
    hasOlder.value = Boolean(anchor.value) && Number(response?.total) > rows.value.length
  }
  const accept = () => {
    const merged = mergeLogRows(rows.value, pending.value)
    if (merged.length > maxRows) {
      truncated.value = true
      hasOlder.value = Boolean(anchor.value)
    }
    rows.value = merged.slice(0, maxRows)
    pending.value = []
  }
  const setFollowing = value => {
    following.value = value
    if (value) accept()
  }
  const read = async older => {
    if (busy.value || (older && (!hasOlder.value || rows.value.length >= maxRows))) return
    const version = generation
    controller = new AbortController()
    const signal = controller.signal
    busy.value = true
    try {
      const query = params()
      query.set('limit', String(limit()))
      query.set('offset', '0')
      if (older) {
        following.value = false
        query.set('anchor_id', String(anchor.value))
        query.set('before_id', String(rows.value.at(-1).id))
      }
      // Poll a recent window, not after_id: late-ingested timestamps may be older.
      const response = await fetchAPI(`/observability/logs?${query}`, { signal })
      if (version !== generation || signal.aborted) return
      const incoming = Array.isArray(response?.logs) ? response.logs : []
      if (query.has('search') && response?.search !== query.get('search')) {
        throw new Error('This Home version did not confirm server-side search support. Reset the search or upgrade Home before tailing.')
      }
      if (older) {
        const merged = mergeLogRows(rows.value, incoming)
        hasOlder.value = incoming.length > 0 && Number(response.total) > incoming.length
        if (merged.length > maxRows) truncated.value = true
        // Keep the current viewport when older loading reaches the viewer limit.
        rows.value = merged.slice(0, maxRows)
      } else {
        if (Number(response.total) > incoming.length && incoming.length && rows.value.length && !incoming.some(row => rows.value.some(current => String(current.id) === String(row.id)))) truncated.value = true
        const known = new Set(rows.value.map(row => String(row.id)))
        const staged = mergeLogRows(pending.value, incoming.filter(row => !known.has(String(row.id))))
        if (staged.length > maxRows) truncated.value = true
        pending.value = staged.slice(0, maxRows)
        if (!rows.value.length) {
          anchor.value = response?.anchor_id || null
          hasOlder.value = Boolean(anchor.value) && Number(response.total) > incoming.length
        }
        if (following.value) accept()
      }
    } catch (error) {
      if (version === generation && !signal.aborted) onError(error)
    } finally {
      if (version === generation) {
        busy.value = false
        controller = null
      }
    }
  }
  return { rows, pending, following, busy, truncated, seed, reset, cancel, accept, setFollowing,
    canLoadOlder: computed(() => hasOlder.value && rows.value.length > 0 && rows.value.length < maxRows),
    poll: () => read(false), loadOlder: () => read(true) }
}
