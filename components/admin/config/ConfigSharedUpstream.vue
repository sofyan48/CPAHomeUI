<template>
  <div class="space-y-6">
    <AppCard v-for="section in sections" :id="`config-${section.id}`" :key="section.id">
      <template #header>
        <div>
          <h2 class="font-semibold text-[var(--ui-text-highlighted)]">{{ section.title }}</h2>
          <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ section.description }}</p>
          <p class="mt-1 text-xs text-[var(--ui-text-muted)]">Backend default removes the explicit setting. Configured empty strings, zeroes, disabled booleans and empty objects remain explicit values.</p>
        </div>
      </template>
      <div class="divide-y divide-[var(--ui-border-muted)]">
        <UFormField
          v-for="field in section.fields"
          :key="field.key"
          :label="field.label"
          :description="field.description"
          :error="validationErrors[field.key]"
          class="px-1 py-3"
        >
          <p class="mb-2 break-all font-mono text-xs text-[var(--ui-text-muted)]">{{ field.path.join('.') }}</p>
          <USelect
            v-if="field.type === 'boolean'"
            :model-value="draft[field.key] == null ? 'default' : draft[field.key] === true ? 'true' : 'false'"
            :items="booleanOptions"
            :disabled="loading"
            :aria-label="field.label"
            class="w-full sm:max-w-sm"
            @update:model-value="updateField(field.key, $event === 'default' ? null : $event === 'true')"
          />
          <div v-else class="flex flex-col gap-2 sm:flex-row">
            <USelect
              :model-value="draft[field.key] == null ? 'default' : 'configured'"
              :items="textOptions"
              :disabled="loading"
              :aria-label="`${field.label} source`"
              class="w-full sm:w-48"
              @update:model-value="updateField(field.key, $event === 'default' ? null : field.type === 'number' ? 0 : field.type === 'json' ? '{}' : '')"
            />
            <UTextarea
              v-if="field.type === 'json' && draft[field.key] != null"
              :model-value="String(draft[field.key])"
              :disabled="loading"
              :aria-label="field.label"
              :rows="8"
              class="min-w-0 flex-1 font-mono text-xs"
              spellcheck="false"
              @update:model-value="updateField(field.key, String($event ?? ''))"
            />
            <UInput
              v-else-if="draft[field.key] != null"
              :model-value="String(draft[field.key])"
              :disabled="loading"
              :aria-label="field.label"
              :type="field.type === 'number' ? 'number' : 'text'"
              :step="field.type === 'number' ? 1 : undefined"
              :placeholder="field.placeholder || (field.type === 'duration' ? '20s (empty means unlimited)' : 'Explicit value (may be empty)')"
              class="min-w-0 flex-1"
              @update:model-value="updateField(field.key, field.type === 'number' && $event !== '' && $event != null ? Number($event) : String($event ?? ''))"
            />
          </div>
        </UFormField>
      </div>
    </AppCard>
  </div>
</template>

<script setup lang="ts">
type DraftValue = string | number | boolean | null | undefined
type SharedSection = {
  id: string
  title: string
  description: string
  fields: Array<{
    key: string
    path: string[]
    label: string
    description: string
    type: string
    placeholder?: string
  }>
}

withDefaults(defineProps<{
  sections: SharedSection[]
  validationErrors?: Record<string, string>
  loading?: boolean
}>(), {
  validationErrors: () => ({}),
  loading: false
})

const draft = defineModel<Record<string, DraftValue>>('draft', { required: true })
const booleanOptions = [
  { label: 'Backend default (unset)', value: 'default' },
  { label: 'Enabled (true)', value: 'true' },
  { label: 'Disabled (false)', value: 'false' }
]
const textOptions = [
  { label: 'Backend default (unset)', value: 'default' },
  { label: 'Configured value', value: 'configured' }
]

function updateField(key: string, value: DraftValue) {
  draft.value = { ...draft.value, [key]: value }
}
</script>
