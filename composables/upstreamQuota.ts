export type QuotaCollectionEntry = {
  credential_id: string
  provider?: string
  credential_type?: string
  credential_status?: string
  collection_status?: string
  last_attempt_at?: string | null
  source?: string | null
  quota_status?: string
}

export function quotaCollectionSettled(entry: QuotaCollectionEntry, baseline: QuotaCollectionEntry): boolean {
  if (entry.provider !== baseline.provider || entry.credential_type !== baseline.credential_type) return false
  if (!['success', 'partial', 'failed'].includes(entry.collection_status || '')) return false
  const attempt = Date.parse(entry.last_attempt_at || '')
  const previous = Date.parse(baseline.last_attempt_at || '')
  if (!Number.isFinite(attempt)) return false
  // A probe already leased before POST can settle without changing its attempt timestamp.
  const newer = !baseline.last_attempt_at || (Number.isFinite(previous) && attempt > previous)
  const existing = baseline.collection_status === 'collecting' && entry.last_attempt_at === baseline.last_attempt_at
  return (newer || existing) && (entry.collection_status === 'failed' || entry.source === 'active_probe' || entry.source === 'mixed')
}

export function credentialWeightPatch(raw: string, unset: boolean): number | null {
  if (unset) return null
  const text = String(raw).trim()
  if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > 1_000_000) {
    throw new Error('Weight must be an integer no greater than 1,000,000. Use Unset to clear it.')
  }
  return Number(text) <= 0 ? 0 : Number(text)
}

type QuotaWindow = {
  id: string
  unit?: string
  currency?: string | null
}

export function quotaWindowAmount(value: number | null | undefined, window: QuotaWindow): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const amount = Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (window.unit === 'percentage') return `${amount}%`
  return window.currency ? `${amount} ${window.currency}` : amount
}

export function quotaDisplayWindows<T extends QuotaWindow>(quota: { provider?: string; primary_windows?: T[]; windows?: T[] }): T[] {
  const primary = quota.primary_windows || []
  if (!['xai', 'grok'].includes(String(quota.provider).toLowerCase())) return primary.slice(0, 2)
  const windows = [...primary, ...(quota.windows || [])]
  // Weekly-only accounts have no monthly allowance; never synthesize a zero-limit window.
  const ordered = ['xai-weekly-usage', 'xai-monthly-spend', 'xai-on-demand']
    .flatMap(id => { const window = windows.find(entry => entry.id === id); return window ? [window] : [] })
  return ordered.length ? ordered : primary.slice(0, 2)
}

export function quotaCollectionMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code === 'DCA_TOKEN_UNAVAILABLE') return 'Meta quota requires DCA authorization. Reauthorize this Meta account and collect quota again.'
  return error?.message || 'Quota collection failed.'
}

export function isQuotaAttention(quota: { quota_status?: string | null; freshness?: string | null; collection_status?: string | null } | null | undefined): boolean {
  return Boolean(quota && (quota.quota_status !== 'healthy' || quota.freshness !== 'fresh' || quota.collection_status === 'partial' || quota.collection_status === 'failed'))
}
