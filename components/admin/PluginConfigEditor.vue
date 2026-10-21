<template>
    <AppModal
        :open="open"
        :title="`Configure ${plugin?.metadata?.name || plugin?.name || plugin?.id || 'plugin'}`"
        :description="plugin?.id"
        :dismissible="!saving"
        @update:open="close"
    >
        <template #body>
            <p v-if="loading" role="status" class="text-sm text-[var(--ui-text-muted)]">Loading plugin configuration…</p>
            <div v-else-if="!ready" class="space-y-3">
                <UAlert v-if="error" color="error" variant="subtle" title="Cannot load plugin configuration" :description="error" />
                <AppButton color="neutral" variant="outline" @click="load">Retry</AppButton>
            </div>
            <form v-else class="space-y-5" @submit.prevent="save">
                <fieldset :disabled="saving" class="space-y-5">
                    <UCheckbox v-model="enabled" label="Enable this plugin" description="This is the per-plugin switch. Global plugins must also be enabled before it can become effective." />
                    <UFormField label="Priority" description="Startup and routing order. Leave blank or use 0 for the default.">
                        <UInput v-model="priority" inputmode="numeric" placeholder="0" class="w-full" />
                    </UFormField>
                    <UCheckbox v-model="loadInHome" label="Load in Home" description="Only enable for trusted provider/auth plugins that must run inside Home. Store plugins otherwise run on CPA nodes." />
                    <section class="space-y-3 rounded-lg border border-[var(--ui-border)] p-3">
                        <h3 class="text-sm font-semibold">Declared parameters</h3>
                        <p v-if="!fields.length" class="text-xs text-[var(--ui-text-muted)]">No parameter declarations are available. Plugins not loaded in Home may not expose metadata; use custom parameters below.</p>
                        <UFormField v-for="field in fields" :key="field.name" :label="`${field.name} (${field.type})`" :description="field.description">
                            <div class="space-y-2">
                                <UCheckbox :model-value="declared[field.name]?.active" label="Set value" @update:model-value="setActive(field.name, $event)" />
                                <template v-if="declared[field.name]?.active">
                                    <USelect v-if="field.type === 'boolean'" v-model="declared[field.name].value" :items="['true', 'false']" :aria-label="field.name" class="w-full" />
                                    <USelect v-else-if="field.type === 'enum' && field.enum_values.length" v-model="declared[field.name].value" :items="field.enum_values" :aria-label="field.name" class="w-full" />
                                    <UTextarea v-else-if="['array', 'object'].includes(field.type)" v-model="declared[field.name].value" :aria-label="field.name" class="w-full font-mono" />
                                    <UInput v-else v-model="declared[field.name].value" :aria-label="field.name" class="w-full" />
                                </template>
                            </div>
                        </UFormField>
                    </section>
                    <section class="space-y-3 rounded-lg border border-[var(--ui-border)] p-3">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <h3 class="text-sm font-semibold">Custom parameters</h3>
                            <AppButton type="button" color="neutral" variant="outline" size="sm" icon="i-tabler-plus" :disabled="saving" @click="addCustom">Add parameter</AppButton>
                        </div>
                        <p class="text-xs text-[var(--ui-text-muted)]">Choose a value type explicitly. Arrays and objects use JSON. The pinned store manifest is preserved and cannot be edited here.</p>
                        <div v-for="(entry, index) in custom" :key="entry.id" class="space-y-2 border-t border-[var(--ui-border)] pt-3">
                            <div class="flex items-center gap-2">
                                <UInput v-model="entry.key" :aria-label="`Parameter ${index + 1} name`" placeholder="option-key" class="min-w-0 flex-1" />
                                <USelect v-model="entry.type" :items="parameterTypes" :aria-label="`Parameter ${index + 1} type`" />
                                <AppButton type="button" color="error" variant="ghost" icon="i-tabler-trash" :aria-label="`Remove parameter ${index + 1}`" :disabled="saving" @click="custom.splice(index, 1)" />
                            </div>
                            <USelect v-if="entry.type === 'boolean'" v-model="entry.value" :items="['true', 'false']" :aria-label="`Parameter ${index + 1} value`" class="w-full" />
                            <UTextarea v-else-if="['array', 'object'].includes(entry.type)" v-model="entry.value" :aria-label="`Parameter ${index + 1} JSON value`" class="w-full font-mono" />
                            <UInput v-else-if="entry.type !== 'null'" v-model="entry.value" :aria-label="`Parameter ${index + 1} value`" class="w-full" />
                        </div>
                    </section>
                </fieldset>
                <UAlert v-if="error" color="error" variant="subtle" title="Configuration not saved" :description="error" />
                <div class="flex justify-end gap-3">
                    <AppButton type="button" color="neutral" variant="outline" :disabled="saving" @click="close(false)">Cancel</AppButton>
                    <AppButton type="submit" :loading="saving" :disabled="saving || disabled">Save configuration</AppButton>
                </div>
            </form>
        </template>
    </AppModal>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'

type Config = Record<string, unknown>
type Field = { name: string; type: string; description: string; enum_values: string[] }
type Plugin = { id: string; name?: string; enabled?: boolean; config_fields?: unknown[]; metadata?: { name?: string; config_fields?: unknown[] } }
type Entry = { id: number; key: string; type: string; value: string }
const props = defineProps<{ open: boolean; plugin: Plugin | null; disabled?: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [id: string] }>()
const { fetchAPI, token } = useApi()
const toast = useToast()
const reserved = new Set(['enabled', 'priority', 'load-in-home', 'store'])
const parameterTypes = ['string', 'boolean', 'integer', 'number', 'array', 'object', 'null']
const loading = ref(false)
const saving = ref(false)
const ready = ref(false)
const error = ref('')
const enabled = ref(false)
const priority = ref('0')
const loadInHome = ref(false)
const fields = ref<Field[]>([])
const declared = reactive<Record<string, { active: boolean; value: string }>>(Object.create(null))
const custom = ref<Entry[]>([])
let baseline: Config = {}
let baselineSettings = { enabled: false, priority: '0', loadInHome: false }
let sequence = 0
let generation = 0
let controller: AbortController | undefined
const path = computed(() => `/config/plugins/configs/${encodeURIComponent(props.plugin?.id || '')}`)
const isRecord = (value: unknown): value is Config => value !== null && typeof value === 'object' && !Array.isArray(value)
const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const format = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value) ?? ''
const valueType = (value: unknown) => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

function normalizeFields(plugin: Plugin): Field[] {
    const direct = Array.isArray(plugin.config_fields) ? plugin.config_fields : []
    const raw = direct.length ? direct : plugin.metadata?.config_fields || []
    const seen = new Set<string>()
    return raw.flatMap((item) => {
        if (!isRecord(item) || typeof item.name !== 'string') return []
        const name = item.name.trim()
        if (!name || reserved.has(name) || seen.has(name)) return []
        seen.add(name)
        return [{ name, type: typeof item.type === 'string' ? item.type.trim().toLowerCase() : 'string', description: typeof item.description === 'string' ? item.description : '', enum_values: Array.isArray(item.enum_values) ? item.enum_values.filter((value): value is string => typeof value === 'string') : [] }]
    })
}

async function readConfig(url: string, signal: AbortSignal): Promise<Config> {
    try {
        const value = await fetchAPI<unknown>(url, { signal })
        if (!isRecord(value)) throw new Error('The plugin configuration is not an object. Use the configuration workspace to repair it before editing.')
        return value
    } catch (cause) {
        if ((cause as { statusCode?: number })?.statusCode === 404) return {}
        throw cause
    }
}

async function load() {
    if (!props.open || !props.plugin || saving.value) return
    controller?.abort()
    controller = new AbortController()
    const current = ++generation
    const plugin = props.plugin
    loading.value = true
    ready.value = false
    error.value = ''
    try {
        const config = await readConfig(path.value, controller.signal)
        if (current !== generation) return
        baseline = config
        fields.value = normalizeFields(plugin)
        enabled.value = typeof config.enabled === 'boolean' ? config.enabled : plugin.enabled === true
        priority.value = config.priority === undefined ? '0' : String(config.priority)
        loadInHome.value = config['load-in-home'] === true
        baselineSettings = { enabled: enabled.value, priority: priority.value, loadInHome: loadInHome.value }
        for (const key of Object.keys(declared)) delete declared[key]
        for (const field of fields.value) {
            declared[field.name] = { active: Object.hasOwn(config, field.name), value: Object.hasOwn(config, field.name) ? format(config[field.name]) : field.type === 'boolean' ? 'false' : '' }
        }
        const names = new Set(fields.value.map((field) => field.name))
        custom.value = Object.entries(config).filter(([key]) => !reserved.has(key) && !names.has(key)).map(([key, value]) => ({ id: ++sequence, key, type: valueType(value), value: format(value) }))
        ready.value = true
    } catch (cause) {
        if (current === generation) error.value = message(cause)
    } finally {
        if (current === generation) loading.value = false
    }
}

function setActive(name: string, active: boolean | 'indeterminate') {
    const entry = declared[name]
    if (entry) entry.active = active === true
}
function addCustom() {
    custom.value.push({ id: ++sequence, key: '', type: 'string', value: '' })
}
function close(open: boolean) {
    if (!saving.value) emit('update:open', open)
}
function parseValue(type: string, raw: string, name: string, options: string[] = []): unknown {
    const text = raw.trim()
    const invalid = () => new Error(`${name}: enter a valid ${type} value.`)
    if (type === 'boolean') {
        if (text !== 'true' && text !== 'false') throw invalid()
        return text === 'true'
    }
    if (type === 'integer') {
        if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text))) throw invalid()
        return Number(text)
    }
    if (type === 'number') {
        if (!text || !/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) throw invalid()
        return Number(text)
    }
    if (type === 'array' || type === 'object') {
        let parsed: unknown
        try { parsed = JSON.parse(text) } catch { throw invalid() }
        if (type === 'array' ? !Array.isArray(parsed) : !isRecord(parsed)) throw invalid()
        return parsed
    }
    if (type === 'null') return null
    if (type === 'enum' && options.length && !options.includes(raw)) throw new Error(`${name}: choose one of the declared options.`)
    return raw
}

function collectParams(): Config {
    const params: Config = Object.create(null)
    for (const field of fields.value) {
        const entry = declared[field.name]
        if (!entry?.active) continue
        // Preserve untouched values even if a plugin changed its declared schema.
        params[field.name] = Object.hasOwn(baseline, field.name) && entry.value === format(baseline[field.name])
            ? baseline[field.name]
            : parseValue(field.type, entry.value, field.name, field.enum_values)
    }
    const names = new Set(fields.value.map((field) => field.name))
    for (const entry of custom.value) {
        const key = entry.key.trim()
        if (!key) throw new Error('Every custom parameter needs a name. Remove unused rows before saving.')
        if (reserved.has(key)) throw new Error(`${key} is reserved and cannot be a custom parameter.`)
        if (names.has(key) || Object.hasOwn(params, key)) throw new Error(`Duplicate parameter: ${key}.`)
        params[key] = Object.hasOwn(baseline, key) && entry.type === valueType(baseline[key]) && entry.value === format(baseline[key])
            ? baseline[key] : parseValue(entry.type, entry.value, key)
    }
    return params
}

function sameValue(left: unknown, right: unknown): boolean {
    if (left === right) return true
    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((value, index) => sameValue(value, right[index]))
    }
    if (isRecord(left) && isRecord(right)) {
        const keys = Object.keys(left)
        return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]))
    }
    return false
}

async function save() {
    if (!ready.value || loading.value || saving.value || props.disabled || !props.plugin) return
    error.value = ''
    let params: Config
    let order: number
    try {
        order = priority.value.trim() ? parseValue('integer', priority.value, 'Priority') as number : 0
        params = collectParams()
    } catch (cause) { error.value = message(cause); return }
    const current = generation
    const id = props.plugin.id
    const url = path.value
    saving.value = true
    controller = new AbortController()
    try {
        // Apply only local changes to the fresh snapshot, never replay untouched baseline values.
        const latest = await readConfig(url, controller.signal)
        if (current !== generation) return
        const next: Config = { ...latest }
        if (enabled.value !== baselineSettings.enabled) next.enabled = enabled.value
        if (order !== Number(baselineSettings.priority)) {
            if (order) next.priority = order
            else delete next.priority
        }
        if (loadInHome.value !== baselineSettings.loadInHome) next['load-in-home'] = loadInHome.value
        for (const key of Object.keys(baseline)) {
            if (!reserved.has(key) && !Object.hasOwn(params, key)) delete next[key]
        }
        for (const [key, value] of Object.entries(params)) {
            if (!Object.hasOwn(baseline, key) || !sameValue(value, baseline[key])) {
                Object.defineProperty(next, key, { value, enumerable: true, configurable: true, writable: true })
            }
        }
        await fetchAPI(url, { method: 'PUT', body: next, signal: controller.signal })
        if (current !== generation) return
        toast.add({ title: 'Plugin configuration saved', description: id, color: 'success' })
        emit('saved', id)
        emit('update:open', false)
    } catch (cause) {
        if (current === generation) error.value = `${message(cause)} If Home reported a reload failure, the write may already be committed; close and reopen to reread before retrying.`
    } finally {
        if (current === generation) saving.value = false
    }
}

watch(() => [props.open, props.plugin?.id, token.value], () => {
    generation++
    controller?.abort()
    saving.value = false
    ready.value = false
    if (props.open) void load()
}, { immediate: true })
onScopeDispose(() => { generation++; controller?.abort() })
</script>
