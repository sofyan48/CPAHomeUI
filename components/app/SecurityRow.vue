<template>
  <div class="security-row flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:p-4">
    <div class="security-row__icon flex size-9 shrink-0 items-center justify-center rounded-xl">
      <UIcon :name="icon" class="size-5" aria-hidden="true" />
    </div>
    <div class="min-w-0 flex-1 basis-40">
      <p class="text-sm font-medium text-[var(--ui-text-highlighted)]">{{ title }}</p>
      <p class="mt-0.5 break-words text-xs leading-relaxed text-[var(--ui-text-muted)]">{{ detail }}</p>
    </div>
    <AppButton class="shrink-0 rounded-lg" color="neutral" variant="soft" size="sm" :aria-label="`${action}: ${title}`" @click="$emit('action')">{{ action }}</AppButton>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string; title: string; detail: string; action: string }>()
defineEmits<{ action: [] }>()
</script>

<style scoped>
.security-row {
  border-color: color-mix(in oklch, var(--ui-border) 75%, transparent);
  background: color-mix(in oklch, var(--ui-bg-muted) 45%, var(--ui-bg));
}
.security-row__icon {
  color: var(--ui-primary);
  background: color-mix(in oklch, var(--ui-primary) 10%, var(--ui-bg));
}
</style>
