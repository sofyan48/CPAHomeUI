<template>
  <UModal v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </UModal>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
