<template>
  <UModal v-model:open="open" title="Commands" description="Search management navigation and global actions." :ui="{ content: 'sm:max-w-xl' }">
    <template #content>
      <UCommandPalette
        :groups="groups"
        placeholder="Search pages and actions…"
        :input="{ 'aria-label': 'Search pages and actions' }"
        :fuse="{ fuseOptions: { keys: ['label', 'description'], threshold: 0.3, ignoreLocation: true } }"
        close
        @update:open="open = $event"
      >
        <template #empty>
          <p class="p-4 text-sm text-[var(--ui-text-muted)]">No matching pages or actions.</p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { CommandPaletteGroup } from '@nuxt/ui'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ groups: CommandPaletteGroup[]; disabled?: boolean }>()

function handleShortcut(event: KeyboardEvent) {
  if (props.disabled || event.defaultPrevented || event.isComposing || event.repeat || event.altKey) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
}

onMounted(() => window.addEventListener('keydown', handleShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcut))
</script>
