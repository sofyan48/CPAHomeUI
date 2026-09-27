<template>
  <div v-if="native" ref="nativeRoot" class="w-full min-w-0 overflow-auto" v-bind="$attrs">
    <slot />
  </div>
  <UTable v-else v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </UTable>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{ native?: boolean }>(), { native: false })
const nativeRoot = ref<HTMLElement | null>(null)
defineExpose({ nativeRoot })
</script>
