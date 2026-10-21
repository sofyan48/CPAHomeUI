<template>
  <UApp :toaster="{ position: 'bottom-right' }">
    <div>
      <NuxtLayout>
        <NuxtPage :key="route.path.startsWith('/admin') ? managementGeneration : undefined" />
      </NuxtLayout>
    </div>
  </UApp>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useManagementSessionStore } from '~/stores/managementSession'

const route = useRoute()
// Document scope also covers Nuxt UI overlays teleported outside the shell.
useHead(() => {
  const adminConsole = /^\/admin(?:\/|$)/.test(route.path) ? '' : undefined
  return {
    htmlAttrs: { 'data-admin-console': adminConsole },
    bodyAttrs: { 'data-admin-console': adminConsole }
  }
})
const { token } = storeToRefs(useManagementSessionStore())
const managementGeneration = ref(0)
// Token changes invalidate workspace owners; remount pages to acquire fresh refs.
watch(token, () => { managementGeneration.value++ }, { flush: 'sync' })
</script>
