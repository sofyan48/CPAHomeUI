import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import * as dates from '../composables/dateRange'

const { dateRangeError, dateInputBounds, isDateInputValid, sanitizeDateInput } = dates

describe('admin date ranges', () => {
  test('validates the calendar without rollover and requires four-digit positive years', () => {
    for (const value of ['2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31']) expect(isDateInputValid(value)).toBe(true)
    for (const value of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '0000-01-01', '20266-10-15', '202-10-15', '2026-10-', '2026-10-15Z']) expect(isDateInputValid(value)).toBe(false)
  })

  test('accepts empty/open and same-day ranges, but rejects inversions', () => {
    for (const [from, to] of [['', ''], ['2026-10-15', ''], ['', '2026-10-15'], ['2026-10-15', '2026-10-15']]) expect(dateRangeError(from, to)).toBe('')
    expect(dateRangeError('2026-10-16', '2026-10-15')).not.toBe('')
    expect(dateRangeError('2026-02-30', '')).not.toBe('')
  })

  test('validates minute precision and orders same-day times', () => {
    expect(dateRangeError('2026-10-15T09:00', '2026-10-15T09:00', 'datetime-local')).toBe('')
    expect(dateRangeError('2026-10-15T09:01', '2026-10-15T09:00', 'datetime-local')).not.toBe('')
    for (const value of ['2026-10-15T', '2026-10-15T24:00', '2026-10-15T09:60', '2026-02-30T09:00', '2026-10-15T09:00Z']) expect(isDateInputValid(value, 'datetime-local')).toBe(false)
  })

  test('uses only complete valid peer boundaries, with four-digit global limits', () => {
    expect(dateInputBounds('date', '', '2026-10-15')).toEqual({ min: '0001-01-01', max: '2026-10-15' })
    expect(dateInputBounds('date', '2026-02-30', '202')).toEqual({ min: '0001-01-01', max: '9999-12-31' })
    expect(dateInputBounds('datetime-local', '2026-10-15T09:00')).toEqual({ min: '2026-10-15T09:00', max: '9999-12-31T23:59' })
  })

  test('caps pasted years without losing month/day or partial input', () => {
    expect(sanitizeDateInput('202666-10-15T09:00')).toBe('2026-10-15T09:00')
    for (const draft of ['', '2', '202', '2026-', '2026-02-30', '2026-10-15T']) expect(sanitizeDateInput(draft)).toBe(draft)
  })
})

// Compile and mount the real SFC with a lightweight UInput stub; no Nuxt server or DOM required.
function mountInput(initial: Record<string, string | boolean>) {
  const source = readFileSync(new URL('../components/AppDateInput.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: 'date-input-test', inlineTemplate: true })
  const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(script.content)
    .replace(/import \{([^}]+)\} from ["']vue["'];?/g, (_, names) => `const { ${names.replace(/ as /g, ': ')} } = Vue;`)
    .replace(/import .* from ["']~\/composables\/dateRange["'];?/, 'const { dateInputBounds, dateRangeError, sanitizeDateInput } = dates;')
    .replace('export default', 'return')
  const component = new Function('Vue', 'dates', `const { computed, useId, useAttrs } = Vue; ${js}`)(Vue, dates)
  const inputs = new Map<string, any>()
  const state = Vue.reactive({ modelValue: '', ...initial })
  const renderer = Vue.createRenderer<any, any>({
    createElement: (tag: string) => ({ tag, children: [] }),
    createText: (text: string) => ({ text }), createComment: () => ({}),
    setText: () => {}, setElementText: () => {}, parentNode: (node: any) => node.parent, nextSibling: () => null,
    insert: (child: any, parent: any) => { child.parent = parent; parent.children.push(child) }, remove: () => {}, patchProp: () => {}
  })
  const app = renderer.createApp({ render: () => Vue.h(component, { ...state, 'onUpdate:modelValue': (value: string) => { state.modelValue = value } }) })
  app.component('UInput', { inheritAttrs: false, setup: (_, { attrs }) => () => { inputs.set(String(attrs.type), attrs); return Vue.h('input') } })
  app.mount({ children: [] })
  return { state, current: () => inputs.get('text'), picker: () => inputs.get(String(state.type || 'date')), app }
}

describe('admin filter integration', () => {
  test('every apply path validates before replacing applied filters', () => {
    const cases = [
      ['pages/admin/usage.vue', 'const applyFilters = async () => {', 'appliedFilters.value ='],
      ['pages/admin/logs.vue', 'const applyFilters = async () => {', 'appliedApplicationFilters.value ='],
      ['pages/admin/billing.vue', 'async function applyOverviewFilters() {', 'appliedOverviewFilters.value ='],
      ['pages/admin/billing.vue', 'async function applyChargeFilters() {', 'appliedChargeFilters.value ='],
      ['pages/admin/billing.vue', 'async function applyBalanceFilters() {', 'appliedBalanceFilters.value ='],
      ['components/admin/RequestRecords.vue', 'async function applyFilters() {', 'appliedFilters.value ='],
      ['components/admin/UsageLegacyRecords.vue', 'function apply() {', 'applied.value =']
    ]
    for (const [file, start, assignment] of cases) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      const guard = source.split(start!)[1]!.split(assignment!)[0]!
      expect(guard).toContain('dateRangeError(')
      expect(guard).toContain('return')
      const template = source.split('</template>')[0]!
      expect(template).not.toMatch(/<UInput[^>]*type="(?:date|datetime-local)"/)
    }
  })
})

describe('AppDateInput editing', () => {
  test('shares valid date and date-time selections with the editable text draft', async () => {
    for (const type of ['date', 'datetime-local']) {
      const suffix = type === 'date' ? '' : 'T09:00'
      const initial = `2026-10-14${suffix}`, selected = `2026-10-15${suffix}`
      const { state, current, picker, app } = mountInput({ type, modelValue: initial, 'aria-describedby': 'date-hint' })
      expect(picker().type).toBe(type)
      expect(picker().id).toBeTruthy()
      expect(picker()['model-value']).toBe(initial)
      expect(picker()['aria-describedby']).toBe('date-hint')
      picker().onChange({ target: { value: selected, validity: { valid: true } } })
      await Vue.nextTick()
      expect(state.modelValue).toBe(selected)
      expect(current()['model-value']).toBe(selected)
      current().onInput({ target: { value: initial } })
      await Vue.nextTick()
      expect(picker()['model-value']).toBe(initial)
      current().onInput({ target: { value: '202' } })
      await Vue.nextTick()
      expect(picker()['model-value']).toBe('')
      expect(current()['aria-describedby']).toContain('date-hint')
      expect(picker()['aria-describedby']).toBe(current()['aria-describedby'])
      app.unmount()
    }
  })

  test('rejects empty, invalid, and out-of-bounds native selections without erasing the draft', async () => {
    const original = '2026-10-15T09:30'
    const { state, picker, app } = mountInput({ type: 'datetime-local', modelValue: original, min: '2026-10-15T09:00', max: '2026-10-15T10:00' })
    for (const [value, valid] of [
      ['', true], ['2026-02-30T09:30', true], ['2026-10-15T08:59', true],
      ['2026-10-15T10:01', true], ['2026-10-15T09:45', false]
    ] as const) {
      const target = { value, validity: { valid } }
      picker().onChange({ target })
      await Vue.nextTick()
      expect(state.modelValue).toBe(original)
      expect(target.value).toBe(original)
    }
    for (const value of ['2026-10-15T09:00', '2026-10-15T10:00']) {
      picker().onChange({ target: { value, validity: { valid: true } } })
      await Vue.nextTick()
      expect(state.modelValue).toBe(value)
    }
    app.unmount()
  })

  test('propagates disabled and readonly state to both controls and ignores edits', async () => {
    for (const flag of ['disabled', 'readonly']) {
      const original = '2026-10-15'
      const { state, current, picker, app } = mountInput({ modelValue: original, [flag]: true })
      expect(current()[flag]).toBe(true)
      expect(picker()[flag]).toBe(true)
      current().onInput({ target: { value: '2026-10-16' } })
      const target = { value: '2026-10-16', validity: { valid: true } }
      picker().onChange({ target })
      await Vue.nextTick()
      expect(state.modelValue).toBe(original)
      expect(target.value).toBe(original)
      state[flag] = false
      await Vue.nextTick()
      expect(current()[flag]).toBe(false)
      expect(picker()[flag]).toBe(false)
      picker().onChange({ target })
      await Vue.nextTick()
      expect(state.modelValue).toBe(original)
      picker().onChange({ target: { value: '2026-10-16', validity: { valid: true } } })
      await Vue.nextTick()
      expect(state.modelValue).toBe('2026-10-16')
      app.unmount()
    }
  })
  test('keeps invalid and inverted drafts editable and recovers without changing peers', async () => {
    const { state, current, app } = mountInput({ max: '2026-10-15' })
    for (const [draft, invalid] of [['202', true], ['2026-02-30', true], ['2026-10-16', true], ['2026-10-14', false], ['', false]] as const) {
      current().onInput({ target: { value: draft } })
      await Vue.nextTick()
      expect(state.modelValue).toBe(draft)
      expect(current()['aria-invalid']).toBe(invalid)
      expect(state.max).toBe('2026-10-15')
    }
    app.unmount()
  })

  test('sanitizes the actual input and applies same-day time bounds', async () => {
    const { state, current, picker, app } = mountInput({ type: 'datetime-local', min: '2026-10-15T09:00' })
    const target = { value: '202666-10-15T08:00' }
    current().onInput({ target })
    await Vue.nextTick()
    expect(target.value).toBe('2026-10-15T08:00')
    expect(state.modelValue).toBe(target.value)
    expect(current().min).toBeUndefined()
    expect(current().max).toBeUndefined()
    expect(picker().min).toBe('2026-10-15T09:00')
    expect(picker().max).toBe('9999-12-31T23:59')
    expect(picker().step).toBe(60)
    expect(current()['aria-invalid']).toBe(true)
    current().onInput({ target: { value: '2026-10-15T09:00' } })
    await Vue.nextTick()
    expect(current()['aria-invalid']).toBe(false)
    app.unmount()
  })
})
