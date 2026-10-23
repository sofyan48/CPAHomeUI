import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { useCredentialModelsStore } from '../stores/credentialModels'
import { credentialExclusionCandidates } from '../composables/credentialModelCards'

beforeEach(() => setActivePinia(createPinia()))

describe('credential model cache', () => {
  test('shares queries only within the same credential and session', async () => {
    const cache = useCredentialModelsStore()
    cache.setScope('/v8/management', 'session-one')
    let calls = 0
    const fetcher = async () => ({ models: [{ id: `model-${++calls}` }] })
    const [first, second] = await Promise.all([cache.fetchModels('a', fetcher), cache.fetchModels('a', fetcher)])
    expect(first).toBe(second)
    expect(calls).toBe(1)
    await cache.fetchModels('b', fetcher)
    expect(calls).toBe(2)
    cache.setScope('/v8/management', 'session-two')
    await cache.fetchModels('a', fetcher)
    expect(calls).toBe(3)
  })

  test('invalidated requests cannot repopulate the current cache', async () => {
    const cache = useCredentialModelsStore()
    let finish!: (value: string) => void
    const old = cache.fetchModels('a', () => new Promise<string>(resolve => { finish = resolve }))
    await Promise.resolve()
    cache.invalidate()
    expect(await cache.fetchModels('a', async () => 'new')).toBe('new')
    finish('old')
    await old
    expect(await cache.fetchModels('a', async () => 'unexpected')).toBe('new')
  })

  test('refresh replaces cached responses and failed requests can retry', async () => {
    const cache = useCredentialModelsStore()
    await cache.fetchModels('a', async () => 'old')
    expect(await cache.fetchModels('a', async () => 'fresh', true)).toBe('fresh')
    await expect(cache.fetchModels('b', async () => { throw new Error('unavailable') })).rejects.toThrow('unavailable')
    expect(await cache.fetchModels('b', async () => 'recovered')).toBe('recovered')
  })
})

test('exclusion picker retains exact rules without inventing wildcard candidates', () => {
  expect(credentialExclusionCandidates([{ id: 'Current' }], ['current', 'retired', 'retired', 'prefix-*', ''])).toEqual([{ id: 'Current' }, { id: 'retired' }])
  const known = credentialExclusionCandidates(null, ['retired']).map(model => model.id)
  expect(credentialExclusionCandidates([], known)).toEqual([{ id: 'retired' }])
})
