<template>
  <UCard v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </UCard>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
provide(Symbol.for('cliproxy-app-card'), true)
</script>
