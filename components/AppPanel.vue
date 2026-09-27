<template>
  <component :is="as" v-bind="$attrs">
    <slot />
  </component>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{ as?: string }>(), { as: 'div' })
</script>
