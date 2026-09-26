<script setup lang="ts">
definePageMeta({ layout: 'default' })
await navigateTo({ path: '/admin/upstream', query: { tab: 'accounts', q: useRoute().query.q } }, { replace: true })
</script>

<template>
  <div />
</template>
