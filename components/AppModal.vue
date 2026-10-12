<template>
  <USlideover v-bind="$attrs" side="right" :inset="false" :ui="slideoverUi">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SlideoverProps } from '@nuxt/ui'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  fullscreen?: boolean
  scrollable?: boolean
  ui?: SlideoverProps['ui']
}>()

// Slideovers always scroll the body; modal-only props must not reach DialogRoot.
const slideoverUi = computed(() => props.fullscreen
  ? { ...props.ui, content: [props.ui?.content, 'max-w-none sm:max-w-none'] }
  : props.ui)
</script>
