<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Provider Keys</h1>
      <UButton color="primary" icon="i-heroicons-plus">
        New Provider Key
      </UButton>
    </div>
    
    <UCard :ui="{ body: { padding: '' } }">
      <UTable :columns="[{ key: 'provider', label: 'Provider' }, { key: 'status', label: 'Status' }]" :data="[]">
        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-10">
            <span class="text-sm text-[var(--ui-text-muted)]">Work in progress: Provider Keys view</span>
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
