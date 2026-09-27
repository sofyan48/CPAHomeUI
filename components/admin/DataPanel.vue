<template>
  <AppCard :ui="{ body: 'p-0' }" :aria-label="title || 'Data table'">
    <template v-if="title || description || $slots.actions" #header>
      <div class="flex min-h-8 items-center gap-3">
        <div class="min-w-0 flex-1">
          <h2 v-if="title" class="truncate text-sm font-semibold text-highlighted">{{ title }}</h2>
          <p v-if="description" class="mt-0.5 truncate text-xs text-muted">{{ description }}</p>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5">
          <slot name="actions" />
        </div>
      </div>
    </template>

    <div class="min-w-0 overflow-x-auto">
      <slot />
    </div>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AppCard>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: '',
  description: ''
})
</script>
