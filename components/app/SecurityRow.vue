<template>
  <div class="flex items-center gap-3 rounded-xl border border-[var(--ui-border)] p-3">
    <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
      <UIcon :name="icon" class="size-5" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium text-[var(--ui-text-highlighted)]">{{ title }}</p>
      <p class="truncate text-xs text-[var(--ui-text-muted)]">{{ detail }}</p>
    </div>
    <AppButton color="neutral" variant="soft" size="sm" @click="$emit('action')">{{ action }}</AppButton>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string; title: string; detail: string; action: string }>()
defineEmits<{ action: [] }>()
</script>
