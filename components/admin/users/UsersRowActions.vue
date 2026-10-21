<template>
  <div class="flex items-center justify-end gap-1">
    <AppButton size="xs" color="neutral" variant="ghost" icon="i-tabler-eye" :aria-label="`View user ${user.username}`" title="View user" @click="$emit('view')" />
    <UDropdownMenu :items="items">
      <AppButton size="xs" color="neutral" variant="ghost" icon="i-tabler-dots-vertical" :aria-label="`Actions for ${user.username}`" title="User actions" />
    </UDropdownMenu>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  user: { username: string; deleted_at?: string; approval_pending?: boolean; pending_topup?: unknown }
  operable: boolean
  topupSupported: boolean
  resetSupported: boolean
  approving: boolean
  approvingTopup: boolean
}>()
const emit = defineEmits(['view', 'edit', 'balance', 'reset', 'approve', 'topup', 'delete'])
const items = computed(() => [
  ...(props.user.approval_pending && !props.user.deleted_at ? [{ label: 'Approve user', icon: 'i-tabler-user-check', disabled: props.approving, onSelect: () => emit('approve') }] : []),
  ...(props.topupSupported && props.user.pending_topup && !props.user.deleted_at ? [{ label: 'Approve topup', icon: 'i-tabler-coins', disabled: props.approvingTopup, onSelect: () => emit('topup') }] : []),
  { label: 'Edit user', icon: 'i-tabler-edit', onSelect: () => emit('edit') },
  { label: 'Balance operation', icon: 'i-tabler-cash-banknote', disabled: !props.operable, onSelect: () => emit('balance') },
  ...(props.resetSupported ? [{ label: 'Configure reset allowance', icon: 'i-tabler-refresh', disabled: !props.operable, onSelect: () => emit('reset') }] : []),
  { label: 'Delete user', icon: 'i-tabler-trash', color: 'error' as const, onSelect: () => emit('delete') }
])
</script>
