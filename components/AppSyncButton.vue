<template>
  <AppButton v-bind="$attrs" color="neutral" variant="outline" size="md" icon="i-tabler-refresh" :loading="loading" :disabled="loading">
    {{ loading ? 'Syncing' : 'Sync data' }}
  </AppButton>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ loading?: boolean }>()
</script>
