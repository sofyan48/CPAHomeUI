<template>
  <div class="min-w-0">
    <UInput
      v-bind="$attrs"
      :model-value="modelValue"
      type="text"
      autocomplete="off"
      :disabled="disabled"
      :readonly="readonly"
      :placeholder="type === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'"
      :aria-invalid="!!error"
      :aria-describedby="describedBy"
      class="w-full"
      @input="onInput"
    />
    <div class="mt-2 min-w-0 max-w-full">
      <label :for="pickerId" class="mb-1 block text-xs text-[var(--ui-text-muted)]">{{ type === 'date' ? 'Choose date' : 'Choose date and time' }}</label>
      <UInput
        :id="pickerId"
        :type="type"
        :model-value="pickerValue"
        :min="bounds.min"
        :max="bounds.max"
        :step="type === 'datetime-local' ? 60 : undefined"
        :disabled="disabled"
        :readonly="readonly"
        :aria-describedby="describedBy"
        :ui="{ base: 'min-w-0 max-w-full' }"
        class="w-full min-w-0 max-w-full"
        @change="onPickerChange"
      />
    </div>
    <p v-if="error" :id="errorId" role="status" class="mt-1 break-words text-xs text-[var(--ui-error)]">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { dateInputBounds, dateRangeError, sanitizeDateInput, type DateInputType } from '~/composables/dateRange'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ modelValue?: string; type?: DateInputType; min?: string; max?: string; disabled?: boolean; readonly?: boolean }>(), { modelValue: '', type: 'date', min: '', max: '', disabled: false, readonly: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const attrs = useAttrs()
const errorId = useId()
const pickerId = `${errorId}-picker`
const describedBy = computed(() => [attrs['aria-describedby'], error.value ? errorId : ''].filter(Boolean).join(' ') || undefined)
const bounds = computed(() => dateInputBounds(props.type, props.min, props.max))
const error = computed(() => {
  const invalid = dateRangeError(props.modelValue, '', props.type)
  if (invalid || !props.modelValue) return invalid
  if (props.modelValue < bounds.value.min) return `Enter a value on or after ${bounds.value.min}.`
  if (props.modelValue > bounds.value.max) return `Enter a value on or before ${bounds.value.max}.`
  return ''
})
const pickerValue = computed(() => error.value ? '' : props.modelValue)

// Keep the native control available without relying on showPicker support. Incomplete
// native edits must not erase the text draft or commit a browser-normalized invalid value.
function onPickerChange(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value
  if (props.disabled || props.readonly || !value || !input.validity.valid || dateRangeError(value, '', props.type) || value < bounds.value.min || value > bounds.value.max) {
    input.value = pickerValue.value
    return
  }
  emit('update:modelValue', value)
}

// Text drafts avoid native date inputs dropping incomplete calendar segments to an empty value.
// Validation never rewrites either endpoint, so both fields remain freely editable.
function onInput(event: Event) {
  if (props.disabled || props.readonly) return
  const input = event.target as HTMLInputElement
  const value = sanitizeDateInput(input.value)
  if (input.value !== value) input.value = value
  emit('update:modelValue', value)
}
</script>
