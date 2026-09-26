<template>
  <div class="flex justify-end">
    <UDropdownMenu :items="items.map(item => ({ label: item.label, icon: item.icon, color: item.color, disabled: item.disabled, onSelect: item.click }))">
      <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-ellipsis-horizontal" :aria-label="'More actions for ' + label" />
    </UDropdownMenu>
  </div>
</template>

<script>
export default {
  props: ['label', 'items']
}
</script>
