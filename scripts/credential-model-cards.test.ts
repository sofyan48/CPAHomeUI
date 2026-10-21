import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { credentialModelCards } from '../composables/credentialModelCards'

const state = (model: string, upstream = model, registered = true) => ({
  model, upstream_model: upstream, state_key: upstream, registered,
  status: 'error', blocked: false, block_reason: 'none',
  last_error: { http_status: 499, message: 'context canceled' }
})

describe('credential model cards', () => {
  test('registry and runtime produce one card with diagnostic history, not a second list', () => {
    const diagnostic = state('grok-4.7')
    const cards = credentialModelCards([{ id: 'grok-4.7', display_name: 'Grok' }], [diagnostic])
    expect(cards).toEqual([{ id: 'grok-4.7', display_name: 'Grok', diagnostics: [diagnostic] }])
    expect(cards[0].diagnostics[0].blocked).toBe(false)
  })

  test('prefixed aliases sharing upstream/state keys and display names remain distinct', () => {
    const models = ['team/fast', 'team/quick', 'grok-4.7-build-fast'].map(id => ({ id, display_name: 'Grok' }))
    const states = models.map(model => state(model.id, 'grok-4.7-build-fast'))
    const cards = credentialModelCards(models, states)
    expect(cards.map(card => card.id)).toEqual(models.map(model => model.id))
    expect(cards.map(card => card.diagnostics.length)).toEqual([1, 1, 1])
  })

  test('only exact exposed IDs join; case, prefix, and thinking variants are not guessed', () => {
    const ids = ['fast', 'team/fast', 'Fast', 'fast(high)']
    expect(credentialModelCards(ids.map(id => ({ id })), ids.map(id => state(id))).length).toBe(4)
  })

  test('registry-only fallback and runtime-only historical models are retained', () => {
    expect(credentialModelCards([{ id: 'registered' }], [])).toEqual([{ id: 'registered', diagnostics: [] }])
    const history = state('old-model', 'old-model', false)
    const cards = credentialModelCards([{ id: 'registered' }], [history])
    expect(cards.map(card => card.id)).toEqual(['registered', 'old-model'])
    expect(cards[1].diagnostics).toEqual([history])
    expect(credentialModelCards([], [history]).length).toBe(1)
    expect(credentialModelCards([], [])).toEqual([])
  })

  test('repeated identities deduplicate without discarding different diagnostic mappings', () => {
    const first = state('fast', 'upstream-one')
    const second = state('fast', 'upstream-two')
    const cards = credentialModelCards([{ id: 'fast' }, { id: 'fast' }], [first, first, second])
    expect(cards.length).toBe(1)
    expect(cards[0].diagnostics).toEqual([first, second])
  })

  test('Models tab renders one card loop keyed by exposed ID and one heading', () => {
    const source = readFileSync(new URL('../components/admin/UpstreamAccounts.vue', import.meta.url), 'utf8')
    const section = source.split(`detailsTab === 'Models'`)[1].split(`detailsTab === 'Recovery'`)[0]
    expect(section.match(/<h3 /g)?.length).toBe(1)
    expect(section).toContain('v-for="model in scopedModelCards" :key="model.id"')
        expect(section.match(/v-for="model in /g)?.length).toBe(1)
        expect(section).toContain('v-model="modelScope"')
    expect(section).not.toContain('v-for="model in credentialModels"')
    expect(section).not.toContain('v-for="model in modelStates.credential.models')
    expect(source).toContain('credentialModelCards(credentialModels.value, modelStates.value?.credential?.models || [])')
  })
})
