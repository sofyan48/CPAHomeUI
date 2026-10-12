<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div><h3 class="font-semibold">Concurrency limits</h3><p class="text-xs text-[var(--ui-text-muted)]">Blank or 0 removes a limit.</p></div>
      <AppButton type="button" size="sm" color="neutral" variant="outline" :loading="loading" :disabled="saving || loading || available === false" @click="emit('reload')">Reload</AppButton>
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <p v-if="conflict" class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-600 dark:text-amber-400">Policy changed elsewhere. Reload before saving.</p>
    <p v-if="available === false" class="text-[var(--ui-text-muted)]">Concurrency policy is unavailable on this deployment.</p>
    <UAlert v-if="available === false && dirty" color="warning" variant="subtle" description="Unsaved concurrency limits were retained. Metadata saving is blocked while the policy is unavailable." />
    <div v-if="available !== false && policy && !loading" class="space-y-3">
      <p class="text-xs text-[var(--ui-text-muted)]">Version {{ policy.version }}</p>
      <UFormField label="Credential-wide limit"><UInput v-model="total" type="number" min="0" step="1" placeholder="Unlimited" class="w-full" :disabled="saving || conflict" /></UFormField>
      <div class="flex items-center justify-between"><h4 class="text-sm font-semibold">Model limits</h4><AppButton size="sm" color="neutral" variant="outline" type="button" :disabled="saving || conflict" @click="emit('add')">Add model</AppButton></div>
      <div v-for="(entry, index) in models" :key="entry.key" class="flex items-end gap-2">
        <UFormField label="Model" class="min-w-0 flex-1"><UInput v-model="entry.model" placeholder="Canonical model ID" class="w-full" :disabled="saving || conflict" /></UFormField>
        <UFormField label="Max in flight" class="w-28"><UInput v-model="entry.limit" type="number" min="0" step="1" class="w-full" :disabled="saving || conflict" /></UFormField>
        <AppButton type="button" color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove model limit" :disabled="saving || conflict" @click="emit('remove', index)" />
      </div>
      <p v-if="!models.length" class="rounded-md border border-dashed border-[var(--ui-border)] px-3 py-4 text-center text-[var(--ui-text-muted)]">No model limits configured.</p>
      <div v-if="showSave" class="flex justify-end"><AppButton type="button" size="sm" :loading="saving" :disabled="saving || loading || conflict" @click="emit('save')">Save policy</AppButton></div>
    </div>
    <p v-else-if="loading" class="py-4 text-center text-[var(--ui-text-muted)]">Loading policy…</p>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  policy: { version: number } | null
  loading: boolean
  saving: boolean
  conflict: boolean
  error: string
  showSave?: boolean
  available?: boolean
  dirty?: boolean
}>()
const total = defineModel<string>('total', { required: true })
const models = defineModel<{ key: number, model: string, limit: string }[]>('models', { required: true })
const emit = defineEmits<{ reload: [], save: [], add: [], remove: [index: number] }>()
</script>
