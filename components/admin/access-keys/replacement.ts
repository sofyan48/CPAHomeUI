export type AccessKeySnapshot = { etag: string; values: string[] }

export function readReplacementSnapshot(payload: unknown, etag: string | null): AccessKeySnapshot {
  if (!etag || !/^"[\x21\x23-\x7e\x80-\xff]*"$/.test(etag)) {
    throw new Error('Safe replacement requires a strong ETag. Check Home support and, for a separate UI origin, ETag header exposure. No keys were changed.')
  }
  const data = payload as Record<string, unknown> | null
  const entries = Array.isArray(payload) ? payload : data?.api_key_entries ?? data?.items ?? data?.['api-keys'] ?? data?.api_keys
  if (!Array.isArray(entries)) throw new Error('The key collection could not be read safely. No keys were changed.')
  const values = entries.map((entry: unknown) => {
    const record = entry as Record<string, unknown> | null
    const aliases = typeof entry === 'string' ? [entry] :
      ['api_key', 'api-key', 'key', 'value'].filter(key => record && key in record).map(key => record?.[key])
    const value = aliases[0]
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || /[\r\n]/.test(value) || aliases.some(alias => alias !== value)) {
      throw new Error('The key collection contains an unreadable value. Replacement is blocked to avoid data loss.')
    }
    return value
  })
  if (new Set(values).size !== values.length) throw new Error('The key collection contains duplicate values. Replacement is blocked.')
  if (!Array.isArray(payload)) {
    for (const alias of ['api_key_entries', 'items', 'api-keys', 'api_keys']) {
      if (data && alias in data && data[alias] !== entries) {
        const other = readReplacementSnapshot(data[alias], etag)
        if (other.values.length !== values.length || other.values.some(value => !values.includes(value))) {
          throw new Error('The key collection contains inconsistent lists. Replacement is blocked to avoid data loss.')
        }
      }
    }
  }
  return { etag, values }
}

export function planReplacement(text: string, snapshot: AccessKeySnapshot) {
  const values = text.split(/\r\n|\n|\r/).map(value => value.trim()).filter(Boolean)
  if (new Set(values).size !== values.length) throw new Error('Duplicate key values are not allowed. Remove duplicate lines before continuing.')
  const current = new Set(snapshot.values)
  const next = new Set(values)
  // Home preserves ALL stored metadata for existing/restored values when these
  // fields are omitted. Replaying metadata can revalidate deleted owners/groups
  // and cannot preserve fields absent from an older GET response.
  const body = { api_key_entries: values.map(api_key => ({ api_key })) }
  if (new TextEncoder().encode(JSON.stringify(body)).length > 1024 * 1024) {
    throw new Error('The replacement exceeds Home’s 1 MiB request limit.')
  }
  return {
    body,
    headers: { 'If-Match': snapshot.etag },
    kept: values.filter(value => current.has(value)).length,
    added: values.filter(value => !current.has(value)).length,
    removed: snapshot.values.filter(value => !next.has(value)).length,
    total: values.length,
    changed: values.length !== snapshot.values.length || values.some((value, index) => value !== snapshot.values[index]),
  }
}
