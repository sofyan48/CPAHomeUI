<template>
  <UButton v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </UButton>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
