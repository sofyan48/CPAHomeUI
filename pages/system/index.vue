<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">System Nodes</h1>
      <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path">
        Refresh
      </UButton>
    </div>
    
    <UCard :ui="{ body: { padding: '' } }">
      <UTable :columns="[{ key: 'id', label: 'Node ID' }, { key: 'status', label: 'Status' }]" :data="[]">
        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-10">
            <span class="text-sm text-[var(--ui-text-muted)]">Work in progress: System Nodes view</span>
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
