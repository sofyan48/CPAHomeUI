<template>
  <div class="space-y-6">
    <UAlert
      v-if="loading"
      color="neutral"
      variant="subtle"
      icon="i-tabler-refresh"
      title="Loading configuration"
      description="Configuration fields will be available when the current values finish loading."
    />

    <template v-for="section in sections" :key="section.id">
    <AppCard :id="`config-${section.id}`">
      <template #header>
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="font-semibold text-[var(--ui-text-highlighted)]">{{ section.title }}</h2>
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ section.description }}</p>
          </div>
          <AppButton
            v-if="section.navigateTo"
            type="button"
            color="neutral"
            variant="ghost"
            size="sm"
            trailing-icon="i-tabler-arrow-right"
            @click="emit('navigate', section.navigateTo)"
          >
            Manage
          </AppButton>
        </div>
      </template>

      <div class="divide-y divide-[var(--ui-border-muted)]">
        <template v-for="field in section.fields" :key="field.key">
          <label
            v-if="field.type === 'switch'"
            class="flex items-center justify-between gap-5 px-1 py-3"
            :class="validationClass(field.key)"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-[var(--ui-text-highlighted)]">{{ field.label }}</span>
              <span v-if="field.description" class="mt-1 block text-xs text-[var(--ui-text-muted)]">{{ field.description }}</span>
              <span v-if="errorFor(field.key)" class="mt-2 block text-xs text-[var(--ui-error)]">{{ errorFor(field.key) }}</span>
            </span>
            <USwitch
              :model-value="booleanValue(field.key)"
              :disabled="loading || fieldDisabled(field)"
              :aria-label="field.label"
              @update:model-value="updateField(field.key, $event)"
            />
          </label>

          <UFormField
            v-else
            :label="field.label"
            :hint="field.hint"
            :error="errorFor(field.key)"
            class="grid gap-2 px-1 py-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] md:items-center"
          >
            <UTextarea
              v-if="field.type === 'textarea'"
              :model-value="textValue(field.key)"
              :rows="field.rows || 4"
              :disabled="loading || fieldDisabled(field)"
              :placeholder="field.placeholder"
              class="w-full font-mono text-xs"
              spellcheck="false"
              @update:model-value="updateField(field.key, $event)"
            />
            <USelect
              v-else-if="field.type === 'select'"
              :model-value="textValue(field.key)"
              :items="field.items"
              value-key="value"
              label-key="label"
              :disabled="loading || fieldDisabled(field)"
              class="w-full"
              @update:model-value="updateField(field.key, $event)"
            />
            <div v-else-if="field.type === 'password'" class="flex gap-2">
              <UInput
                :model-value="textValue(field.key)"
                :type="secretVisible ? 'text' : 'password'"
                :autocomplete="secretVisible ? 'off' : 'new-password'"
                :disabled="loading || fieldDisabled(field)"
                :placeholder="field.placeholder"
                class="min-w-0 flex-1"
                @update:model-value="updateField(field.key, $event)"
              />
              <AppButton
                type="button"
                color="neutral"
                variant="outline"
                :icon="secretVisible ? 'i-tabler-eye-off' : 'i-tabler-eye'"
                :aria-label="secretVisible ? 'Hide secret key' : 'Reveal secret key'"
                :disabled="loading"
                @click="toggleSecretVisibility"
              />
            </div>
            <UInput
              v-else
              :model-value="inputValue(field.key)"
              :type="field.type"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :disabled="loading || fieldDisabled(field)"
              :placeholder="field.placeholder"
              class="w-full"
              @update:model-value="updateField(field.key, normalizeInput(field, $event))"
            />
          </UFormField>
        </template>
      </div>
    </AppCard>
    <slot v-if="section.id === 'plugins'" name="oauth-rules" />
    <slot v-if="section.id === 'network'" name="proxy-pool" />
    <slot v-if="section.id === 'retry-routing'" name="payload" />
    </template>
  </div>
</template>

<script setup lang="ts">
type DraftValue = string | number | boolean | null | undefined
type ConfigDraft = Record<string, DraftValue>
type ValidationErrors = Record<string, string | string[] | null | undefined>
type FieldType = 'switch' | 'text' | 'url' | 'number' | 'password' | 'textarea' | 'select'

type Field = {
  key: string
  label: string
  type: FieldType
  description?: string
  hint?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number
  rows?: number
  span?: 'full'
  items?: Array<{ label: string; value: string }>
  enabledBy?: string
}

type Section = {
  id: string
  title: string
  description: string
  navigateTo?: string
  fields: Field[]
}

const props = withDefaults(defineProps<{
  validationErrors?: ValidationErrors
  loading?: boolean
}>(), {
  validationErrors: () => ({}),
  loading: false
})

const draft = defineModel<ConfigDraft>('draft', { required: true })
const emit = defineEmits<{
  navigate: [section: string]
}>()

const secretVisible = ref(false)

const routingOptions = [
  { label: 'Round robin', value: 'round-robin' },
  { label: 'Weighted round robin', value: 'weighted-round-robin' },
  { label: 'Fill first', value: 'fill-first' }
]

const sections: Section[] = [
  {
    id: 'server',
    title: 'Server',
    description: 'Core CPA listener and diagnostic settings.',
    fields: [
      { key: 'debug', label: 'Debug mode', type: 'switch', description: 'Enable verbose runtime diagnostics.' },
      { key: 'port', label: 'CPA port', type: 'number', min: 1, max: 65535, step: 1, hint: 'Valid range: 1–65535' }
    ]
  },
  {
    id: 'tls',
    title: 'TLS',
    description: 'Serve the CPA endpoint with the configured certificate and private key.',
    fields: [
      { key: 'tlsEnable', label: 'Enable TLS', type: 'switch', description: 'Require TLS for the public CPA listener.' },
      { key: 'tlsCert', label: 'Certificate path', type: 'text', placeholder: '/path/to/cert.pem' },
      { key: 'tlsKey', label: 'Private key path', type: 'text', placeholder: '/path/to/key.pem' }
    ]
  },
  {
    id: 'remote-management',
    title: 'Remote management',
    description: 'Control Management API exposure and the bundled control panel.',
    fields: [
      { key: 'remoteManagementAllowRemote', label: 'Allow remote access', type: 'switch', description: 'Accept Management API requests from non-loopback addresses.' },
      { key: 'remoteManagementSecretKey', label: 'Secret key', type: 'password', placeholder: 'Empty disables Management API routes', hint: 'Keep this value private.' },
      { key: 'remoteManagementDisableControlPanel', label: 'Disable control panel', type: 'switch', description: 'Do not serve the bundled browser control panel.' },
      { key: 'remoteManagementDisableAutoUpdatePanel', label: 'Disable panel auto-update', type: 'switch', description: 'Prevent automatic control-panel updates.' },
      { key: 'remoteManagementPanelGithubRepository', label: 'Panel GitHub repository', type: 'text', placeholder: 'owner/repository' }
    ]
  },
  {
    id: 'plugins',
    title: 'Plugins',
    description: 'Configure plugin loading and store source definitions.',
    navigateTo: 'plugins',
    fields: [
      { key: 'pluginsEnabled', label: 'Enable plugins', type: 'switch', description: 'Load configured plugins at runtime.' },
      { key: 'pluginsDir', label: 'Plugin artifact directory', type: 'text', placeholder: 'plugins' },
      { key: 'pluginStoreSourcesJson', label: 'Third-party plugin sources', type: 'textarea', rows: 5, span: 'full', hint: 'One registry.json URL per line. The official source is always retained.', placeholder: 'https://example.com/plugins/registry.json' }
    ]
  },
  {
    id: 'logs',
    title: 'Logs and statistics',
    description: 'Choose collected diagnostics and local log retention limits.',
    fields: [
      { key: 'requestLog', label: 'Request logs', type: 'switch', description: 'Write per-request diagnostic records.' },
      { key: 'usageStatisticsEnabled', label: 'Usage statistics', type: 'switch', description: 'Collect runtime usage statistics.' },
      { key: 'loggingToFile', label: 'Logging to file', type: 'switch', description: 'Persist application logs to local files.' },
      { key: 'logsMaxTotalSizeMb', label: 'Maximum total log size', type: 'number', min: 0, step: 1, hint: 'Megabytes; 0 uses runtime behavior.' },
      { key: 'errorLogsMaxFiles', label: 'Error log files', type: 'number', min: 0, step: 1, hint: 'Maximum retained error log files.' }
    ]
  },
  {
    id: 'network',
    title: 'Network',
    description: 'Set the current global outbound proxy. Proxy pools are managed separately.',
    navigateTo: 'proxy-network',
    fields: [
      { key: 'proxyUrl', label: 'Proxy URL', type: 'url', span: 'full', placeholder: 'http://user:password@proxy.example:8080', hint: 'Leave empty to connect directly.' }
    ]
  },
  {
    id: 'quota',
    title: 'Quota handling',
    description: 'Fallback behavior when an upstream project or preview model reaches quota.',
    navigateTo: 'quota',
    fields: [
      { key: 'quotaSwitchProject', label: 'Switch project', type: 'switch', description: 'Try another project after quota exhaustion.' },
      { key: 'quotaSwitchPreviewModel', label: 'Switch preview model', type: 'switch', description: 'Try preview-model alternatives after quota exhaustion.' }
    ]
  },
  {
    id: 'retry-routing',
    title: 'Retry and routing',
    description: 'Tune retry limits, cooling behavior, model prefixes, and credential selection.',
    fields: [
      { key: 'requestRetry', label: 'Request retries', type: 'number', min: 0, step: 1 },
      { key: 'maxRetryCredentials', label: 'Max retry credentials', type: 'number', min: 0, step: 1 },
      { key: 'maxRetryInterval', label: 'Max retry interval', type: 'number', min: 0, step: 1, hint: 'Runtime interval value.' },
      { key: 'disableCooling', label: 'Disable cooling', type: 'switch', description: 'Do not temporarily cool credentials after retryable failures.' },
      { key: 'forceModelPrefix', label: 'Force model prefix', type: 'switch', description: 'Require provider prefixes on model names.' },
      { key: 'routingStrategy', label: 'Routing strategy', type: 'select', items: routingOptions }
    ]
  },
  {
    id: 'antigravity',
    title: 'Antigravity',
    description: 'Configure words obfuscated from Antigravity system instructions.',
    fields: [
      { key: 'antigravitySensitiveWordsJson', label: 'Sensitive words obfuscation', type: 'textarea', rows: 5, span: 'full', hint: 'One word per line. Matching is case-insensitive; entries shorter than two characters are ignored.', placeholder: 'sensitive-word' }
    ]
  }
]

function valueFor(key: string): DraftValue {
  return draft.value?.[key]
}

function textValue(key: string): string {
  const value = valueFor(key)
  return value === null || value === undefined ? '' : String(value)
}

function inputValue(key: string): string | number | undefined {
  const value = valueFor(key)
  return typeof value === 'number' || typeof value === 'string' ? value : undefined
}

function toggleSecretVisibility() {
  secretVisible.value = !secretVisible.value
}

function booleanValue(key: string): boolean {
  return Boolean(valueFor(key))
}

function updateField(key: string, value: DraftValue) {
  draft.value = { ...draft.value, [key]: value }
}

function normalizeInput(field: Field, value: string | number | null | undefined): string | number | null {
  if (field.type !== 'number') return value ?? ''
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isNaN(number) ? value : number
}

function fieldDisabled(_field: Field): boolean {
  return false
}

function errorFor(key: string): string | undefined {
  const error = props.validationErrors[key]
  if (Array.isArray(error)) return error.filter(Boolean).join(', ') || undefined
  return error || undefined
}

function validationClass(key: string): string {
  return errorFor(key) ? 'bg-[var(--ui-warning)]/5' : ''
}
</script>
