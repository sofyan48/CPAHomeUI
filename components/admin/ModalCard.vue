<template>
  <component
    :is="as"
    :class="[
      'border border-[var(--ui-border)]',
      nested
        ? 'rounded-md bg-[var(--ui-bg)] p-3'
        : 'rounded-lg bg-[var(--ui-bg-muted)]/40 p-4'
    ]"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  as?: string
  nested?: boolean
}>(), {
  as: 'section',
  nested: false
})
</script>
