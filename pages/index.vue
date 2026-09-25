<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <UCard>
        <h3 class="text-sm font-medium text-[var(--ui-text-muted)] mb-2">Total Request Logs (24h)</h3>
        <p class="text-3xl font-bold">0</p>
      </UCard>
      <UCard>
        <h3 class="text-sm font-medium text-[var(--ui-text-muted)] mb-2">Active Models</h3>
        <p class="text-3xl font-bold">0</p>
      </UCard>
      <UCard>
        <h3 class="text-sm font-medium text-[var(--ui-text-muted)] mb-2">Connected Nodes</h3>
        <p class="text-3xl font-bold">0</p>
      </UCard>
    </div>

    <UCard>
      <h2 class="text-lg font-semibold mb-4">System Status</h2>
      <p class="text-sm text-[var(--ui-text-muted)]">Welcome to CLIProxyAPI Home Management Center.</p>
    </UCard>
  </div>
</template>
