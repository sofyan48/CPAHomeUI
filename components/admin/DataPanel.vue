<template>
  <section class="data-panel" :aria-label="title || 'Data table'">
    <ToolbarRoot v-if="title || description || $slots.actions" class="data-panel__toolbar" orientation="horizontal" :loop="true">
      <div class="min-w-0 flex-1">
        <h2 v-if="title" class="truncate text-sm font-semibold text-[var(--ui-text-highlighted)]">{{ title }}</h2>
        <p v-if="description" class="mt-0.5 truncate text-xs text-[var(--ui-text-muted)]">{{ description }}</p>
      </div>
      <SeparatorRoot v-if="$slots.actions" decorative orientation="vertical" class="data-panel__separator" />
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5"><slot name="actions" /></div>
    </ToolbarRoot>

    <SeparatorRoot v-if="title || description || $slots.actions" decorative class="h-px bg-[var(--ui-border)]" />

    <ScrollAreaRoot type="auto" class="data-panel__scroll-root">
      <ScrollAreaViewport class="data-panel__viewport">
        <slot />
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="horizontal" class="data-panel__scrollbar data-panel__scrollbar--horizontal">
        <ScrollAreaThumb class="data-panel__thumb" />
      </ScrollAreaScrollbar>
      <ScrollAreaScrollbar orientation="vertical" class="data-panel__scrollbar data-panel__scrollbar--vertical">
        <ScrollAreaThumb class="data-panel__thumb" />
      </ScrollAreaScrollbar>
      <ScrollAreaCorner class="bg-[var(--ui-bg-muted)]" />
    </ScrollAreaRoot>

    <template v-if="$slots.footer">
      <SeparatorRoot decorative class="h-px bg-[var(--ui-border)]" />
      <footer class="data-panel__footer"><slot name="footer" /></footer>
    </template>
  </section>
</template>

<script setup lang="ts">
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
  Separator as SeparatorRoot,
  ToolbarRoot
} from 'reka-ui'

defineProps<{ title?: string; description?: string }>()
</script>

<style scoped>
.data-panel {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: 0.625rem;
  background: var(--glass-card-strong);
  -webkit-backdrop-filter: blur(12px) saturate(110%);
  backdrop-filter: blur(12px) saturate(110%);
  box-shadow: var(--glass-shadow);
}
.data-panel__toolbar {
  display: flex;
  min-height: 3.25rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: transparent;
}
.data-panel__separator { width: 1px; height: 1.5rem; background: var(--ui-border); }
.data-panel__scroll-root { width: 100%; }
.data-panel__viewport { width: 100%; max-width: 100%; }
.data-panel__footer { background: color-mix(in oklch, var(--glass-card-strong) 82%, var(--ui-bg-muted)); }
.data-panel__scrollbar { display: flex; touch-action: none; user-select: none; padding: 2px; background: transparent; }
.data-panel__scrollbar--horizontal { height: 9px; flex-direction: column; }
.data-panel__scrollbar--vertical { width: 9px; }
.data-panel__thumb { position: relative; flex: 1; border-radius: 9999px; background: color-mix(in oklch, var(--ui-text-dimmed) 30%, transparent); }
.data-panel__thumb:hover { background: color-mix(in oklch, var(--ui-text-muted) 50%, transparent); }
</style>
