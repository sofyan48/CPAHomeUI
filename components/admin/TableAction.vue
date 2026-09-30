<template>
  <UTooltip :text="label" :delay-duration="250">
    <span class="inline-flex" :tabindex="disabled ? 0 : undefined">
      <AppButton
        size="xs"
        :color="destructive ? 'error' : 'neutral'"
        variant="ghost"
        :icon="resolvedIcon"
        :aria-label="label"
        :title="label"
        :loading="loading"
        :disabled="disabled"
        class="admin-table-action"
        @click="$emit('click', $event)"
      />
    </span>
  </UTooltip>
</template>

<script setup lang="ts">
const icons = {
  view: 'i-tabler-eye',
  edit: 'i-tabler-pencil',
  copy: 'i-tabler-copy',
  duplicate: 'i-tabler-copy',
  test: 'i-tabler-plug-connected',
  refresh: 'i-tabler-refresh',
  download: 'i-tabler-download',
  remove: 'i-tabler-trash',
  delete: 'i-tabler-trash',
  add: 'i-tabler-plus',
  upload: 'i-tabler-upload',
  retry: 'i-tabler-reload',
  details: 'i-tabler-eye'
} as const

type Action = keyof typeof icons

const props = withDefaults(defineProps<{
  action: Action
  label?: string
  icon?: string
  loading?: boolean
  disabled?: boolean
  destructive?: boolean
}>(), {
  label: '',
  icon: '',
  loading: false,
  disabled: false,
  destructive: false
})

defineEmits<{ click: [event: MouseEvent] }>()

const resolvedIcon = computed(() => props.icon || icons[props.action])
const label = computed(() => props.label || `${props.action.charAt(0).toUpperCase()}${props.action.slice(1)}`)
</script>
