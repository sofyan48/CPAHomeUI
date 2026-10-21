<template>
  <AdminDataPanel :title="title" :description="description">
    <template v-if="$slots.actions || $slots.panelActions" #actions>
      <slot name="panelActions" />
      <slot name="actions" />
    </template>

    <template v-if="$slots.filters" #toolbar>
      <slot name="filters" />
    </template>

    <template v-if="$slots.bulk" #bulk>
      <slot name="bulk" />
    </template>

    <slot />

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AdminDataPanel>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: '',
  description: ''
})
</script>
