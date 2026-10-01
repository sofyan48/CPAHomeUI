<template>
  <UCard v-bind="$attrs" :class="userCard ? ['user-card', { 'user-card--tinted': tinted, 'user-card--emerald': accent === 'emerald' }] : undefined">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </UCard>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{
  tinted?: boolean
  accent?: 'neutral' | 'emerald'
}>()
const userCard = inject(Symbol.for('cliproxy-user-card'), false)
provide(Symbol.for('cliproxy-app-card'), true)
</script>

<style scoped>
.user-card {
  --user-card-accent: var(--color-slate-500);
  background: var(--ui-bg);
  border: 1px solid color-mix(in oklch, var(--ui-border) 80%, var(--ui-text-muted));
  box-shadow:
    inset 0 1px 0 color-mix(in oklch, white 35%, transparent),
    0 2px 0 color-mix(in oklch, var(--ui-border) 85%, var(--ui-text-muted)),
    0 4px 6px rgb(0 0 0 / 8%),
    0 10px 20px rgb(0 0 0 / 7%);
}

.user-card--emerald { --user-card-accent: var(--color-emerald-700); }

.user-card--tinted {
  background: color-mix(in oklch, var(--user-card-accent) 6%, var(--ui-bg));
}

:global(.dark) .user-card {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 7%),
    0 2px 0 rgb(0 0 0 / 30%),
    0 4px 8px rgb(0 0 0 / 20%),
    0 12px 24px rgb(0 0 0 / 20%);
}
</style>
