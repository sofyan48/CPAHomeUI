type RegisteredModel = { id: string; display_name?: string }
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
