<template>
  <main class="min-h-screen bg-[var(--ui-bg)] px-4 py-12 text-[var(--ui-text)]">
    <div class="mx-auto max-w-5xl">
      <div class="mb-10 text-center">
        <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-500/25">
          <UIcon name="i-heroicons-command-line" class="size-8" />
        </div>
        <h1 class="text-4xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">CLIProxyAPI Home</h1>
        <p class="mx-auto mt-3 max-w-2xl text-[var(--ui-text-muted)]">Choose the management console or your user workspace.</p>
      </div>
      <div class="grid gap-6 md:grid-cols-2">
        <UCard>
          <div class="flex h-full flex-col">
            <UIcon name="i-heroicons-shield-check" class="size-9 text-primary-500" />
            <h2 class="mt-5 text-xl font-semibold">Management console</h2>
            <p class="mt-2 flex-1 text-sm leading-6 text-[var(--ui-text-muted)]">Manage the Home runtime, access, providers, credentials, billing, observability, and nodes.</p>
            <UButton to="/admin/connect" class="mt-6" block trailing-icon="i-heroicons-arrow-right">Admin sign in</UButton>
          </div>
        </UCard>
        <UCard>
          <div class="flex h-full flex-col">
            <UIcon name="i-heroicons-user-circle" class="size-9 text-emerald-500" />
            <h2 class="mt-5 text-xl font-semibold">User workspace</h2>
            <p class="mt-2 flex-1 text-sm leading-6 text-[var(--ui-text-muted)]">Manage personal API keys, billing, security, and browse available models.</p>
            <UButton to="/app/login" class="mt-6" color="neutral" variant="outline" block trailing-icon="i-heroicons-arrow-right">User sign in</UButton>
          </div>
        </UCard>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
</script>
