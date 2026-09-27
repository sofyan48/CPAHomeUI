<template>
  <div role="tablist" :aria-label="label" class="app-panel-tabs">
    <UButton
      v-for="item in items"
      :key="item.value"
      role="tab"
      :aria-selected="modelValue === item.value"
      :color="modelValue === item.value ? 'primary' : 'neutral'"
      :variant="modelValue === item.value ? 'soft' : 'ghost'"
      :icon="item.icon"
      @click="$emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  items: Array<{ label: string; value: string; icon?: string }>
  label?: string
}>(), {
  items: () => [],
  label: 'Sections'
})

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<style scoped>
.app-panel-tabs {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  border-bottom: 1px solid var(--ui-border);
}
.app-panel-tabs :deep(button) {
  border-radius: 0;
  border-bottom: 2px solid transparent;
}
.app-panel-tabs :deep(button[aria-selected="true"]) {
  border-bottom-color: var(--ui-primary);
  background: transparent;
  color: var(--ui-primary);
}
</style>
