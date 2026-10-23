type ModelRecord = Record<string, any>

export interface BillingModelCandidate {
  key: string
  provider: string
  model: string
  displayName: string
  description: string
  ownedBy: string
  type: string
  available: boolean
  raw: ModelRecord | null
}

const nonemptyString = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const isRecord = (value: unknown): value is ModelRecord => !!value && typeof value === 'object' && !Array.isArray(value)

function flattenModels(source: unknown): ModelRecord[] {
  const entries = Array.isArray(source) ? source : isRecord(source) ? Object.values(source).flatMap(group => Array.isArray(group) ? group : []) : []
  return entries.filter(isRecord)
}

function billingTargets(record: ModelRecord): { provider: string; model: string }[] {
  // Presence is authoritative: unresolved targets must never fall back to a public alias.
  const targets = Object.hasOwn(record, 'billing_models')
    ? record.billing_models
    : Array.isArray(record.providers) ? record.providers.map(provider => ({ provider, model: record.id })) : []
  if (!Array.isArray(targets)) return []
  return targets.filter(isRecord).flatMap(target => {
    const provider = nonemptyString(target.provider).toLowerCase()
    const model = nonemptyString(target.model)
    return provider && model ? [{ provider, model }] : []
  })
}

export function billingModelCandidates(available: unknown, staticModels: unknown, priceRules: ModelRecord[] = []): BillingModelCandidate[] {
  const map = new Map<string, BillingModelCandidate>()
  const add = (record: ModelRecord, available: boolean) => {
    if (!nonemptyString(record.id)) return
    for (const { provider, model } of billingTargets(record)) {
      const key = `${provider}::${model}`
      const previous = map.get(key)
      const description = [record.id, record.name, record.display_name, record.description].filter(value => nonemptyString(value)).join(' ')
      map.set(key, {
        key, provider, model,
        displayName: record.display_name || record.name || record.id,
        description: [...new Set([previous?.description, description])].filter(Boolean).join(' '),
        ownedBy: record.owned_by || previous?.ownedBy || '',
        type: record.type || previous?.type || '',
        available: Boolean(available || previous?.available),
        raw: record
      })
    }
  }
  flattenModels(staticModels).forEach(record => add(record, false))
  flattenModels(available).forEach(record => add(record, true))
  priceRules.forEach(rule => {
    if (!rule?.provider || !rule?.model) return
    const key = `${String(rule.provider).toLowerCase()}::${rule.model}`
    if (!map.has(key)) map.set(key, { key, provider: rule.provider, model: rule.model, displayName: rule.model, description: 'Existing model price rule', ownedBy: '', type: '', available: false, raw: null })
  })
  return [...map.values()].sort((a, b) => Number(b.available) - Number(a.available) || a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))
}
