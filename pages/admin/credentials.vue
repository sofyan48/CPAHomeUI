<script setup>
const route = useRoute()
await navigateTo({ path: '/admin/upstream', query: { tab: 'accounts', q: route.query.q, credential: route.query.credential } }, { replace: true })
</script>

<template><div /></template>
