<template>
  <div v-if="visibleActions.length" class="inline-flex items-center justify-end gap-1 whitespace-nowrap" @click.stop>
    <AppButton
      v-for="action in inlineActions"
      :key="action.id"
      type="button"
      size="sm"
      variant="link"
      :color="action.destructive ? 'error' : 'neutral'"
      :icon="action.icon"
      :aria-label="action.ariaLabel || action.label"
      :loading="action.loading"
      :disabled="action.disabled || action.loading"
      :ui="buttonUI"
      @click="selectAction(action)"
    >
      {{ action.label }}
    </AppButton>
    <UDropdownMenu
      v-if="overflowActions.length"
      :items="menuItems"
      :content="{ align: 'end' }"
      :ui="{ content: 'max-h-[var(--reka-dropdown-menu-content-available-height)] overflow-y-auto', item: 'min-h-10 sm:min-h-0' }"
    >
      <AppButton
        type="button"
        size="sm"
        color="neutral"
        variant="link"
        icon="i-tabler-dots"
        :aria-label="`More actions for ${menuLabel}`"
        :ui="buttonUI"
      >
        More
      </AppButton>
    </UDropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue'

type RowAction = {
  id: string
  label: string
  ariaLabel?: string
  icon: string
  onSelect: () => unknown
  destructive?: boolean
  disabled?: boolean
  loading?: boolean
}

const props = defineProps<{
  actions: (RowAction | false | null | undefined)[]
  menuLabel: string
  maxInline?: number
}>()

const buttonUI = { base: 'admin-table-action no-underline hover:no-underline min-h-10 sm:min-h-0' }
const compact = ref(false)
let mediaQuery: MediaQueryList | undefined
const updateViewport = () => { compact.value = !mediaQuery?.matches }
onMounted(() => {
  mediaQuery = window.matchMedia('(min-width: 40rem)')
  updateViewport()
  mediaQuery.addEventListener('change', updateViewport)
})
onScopeDispose(() => mediaQuery?.removeEventListener('change', updateViewport))

const visibleActions = computed(() => props.actions.filter((action): action is RowAction => Boolean(action)))
const inlineCount = computed(() => {
  const count = visibleActions.value.length
  if (count <= 1) return count
  if (compact.value) return 0
  const defaultCount = count <= 3 ? count : 2
  return Math.min(defaultCount, Math.max(0, props.maxInline ?? defaultCount))
})

// Priority decides membership; destructive actions only move within their group.
const destructiveLast = (actions: RowAction[]) => [...actions].sort((left, right) => Number(!!left.destructive) - Number(!!right.destructive))
const inlineActions = computed(() => destructiveLast(visibleActions.value.slice(0, inlineCount.value)))
const overflowActions = computed(() => destructiveLast(visibleActions.value.slice(inlineCount.value)))
function selectAction(action: RowAction) {
  if (!action.disabled && !action.loading) return action.onSelect()
}
const menuItems = computed(() => overflowActions.value.map(action => ({
  label: action.label,
  icon: action.icon,
  color: action.destructive ? 'error' as const : 'neutral' as const,
  loading: action.loading,
  disabled: action.disabled || action.loading,
  onSelect: () => selectAction(action)
})))
</script>
