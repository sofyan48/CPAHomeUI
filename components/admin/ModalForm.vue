<template>
  <AppModal
    :open="open"
    :title="title"
    :description="description"
    :dismissible="dismissible"
    :ui="{ content: contentClass }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <slot />
    </template>
  </AppModal>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  dismissible?: boolean
  contentClass?: string
}>(), {
  description: undefined,
  dismissible: false,
  contentClass: 'sm:max-w-2xl'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>
