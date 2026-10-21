type RegisteredModel = { id: string; display_name?: string }

export function normalizeCredentialModels(value: unknown): RegisteredModel[] {
  if (!Array.isArray(value)) return []
  const models = new Map<string, RegisteredModel>()
  for (const entry of value) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) continue
    const id = entry.id.trim()
    if (!models.has(id)) models.set(id, { id, display_name: typeof entry.display_name === 'string' ? entry.display_name : undefined })
  }
  return [...models.values()]
}

export function parseCredentialExclusions(value: string): string[] | null {
  try {
    const rules: unknown = value.trim() ? JSON.parse(value) : []
    return Array.isArray(rules) && rules.every(rule => typeof rule === 'string') ? rules : null
  } catch { return null }
}

export function credentialExclusionMatches(rule: string, id: string): boolean {
  const pattern = rule.trim().split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return Boolean(pattern) && new RegExp(`^${pattern}$`, 'i').test(id)
}
type RuntimeModel = {
  model: string
  display_name?: string
  upstream_model: string
  state_key: string
  registered: boolean
}

export function credentialModelCards<T extends RuntimeModel>(models: RegisteredModel[], states: T[]) {
  const cards = new Map<string, { id: string; display_name?: string; diagnostics: T[] }>()
  for (const model of models) {
    const id = model.id.trim()
    if (id && !cards.has(id)) cards.set(id, { ...model, id, diagnostics: [] })
  }
  for (const state of states) {
    const id = state.model.trim()
    if (!id) continue
    // Exposed route identity preserves aliases that share upstream/history keys.
    let card = cards.get(id)
    if (!card) {
      card = { id, display_name: state.display_name, diagnostics: [] }
      cards.set(id, card)
    }
    if (!card.diagnostics.some(entry => entry.upstream_model === state.upstream_model && entry.state_key === state.state_key)) {
      card.diagnostics.push(state)
    }
  }
  return [...cards.values()]
}
