<template>
  <div v-if="native" ref="nativeRoot" class="app-table w-full min-w-0 overflow-auto" v-bind="$attrs">
    <slot />
  </div>
  <UTable v-else class="app-table" v-bind="$attrs">
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

<style scoped>
.app-table:deep(table) {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.app-table:deep(thead) {
  background: color-mix(in oklch, var(--ui-bg-muted) 72%, transparent);
}

.app-table:deep(th) {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  line-height: 1rem;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.app-table:deep(td) {
  padding: 0.75rem 1rem;
  color: var(--ui-text);
  font-size: 0.875rem;
  line-height: 1.25rem;
  vertical-align: middle;
}

.app-table:deep(tbody tr:not(:first-child) td) {
  border-top: 1px solid var(--ui-border);
}

.app-table:deep(tbody tr) {
  transition: background-color 120ms ease;
}

.app-table:deep(tbody tr:hover) {
  background: color-mix(in oklch, var(--ui-bg-muted) 58%, transparent);
}

</style>
