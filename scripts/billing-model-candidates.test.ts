import { describe, expect, test } from 'bun:test'
import { billingModelCandidates } from '../composables/billingModelCandidates'

describe('billing model execution identities', () => {
  test('prices every upstream target, deduplicates scopes, and keeps aliases searchable', () => {
    const candidates = billingModelCandidates([
      {
        id: 'team/MY-MODEL', name: 'merged-name-is-not-authoritative', display_name: 'Team model',
        providers: ['wrong-provider'], description: 'Alias description',
        billing_models: [
          { provider: ' Z-AI ', model: ' glm-5.3-flash ' },
          { provider: 'z-ai', model: 'glm-next' },
          { provider: 'another-provider', model: 'other-upstream' },
          { provider: 'z-ai', model: 'glm-5.3-flash' }
        ]
      },
      { id: 'another-alias', billing_models: [{ provider: 'z-ai', model: 'glm-5.3-flash' }] }
    ], { arbitraryGroup: [{ id: 'glm-5.3-flash', providers: ['z-ai'], description: 'Static description' }] })
    expect(candidates.map(({ provider, model }) => [provider, model])).toEqual([
      ['another-provider', 'other-upstream'], ['z-ai', 'glm-5.3-flash'], ['z-ai', 'glm-next']
    ])
    expect(candidates.every(candidate => candidate.available && candidate.description.includes('team/MY-MODEL'))).toBe(true)
    const shared = candidates.find(candidate => candidate.model === 'glm-5.3-flash')!
    for (const text of ['another-alias', 'Static description', 'Alias description', 'Team model', 'merged-name-is-not-authoritative']) {
      expect(shared.description).toContain(text)
    }
  })

  test('present empty or malformed billing targets never fall back to aliases', () => {
    const records = [[], null, undefined, {}, [null, {}, { provider: '', model: 'glm' }, { provider: 'z-ai', model: 1 }]]
      .map((billing_models, index) => ({ id: `alias-${index}`, providers: ['z-ai'], billing_models }))
    expect(billingModelCandidates(records, [])).toEqual([])
  })

  test('only absent metadata falls back to authoritative providers and public IDs', () => {
    const candidates = billingModelCandidates([
      { id: 'legacy', providers: [' CODEX ', 'codex', null, 1, ''] },
      { id: 'unsafe', owned_by: 'openai', type: 'codex' },
      { name: 'not-an-id', providers: ['codex'] }
    ], { 'not-a-provider': [{ id: 'static', providers: ['Z-AI'] }, { id: 'unsafe-static' }] })
    expect(candidates.map(({ provider, model, available }) => [provider, model, available])).toEqual([
      ['codex', 'legacy', true], ['z-ai', 'static', false]
    ])
  })

  test('retains existing rules for editing without treating them as available targets', () => {
    const candidates = billingModelCandidates([
      { id: 'public-alias', providers: ['z-ai'], billing_models: [] },
      { id: 'other-alias', billing_models: [{ provider: 'z-ai', model: 'upstream' }] }
    ], [], [
      { provider: 'z-ai', model: 'public-alias' },
      { provider: 'z-ai', model: 'upstream' }
    ])
    expect(candidates.map(({ model, available }) => [model, available])).toEqual([
      ['upstream', true], ['public-alias', false]
    ])
    expect(candidates[1].description).toBe('Existing model price rule')
  })
})
