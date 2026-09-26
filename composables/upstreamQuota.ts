export function isQuotaAttention(quota: { quota_status?: string | null; freshness?: string | null; collection_status?: string | null } | null | undefined): boolean {
  return Boolean(quota && (quota.quota_status !== 'healthy' || quota.freshness !== 'fresh' || quota.collection_status === 'partial' || quota.collection_status === 'failed'))
}
