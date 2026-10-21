import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readReplacementSnapshot, planReplacement } from './replacement.ts'

const etag = '"collection-1"'

test('retained values omit every metadata field so Home preserves stored metadata', () => {
  const entry = {
    id: 7, api_key_id: 7, api_key: 'kept', 'api-key': 'kept',
    display_name: 'Production', user_id: 42, 'user-id': 42,
    channels: [1, 9], model_groups: [2, 8], limits: { daily: 100 },
  }
  const snapshot = readReplacementSnapshot({ api_key_entries: [entry], items: [entry], 'api-keys': ['kept'] }, etag)
  const plan = planReplacement(' kept \r\n\nnew\n', snapshot)
  assert.deepEqual(plan.body, { api_key_entries: [{ api_key: 'kept' }, { api_key: 'new' }] })
  assert.deepEqual(plan.headers, { 'If-Match': etag })
  assert.equal(plan.kept, 1)
  assert.equal(plan.added, 1)
  assert.equal(plan.removed, 0)
  assert.equal(entry.user_id, 42)
})

test('legacy string snapshots never synthesize metadata defaults', () => {
  const snapshot = readReplacementSnapshot({ 'api-keys': ['old', 'kept'] }, etag)
  const plan = planReplacement('kept\nreplacement', snapshot)
  assert.equal(plan.removed, 1)
  assert.deepEqual(plan.body.api_key_entries, [{ api_key: 'kept' }, { api_key: 'replacement' }])
})

test('explicit empty input produces an empty list and counts every removal', () => {
  const snapshot = readReplacementSnapshot(['a', 'b'], etag)
  const plan = planReplacement(' \n\r\n', snapshot)
  assert.deepEqual(plan.body, { api_key_entries: [] })
  assert.equal(plan.total, 0)
  assert.equal(plan.removed, 2)
  assert.equal(plan.changed, true)
  assert.equal(planReplacement('', readReplacementSnapshot({ items: [] }, etag)).changed, false)
})

test('duplicates are rejected rather than silently collapsed', () => {
  assert.throws(() => planReplacement('key\n key ', { etag, values: [] }), /Duplicate/)
  assert.throws(() => readReplacementSnapshot(['key', 'key'], etag), /duplicate/)
})

test('missing, weak, wildcard and malformed ETags block replacement', () => {
  for (const invalid of [null, '', 'W/"weak"', '*', 'unquoted', '"a", "b"']) {
    assert.throws(() => readReplacementSnapshot([], invalid), /strong ETag/)
  }
})

test('unreadable or inconsistent snapshots cannot silently become empty/partial lists', () => {
  for (const payload of [null, {}, { items: null }, { items: [null] }, { items: [{}] },
    { items: [''] }, { items: [' padded '] }, { items: ['line\nbreak'] },
    { items: [{ api_key: 'a', 'api-key': 'b' }] },
    { items: [], 'api-keys': ['hidden'] }, { items: ['a'], api_key_entries: ['b'] }]) {
    assert.throws(() => readReplacementSnapshot(payload, etag))
  }
})

test('unchanged lists require no write and oversized payloads are rejected', () => {
  const snapshot = readReplacementSnapshot(['a'], etag)
  assert.equal(planReplacement('a\n', snapshot).changed, false)
  assert.throws(() => planReplacement('x'.repeat(1024 * 1024), snapshot), /1 MiB/)
})
