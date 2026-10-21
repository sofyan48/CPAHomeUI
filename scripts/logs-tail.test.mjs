import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import { ref, computed, watch } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { mergeLogRows, useApplicationLogTail } from '../composables/useApplicationLogTail.js'

const row = (id, timestamp = id) => ({ id, timestamp: new Date(timestamp * 1000).toISOString(), line: `line ${id}` })
const snapshot = (logs, total = logs.length, anchor_id = 999) => ({ logs, total, anchor_id, search: 'needle' })
function fixture() {
  const calls = []
  const errors = []
  let respond = async () => snapshot([])
  const tail = useApplicationLogTail({
    fetchAPI: async (url, options) => { calls.push({ query: new URL(url, 'http://home').searchParams, ...options }); return respond() },
    params: () => new URLSearchParams({ search: 'needle', level: 'warn' }),
    limit: () => 2,
    onError: error => errors.push(error),
  })
  return { tail, calls, errors, respond: fn => { respond = fn } }
}

test('deduplicates by record ID, not request ID; chronological timestamp/ID order', () => {
  assert.deepEqual(mergeLogRows([row(1, 3), row(2, 2)], [row(2, 2), row(3, 2), row(4, 1)]).map(item => item.id), [1, 3, 2, 4])
})

test('polls recent unanchored window; buffers repeated arrivals until explicitly accepted', async () => {
  const f = fixture()
  f.tail.seed(snapshot([row(2), row(1)], 10))
  f.respond(async () => snapshot([row(3), row(2)], 11))
  await f.tail.poll()
  await f.tail.poll()
  assert.deepEqual(f.tail.rows.value.map(item => item.id), [2, 1])
  assert.deepEqual(f.tail.pending.value.map(item => item.id), [3])
  assert.equal(f.calls[0].query.get('anchor_id'), null)
  assert.equal(f.calls[0].query.get('after_id'), null)
  assert.equal(f.calls[0].query.get('search'), 'needle')
  f.tail.accept()
  assert.deepEqual(f.tail.rows.value.map(item => item.id), [3, 2, 1])
  assert.equal(f.tail.following.value, false)
  f.tail.setFollowing(true)
  f.respond(async () => snapshot([row(4), row(3)], 12))
  await f.tail.poll()
  assert.deepEqual(f.tail.rows.value.map(item => item.id), [4, 3, 2, 1])
  assert.equal(f.tail.pending.value.length, 0)
})

test('loads older using chronological oldest ID and server ceiling, preserving filters', async () => {
  const f = fixture()
  f.tail.seed(snapshot([row(1, 10), row(50, 9)], 4, 999))
  f.tail.setFollowing(true)
  f.respond(async () => snapshot([row(49, 8), row(48, 7)], 2))
  await f.tail.loadOlder()
  assert.equal(f.calls[0].query.get('before_id'), '50')
  assert.equal(f.calls[0].query.get('anchor_id'), '999')
  assert.equal(f.calls[0].query.get('offset'), '0')
  assert.equal(f.calls[0].query.get('level'), 'warn')
  assert.equal(f.tail.following.value, false)
  assert.deepEqual(f.tail.rows.value.map(item => item.id), [1, 50, 49, 48])
  assert.equal(f.tail.canLoadOlder.value, false)
})

test('cancellation rejects stale success and error, including fetches that ignore abort', async () => {
  const f = fixture()
  f.tail.seed(snapshot([row(1)], 3))
  let resolve
  f.respond(() => new Promise(done => { resolve = done }))
  const read = f.tail.poll()
  f.tail.reset()
  resolve(snapshot([row(5)]))
  await read
  assert.equal(f.calls[0].signal.aborted, true)
  assert.equal(f.tail.rows.value.length, 0)
  assert.equal(f.tail.pending.value.length, 0)
  let reject
  f.respond(() => new Promise((_, fail) => { reject = fail }))
  const failed = f.tail.poll()
  f.tail.cancel()
  reject(new Error('obsolete'))
  await failed
  assert.equal(f.errors.length, 0)
})

test('search support and expired cursors report errors without replacing visible content', async () => {
  const f = fixture()
  f.tail.seed(snapshot([row(2)], 3))
  f.respond(async () => ({ logs: [row(3)] }))
  await f.tail.poll()
  assert.match(f.errors[0].message, /search support/)
  const expired = { statusCode: 409, data: { error: 'log_cursor_expired' } }
  f.respond(async () => { throw expired })
  await f.tail.loadOlder()
  assert.equal(f.errors[1], expired)
  assert.deepEqual(f.tail.rows.value.map(item => item.id), [2])
})

test('bounded pending buffer signals truncation and keeps reader rows unchanged', async () => {
  const f = fixture()
  f.tail.seed(snapshot([row(1)], 1))
  f.respond(async () => snapshot(Array.from({ length: 2100 }, (_, index) => row(index + 2)), 2100))
  await f.tail.poll()
  assert.equal(f.tail.pending.value.length, 2000)
  assert.equal(f.tail.rows.value.length, 1)
  assert.equal(f.tail.truncated.value, true)
})

const pageFile = new URL('../pages/admin/logs.vue', import.meta.url)
function pageFixture() {
  const { descriptor } = parse(fs.readFileSync(pageFile, 'utf8'))
  let respond = async () => snapshot([row(2), row(1)], 10)
  const calls = []
  const context = vm.createContext({
    ref, computed, watch, URLSearchParams, AbortController, Intl, Date,
    useApplicationLogTail,
    useApi: () => ({ token: ref('test'), fetchAPI: async (url, options) => {
      calls.push({ query: new URL(url, 'http://home').searchParams, ...options })
      return respond()
    } }),
    useWorkspaceState: (_, initial) => ref(initial()),
    useDataSync: () => {}, onMounted: () => {}, onBeforeUnmount: () => {},
    setInterval, clearInterval,
  })
  const script = descriptor.scriptSetup.content.replace(/^import .*$/gm, '')
  vm.runInContext(`${script}\nglobalThis.page = { activeView, applicationMode, applicationResponse, applicationAnchorId, applicationPage, applicationFilters, appliedApplicationFilters, applicationCursorExpired, applicationSearchUnsupported, tail, loadApplicationLogs, changeApplicationPage, changeApplicationMode, restartApplicationLogs, pollApplicationTail, loadOlderApplicationTail, resetApplicationPagination };`, context)
  return { page: context.page, calls, respond: fn => { respond = fn } }
}

test('an initially empty tail uses the later server ceiling when records arrive', async () => {
  const f = fixture()
  f.tail.seed(snapshot([], 0, 10))
  f.tail.setFollowing(true)
  f.respond(async () => snapshot([row(12), row(11)], 4, 20))
  await f.tail.poll()
  assert.equal(f.tail.canLoadOlder.value, true)
  f.respond(async () => snapshot([row(10)], 1, 20))
  await f.tail.loadOlder()
  assert.equal(f.calls.at(-1).query.get('anchor_id'), '20')
})

test('page preserves server-returned anchor/search across historical offset navigation', async () => {
  const f = pageFixture()
  f.page.appliedApplicationFilters.value.search = 'needle'
  await f.page.loadApplicationLogs()
  assert.equal(f.page.applicationAnchorId.value, 999)
  f.respond(async () => snapshot([row(1)], 100))
  await f.page.loadApplicationLogs(2)
  assert.equal(f.calls[1].query.get('anchor_id'), '999')
  assert.equal(f.calls[1].query.get('offset'), '50')
  assert.equal(f.calls[1].query.get('search'), 'needle')
  assert.equal(f.page.applicationPage.value, 2)
})

test('page tail buffers, stops expired cursor retries, and restarts with a fresh ceiling', async () => {
  const f = pageFixture()
  f.page.activeView.value = 'application'
  await f.page.changeApplicationMode('tail')
  f.respond(async () => snapshot([row(3), row(2)], 11))
  await f.page.pollApplicationTail()
  assert.equal(f.page.tail.pending.value.length, 1)
  f.respond(async () => { throw { statusCode: 409, data: { error: 'log_cursor_expired' } } })
  await f.page.loadOlderApplicationTail()
  assert.equal(f.page.applicationCursorExpired.value, true)
  const count = f.calls.length
  await f.page.pollApplicationTail()
  await f.page.loadOlderApplicationTail()
  assert.equal(f.calls.length, count)
  f.respond(async () => snapshot([row(4)], 1, 1234))
  await f.page.restartApplicationLogs()
  assert.equal(f.calls.at(-1).query.get('anchor_id'), null)
  assert.equal(f.page.applicationAnchorId.value, 1234)
  assert.equal(f.page.applicationCursorExpired.value, false)
  assert.equal(f.page.tail.pending.value.length, 0)
})

test('page generation guard rejects stale responses after reset', async () => {
  const f = pageFixture()
  let resolve
  f.respond(() => new Promise(done => { resolve = done }))
  const read = f.page.loadApplicationLogs()
  f.page.resetApplicationPagination()
  resolve(snapshot([row(7)]))
  await read
  assert.equal(f.page.applicationResponse.value, null)
  assert.equal(f.calls[0].signal.aborted, true)
})

for (const file of ['pages/admin/logs.vue', 'components/admin/ApplicationLogTail.vue']) {
  test(`${file}: SFC script and template compile`, () => {
    const { descriptor, errors } = parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: file })
    const result = compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(result.errors, [])
  })
}
