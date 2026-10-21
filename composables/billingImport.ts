export interface BillingImportApplyRequest {
  preview_id: string
  preview_revision: string
  selected_keys: string[]
  confirm_overwrite: boolean
  idempotency_key: string
}

export interface BillingImportPendingApply {
  version: 1
  createdAt: string
  input: BillingImportApplyRequest
}

const storagePrefix = 'cpa-home:billing-import:pending:'
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

// Only a digest is stored: neither the management key nor the backend URL is persisted.
export async function billingImportStorageKey(backend: string, token: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') {
    throw new Error('Safe import recovery requires Web Crypto. Open this UI over HTTPS or localhost in a supported browser. Previews and update checks remain available; applying prices is disabled.')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([backend, token])))
  return storagePrefix + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function billingImportApplySupportError(): string {
  return typeof globalThis.crypto?.randomUUID === 'function' ? '' :
    'Applying prices requires crypto.randomUUID. Open this UI over HTTPS or localhost in a supported browser. Previews, update checks, and retries of saved requests remain available.'
}

export function createBillingImportIdempotencyKey(): string {
  const unsupported = billingImportApplySupportError()
  if (unsupported) throw new Error(unsupported)
  return globalThis.crypto.randomUUID()
}

function parsePending(value: unknown): BillingImportPendingApply {
  const pending = value as BillingImportPendingApply | null
  const input = pending?.input
  if (pending?.version !== 1 || !nonempty(pending.createdAt) || !Number.isFinite(Date.parse(pending.createdAt)) ||
    !input || !nonempty(input.preview_id) || !nonempty(input.preview_revision) ||
    !nonempty(input.idempotency_key) || typeof input.confirm_overwrite !== 'boolean' ||
    !Array.isArray(input.selected_keys) || !input.selected_keys.length ||
    !input.selected_keys.every(nonempty) || new Set(input.selected_keys).size !== input.selected_keys.length) {
    throw new Error('Stored import recovery data is invalid. No request was sent.')
  }
  // Whitelist fields so unrelated data (including credentials) can never be written back.
  return {
    version: 1,
    createdAt: pending.createdAt,
    input: {
      preview_id: input.preview_id,
      preview_revision: input.preview_revision,
      selected_keys: [...input.selected_keys],
      confirm_overwrite: input.confirm_overwrite,
      idempotency_key: input.idempotency_key
    }
  }
}

export function readBillingImportPending(storage: Storage, key: string): BillingImportPendingApply | null {
  const raw = storage.getItem(key)
  return raw === null ? null : parsePending(JSON.parse(raw))
}

export function writeBillingImportPending(storage: Storage, key: string, pending: BillingImportPendingApply | null) {
  if (pending) storage.setItem(key, JSON.stringify(parsePending(pending)))
  else storage.removeItem(key)
}

export function isDefinitiveBillingImportFailure(error: { statusCode?: number }) {
  return [404, 405, 409, 410, 412, 422, 501].includes(error?.statusCode || 0)
}

// A malformed success response is still uncertain; never discard its recovery request.
export function validateBillingImportResult(result: any, input: BillingImportApplyRequest): void {
  if (!nonempty(result?.operation_id) || result.preview_id !== input.preview_id || result.atomic !== true ||
    !['applied', 'failed', 'conflict', 'expired'].includes(result.status) || !Array.isArray(result.rows)) {
    throw new Error('Invalid import operation response. Retry the saved request to recover its result.')
  }
  const keys = new Set<string>()
  for (const row of result.rows) {
    const success = ({ create: 'created', update_sync: 'updated', overwrite: 'overwritten' } as Record<string, string>)[row.action]
    if (!input.selected_keys.includes(row.key) || keys.has(row.key) || !success ||
      !nonempty(row.provider) || !nonempty(row.model) ||
      ![success, 'failed', 'conflict'].includes(row.status) ||
      (row.status === success ? !nonempty(row.resource_id) || row.error_code || row.error_message :
        row.resource_id || !nonempty(row.error_code) || !nonempty(row.error_message))) {
      throw new Error('Invalid import row response. The saved request has been retained.')
    }
    keys.add(row.key)
  }
  const unsuccessful = result.rows.filter((row: any) => ['failed', 'conflict'].includes(row.status))
  if ((result.status === 'expired' ? keys.size !== 0 : keys.size !== input.selected_keys.length) ||
    (result.status === 'applied' && (!nonempty(result.applied_at) || !Number.isFinite(Date.parse(result.applied_at)) || unsuccessful.length > 0)) ||
    (['failed', 'conflict'].includes(result.status) && (result.applied_at || unsuccessful.length !== keys.size)) ||
    (result.status === 'failed' && !result.rows.some((row: any) => row.status === 'failed')) ||
    (result.status === 'conflict' && result.rows.some((row: any) => row.status !== 'conflict'))) {
    throw new Error('Incomplete import result. The saved request has been retained.')
  }
}
