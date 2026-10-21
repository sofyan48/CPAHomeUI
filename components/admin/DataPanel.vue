<template>
  <section class="min-w-0 max-w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)]" :aria-label="title || 'Data table'">
    <header v-if="title || description || $slots.actions" class="border-b border-[var(--ui-border)] px-4 py-3">
      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div v-if="title || description" class="min-w-0 flex-1">
          <h2 v-if="title" class="text-sm font-semibold text-highlighted [overflow-wrap:anywhere]">{{ title }}</h2>
          <p v-if="description" class="mt-1 text-xs leading-5 text-muted [overflow-wrap:anywhere]">{{ description }}</p>
        </div>
        <div v-if="$slots.actions" class="flex min-w-0 flex-col gap-2 sm:shrink-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <slot name="actions" />
        </div>
      </div>
    </header>

    <div v-if="$slots.toolbar" class="border-b border-[var(--ui-border)] px-4 py-3">
      <slot name="toolbar" />
    </div>

    <div v-if="$slots.bulk" class="border-b border-[var(--ui-border)] px-4 py-2">
      <slot name="bulk" />
    </div>

    <div class="min-w-0 max-w-full overflow-x-auto" :class="contentClass">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="min-w-0 border-t border-[var(--ui-border)] px-4 py-3">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string; contentClass?: string }>(), {
  title: '',
  description: '',
  contentClass: ''
})
</script>
