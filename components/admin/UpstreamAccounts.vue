<template>
  <div class="space-y-4">
    <input ref="fileInput" type="file" accept="application/json,.json" multiple class="hidden" @change="uploadFiles">


    <UAlert v-if="pageError" color="error" variant="subtle" icon="i-tabler-alert-triangle" title="Unable to load credentials" :description="pageError" />
    <UAlert v-if="flightError" color="warning" variant="subtle" icon="i-tabler-alert-triangle" title="In-flight summary unavailable" :description="flightError" />




    <section class="overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)]">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border)] px-4 py-3">
        <h2 class="font-semibold">Upstream accounts</h2>
        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="outline" size="sm" icon="i-tabler-refresh" :loading="pending" :disabled="bulkBusy" @click="refreshData">Refresh</UButton>
          <UButton size="sm" icon="i-tabler-plus" :disabled="busy" @click="createOpen = true">Add credential</UButton>
        </div>
      </div>
      <div class="flex flex-col gap-3 border-b border-[var(--ui-border)] px-4 py-3 lg:flex-row lg:items-center">
        <UInput v-model="search" type="search" icon="i-tabler-search" placeholder="Search credentials..." aria-label="Search credentials" class="w-full lg:max-w-80 lg:flex-1" />
        <div class="grid w-full grid-cols-1 items-center gap-2 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap lg:flex-1">
          <USelect v-model="statusFilter" aria-label="Filter by status" :items="statusOptions" value-key="value" label-key="label" class="w-full sm:w-40" />
          <USelectMenu v-model="providerFilter" aria-label="Filter by provider" :items="providerOptions" value-key="value" label-key="label" :search-input="{ placeholder: 'Search providers...' }" class="w-full sm:w-52" />
          <div class="col-span-full flex flex-wrap gap-2 sm:col-span-1">
            <UButton size="sm" :color="attentionOnly ? 'warning' : 'neutral'" :variant="attentionOnly ? 'soft' : 'outline'" :aria-pressed="attentionOnly" @click="attentionOnly = !attentionOnly">Needs attention</UButton>
            <UButton size="sm" color="neutral" :variant="websocketsFilter === 'on' ? 'soft' : 'outline'" :aria-pressed="websocketsFilter === 'on'" @click="websocketsFilter = websocketsFilter === 'on' ? ALL_FILTER : 'on'">WebSockets</UButton>
            <USelect v-model="websocketsFilter" aria-label="Filter by WebSockets" :items="websocketsOptions" value-key="value" label-key="label" class="w-36" />
          </div>
          <div class="col-span-full flex min-h-9 items-center justify-between gap-2 sm:ml-auto">
            <span role="status" aria-live="polite" class="text-xs tabular-nums text-[var(--ui-text-muted)]">{{ filteredCredentials.length }} of {{ credentials.length }} results</span>
            <UButton v-if="hasActiveFilters" size="sm" color="neutral" variant="ghost" @click="clearFilters">Clear filters</UButton>
          </div>
        </div>
      </div>
      <div class="p-4">
        <div v-if="selectedIDs.size" class="mb-3 flex flex-col gap-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div><p class="text-sm font-medium">{{ selectedIDs.size }} selected</p><p class="mt-0.5 text-xs text-[var(--ui-text-muted)]">{{ selectedEnabledCount }} enabled · {{ selectedDisabledCount }} disabled</p></div>
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" color="neutral" variant="ghost" :disabled="bulkBusy" @click="selectedIDs = new Set()">Clear selection</UButton>
            <UButton size="sm" color="neutral" variant="ghost" icon="i-tabler-check" :disabled="!selectedDisabledCount || busy || pending" :loading="bulkBusy && bulkAction === 'Enable'" @click="bulkStatus(false)">Enable selected</UButton>
            <UButton size="sm" color="neutral" variant="ghost" icon="i-tabler-alert-triangle" :disabled="!selectedEnabledCount || busy || pending" :loading="bulkBusy && bulkAction === 'Disable'" @click="bulkStatus(true)">Disable selected</UButton>
            <UButton size="sm" color="error" variant="ghost" icon="i-tabler-trash" :disabled="busy || pending" @click="bulkDeleteOpen = true">Delete selected</UButton>
          </div>
        </div>
        <div class="overflow-x-auto rounded-md border border-[var(--ui-border)]">
      <UTable :columns="columns" :data="filteredCredentials" :loading="pending" class="accounts-table min-w-[1100px] table-fixed">
        <template #select-header><input type="checkbox" aria-label="Select all visible credentials" :checked="allVisibleSelected" :indeterminate="someVisibleSelected && !allVisibleSelected" :disabled="bulkBusy || pending || !filteredCredentials.length" @change="toggleAllVisible($event.target.checked)"></template>
        <template #select-cell="{ row }"><input type="checkbox" :aria-label="`Select ${value(row).label || value(row).name || value(row).id}`" :checked="selectedIDs.has(value(row).id)" :disabled="bulkBusy || pending" @change="toggleSelected(value(row).id, $event.target.checked)"></template>
        <template #identity-cell="{ row }"><div class="flex min-w-0 items-center gap-2.5"><span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--ui-bg-elevated)] text-[var(--ui-primary)]"><UIcon name="i-tabler-key" class="size-4" /></span><div class="min-w-0"><p class="truncate font-medium">{{ value(row).label || value(row).name }}</p><p class="mt-1 truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ value(row).name || value(row).auth_index || value(row).id }}</p><p v-if="value(row).note" class="mt-0.5 truncate text-xs text-[var(--ui-text-muted)]">{{ value(row).note }}</p></div></div></template>
        <template #provider-cell="{ row }"><div class="flex flex-col items-start gap-1"><UBadge color="primary" variant="subtle">{{ value(row).provider || value(row).type || 'Unknown' }}</UBadge><UBadge v-if="value(row).type && String(value(row).type).toLowerCase() !== String(value(row).provider || '').toLowerCase()" color="neutral" variant="subtle" class="font-mono text-xs">{{ value(row).type }}</UBadge></div></template>
        <template #status-cell="{ row }"><div class="flex items-center gap-2"><USwitch :model-value="!value(row).disabled" :disabled="busy" :loading="changing === value(row).id" :aria-label="`${value(row).disabled ? 'Enable' : 'Disable'} ${value(row).label || value(row).id}`" @update:model-value="toggleStatus(value(row))" /><UBadge :color="credentialColor(value(row))" variant="subtle"><UIcon :name="value(row).disabled || value(row).unavailable ? 'i-tabler-alert-triangle' : 'i-tabler-circle-check'" class="mr-1 inline size-3" />{{ credentialStatus(value(row)) }}</UBadge></div></template>
        <template #concurrency-cell="{ row }"><div class="text-sm"><span class="font-semibold">{{ concurrency(value(row)).in_flight || value(row).in_flight || 0 }}</span><span class="text-[var(--ui-text-muted)]"> / {{ concurrency(value(row)).max_in_flight ?? value(row).max_in_flight ?? '∞' }}</span><p v-if="concurrency(value(row)).total_saturated || value(row).total_saturated" class="text-xs text-amber-500">Saturated</p></div></template>
        <template #quota-cell="{ row }">
          <button type="button" class="min-w-44 space-y-1 text-left" :aria-label="`View quota for ${value(row).label || value(row).id}`" @click="openAccountQuota(value(row))">
            <template v-if="quotaByID.get(value(row).id)">
              <div class="flex flex-wrap gap-1">
                <UBadge :color="quotaColor(quotaByID.get(value(row).id).quota_status)" variant="subtle">{{ quotaByID.get(value(row).id).quota_status || 'unknown' }}</UBadge>
                <UBadge color="neutral" variant="subtle">{{ quotaByID.get(value(row).id).freshness || 'never' }}</UBadge>
                <UBadge v-if="quotaByID.get(value(row).id).collection_status" color="neutral" variant="subtle">{{ quotaByID.get(value(row).id).collection_status }}</UBadge>
              </div>
              <div v-for="window in (quotaByID.get(value(row).id).primary_windows || []).slice(0, 2)" :key="window.id" class="grid grid-cols-[minmax(6.5rem,9rem)_minmax(2.5rem,1fr)_2.25rem] items-center gap-2 text-[11px]">
                <span class="truncate" :title="window.label || window.id">{{ window.label || window.id }}</span>
                <div class="h-1.5 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div v-if="quotaWindowRatio(window) !== null" class="h-full rounded-full bg-[var(--ui-primary)]" :style="{ width: `${Math.round(quotaWindowRatio(window) * 100)}%` }" /></div>
                <span class="text-right tabular-nums text-[var(--ui-text-muted)]">{{ quotaWindowRatio(window) === null ? '—' : `${Math.round(quotaWindowRatio(window) * 100)}%` }}</span>
              </div>
              <p v-if="quotaByID.get(value(row).id).window_count > 2" class="text-xs text-[var(--ui-text-muted)]">+{{ quotaByID.get(value(row).id).window_count - 2 }} more</p>
            </template>
            <span v-else class="text-xs text-[var(--ui-text-muted)]">{{ quotaPending ? 'Loading…' : quotaError ? 'Unavailable' : 'Not collected' }}</span>
          </button>
        </template>
        <template #websockets-cell="{ row }">
          <div v-if="supportsWebsockets(value(row))" class="flex items-center gap-2">
            <USwitch :model-value="Boolean(value(row).websockets)" :disabled="busy || !value(row).id" :loading="inlineChanging === value(row).id" :aria-label="`WebSockets for ${value(row).label || value(row).name || value(row).id}`" @update:model-value="setInlineField(value(row), 'websockets', $event)" />
            <span class="text-xs text-[var(--ui-text-muted)]">{{ value(row).websockets ? 'On' : 'Off' }}</span>
          </div>
          <span v-else class="text-xs text-[var(--ui-text-muted)]" title="WebSockets are not applicable to this provider">N/A</span>
        </template>
        <template #cooling-cell="{ row }"><USwitch :model-value="!value(row)['disable-cooling']" :disabled="busy || !value(row).id" :loading="inlineChanging === value(row).id" :aria-label="`Cooling schedule for ${value(row).label || value(row).name || value(row).id}`" @update:model-value="setInlineField(value(row), 'disable_cooling', !$event)" /></template>
        <template #priority-cell="{ row }"><span class="font-mono text-xs tabular-nums">{{ value(row).priority ?? 'Not set' }}</span></template>
        <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><AdminTableAction action="view" label="View credential details" @click="showDetails(value(row))" /><AdminTableAction action="test" label="Test connectivity" @click="openConnectivity(value(row))" /><AdminTableAction v-if="supports('credential_cooldown_reset', false)" action="refresh" label="Clear quota cooldown" :loading="resettingCooldown === value(row).id" :disabled="busy || !!resettingCooldown" @click="resetCooldown(value(row))" /><AdminTableAction action="download" label="Download credential" :disabled="busy" @click="downloadCredential(value(row))" /><AdminTableAction action="delete" label="Delete credential" destructive :disabled="busy" @click="confirmDelete(value(row))" /></div></template>
        <template #empty><div class="py-14 text-center text-sm text-[var(--ui-text-muted)]"><p>{{ pending ? 'Loading accounts…' : pageError ? 'Could not load accounts. Check the connection and refresh.' : hasActiveFilters ? 'No matching credentials.' : 'No credentials have been added.' }}</p><UButton v-if="hasActiveFilters && !pending" class="mt-3" color="neutral" variant="outline" size="sm" @click="clearFilters">Clear filters</UButton></div></template>
      </UTable>
        </div>
      </div>
    </section>

    <UModal v-model:open="createOpen" title="Add credential" description="Choose how to add an upstream account." :ui="{ content: 'sm:max-w-2xl' }" @update:open="handleCreateOpen">
      <template #body>
        <div class="space-y-5">
          <div class="grid grid-cols-3 gap-1 rounded-md bg-[var(--ui-bg-elevated)] p-1" role="tablist" aria-label="Credential creation method">
            <UButton v-for="mode in createModes" :key="mode.value" role="tab" :aria-selected="createMode === mode.value" color="neutral" :variant="createMode === mode.value ? 'solid' : 'ghost'" size="sm" class="justify-center" :disabled="uploading" @click="createMode = mode.value">{{ mode.label }}</UButton>
          </div>
          <div v-if="createMode === 'oauth'" class="max-h-[65vh] space-y-3 overflow-y-auto"><p class="text-sm text-[var(--ui-text-muted)]">Start a login for the provider you want to connect.</p><div v-for="provider in oauthProviders" :key="provider.value" class="rounded-lg border border-[var(--ui-border)] p-3"><div class="flex items-center justify-between gap-3"><strong>{{ provider.label }}</strong><UButton size="sm" :loading="startingOAuth === provider.value" @click="startOAuth(provider.value)">Start login</UButton></div><template v-if="oauthSessions[provider.value]"><div class="mt-3 break-all rounded-md bg-[var(--ui-bg-elevated)] p-2 font-mono text-xs">{{ oauthSessions[provider.value].url }}</div><div class="mt-2 flex flex-wrap gap-2"><UButton size="sm" color="neutral" variant="outline" @click="copyOAuthLink(provider.value)">Copy authorization link</UButton><UButton size="sm" color="neutral" variant="outline" @click="openOAuthLink(provider.value)">Open authorization link</UButton><UButton size="sm" color="neutral" variant="outline" :loading="checkingOAuth === provider.value" @click="checkOAuthStatus(provider.value)">Check status</UButton></div><p v-if="oauthSessions[provider.value].status" class="mt-2 text-sm">{{ oauthSessions[provider.value].status }} {{ oauthSessions[provider.value].error }}</p><form v-if="provider.value !== 'kimi'" class="mt-3 grid gap-2" @submit.prevent="submitCallback(provider.value)"><UInput v-model="oauthSessions[provider.value].redirect_url" placeholder="Callback URL" /><div class="grid gap-2 sm:grid-cols-2"><UInput v-model="oauthSessions[provider.value].code" placeholder="Authorization code" /><UInput v-model="oauthSessions[provider.value].state" placeholder="State" /></div><UInput v-model="oauthSessions[provider.value].callback_error" placeholder="Provider error (optional)" /><UButton type="submit" size="sm" :loading="submittingCallback === provider.value">Submit callback</UButton></form></template></div><UAlert v-if="oauthError" color="error" variant="subtle" :description="oauthError" /></div>
          <div v-else-if="createMode === 'upload'" class="space-y-4"><button type="button" class="w-full rounded-lg border border-dashed border-[var(--ui-border)] p-6 text-center disabled:opacity-50" :disabled="uploadActive || busy" @click="fileInput?.click()" @dragenter.prevent @dragover.prevent @dragleave.prevent @drop.prevent.stop="uploadDroppedFiles"><UIcon name="i-tabler-upload" class="mx-auto mb-2 size-6" /><p class="text-sm">Drop credential JSON files here or choose files</p></button><p v-if="uploadResults.length" class="text-xs text-[var(--ui-text-muted)]">{{ uploadActive ? `${uploadResults.filter(item => ['success', 'error'].includes(item.status)).length} / ${uploadResults.length} completed` : `${uploadResults.filter(item => item.status === 'success').length} successful · ${failedUploads.length} failed` }}</p><div v-for="(result, index) in uploadResults" :key="result.id" class="rounded-md border border-[var(--ui-border)] p-3 text-sm"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="truncate font-medium">{{ result.file.name }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatFileSize(result.file.size) }} · {{ uploadMessage(result) }}<span v-if="result.resultName"> · {{ result.resultName }}</span></p></div><div class="flex gap-1"><UButton v-if="isRetryableUpload(result)" size="xs" variant="ghost" @click="retryUpload(result)">Retry</UButton><UButton v-if="result.status !== 'uploading' && !uploadActive" size="xs" variant="ghost" color="error" @click="uploadResults.splice(index, 1)">Remove</UButton></div></div><div v-if="result.status === 'uploading'" class="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div class="h-full bg-[var(--ui-primary)]" :style="{ width: `${result.progress}%` }" /></div></div><div v-if="!uploadActive" class="flex gap-2"><UButton v-if="failedUploads.filter(isRetryableUpload).length > 1" size="sm" variant="outline" @click="retryFailedUploads">Retry failed</UButton><UButton v-if="uploadResults.length" size="sm" variant="ghost" @click="uploadResults = []">Clear results</UButton></div></div>
          <form v-else class="space-y-4" @submit.prevent="importVertex"><div class="rounded-lg border border-dashed border-[var(--ui-border)] p-5" @dragover.prevent @drop.prevent="vertexFile = $event.dataTransfer.files?.[0] || null"><UFormField label="Service account JSON" required><input type="file" accept="application/json,.json" class="block w-full text-sm" @change="vertexFile = $event.target.files?.[0] || null" /></UFormField><p v-if="vertexFile" class="mt-2 text-xs">{{ vertexFile.name }} <UButton size="xs" variant="ghost" @click="vertexFile = null">Remove</UButton></p></div><UFormField label="Location"><UInput v-model="vertexLocation" class="w-full" placeholder="us-central1" /></UFormField><UAlert v-if="vertexError" color="error" variant="subtle" :description="vertexError" /><div v-if="vertexResult" class="rounded-md border border-[var(--ui-border)] p-3 text-sm"><p>Status: {{ vertexResult.status }}</p><p>Project: {{ vertexResult.project_id }}</p><p>Email: {{ vertexResult.email }}</p><p>Location: {{ vertexResult.location }}</p><p>Auth file: {{ vertexResult['auth-file'] }}</p></div><div class="flex justify-end"><UButton type="submit" :loading="importingVertex">Import</UButton></div></form>
        </div>
      </template>
    </UModal>




    <USlideover v-model:open="detailsOpen" :title="detailsTarget?.label || detailsTarget?.name || 'Credential details'" :description="detailsTarget?.id || ''" :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <div v-if="detailsTarget" class="space-y-5">
          <div class="-mx-4 flex flex-wrap gap-1 border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] px-4 py-2" role="tablist" aria-label="Credential details"><UButton v-for="section in detailSections" :key="section" role="tab" :aria-selected="detailsTab === section" size="sm" color="neutral" :variant="detailsTab === section ? 'soft' : 'ghost'" @click="selectDetailSection(section)">{{ section }}</UButton></div>
          <section v-if="detailsTab === 'Overview'" class="space-y-3"><div><h3 class="font-semibold">Overview</h3><p class="text-xs text-[var(--ui-text-muted)]">Credential identity, routing, and runtime state.</p></div><dl class="grid gap-3 text-sm"><div v-for="entry in overviewFields(detailsTarget)" :key="entry.label" class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"><dt class="text-xs text-[var(--ui-text-muted)]">{{ entry.label }}</dt><dd class="mt-1 break-words font-mono text-xs">{{ entry.value }}</dd></div></dl><UAlert v-if="detailsTarget.status_message" color="warning" variant="subtle" :description="detailsTarget.status_message" /></section>
          <form v-else-if="detailsTab === 'Metadata'" class="space-y-4 text-sm" @submit.prevent="saveFields"><div><h3 class="font-semibold">Metadata</h3><p class="text-xs text-[var(--ui-text-muted)]">Edit routing and credential metadata directly.</p></div>
            <p class="text-xs text-[var(--ui-text-muted)]">Only changed fields are saved. Leave optional text blank to clear it.</p>
            <div class="grid gap-3 sm:grid-cols-2"><UFormField label="Prefix"><UInput v-model="fields.prefix" class="w-full" /></UFormField><UFormField label="Proxy URL"><UInput v-model="fields.proxy_url" class="w-full" placeholder="socks5://..." /></UFormField><UFormField label="Priority"><UInput v-model="fields.priority" type="number" step="1" class="w-full" /></UFormField><UFormField label="Request retries"><UInput v-model="fields.request_retry" type="number" min="0" step="1" class="w-full" placeholder="Default" /></UFormField></div>
            <UFormField label="Note"><UTextarea v-model="fields.note" class="w-full" /></UFormField>
            <UCheckbox v-if="supportsWebsockets(detailsTarget || {})" v-model="fields.websockets" label="WebSockets" />
            <UFormField label="Cooling override"><USelect v-model="fields.disable_cooling" :items="coolingOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
            <UAlert v-if="fieldsError" color="error" variant="subtle" :description="fieldsError" />
            <div class="flex justify-end border-t border-[var(--ui-border)] pt-3"><UButton type="submit" size="sm" :loading="savingFields">Save changes</UButton></div>
          </form>
          <section v-else-if="detailsTab === 'Quota'" class="space-y-3 text-sm"><div><h3 class="font-semibold">Quota</h3><p class="text-xs text-[var(--ui-text-muted)]">All quota windows, collection state, and reset credits.</p></div>
            <UAlert v-if="accountQuotaError" color="error" variant="subtle" :description="accountQuotaError" />
            <p v-if="accountQuotaLoading" class="py-8 text-center text-[var(--ui-text-muted)]">Loading quota windows…</p>
            <template v-else-if="accountQuotaDetail">
              <div class="flex flex-wrap items-center gap-2"><UBadge color="neutral" variant="subtle">{{ accountQuotaDetail.credential?.provider || detailsTarget?.provider || 'Unknown provider' }}</UBadge><UBadge :color="quotaColor(accountQuotaDetail.credential?.quota_status)" variant="subtle">{{ accountQuotaDetail.credential?.quota_status || 'unknown' }}</UBadge><UBadge color="neutral" variant="subtle">{{ accountQuotaDetail.collection?.freshness || 'never' }}</UBadge><UBadge v-if="accountQuotaDetail.collection?.status" color="neutral" variant="subtle">{{ accountQuotaDetail.collection.status }}</UBadge></div>
              <div v-for="window in accountQuotaDetail.windows || []" :key="window.id" class="rounded-md border border-[var(--ui-border)] p-3"><div class="flex items-start justify-between gap-3"><p class="font-medium">{{ window.label || window.id }}</p><UBadge :color="quotaColor(window.status)" variant="subtle">{{ window.status }}</UBadge></div><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ quotaWindowRemaining(window) }} · Used: {{ window.used ?? '—' }} · Reset: {{ window.reset_at ? new Date(window.reset_at).toLocaleString() : '—' }}</p><div v-if="quotaWindowRatio(window) !== null" class="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div class="h-full bg-[var(--ui-primary)]" :style="{ width: `${Math.round(quotaWindowRatio(window) * 100)}%` }" /></div></div>
              <p v-if="accountQuotaDetail.collection?.error?.message" class="text-xs text-red-500">{{ accountQuotaDetail.collection.error.message }}</p><p v-if="!accountQuotaDetail.windows?.length" class="text-[var(--ui-text-muted)]">No quota windows recorded.</p>
              <div v-if="accountQuotaDetail.reset_credits" class="rounded-md border border-[var(--ui-border)] p-3"><p class="font-medium">Reset credits: {{ accountQuotaDetail.reset_credits.available_count ?? '—' }} available</p><p v-if="accountQuotaDetail.reset_credits.observed_at" class="text-xs text-[var(--ui-text-muted)]">Observed {{ new Date(accountQuotaDetail.reset_credits.observed_at).toLocaleString() }}</p><p v-for="(credit, index) in accountQuotaDetail.reset_credits.credits || []" :key="index" class="mt-1 text-xs">{{ credit.status }} · Expires {{ credit.expires_at ? new Date(credit.expires_at).toLocaleString() : '—' }}</p></div>
            </template>
            <p class="text-xs text-[var(--ui-text-muted)]">Collection runs in the background. Refresh after it finishes to see updated snapshots.</p>
            <div class="flex justify-end gap-2 border-t border-[var(--ui-border)] pt-3"><UButton size="sm" color="neutral" variant="outline" :loading="accountQuotaLoading" @click="refreshAccountQuota">Refresh</UButton><UButton size="sm" color="neutral" variant="outline" :loading="accountQuotaCollecting" @click="collectAccountQuota">Collect now</UButton></div>
          </section>
          <section v-else-if="detailsTab === 'Concurrency'" class="space-y-5 text-sm"><div><h3 class="font-semibold">Concurrency</h3><p class="text-xs text-[var(--ui-text-muted)]">Policy, admitted state, and observed requests.</p></div>
            <UAlert v-if="policyError || concurrencyError" color="error" variant="subtle" :description="policyError || concurrencyError" />
            <section class="space-y-3"><div class="flex items-center justify-between gap-2"><div><h3 class="font-semibold">Concurrency policy</h3><p class="text-xs text-[var(--ui-text-muted)]">Blank or 0 removes a limit.</p></div><UButton size="sm" color="neutral" variant="outline" :loading="loadingPolicy" @click="loadPolicy">Reload</UButton></div><div v-if="policyConflict" class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">Policy changed elsewhere. Reload before saving.</div><form v-if="policy && !loadingPolicy" class="space-y-3" @submit.prevent="savePolicy"><p class="text-xs text-[var(--ui-text-muted)]">Version {{ policy.version }}</p><UFormField label="Total max in flight"><UInput v-model="policyTotal" type="number" min="0" step="1" placeholder="Unlimited" class="w-full" /></UFormField><div class="flex items-center justify-between"><h4 class="text-sm font-semibold">Per-model limits</h4><UButton size="sm" color="neutral" variant="outline" type="button" @click="policyModels.push({ key: ++modelKey, model: '', limit: '' })">Add model</UButton></div><div v-for="(entry, index) in policyModels" :key="entry.key" class="flex items-end gap-2"><UFormField label="Model" class="flex-1"><UInput v-model="entry.model" placeholder="Canonical model ID" class="w-full" /></UFormField><UFormField label="Max in flight" class="w-28"><UInput v-model="entry.limit" type="number" min="0" step="1" class="w-full" /></UFormField><UButton type="button" color="error" variant="ghost" icon="i-tabler-trash" aria-label="Remove model limit" @click="policyModels.splice(index, 1)" /></div><div class="flex justify-end"><UButton type="submit" size="sm" :loading="savingPolicy" :disabled="policyConflict">Save policy</UButton></div></form><p v-else-if="loadingPolicy" class="py-4 text-center text-[var(--ui-text-muted)]">Loading policy…</p></section>
            <section class="space-y-3 border-t border-[var(--ui-border)] pt-4"><div class="flex items-center justify-between gap-2"><div><h3 class="font-semibold">Current concurrency</h3><p class="text-xs text-[var(--ui-text-muted)]">Admitted state and observed in-flight requests.</p></div><UButton size="sm" color="neutral" variant="outline" :loading="loadingConcurrency" @click="loadConcurrency()">Refresh</UButton></div><div v-if="concurrencyState" class="space-y-2"><p>Admitted: <strong>{{ concurrencyState.admitted_in_flight }}</strong> / {{ concurrencyState.max_in_flight ?? '∞' }} <UBadge v-if="concurrencyState.total_saturated" color="warning" variant="subtle">Saturated</UBadge></p><p class="text-xs text-[var(--ui-text-muted)]">Remaining: {{ concurrencyState.remaining ?? 'unlimited' }} · Policy version: {{ concurrencyState.policy_version }} · Fully enforced: {{ concurrencyState.fully_enforced }}</p><div v-for="model in concurrencyState.models || []" :key="model.model" class="rounded-md border border-[var(--ui-border)] p-3"><span class="font-medium">{{ model.model }}</span> · {{ model.admitted_in_flight }} / {{ model.max_in_flight }} <UBadge v-if="model.saturated" color="warning" variant="subtle">Saturated</UBadge></div></div><p v-if="flightDetails?.stale || flightDetails?.details_truncated || flightDetails?.coverage_complete === false" class="text-xs text-amber-500">Observation may be stale or incomplete.</p><p v-if="flightDetails?.observed_at" class="text-xs text-[var(--ui-text-muted)]">Observed at {{ flightDetails.observed_at }} · {{ flightDetails.total }} request(s)</p><div v-for="request in flightDetails?.items || []" :key="request.request_id" class="rounded-md border border-[var(--ui-border)] p-3"><p class="break-all font-mono text-xs">{{ request.request_id }}</p><p>{{ request.model || 'Unknown model' }} · {{ request.request_kind || 'request' }}</p><p class="text-xs text-[var(--ui-text-muted)]">Started {{ request.started_at }}</p></div><p v-if="!loadingConcurrency && !flightDetails?.items?.length" class="text-[var(--ui-text-muted)]">No observed requests.</p><UButton v-if="flightDetails?.next_offset != null" color="neutral" variant="outline" :loading="loadingConcurrency" @click="loadConcurrency(flightDetails.next_offset)">Load more</UButton></section>
          </section>
          <section v-else-if="detailsTab === 'Models'" class="space-y-3 text-sm"><div><h3 class="font-semibold">Models</h3><p class="text-xs text-[var(--ui-text-muted)]">Models exposed by this credential.</p></div><UAlert v-if="modelsError" color="error" variant="subtle" :description="modelsError" /><div class="flex items-center justify-between gap-2"><div><h3 class="font-semibold">Available models</h3><p class="text-xs text-[var(--ui-text-muted)]">Models exposed by this credential.</p></div><UButton size="sm" color="neutral" variant="outline" :loading="modelsLoading" @click="loadModels(detailsTarget)">Refresh</UButton></div><p v-if="modelsLoading" class="py-8 text-center text-[var(--ui-text-muted)]">Loading models…</p><div v-else class="space-y-2"><div v-for="model in credentialModels" :key="model.id" class="rounded-md border border-[var(--ui-border)] px-3 py-2"><p class="font-medium">{{ model.display_name || model.id }}</p><p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ model.id }}</p></div><p v-if="!credentialModels.length" class="py-6 text-center text-[var(--ui-text-muted)]">No models found.</p></div></section>
          <section v-else class="space-y-3"><div><h3 class="font-semibold text-red-600 dark:text-red-400">Danger zone</h3><p class="text-xs text-[var(--ui-text-muted)]">Download a backup or permanently remove this credential.</p></div><div class="flex flex-wrap gap-2"><UButton size="sm" color="neutral" variant="outline" @click="downloadCredential(detailsTarget)">Download credential</UButton><UButton size="sm" color="error" variant="outline" @click="confirmDelete(detailsTarget)">Delete credential</UButton></div></section>
        </div>
      </template>
    </USlideover>

    <UModal v-model:open="connectivityOpen" title="Test credential connectivity" description="Home sends a GET request using the selected credential for proxy selection and $TOKEN$ replacement.">
      <template #body>
        <form class="space-y-4" @submit.prevent="runConnectivity">
          <UAlert color="warning" variant="subtle" title="Trusted URLs only" description="Home sends this request and can reach internal services on its network. Only test URLs you trust." />
          <UFormField label="Credential"><UInput :model-value="connectivityTarget?.label || connectivityTarget?.name || connectivityTarget?.id" readonly class="w-full" /></UFormField>
          <UFormField label="Absolute URL" required><UInput v-model="connectivityURL" type="url" class="w-full" placeholder="https://api.example.com/v1/models" /></UFormField>
          <UFormField label="Authorization header"><UInput model-value="Bearer $TOKEN$" readonly class="w-full font-mono" /></UFormField>
          <UAlert v-if="connectivityError" color="error" variant="subtle" :description="connectivityError" />
          <div v-if="connectivityResult" class="rounded-lg bg-[var(--ui-bg-muted)] p-4 text-sm">
            <p><strong>HTTP {{ connectivityResult.status_code }}</strong></p>
            <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{{ connectivityBody }}</pre>
          </div>
          <div class="flex justify-end gap-2"><UButton type="button" color="neutral" variant="ghost" @click="connectivityOpen = false">Close</UButton><UButton type="submit" :loading="testingConnectivity">Run test</UButton></div>
        </form>
      </template>
    </UModal>



    <UModal v-model:open="bulkDeleteOpen" title="Delete selected credentials"><template #body><div class="space-y-5"><UAlert color="warning" variant="subtle" title="Delete selected credentials?" :description="`${selectedIDs.size} credential(s) will be removed. This cannot be undone.`"/><div class="flex justify-end gap-3"><UButton color="neutral" variant="ghost" :disabled="bulkBusy" @click="bulkDeleteOpen = false">Cancel</UButton><UButton color="error" :loading="bulkBusy" :disabled="!selectedIDs.size" @click="bulkDelete">Delete {{ selectedIDs.size }}</UButton></div></div></template></UModal>
    <UModal v-model:open="deleteOpen" title="Delete credential"><template #body><div class="space-y-5"><UAlert color="warning" variant="subtle" title="This credential will be removed" :description="deleteTarget?.label || deleteTarget?.name || deleteTarget?.id"/><div class="flex justify-end gap-3"><UButton color="neutral" variant="ghost" @click="deleteOpen = false">Cancel</UButton><UButton color="error" :loading="deleting" :disabled="bulkBusy" @click="deleteCredential">Delete</UButton></div></div></template></UModal>
  </div>
</template>

<script setup>
const props = defineProps({ attentionRequest: { type: Number, default: 0 }, syncRequest: { type: Number, default: 0 } })
const { fetchAPI, resolveUrl, token } = useApi()
const { supports } = useCapabilities()
const toast = useToast()
const value = row => row?.original ?? row
const fileInput = ref(null)
const route = useRoute()
const emit = defineEmits(['changed'])

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const ALL_FILTER = '__all__'
const providerFilter = ref(ALL_FILTER)
const statusFilter = ref(ALL_FILTER)
const websocketsFilter = ref(ALL_FILTER)
const attentionOnly = ref(false)
watch(() => props.attentionRequest, () => { attentionOnly.value = true })
const pageError = ref('')
const uploading = ref(false)
const uploadResults = ref([])
const failedUploads = computed(() => uploadResults.value.filter(result => result.status === 'error'))
const uploadActive = computed(() => uploadResults.value.some(result => result.status === 'queued' || result.status === 'uploading'))
let uploadID = 0
const changing = ref('')
const inlineChanging = ref('')
const busy = computed(() => bulkBusy.value || deleting.value || Boolean(changing.value) || Boolean(inlineChanging.value) || savingFields.value)
const detailsOpen = ref(false)
const detailsTarget = ref(null)
const detailsTab = ref('Overview')
const detailSections = ['Overview', 'Metadata', 'Quota', 'Concurrency', 'Models', 'Danger']
function metadataFields(item) {
  return [
    ['Prefix', item.prefix || '—'], ['Priority', item.priority ?? '—'],
    ['Proxy URL', item.proxy_url || 'Global default'],
    ['In flight / limit', `${concurrency(item).in_flight || 0} / ${concurrency(item).max_in_flight ?? '∞'}`]
  ].map(([label, value]) => ({ label, value }))
}
function overviewFields(item) {
  const fallback = '—'
  return [
    ['Provider', item.provider], ['Type', item.type], ['Source', item.source],
    ['Account', item.account || item.email], ['Auth index', item.auth_index || item.id],
    ['Prefix', item.prefix], ['Proxy URL', item.proxy_url],
    ['Priority', item.priority], ['Request retries', item['request-retry']],
    ['WebSockets', supportsWebsockets(item) ? (item.websockets ? 'Enabled' : 'Disabled') : 'N/A'],
    ['Cooling', item['disable-cooling'] ? 'Disabled' : 'Enabled'],
    ['Path', item.path], ['Size', item.size], ['Updated at', item.mod_time || item.updated_at],
    ['Last refresh', item.last_refresh], ['Note', item.note],
    ['Quota status', quotaByID.value.get(item.id)?.quota_status]
  ].map(([label, value]) => ({ label, value: value == null || value === '' ? fallback : String(value) }))
}
const accountQuotaTarget = computed(() => detailsTarget.value)
const accountQuotaDetail = ref(null)
const accountQuotaError = ref('')
const accountQuotaLoading = ref(false)
const accountQuotaCollecting = ref(false)
const resettingCooldown = ref('')
const connectivityOpen = ref(false)
const connectivityTarget = ref(null)
const connectivityURL = ref('')
const connectivityError = ref('')
const connectivityResult = ref(null)
const testingConnectivity = ref(false)
const connectivityBody = computed(() => {
  const body = connectivityResult.value?.body || ''
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
})
const modelsError = ref('')
const modelsLoading = ref(false)
const credentialModels = ref([])

const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
const selectedIDs = ref(new Set())
const bulkBusy = ref(false)
const bulkAction = ref('')
const bulkDeleteOpen = ref(false)
const fieldsTarget = computed(() => detailsTarget.value)
const fields = reactive({ prefix: '', proxy_url: '', priority: '', request_retry: '', note: '', websockets: false, disable_cooling: 'inherit' })
const coolingOptions = [
  { label: 'Inherit global setting', value: 'inherit' },
  { label: 'Enable cooling', value: 'enable' },
  { label: 'Disable cooling', value: 'disable' }
]
const originalFields = ref({})
const fieldsError = ref('')
const savingFields = ref(false)
const policyTarget = computed(() => detailsTarget.value)
const policy = ref(null)
const policyTotal = ref('')
const policyModels = ref([])
const policyError = ref('')
const policyConflict = ref(false)
const loadingPolicy = ref(false)
const savingPolicy = ref(false)
let policyRequest = 0
let modelKey = 0
const concurrencyTarget = computed(() => detailsTarget.value)
const concurrencyState = ref(null)
const flightDetails = ref(null)
const concurrencyError = ref('')
const loadingConcurrency = ref(false)
let concurrencyRequest = 0
const createOpen = ref(false)
const createMode = ref('oauth')
const createModes = [{ value: 'oauth', label: 'OAuth' }, { value: 'upload', label: 'Upload' }, { value: 'vertex', label: 'Vertex' }]
const vertexFile = ref(null)
const vertexResult = ref(null)
const vertexLocation = ref('us-central1')
const vertexError = ref('')
const importingVertex = ref(false)

const oauthError = ref('')
const startingOAuth = ref('')
const oauthSessions = ref({})
const checkingOAuth = ref('')
let oauthGeneration = 0
function stopOAuthPolling() { oauthGeneration++ }
onBeforeUnmount(stopOAuthPolling)

const submittingCallback = ref('')
const oauthProviders = [
  { label: 'Claude', value: 'claude' }, { label: 'Codex', value: 'codex' },
  { label: 'Antigravity', value: 'antigravity' }, { label: 'Kimi', value: 'kimi' },
  { label: 'xAI', value: 'xai' }
]
const oauthRoutes = { claude: '/anthropic-auth-url', codex: '/codex-auth-url', antigravity: '/antigravity-auth-url', kimi: '/kimi-auth-url', xai: '/xai-auth-url' }
function handleCreateOpen(open) {
  if (!open && uploadActive.value) { nextTick(() => { createOpen.value = true }); return }
  if (!open) { stopOAuthPolling(); oauthSessions.value = {}; uploadResults.value = []; if (fileInput.value) fileInput.value.value = '' }
}

const columns = [{ id: 'select', header: '' }, { accessorKey: 'identity', header: 'Credential' }, { accessorKey: 'provider', header: 'Provider' }, { accessorKey: 'status', header: 'Enabled' }, { accessorKey: 'quota', header: 'Quota / reset' }, { accessorKey: 'websockets', header: 'WS' }, { accessorKey: 'cooling', header: 'Cooling' }, { accessorKey: 'priority', header: 'Priority' }, { accessorKey: 'actions', header: 'Actions', meta: { class: { th: 'table-action-head table-action-xwide', td: 'table-action-cell table-action-xwide' } } }]

const flightError = ref('')
async function loadData() {
  pageError.value = ''
  try {
    return await fetchAPI('/auth-files')
  } catch (error) {
    pageError.value = message(error)
    return { files: [] }
  }
}
const { data: authData, pending, refresh: refreshCredentialsData } = useAsyncData('management-credentials', loadData, { lazy: true, default: () => ({ files: [] }) })
async function loadFlight() {
  flightError.value = ''
  try { return await fetchAPI('/credentials/in-flight/summary') }
  catch (error) { flightError.value = message(error); return { items: [] } }
}
const { data: flightData, refresh: refreshFlightData } = useAsyncData('management-credentials-flight', loadFlight, { lazy: true, default: () => ({ items: [] }) })
async function refreshData(notify = true) {
  try {
    await refreshCredentialsData()
    void refreshFlightData()
    void refreshQuotaSummary()
    if (notify) emit('changed')
  } finally { selectedIDs.value = new Set() }
}
watch(() => props.syncRequest, () => { void refreshData(false) })
const credentials = computed(() => Array.isArray(authData.value?.files) ? authData.value.files : [])
const credentialIDs = computed(() => credentials.value.map(item => item.id).filter(Boolean).join(','))
const quotaError = ref('')
async function loadQuotaSummary() {
  quotaError.value = ''
  const ids = credentialIDs.value.split(',').filter(Boolean)
  if (!ids.length) return []
  try {
    const batches = []
    for (let start = 0; start < ids.length; start += 200) {
      const result = await fetchAPI('/quota/credentials', { query: { ids: ids.slice(start, start + 200).join(','), limit: 200 } })
      batches.push(...(result.items || []))
    }
    return batches
  } catch (error) { quotaError.value = message(error); return [] }
}
const { data: quotaSummary, pending: quotaPending, refresh: refreshQuotaSummary } = useAsyncData('management-account-quota', loadQuotaSummary, { lazy: true, default: () => [], watch: [credentialIDs] })
const quotaByID = computed(() => new Map((quotaSummary.value || []).map(item => [item.credential_id, item])))
function quotaColor(status) { return status === 'healthy' || status === 'available' ? 'success' : status === 'low' ? 'warning' : status === 'exhausted' || status === 'error' ? 'error' : 'neutral' }
function quotaWindowRatio(window) {
  const ratio = Number(window.remaining_ratio)
  return window.remaining_ratio == null || !Number.isFinite(ratio) ? null : Math.max(0, Math.min(1, ratio))
}
function quotaWindowRemaining(window) {
  if (window.is_unlimited) return 'Unlimited'
  if (window.remaining != null) return `${Number(window.remaining).toLocaleString()}${window.limit != null ? ` / ${Number(window.limit).toLocaleString()}` : ''}${window.currency ? ` ${window.currency}` : ''}`
  const ratio = quotaWindowRatio(window)
  return ratio == null ? '—' : `${Math.round(ratio * 100)}% remaining`
}
async function openAccountQuota(item) {
  detailsTarget.value = item
  detailsTab.value = 'Quota'
  detailsOpen.value = true
  accountQuotaDetail.value = null
  accountQuotaError.value = ''
  await refreshAccountQuota()
}
async function refreshAccountQuota() {
  if (!accountQuotaTarget.value) return
  const id = accountQuotaTarget.value.id
  accountQuotaLoading.value = true
  accountQuotaError.value = ''
  try {
    const detail = await fetchAPI(`/quota/credentials/${encodeURIComponent(id)}`)
    if (accountQuotaTarget.value?.id === id) accountQuotaDetail.value = detail
    await refreshQuotaSummary()
  } catch (error) { if (accountQuotaTarget.value?.id === id) accountQuotaError.value = message(error) }
  finally { if (accountQuotaTarget.value?.id === id) accountQuotaLoading.value = false }
}
async function collectAccountQuota() {
  if (!accountQuotaTarget.value) return
  accountQuotaCollecting.value = true
  accountQuotaError.value = ''
  try {
    const result = await fetchAPI('/quota/collect', { method: 'POST', body: { credential_ids: [accountQuotaTarget.value.id] } })
    toast.add({ title: result.accepted ? 'Quota collection queued' : 'No collection queued', description: result.accepted ? 'Collection runs in the background. Refresh later to see updated snapshots.' : 'No eligible credentials were newly queued.', color: result.accepted ? 'success' : 'warning' })
  } catch (error) { accountQuotaError.value = message(error) }
  finally { accountQuotaCollecting.value = false }
}
const flightItems = computed(() => Array.isArray(flightData.value?.items) ? flightData.value.items : [])
const flightByID = computed(() => new Map(flightItems.value.map(item => [item.credential_id, item])))
const concurrency = item => flightByID.value.get(item.id) || {}
const enabledCount = computed(() => credentials.value.filter(item => !item.disabled && !item.unavailable).length)
const totalInFlight = computed(() => flightItems.value.reduce((sum, item) => sum + Number(item.in_flight || 0), 0))
const saturatedCount = computed(() => flightItems.value.filter(item => item.total_saturated || item.saturated_model_count).length)
const providerOptions = computed(() => [{ label: 'All providers', value: ALL_FILTER }, ...[...new Set(credentials.value.map(item => item.provider).filter(Boolean))].sort().map(value => ({ label: value, value }))])
const statusOptions = [
  { label: 'All statuses', value: ALL_FILTER }, { label: 'Active', value: 'active' },
  { label: 'Disabled', value: 'disabled' }, { label: 'Unavailable', value: 'unavailable' },
  { label: 'Error', value: 'error' }
]
const websocketsOptions = [
  { label: 'All WebSockets', value: ALL_FILTER }, { label: 'WebSockets on', value: 'on' }, { label: 'WebSockets off', value: 'off' }
]
const needsAttention = item => isQuotaAttention(quotaByID.value.get(item.id))
const filteredCredentials = computed(() => {
  const q = search.value.trim().toLowerCase()
  return credentials.value.filter(item =>
    (!q || [item.id, item.name, item.label, item.email, item.provider].some(v => String(v || '').toLowerCase().includes(q))) &&
    (providerFilter.value === ALL_FILTER || item.provider === providerFilter.value) &&
    (statusFilter.value === ALL_FILTER || credentialStatus(item) === statusFilter.value) &&
    (websocketsFilter.value === ALL_FILTER || Boolean(item.websockets) === (websocketsFilter.value === 'on')) &&
    (!attentionOnly.value || needsAttention(item))
  )
})
const hasActiveFilters = computed(() => Boolean(search.value.trim()) || providerFilter.value !== ALL_FILTER || statusFilter.value !== ALL_FILTER || websocketsFilter.value !== ALL_FILTER || attentionOnly.value)
const selectedEnabledCount = computed(() => credentials.value.filter(item => selectedIDs.value.has(item.id) && !item.disabled).length)
const selectedDisabledCount = computed(() => credentials.value.filter(item => selectedIDs.value.has(item.id) && item.disabled).length)
function clearFilters() {
  search.value = ''
  providerFilter.value = ALL_FILTER
  statusFilter.value = ALL_FILTER
  websocketsFilter.value = ALL_FILTER
  attentionOnly.value = false
}
const allVisibleSelected = computed(() => filteredCredentials.value.length > 0 && filteredCredentials.value.every(item => selectedIDs.value.has(item.id)))
const someVisibleSelected = computed(() => filteredCredentials.value.some(item => selectedIDs.value.has(item.id)))
watch([search, providerFilter, statusFilter, websocketsFilter, attentionOnly], () => { selectedIDs.value = new Set() })
watch(() => route.query.q, q => { search.value = typeof q === 'string' ? q : '' })
let openedDeepLink = ''
watch([() => route.query.credential, credentials], ([id, items]) => {
  if (id !== openedDeepLink && typeof id !== 'string') openedDeepLink = ''
  if (typeof id !== 'string' || !id || !items.length || id === openedDeepLink) return
  const item = items.find(entry => entry.id === id)
  if (item) { openedDeepLink = id; void showDetails(item, 'Concurrency') }
}, { immediate: true })
function toggleSelected(id, checked) {
  const next = new Set(selectedIDs.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedIDs.value = next
}
function toggleAllVisible(checked) {
  const next = new Set(selectedIDs.value)
  for (const item of filteredCredentials.value) {
    if (checked) next.add(item.id)
    else next.delete(item.id)
  }
  selectedIDs.value = next
}
async function runBulk(action, items, request) {
  if (bulkBusy.value || pending.value || changing.value || deleting.value || !items.length) return
  bulkBusy.value = true
  bulkAction.value = action
  let succeeded = 0
  let failed = 0
  try {
    for (const item of items) {
      try { await request(item); succeeded++ } catch { failed++ }
    }
    try { await refreshData() } catch { pageError.value = 'Unable to refresh credentials after the bulk action.' }
    toast.add({
      title: `${action} complete: ${succeeded} succeeded, ${failed} failed`,
      description: pageError.value ? 'The list could not be refreshed; refresh before trying again.' : undefined,
      color: failed || pageError.value ? 'warning' : 'success'
    })
  } finally {
    bulkBusy.value = false
    bulkAction.value = ''
  }
}
async function bulkStatus(disabled) {
  const items = credentials.value.filter(item => selectedIDs.value.has(item.id) && item.disabled !== disabled)
  if (!items.length) { selectedIDs.value = new Set(); return }
  await runBulk(disabled ? 'Disable' : 'Enable', items, item => fetchAPI('/auth-files/status', { method: 'PATCH', body: { name: item.id, disabled } }))
}
async function bulkDelete() {
  if (!selectedIDs.value.size || bulkBusy.value) return
  const items = credentials.value.filter(item => selectedIDs.value.has(item.id))
  bulkDeleteOpen.value = false
  await runBulk('Delete', items, item => fetchAPI(`/auth-files?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }))
}

function supportsWebsockets(item) { return ['codex', 'xai'].includes(String(item.provider || '').toLowerCase()) }
async function setInlineField(item, field, nextValue) {
  if (!item.id || busy.value) return
  inlineChanging.value = item.id
  try {
    await fetchAPI('/auth-files/fields', { method: 'PATCH', body: { id: item.id, [field]: nextValue } })
    await refreshData()
    toast.add({ title: 'Credential updated', color: 'success' })
  } catch (error) { toast.add({ title: 'Credential update failed', description: message(error), color: 'error' }) }
  finally { inlineChanging.value = '' }
}
function credentialStatus(item) { return item.disabled ? 'disabled' : item.unavailable ? 'unavailable' : item.status || 'active' }
function credentialColor(item) { return item.disabled ? 'neutral' : item.unavailable ? 'warning' : item.status === 'error' ? 'error' : 'success' }
function uploadErrorCode(error) {
  const text = message(error).toLowerCase()
  if ([401, 403].includes(error?.statusCode) || error?.code === 'auth') return 'unauthorized'
  if (error?.code === 'network') return 'network'
  if (error?.statusCode === 400 || text.includes('unsupported credential json')) return 'unsupported'
  return 'server'
}
function isRetryableUpload(item) { return item.status === 'error' && ['network', 'server'].includes(item.errorCode) }
function uploadMessage(item) {
  const labels = { queued: 'Queued', uploading: `Uploading ${item.progress}%`, success: 'Uploaded', notJson: 'File must use .json', emptyFile: 'File is empty', invalidJson: 'Invalid JSON', unauthorized: 'Unauthorized', network: 'Network error', unsupported: 'Unsupported credential JSON', server: 'Server error' }
  return labels[item.status === 'error' ? item.errorCode : item.status] || item.status
}
function formatFileSize(size) { return size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB` }
function uploadFile(item) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', resolveUrl('/auth-files'))
    xhr.setRequestHeader('Authorization', `Bearer ${token.value}`)
    xhr.upload.onprogress = event => { const ratio = event.lengthComputable && event.total > 0 ? event.loaded / event.total : 0; item.progress = Math.min(99, Math.max(0, Math.round(100 * ratio))) }
    xhr.onerror = () => reject(Object.assign(new Error('Network error'), { code: 'network' }))
    xhr.onload = () => {
      let response = {}
      try { response = JSON.parse(xhr.responseText || '{}') } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(response)
      else reject(Object.assign(new Error(response?.message || response?.error || xhr.statusText || 'Upload failed'), { statusCode: xhr.status }))
    }
    const body = new FormData(); body.append('file', item.file); xhr.send(body)
  })
}
async function validateUpload(item) {
  if (!/\.json$/i.test(item.file.name)) { item.status = 'error'; item.errorCode = 'notJson'; return false }
  if (!item.file.size) { item.status = 'error'; item.errorCode = 'emptyFile'; return false }
  try { JSON.parse(await item.file.text()) } catch { item.status = 'error'; item.errorCode = 'invalidJson'; return false }
  return true
}
async function runUploadItems(items, validate = true) {
  if (!items.length || uploading.value) return
  uploading.value = true
  if (validate) await Promise.all(items.map(validateUpload))
  const queue = items.filter(item => item.status === 'queued' || (!validate && isRetryableUpload(item)))
  let cursor = 0; let succeeded = 0
  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++]
      item.status = 'uploading'; item.progress = 0; item.resultName = null; item.errorCode = null
      try {
        const result = await uploadFile(item)
        item.status = 'success'; item.progress = 100; item.resultName = result?.files?.[0] || result?.name || item.file.name; succeeded++
      } catch (error) { item.status = 'error'; item.progress = 0; item.errorCode = uploadErrorCode(error) }
    }
  }
  try { await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker)); if (succeeded) await refreshData() }
  finally { uploading.value = false }
}
async function addUploadFiles(files) {
  const items = files.map(file => ({ id: `${Date.now()}-${++uploadID}`, file, status: 'queued', progress: 0, resultName: null, errorCode: null }))
  uploadResults.value.push(...items)
  await runUploadItems(items)
}
async function uploadFiles(event) { const files = Array.from(event.target.files || []); event.target.value = ''; await addUploadFiles(files) }
async function retryUpload(item) { await runUploadItems([item], false) }
async function retryFailedUploads() { await runUploadItems(failedUploads.value.filter(isRetryableUpload), false) }
async function uploadDroppedFiles(event) { if (!uploadActive.value && !busy.value) await addUploadFiles(Array.from(event.dataTransfer?.files || [])) }
async function toggleStatus(item) { changing.value = item.id; try { await fetchAPI('/auth-files/status', { method: 'PATCH', body: { name: item.id, disabled: !item.disabled } }); await refreshData() } catch (error) { toast.add({ title: 'Status update failed', description: message(error), color: 'error' }) } finally { changing.value = '' } }
async function showDetails(item, section = 'Overview') {
  detailsTarget.value = item
  initializeFields(item)
  detailsTab.value = section
  accountQuotaDetail.value = null
  accountQuotaError.value = ''
  policy.value = null
  policyError.value = ''
  concurrencyState.value = null
  flightDetails.value = null
  credentialModels.value = []
  modelsError.value = ''
  detailsOpen.value = true
  await selectDetailSection(section)
}
async function selectDetailSection(section) {
  detailsTab.value = section
  if (section === 'Metadata') initializeFields(detailsTarget.value)
  if (section === 'Quota') await refreshAccountQuota()
  if (section === 'Concurrency') {
    policyError.value = ''
    policyConflict.value = false
    concurrencyError.value = ''
    await Promise.all([loadPolicy(), loadConcurrency()])
  }
  if (section === 'Models') await loadModels(detailsTarget.value)
}
async function resetCooldown(item) {
  if (!item.id || resettingCooldown.value || !supports('credential_cooldown_reset', false)) return
  resettingCooldown.value = item.id
  try {
    const result = await fetchAPI(`/credentials/${encodeURIComponent(item.id)}/cooldown`, { method: 'DELETE' })
    toast.add({ title: result.cleared ? 'Quota cooldown cleared' : 'No active quota cooldown', description: result.cleared ? 'Quota cooldowns cleared for this credential.' : 'There were no quota cooldowns to clear for this credential.', color: result.cleared ? 'success' : 'neutral' })
    if (result.cleared) { await refreshCredentialsData(); emit('changed') }
  } catch (error) { toast.add({ title: 'Could not clear quota cooldown', description: message(error), color: 'error' }) }
  finally { resettingCooldown.value = '' }
}
function openConnectivity(item) {
  connectivityTarget.value = item
  connectivityURL.value = ''
  connectivityError.value = ''
  connectivityResult.value = null
  connectivityOpen.value = true
}
async function runConnectivity() {
  const authIndex = connectivityTarget.value?.auth_index || connectivityTarget.value?.id
  const url = connectivityURL.value.trim()
  if (!authIndex || !/^https?:\/\/[^\s/]+/i.test(url)) {
    connectivityError.value = 'Select a credential and enter an absolute HTTP or HTTPS URL.'
    return
  }
  testingConnectivity.value = true
  connectivityError.value = ''
  connectivityResult.value = null
  try {
    connectivityResult.value = await fetchAPI('/api-call', {
      method: 'POST',
      body: { auth_index: authIndex, method: 'GET', url, header: { Authorization: 'Bearer $TOKEN$', Accept: 'application/json' }, data: '' }
    })
    if (connectivityResult.value.status_code < 200 || connectivityResult.value.status_code >= 300) {
      connectivityError.value = `Upstream returned HTTP ${connectivityResult.value.status_code ?? 'unknown'}.`
    }
  } catch (error) { connectivityError.value = message(error) }
  finally { testingConnectivity.value = false }
}
function initializeFields(item) {
  if (!item) return
  fieldsError.value = ''
  Object.assign(fields, {
    prefix: item.prefix || '', proxy_url: item.proxy_url || '',
    priority: item.priority == null ? '' : String(item.priority), request_retry: item['request-retry'] == null ? '' : String(item['request-retry']),
    note: item.note || '', websockets: Boolean(item.websockets), disable_cooling: item['disable-cooling'] == null ? 'inherit' : item['disable-cooling'] ? 'disable' : 'enable'
  })
  originalFields.value = { ...fields }
}
async function saveFields() {
  if (!fieldsTarget.value) return
  const body = { id: fieldsTarget.value.id }
  for (const key of Object.keys(fields)) {
    if (fields[key] === originalFields.value[key]) continue
    if (key === 'priority' || key === 'request_retry') {
      const raw = String(fields[key]).trim()
      if (raw && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))) { fieldsError.value = `${key} must be a non-negative integer.`; return }
      body[key] = raw ? Number(raw) : null
    } else if (key === 'disable_cooling') body['disable-cooling'] = fields[key] === 'inherit' ? null : fields[key] === 'disable'
    else body[key] = fields[key]
  }
  if (Object.keys(body).length === 1) return
  savingFields.value = true; fieldsError.value = ''
  try {
    await fetchAPI('/auth-files/fields', { method: 'PATCH', body })
    await refreshData()
    const updated = credentials.value.find(item => item.id === body.id)
    if (updated) { detailsTarget.value = updated; initializeFields(updated) }
    toast.add({ title: 'Credential fields updated', color: 'success' })
  } catch (error) { fieldsError.value = message(error) }
  finally { savingFields.value = false }
}

async function loadPolicy() {
  if (!policyTarget.value) return
  const requestID = ++policyRequest
  const id = policyTarget.value.id
  loadingPolicy.value = true
  policyError.value = ''
  try {
    const result = await fetchAPI(`/credentials/${encodeURIComponent(id)}/concurrency-policy`)
    if (requestID !== policyRequest) return
    policy.value = result
    policyTotal.value = result.max_in_flight == null ? '' : String(result.max_in_flight)
    policyModels.value = Object.entries(result.max_in_flight_by_model || {}).sort(([a], [b]) => a.localeCompare(b)).map(([model, limit]) => ({ key: ++modelKey, model, limit: String(limit) }))
    policyConflict.value = false
  } catch (error) { if (requestID === policyRequest) policyError.value = message(error) }
  finally { if (requestID === policyRequest) loadingPolicy.value = false }
}
function policyLimit(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) throw new Error('Limits must be non-negative whole numbers.')
  return Number(text) || null
}
async function savePolicy() {
  if (!policyTarget.value || !policy.value || savingPolicy.value || policyConflict.value) return
  let body
  try {
    const total = policyLimit(policyTotal.value)
    const models = {}
    for (const entry of policyModels.value) {
      const model = entry.model.trim()
      if (!model) throw new Error('Enter a model ID or remove the empty row.')
      if (Object.hasOwn(models, model)) throw new Error(`Duplicate model: ${model}`)
      const limit = policyLimit(entry.limit)
      if (limit) models[model] = limit
    }
    body = { version: policy.value.version }
    if (total !== policy.value.max_in_flight) body.max_in_flight = total
    const original = policy.value.max_in_flight_by_model || {}
    if (JSON.stringify(Object.entries(models).sort()) !== JSON.stringify(Object.entries(original).sort())) body.max_in_flight_by_model = models
    if (Object.keys(body).length === 1) return
  } catch (error) { policyError.value = message(error); return }
  savingPolicy.value = true
  policyError.value = ''
  try {
    const result = await fetchAPI(`/credentials/${encodeURIComponent(policyTarget.value.id)}/concurrency-policy`, { method: 'PATCH', body })
    policy.value = result
    policyTotal.value = result.max_in_flight == null ? '' : String(result.max_in_flight)
    policyModels.value = Object.entries(result.max_in_flight_by_model || {}).sort(([a], [b]) => a.localeCompare(b)).map(([model, limit]) => ({ key: ++modelKey, model, limit: String(limit) }))
    await refreshData()
    toast.add({ title: 'Concurrency policy updated', color: 'success' })
  } catch (error) {
    policyConflict.value = error?.statusCode === 409
    policyError.value = policyConflict.value ? 'Policy changed elsewhere. Reload the latest version before editing and saving again.' : message(error)
  } finally { savingPolicy.value = false }
}

async function loadConcurrency(offset = 0) {
  if (!concurrencyTarget.value || loadingConcurrency.value) return
  const id = concurrencyTarget.value.id
  const requestID = ++concurrencyRequest
  loadingConcurrency.value = true; concurrencyError.value = ''
  try {
    const query = { credential_id: id, limit: 25, offset }
    if (offset && flightDetails.value?.snapshot_cursor) query.snapshot_cursor = flightDetails.value.snapshot_cursor
    else query.stable_snapshot = true
    const [states, details] = await Promise.all([
      fetchAPI('/credentials/concurrency'), fetchAPI('/credentials/in-flight', { query })
    ])
    if (requestID !== concurrencyRequest) return
    concurrencyState.value = (states.items || []).find(item => item.credential_id === id) || null
    flightDetails.value = offset ? { ...details, items: [...(flightDetails.value?.items || []), ...(details.items || [])] } : details
  } catch (error) {
    if (requestID === concurrencyRequest) concurrencyError.value = error?.statusCode === 409 ? 'Request snapshot expired. Refresh to load current requests.' : message(error)
  } finally { if (requestID === concurrencyRequest) loadingConcurrency.value = false }
}
async function importVertex() {
  if (!vertexFile.value) { vertexError.value = 'Choose a service-account JSON file.'; return }
  importingVertex.value = true; vertexError.value = ''
  try {
    const body = new FormData()
    body.append('file', vertexFile.value)
    if (vertexLocation.value.trim()) body.append('location', vertexLocation.value.trim())
    vertexResult.value = await fetchAPI('/vertex/import', { method: 'POST', body })
    vertexFile.value = null
    await refreshData()
    toast.add({ title: 'Vertex credential imported', color: 'success' })
  } catch (error) { vertexError.value = message(error) }
  finally { importingVertex.value = false }
}
async function loadModels(item) {
  if (!item?.id || modelsLoading.value) return
  modelsLoading.value = true
  modelsError.value = ''
  credentialModels.value = []
  try { const result = await fetchAPI('/auth-files/models', { query: { name: item.id } }); if (detailsTarget.value?.id === item.id) credentialModels.value = result.models || [] }
  catch (error) { if (detailsTarget.value?.id === item.id) modelsError.value = message(error) }
  finally { if (detailsTarget.value?.id === item.id) modelsLoading.value = false }
}
async function downloadCredential(item) {
  try {
    const blob = await fetchAPI('/auth-files/download', { query: { id: item.id }, responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = item.name || `${item.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) { toast.add({ title: 'Download failed', description: message(error), color: 'error' }) }
}

function confirmDelete(item) { deleteTarget.value = item; deleteOpen.value = true }
async function deleteCredential() { if (!deleteTarget.value) return; deleting.value = true; try { await fetchAPI(`/auth-files?id=${encodeURIComponent(deleteTarget.value.id)}`, { method: 'DELETE' }); deleteOpen.value = false; await refreshData(); toast.add({ title: 'Credential deleted', color: 'success' }) } catch (error) { toast.add({ title: 'Delete failed', description: message(error), color: 'error' }) } finally { deleting.value = false } }
async function startOAuth(provider) {
  startingOAuth.value = provider; oauthError.value = ''
  try {
    const result = await fetchAPI(oauthRoutes[provider], { query: { is_webui: true } })
    if (!result?.url) throw new Error('Authorization URL was not returned.')
    stopOAuthPolling()
    const sessions = { ...oauthSessions.value, [provider]: { url: result.url, state: result.state || '', status: '', code: '', redirect_url: '', callback_error: '' } }
    oauthSessions.value = sessions
  } catch (error) { oauthError.value = message(error) }
  finally { startingOAuth.value = '' }
}
async function copyOAuthLink(provider) {
  try { await navigator.clipboard.writeText(oauthSessions.value[provider].url); toast.add({ title: 'Authorization link copied', color: 'success' }) }
  catch (error) { oauthError.value = message(error) }
}
function openOAuthLink(provider) { window.open(oauthSessions.value[provider].url, '_blank', 'noopener,noreferrer') }
async function completeOAuth() {
  stopOAuthPolling()
  await refreshData()
  toast.add({ title: 'OAuth completed', color: 'success' })
  createOpen.value = false
  oauthSessions.value = {}
}
async function checkOAuthStatus(provider, notify = true) {
  const session = oauthSessions.value[provider]
  if (!session?.state || checkingOAuth.value === provider) return
  checkingOAuth.value = provider
  try {
    const result = await fetchAPI('/get-auth-status', { query: { state: session.state.trim() || undefined } })
    session.status = result.status || 'unknown'; session.error = result.error || ''
    if (String(session.status).trim().toLowerCase() === 'ok') await completeOAuth()
    else if (notify) toast.add({ title: 'OAuth status checked', color: 'neutral' })
  } catch (error) { if (notify) oauthError.value = message(error) }
  finally { checkingOAuth.value = '' }
}
async function pollOAuth(provider, state) {
  const generation = ++oauthGeneration
  let failures = 0
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const result = await fetchAPI('/get-auth-status', { query: { state } })
      if (generation !== oauthGeneration) return
      failures = 0
      const session = oauthSessions.value[provider]
      if (session) { session.status = result.status || 'unknown'; session.error = result.error || '' }
      const status = String(result.status || 'unknown').trim().toLowerCase()
      if (status === 'ok') { await completeOAuth(); return }
      if (status === 'error') { toast.add({ title: 'OAuth failed', description: result.error || result.status, color: 'error' }); return }
    } catch (error) {
      if (generation !== oauthGeneration) return
      failures++
      if (failures >= 3) { toast.add({ title: 'OAuth status failed', description: message(error), color: 'error' }); return }
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  if (generation === oauthGeneration) toast.add({ title: 'OAuth polling stopped', color: 'neutral' })
}
function extractOAuthCode(text) { const value = String(text || '').trim(); return value.match(/\bcode\s*[:=]\s*([^\s&]+)/i)?.[1]?.trim() || value }
function normalizeXaiCallback(source, fallbackState) {
  const value = String(source || '').trim()
  if (!value) return ''
  try { return new URL(value).toString() } catch {}
  const query = value.includes('?') ? value.slice(value.indexOf('?') + 1) : value.includes('#') ? value.slice(value.indexOf('#') + 1) : value
  if (/(^|[&#?])(code|state|error)=/i.test(query)) {
    const params = new URLSearchParams(query.replace(/^[?#]/, ''))
    const state = (params.get('state') || fallbackState || '').trim()
    if (!state) return ''
    const url = new URL('http://127.0.0.1:56121/callback'); url.searchParams.set('state', state)
    for (const key of ['code', 'error', 'error_description']) if (params.get(key)?.trim()) url.searchParams.set(key, params.get(key).trim())
    return url.toString()
  }
  const code = extractOAuthCode(value)
  if (!code || !fallbackState) return ''
  const url = new URL('http://127.0.0.1:56121/callback'); url.searchParams.set('code', code); url.searchParams.set('state', fallbackState); return url.toString()
}
async function submitCallback(provider) {
  const session = oauthSessions.value[provider]
  if (!session || provider === 'kimi') return
  oauthError.value = ''
  let redirectURL = session.redirect_url.trim()
  let code = session.code.trim()
  const state = session.state.trim()
  const errorText = session.callback_error.trim()
  try {
    if (provider === 'xai' && !state && !/(?:^|[?&#])state=/i.test(redirectURL)) throw new Error('State is required for xAI.')
    if ((!state && !redirectURL) || (!code && !errorText && !redirectURL)) throw new Error('Enter state or callback URL, and an authorization code, error, or callback URL.')
    if (provider === 'xai') {
      const normalized = normalizeXaiCallback(redirectURL || code, state)
      code = normalized ? '' : extractOAuthCode(code)
      redirectURL = normalized || redirectURL
    }
    submittingCallback.value = provider
    await fetchAPI('/oauth-callback', { method: 'POST', body: { provider, redirect_url: redirectURL, code, state, error: errorText } })
    toast.add({ title: 'OAuth callback submitted', color: 'success' })
    let pollState = state
    if (!pollState) { const match = session.redirect_url.match(/(?:^|[?&#])state=([^&]+)/i); if (match) { try { pollState = decodeURIComponent(match[1]) } catch { pollState = match[1] } } }
    if (pollState) { session.status = 'wait'; void pollOAuth(provider, pollState) }
  } catch (error) { oauthError.value = message(error) }
  finally { submittingCallback.value = '' }
}
function message(error) { return error?.data?.message || error?.data?.error || error?.message || 'Unexpected request error.' }
</script>

<style scoped>
.accounts-table :deep(th:first-child),
.accounts-table :deep(td:first-child) { width: 44px; }
.accounts-table :deep(th:nth-child(2)),
.accounts-table :deep(td:nth-child(2)) { width: 250px; }
.accounts-table :deep(th:nth-child(3)),
.accounts-table :deep(td:nth-child(3)) { width: 118px; }
.accounts-table :deep(th:nth-child(4)),
.accounts-table :deep(td:nth-child(4)) { width: 150px; }
.accounts-table :deep(th:nth-child(5)),
.accounts-table :deep(td:nth-child(5)) { width: 232px; }
.accounts-table :deep(th:nth-child(6)),
.accounts-table :deep(td:nth-child(6)) { width: 96px; }
.accounts-table :deep(th:nth-child(7)),
.accounts-table :deep(td:nth-child(7)) { width: 120px; }
.accounts-table :deep(th:nth-child(8)),
.accounts-table :deep(td:nth-child(8)) { width: 112px; }
.accounts-table :deep(th:last-child),
.accounts-table :deep(td:last-child) { position: sticky; right: 0; width: 96px; min-width: 96px; text-align: right; background: var(--ui-bg); box-shadow: -1px 0 var(--ui-border); }
.accounts-table :deep(tr:hover td:last-child) { background: var(--ui-bg-elevated); }
</style>
