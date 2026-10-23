<template>
  <div class="space-y-4">
    <input ref="fileInput" type="file" accept="application/json,.json" multiple class="hidden" @change="uploadFiles">


    <UAlert v-if="pageError" color="error" variant="subtle" icon="i-tabler-alert-triangle" title="Unable to load credentials" :description="pageError" />
    <UAlert v-if="flightError" color="warning" variant="subtle" icon="i-tabler-alert-triangle" title="In-flight summary unavailable" :description="flightError" />




    <section>
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border)] px-4 py-3">
        <h2 class="font-semibold">Upstream accounts</h2>
        <div class="flex items-center gap-2">

          <AppButton size="sm" icon="i-tabler-plus" :disabled="busy" @click="createOpen = true">Add credential</AppButton>
        </div>
      </div>
      <div class="flex flex-col gap-3 border-b border-[var(--ui-border)] px-4 py-3 lg:flex-row lg:items-center">
        <UInput v-model="search" type="search" icon="i-tabler-search" placeholder="Search credentials..." aria-label="Search credentials" class="w-full lg:max-w-80 lg:flex-1" />
        <div class="grid w-full grid-cols-1 items-center gap-2 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap lg:flex-1">
          <USelect v-model="statusFilter" aria-label="Filter by status" :items="statusOptions" value-key="value" label-key="label" class="w-full sm:w-40" />
          <USelectMenu v-model="providerFilter" aria-label="Filter by provider" :items="providerOptions" value-key="value" label-key="label" :search-input="{ placeholder: 'Search providers...' }" class="w-full sm:w-52" />
          <div class="col-span-full flex flex-wrap gap-2 sm:col-span-1">
            <AppButton size="sm" :color="attentionOnly ? 'warning' : 'neutral'" :variant="attentionOnly ? 'soft' : 'outline'" :aria-pressed="attentionOnly" @click="attentionOnly = !attentionOnly">Needs attention</AppButton>
            <AppButton size="sm" color="neutral" :variant="websocketsFilter === 'on' ? 'soft' : 'outline'" :aria-pressed="websocketsFilter === 'on'" @click="websocketsFilter = websocketsFilter === 'on' ? ALL_FILTER : 'on'">WebSockets</AppButton>
            <USelect v-model="websocketsFilter" aria-label="Filter by WebSockets" :items="websocketsOptions" value-key="value" label-key="label" class="w-36" />
          </div>
          <div class="col-span-full flex min-h-9 items-center justify-between gap-2 sm:ml-auto">
            <span role="status" aria-live="polite" class="text-xs tabular-nums text-[var(--ui-text-muted)]">{{ filteredCredentials.length }} of {{ credentials.length }} results</span>
            <AppButton v-if="hasActiveFilters" size="sm" color="neutral" variant="ghost" @click="clearFilters">Clear filters</AppButton>
          </div>
        </div>
      </div>
      <div>
        <div v-if="selectedIDs.size" class="mb-3 flex flex-col gap-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] app-surface px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div><p class="text-sm font-medium">{{ selectedIDs.size }} selected</p><p class="mt-0.5 text-xs text-[var(--ui-text-muted)]">{{ selectedEnabledCount }} enabled · {{ selectedDisabledCount }} disabled</p></div>
          <div class="flex flex-wrap gap-2">
            <AppButton size="sm" color="neutral" variant="ghost" :disabled="bulkBusy" @click="selectedIDs = new Set()">Clear selection</AppButton>
            <AppButton size="sm" color="neutral" variant="ghost" icon="i-tabler-check" :disabled="!selectedDisabledCount || busy || pending" :loading="bulkBusy && bulkAction === 'Enable'" @click="bulkStatus(false)">Enable selected</AppButton>
            <AppButton size="sm" color="neutral" variant="ghost" icon="i-tabler-alert-triangle" :disabled="!selectedEnabledCount || busy || pending" :loading="bulkBusy && bulkAction === 'Disable'" @click="bulkStatus(true)">Disable selected</AppButton>
            <AppButton size="sm" color="error" variant="ghost" icon="i-tabler-trash" :disabled="busy || pending" @click="bulkDeleteOpen = true">Delete selected</AppButton>
          </div>
        </div>
      <AppCard :ui="{ body: 'p-0' }">
      <AppTable :columns="columns" :data="filteredCredentials" :loading="pending" class="accounts-table min-w-0">
        <template #select-header><input type="checkbox" aria-label="Select all visible credentials" :checked="allVisibleSelected" :indeterminate="someVisibleSelected && !allVisibleSelected" :disabled="bulkBusy || pending || !filteredCredentials.length" @change="toggleAllVisible($event.target.checked)"></template>
        <template #select-cell="{ row }"><input type="checkbox" :aria-label="`Select ${value(row).label || value(row).name || value(row).id}`" :checked="selectedIDs.has(value(row).id)" :disabled="bulkBusy || pending" @change="toggleSelected(value(row).id, $event.target.checked)"></template>
        <template #identity-cell="{ row }"><div class="flex min-w-0 items-center gap-2.5"><span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--ui-bg-elevated)] text-[var(--ui-primary)]"><UIcon name="i-tabler-key" class="size-4" /></span><div class="min-w-0"><p class="truncate font-medium">{{ value(row).label || value(row).name }}</p><p class="mt-1 truncate font-mono text-xs text-[var(--ui-text-muted)]" :title="credentialIdentifier(value(row))">{{ compactIdentifier(credentialIdentifier(value(row))) }}</p><p v-if="value(row).note" class="mt-0.5 truncate text-xs text-[var(--ui-text-muted)]">{{ value(row).note }}</p></div></div></template>
        <template #provider-cell="{ row }"><div class="flex flex-col items-start gap-1"><UBadge color="primary" variant="subtle">{{ value(row).provider || value(row).type || 'Unknown' }}</UBadge><UBadge v-if="value(row).type && String(value(row).type).toLowerCase() !== String(value(row).provider || '').toLowerCase()" color="neutral" variant="subtle" class="font-mono text-xs">{{ value(row).type }}</UBadge></div></template>
        <template #status-cell="{ row }"><div class="flex items-center gap-2"><USwitch :model-value="!value(row).disabled" :disabled="busy" :loading="changing === value(row).id" :aria-label="`${value(row).disabled ? 'Enable' : 'Disable'} ${value(row).label || value(row).id}`" @update:model-value="toggleStatus(value(row))" /><UBadge :color="credentialColor(value(row))" variant="subtle"><UIcon :name="value(row).disabled || value(row).unavailable ? 'i-tabler-alert-triangle' : 'i-tabler-circle-check'" class="mr-1 inline size-3" />{{ credentialStatus(value(row)) }}</UBadge></div></template>
        <template #concurrency-cell="{ row }"><div class="text-sm"><span class="font-semibold">{{ concurrency(value(row)).in_flight || value(row).in_flight || 0 }}</span><span class="text-[var(--ui-text-muted)]"> / {{ concurrency(value(row)).max_in_flight ?? value(row).max_in_flight ?? '∞' }}</span><p v-if="concurrency(value(row)).total_saturated || value(row).total_saturated" class="text-xs text-amber-500">Saturated</p></div></template>
        <template #quota-cell="{ row }">
          <button type="button" class="min-w-44 space-y-1 text-left" :aria-label="`View quota for ${value(row).label || value(row).id}`" @click="openAccountQuota(value(row))">
            <template v-if="quotaByID.get(value(row).id)">
              <p v-if="quotaByID.get(value(row).id).plan?.name" class="text-xs font-medium">{{ quotaByID.get(value(row).id).plan.name }}</p>
              <div class="flex flex-wrap gap-1">
                <UBadge :color="quotaColor(quotaByID.get(value(row).id).quota_status)" variant="subtle">{{ quotaByID.get(value(row).id).quota_status || 'unknown' }}</UBadge>
                <UBadge color="neutral" variant="subtle">{{ quotaByID.get(value(row).id).freshness || 'never' }}</UBadge>
                <UBadge v-if="quotaByID.get(value(row).id).collection_status" color="neutral" variant="subtle">{{ quotaByID.get(value(row).id).collection_status }}</UBadge>
              </div>
              <div v-for="window in quotaDisplayWindows(quotaByID.get(value(row).id))" :key="window.id" class="grid grid-cols-[minmax(6.5rem,9rem)_minmax(2.5rem,1fr)_2.25rem] items-center gap-2 text-[11px]">
                <span class="truncate" :title="window.label || window.id">{{ window.label || window.id }}</span>
                <div class="h-1.5 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div v-if="quotaWindowRatio(window) !== null" class="h-full rounded-full bg-[var(--ui-primary)]" :style="{ width: `${Math.round(quotaWindowRatio(window) * 100)}%` }" /></div>
                <span class="text-right tabular-nums text-[var(--ui-text-muted)]">{{ quotaWindowRatio(window) === null ? '—' : `${Math.round(quotaWindowRatio(window) * 100)}%` }}</span>
              </div>
              <p v-if="quotaByID.get(value(row).id).window_count > quotaDisplayWindows(quotaByID.get(value(row).id)).length" class="text-xs text-[var(--ui-text-muted)]">+{{ quotaByID.get(value(row).id).window_count - quotaDisplayWindows(quotaByID.get(value(row).id)).length }} more</p>
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
        <template #priority-cell="{ row }"><span class="font-mono text-xs tabular-nums" :title="value(row).priority == null ? 'Not set' : undefined">{{ value(row).priority ?? '—' }}</span></template>
        <template #actions-cell="{ row }">
          <AdminRowActions :actions="credentialRowActions(value(row))" :max-inline="1" :menu-label="`credential ${value(row).label || value(row).name || value(row).id}`" />
        </template>
        <template #empty><div class="py-14 text-center text-sm text-[var(--ui-text-muted)]"><p>{{ pending ? 'Loading accounts…' : pageError ? 'Could not load accounts. Check the connection and refresh.' : hasActiveFilters ? 'No matching credentials.' : 'No credentials have been added.' }}</p><AppButton v-if="hasActiveFilters && !pending" class="mt-3" color="neutral" variant="outline" size="sm" @click="clearFilters">Clear filters</AppButton></div></template>
      </AppTable>
      </AppCard>
      </div>
    </section>

    <AppModal v-model:open="createOpen" :dismissible="false" title="Add credential" description="Choose how to add an upstream account." :ui="{ content: 'sm:max-w-2xl' }" @update:open="handleCreateOpen">
      <template #body>
        <div class="space-y-5">
          <div class="grid grid-cols-3 gap-1 rounded-md bg-[var(--ui-bg-elevated)] p-1" role="tablist" aria-label="Credential creation method">
            <AppButton v-for="mode in createModes" :key="mode.value" role="tab" :aria-selected="createMode === mode.value" color="neutral" :variant="createMode === mode.value ? 'solid' : 'ghost'" size="sm" class="justify-center" :disabled="uploading" @click="createMode = mode.value">{{ mode.label }}</AppButton>
          </div>
          <div v-if="createMode === 'oauth'" class="max-h-[65vh] space-y-3 overflow-y-auto"><p class="text-sm text-[var(--ui-text-muted)]">Start a login for the provider you want to connect.</p><div v-for="provider in oauthProviders" :key="provider.value" class="rounded-lg border border-[var(--ui-border)] p-3"><div class="flex items-center justify-between gap-3"><strong>{{ provider.label }}</strong><AppButton size="sm" :loading="startingOAuth === provider.value" @click="startOAuth(provider.value)">Start login</AppButton></div><template v-if="oauthSessions[provider.value]"><div class="mt-3 break-all rounded-md bg-[var(--ui-bg-elevated)] p-2 font-mono text-xs">{{ oauthSessions[provider.value].url }}</div><div class="mt-2 flex flex-wrap gap-2"><AppButton size="sm" color="neutral" variant="outline" @click="copyOAuthLink(provider.value)">Copy authorization link</AppButton><AppButton size="sm" color="neutral" variant="outline" @click="openOAuthLink(provider.value)">Open authorization link</AppButton><AppButton size="sm" color="neutral" variant="outline" :loading="checkingOAuth === provider.value" @click="checkOAuthStatus(provider.value)">Check status</AppButton></div><p v-if="oauthSessions[provider.value].status" class="mt-2 text-sm">{{ oauthSessions[provider.value].status }} {{ oauthSessions[provider.value].error }}</p><form v-if="provider.value !== 'kimi'" class="mt-3 grid gap-2" @submit.prevent="submitCallback(provider.value)"><UInput v-model="oauthSessions[provider.value].redirect_url" placeholder="Callback URL" /><div class="grid gap-2 sm:grid-cols-2"><UInput v-model="oauthSessions[provider.value].code" placeholder="Authorization code" /><UInput v-model="oauthSessions[provider.value].state" placeholder="State" /></div><UInput v-model="oauthSessions[provider.value].callback_error" placeholder="Provider error (optional)" /><AppButton type="submit" size="sm" :loading="submittingCallback === provider.value">Submit callback</AppButton></form></template></div><UAlert v-if="oauthError" color="error" variant="subtle" :description="oauthError" /></div>
          <div v-else-if="createMode === 'upload'" class="space-y-4"><button type="button" class="w-full rounded-lg border border-dashed border-[var(--ui-border)] p-6 text-center disabled:opacity-50" :disabled="uploadActive || busy" @click="fileInput?.click()" @dragenter.prevent @dragover.prevent @dragleave.prevent @drop.prevent.stop="uploadDroppedFiles"><UIcon name="i-tabler-upload" class="mx-auto mb-2 size-6" /><p class="text-sm">Drop credential JSON files here or choose files</p></button><p v-if="uploadResults.length" class="text-xs text-[var(--ui-text-muted)]">{{ uploadActive ? `${uploadResults.filter(item => ['success', 'error'].includes(item.status)).length} / ${uploadResults.length} completed` : `${uploadResults.filter(item => item.status === 'success').length} successful · ${failedUploads.length} failed` }}</p><div v-for="(result, index) in uploadResults" :key="result.id" class="rounded-md border border-[var(--ui-border)] p-3 text-sm"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="truncate font-medium">{{ result.file.name }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatFileSize(result.file.size) }} · {{ uploadMessage(result) }}<span v-if="result.resultName"> · {{ result.resultName }}</span></p></div><div class="flex gap-1"><AppButton v-if="isRetryableUpload(result)" size="xs" variant="ghost" @click="retryUpload(result)">Retry</AppButton><AppButton v-if="result.status !== 'uploading' && !uploadActive" size="xs" variant="ghost" color="error" @click="uploadResults.splice(index, 1)">Remove</AppButton></div></div><div v-if="result.status === 'uploading'" class="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div class="h-full bg-[var(--ui-primary)]" :style="{ width: `${result.progress}%` }" /></div></div><div v-if="!uploadActive" class="flex gap-2"><AppButton v-if="failedUploads.filter(isRetryableUpload).length > 1" size="sm" variant="outline" @click="retryFailedUploads">Retry failed</AppButton><AppButton v-if="uploadResults.length" size="sm" variant="ghost" @click="uploadResults = []">Clear results</AppButton></div></div>
          <form v-else class="space-y-4" @submit.prevent="importVertex"><div class="rounded-lg border border-dashed border-[var(--ui-border)] p-5" @dragover.prevent @drop.prevent="vertexFile = $event.dataTransfer.files?.[0] || null"><UFormField label="Service account JSON" required><input type="file" accept="application/json,.json" class="block w-full text-sm" @change="vertexFile = $event.target.files?.[0] || null" /></UFormField><p v-if="vertexFile" class="mt-2 text-xs">{{ vertexFile.name }} <AppButton size="xs" variant="ghost" @click="vertexFile = null">Remove</AppButton></p></div><UFormField label="Location"><UInput v-model="vertexLocation" class="w-full" placeholder="us-central1" /></UFormField><UAlert v-if="vertexError" color="error" variant="subtle" :description="vertexError" /><div v-if="vertexResult" class="rounded-md border border-[var(--ui-border)] p-3 text-sm"><p>Status: {{ vertexResult.status }}</p><p>Project: {{ vertexResult.project_id }}</p><p>Email: {{ vertexResult.email }}</p><p>Location: {{ vertexResult.location }}</p><p>Auth file: {{ vertexResult['auth-file'] }}</p></div><div class="flex justify-end"><AppButton type="submit" :loading="importingVertex">Import</AppButton></div></form>
        </div>
      </template>
    </AppModal>




    <USlideover v-model:open="detailsOpen" :dismissible="!savingFields && !savingPolicy && !credentialAction" :title="detailsTarget?.label || detailsTarget?.name || 'Credential details'" :description="detailsTarget?.id || ''" :ui="{ content: 'sm:max-w-xl' }">
      <template #body>
        <div v-if="detailsTarget" class="space-y-5">
          <div class="-mx-4 flex flex-wrap gap-1 border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] px-4 py-2" role="tablist" aria-label="Credential details"><AppButton v-for="section in detailSections" :key="section" role="tab" :aria-selected="detailsTab === section" size="sm" color="neutral" :variant="detailsTab === section ? 'soft' : 'ghost'" :disabled="savingFields || savingPolicy || Boolean(credentialAction)" @click="selectDetailSection(section)">{{ section }}</AppButton></div>
          <section v-if="detailsTab === 'Overview'" class="space-y-3"><div><h3 class="font-semibold">Overview</h3><p class="text-xs text-[var(--ui-text-muted)]">Credential identity, routing, and runtime state.</p></div><dl class="grid gap-3 text-sm"><div v-for="entry in overviewFields(detailsTarget)" :key="entry.label" class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"><dt class="text-xs text-[var(--ui-text-muted)]">{{ entry.label }}</dt><dd class="mt-1 break-words font-mono text-xs">{{ entry.value }}</dd></div></dl><UAlert v-if="detailsTarget.status_message" color="warning" variant="subtle" :description="detailsTarget.status_message" /></section>
          <form v-else-if="detailsTab === 'Metadata'" class="space-y-4 text-sm" @submit.prevent="saveFields"><div><h3 class="font-semibold">Metadata</h3><p class="text-xs text-[var(--ui-text-muted)]">Edit routing and credential metadata directly.</p></div>
            <fieldset :disabled="savingFields || savingPolicy || Boolean(credentialAction)" class="space-y-4">
            <p class="text-xs text-[var(--ui-text-muted)]">Only changed fields are saved. Leave optional text blank to clear it.</p>
            <div class="grid gap-3 sm:grid-cols-2"><UFormField label="Prefix"><UInput v-model="fields.prefix" class="w-full" /></UFormField><UFormField label="Proxy URL"><UInput v-model="fields.proxy_url" class="w-full" placeholder="socks5://..." /></UFormField><UFormField label="Priority"><UInput v-model="fields.priority" type="number" step="1" class="w-full" /></UFormField><UFormField label="Request retries"><UInput v-model="fields.request_retry" type="number" min="0" step="1" class="w-full" placeholder="Default" /></UFormField></div>
            <UFormField label="Weight" description="Only applies to weighted-round-robin routing. Zero excludes this credential. Unset removes the explicit weight and restores the default of 1."><div class="flex gap-2"><UInput v-model="fields.weight" :disabled="!exclusionsLoaded" type="number" step="1" max="1000000" class="w-full" placeholder="Unset (default 1)" /><AppButton type="button" size="sm" color="neutral" variant="outline" :disabled="!exclusionsLoaded" @click="fields.weight = ''">Unset</AppButton></div></UFormField>
            <UFormField label="Note"><UTextarea v-model="fields.note" class="w-full" /></UFormField>
            <AdminCredentialExcludedModels v-if="exclusionsLoaded" :key="detailsTarget.id" v-model="excludedModels" :credential-id="detailsTarget.id" :disabled="savingFields || savingPolicy || Boolean(credentialAction)" />
            <p v-if="exclusionsLoading" class="text-xs text-[var(--ui-text-muted)]">Reading stored exclusions…</p>
            <UAlert v-if="exclusionsError" color="warning" variant="subtle" :description="exclusionsError" />
            <AppButton v-if="!exclusionsLoaded && !exclusionsLoading" type="button" size="sm" variant="outline" @click="loadExclusions">Read exclusions</AppButton>
            <UCheckbox v-if="supportsWebsockets(detailsTarget || {})" v-model="fields.websockets" label="WebSockets" />
            <div v-else class="flex items-center justify-between rounded-md border border-[var(--ui-border)] p-3"><div><h4 class="font-semibold">WebSocket support</h4><p class="text-xs text-[var(--ui-text-muted)]">The current provider does not expose a WS toggle.</p></div><UBadge color="neutral" variant="subtle">N/A</UBadge></div>
            <UFormField label="Cooling override"><USelect v-model="fields.disable_cooling" :items="coolingOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
            <div class="flex items-center justify-between rounded-md border border-[var(--ui-border)] p-3"><span class="font-semibold">Enable credential</span><USwitch v-model="fields.enabled" aria-label="Enable credential" :disabled="savingFields" /></div>
            <AdminCredentialConcurrencyPolicy v-model:total="policyTotal" v-model:models="policyModels" class="border-t border-[var(--ui-border)] pt-4" :available="policySupported" :dirty="policyDirty" :policy="policy" :loading="loadingPolicy" :saving="savingFields || savingPolicy" :conflict="policyConflict" :error="policyError" @reload="loadPolicy" @add="addPolicyModel" @remove="policyModels.splice($event, 1)" />
            <UAlert v-if="fieldsError" color="error" variant="subtle" :description="fieldsError" />
            <div class="flex justify-end border-t border-[var(--ui-border)] pt-3"><AppButton type="submit" size="sm" :loading="savingFields" :disabled="savingFields || savingPolicy || Boolean(credentialAction) || (!policySupported && policyDirty) || (policySupported && (loadingPolicy || !policy || policyConflict))">Save changes</AppButton></div>
            </fieldset>
          </form>
          <section v-else-if="detailsTab === 'Quota'" class="space-y-3 text-sm"><div><h3 class="font-semibold">Quota</h3><p class="text-xs text-[var(--ui-text-muted)]">All quota windows, collection state, and reset credits.</p></div>
            <UAlert v-if="accountQuotaError" color="error" variant="subtle" :description="accountQuotaError" />
            <p v-if="accountQuotaLoading" class="py-8 text-center text-[var(--ui-text-muted)]">Loading quota windows…</p>
            <template v-else-if="accountQuotaDetail">
              <div class="flex flex-wrap items-center gap-2"><UBadge color="neutral" variant="subtle">{{ accountQuotaDetail.credential?.provider || detailsTarget?.provider || 'Unknown provider' }}</UBadge><UBadge :color="quotaColor(accountQuotaDetail.credential?.quota_status)" variant="subtle">{{ accountQuotaDetail.credential?.quota_status || 'unknown' }}</UBadge><UBadge color="neutral" variant="subtle">{{ accountQuotaDetail.collection?.freshness || 'never' }}</UBadge><UBadge v-if="accountQuotaDetail.collection?.status" color="neutral" variant="subtle">{{ accountQuotaDetail.collection.status }}</UBadge></div>
              <p v-if="accountQuotaDetail.credential?.plan?.name" class="font-medium">{{ accountQuotaDetail.credential.plan.name }}</p>
              <div v-for="window in accountQuotaDetail.windows || []" :key="window.id" class="rounded-md border border-[var(--ui-border)] p-3"><div class="flex items-start justify-between gap-3"><p class="font-medium">{{ window.label || window.id }}</p><UBadge :color="quotaColor(window.status)" variant="subtle">{{ window.status }}</UBadge></div><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ quotaWindowRemaining(window) }} · Used: {{ quotaWindowAmount(window.used, window) }} · Reset: {{ window.reset_at ? new Date(window.reset_at).toLocaleString() : '—' }}</p><div v-if="quotaWindowRatio(window) !== null" class="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ui-bg-muted)]"><div class="h-full bg-[var(--ui-primary)]" :style="{ width: `${Math.round(quotaWindowRatio(window) * 100)}%` }" /></div></div>
              <p v-if="accountQuotaDetail.collection?.error?.message" class="text-xs text-red-500">{{ quotaCollectionMessage(accountQuotaDetail.collection.error) }}</p><p v-if="!accountQuotaDetail.windows?.length" class="text-[var(--ui-text-muted)]">No quota windows recorded.</p>
              <div v-if="accountQuotaDetail.reset_credits || resetCreditSupported" class="rounded-md border border-[var(--ui-border)] p-3"><p class="font-medium">Reset credits: {{ accountQuotaDetail.reset_credits?.available_count ?? '—' }} available</p><p v-if="String(accountQuotaDetail.credential?.provider).toLowerCase() === 'claude'" class="mt-1 text-xs text-[var(--ui-text-muted)]">Remaining resets in active grants, not guaranteed redemption eligibility. Home observes Claude grants only; it cannot consume them. Individual credit expiry details are not provided.</p><p v-if="accountQuotaDetail.reset_credits?.observed_at" class="text-xs text-[var(--ui-text-muted)]">Observed {{ new Date(accountQuotaDetail.reset_credits.observed_at).toLocaleString() }}</p><p v-for="(credit, index) in accountQuotaDetail.reset_credits?.credits || []" :key="index" class="mt-1 text-xs">{{ credit.status }} · Expires {{ credit.expires_at ? new Date(credit.expires_at).toLocaleString() : '—' }}</p><AppButton v-if="resetCreditSupported" size="sm" color="neutral" variant="outline" class="mt-3" :disabled="!canResetCredit || resetCreditSubmitting || Boolean(resetCreditAttempts[detailsTarget?.id])" @click="openResetCredit">Reset Codex quota with one credit</AppButton><p v-if="resetCreditDisabledReason" class="mt-2 text-xs text-[var(--ui-text-muted)]">{{ resetCreditDisabledReason }}</p></div>
            </template>
            <UAlert v-if="resetCreditNotice && resetCreditNoticeCredential === detailsTarget?.id" :color="resetCreditNoticeColor" variant="subtle" :description="resetCreditNotice" />
            <p role="status" class="text-xs text-[var(--ui-text-muted)]">{{ accountQuotaCollecting ? 'Waiting for a newer settled quota collection result…' : accountQuotaNotice || 'Collection is tracked for up to 30 polls; Home may continue after tracking ends.' }}</p>
            <div class="flex flex-wrap justify-end gap-2 border-t border-[var(--ui-border)] pt-3"><AppButton size="sm" color="neutral" variant="outline" :loading="accountQuotaLoading" @click="refreshAccountQuota">Refresh</AppButton><AppButton size="sm" color="neutral" variant="outline" :loading="accountQuotaCollecting" @click="collectAccountQuota">Collect now</AppButton></div>
          </section>
          <section v-else-if="detailsTab === 'Concurrency'" class="space-y-5 text-sm"><div><h3 class="font-semibold">Concurrency</h3><p class="text-xs text-[var(--ui-text-muted)]">Policy, admitted state, and observed requests.</p></div>
            <UAlert v-if="policyError || concurrencyError" color="error" variant="subtle" :description="policyError || concurrencyError" />
            <AdminCredentialConcurrencyPolicy v-model:total="policyTotal" v-model:models="policyModels" :available="policySupported" :dirty="policyDirty" :policy="policy" :loading="loadingPolicy" :saving="savingFields || savingPolicy" :conflict="policyConflict" :error="policyError" show-save @reload="loadPolicy" @save="savePolicy" @add="addPolicyModel" @remove="policyModels.splice($event, 1)" />
            <p v-if="!snapshotsSupported" class="text-[var(--ui-text-muted)]">In-flight snapshots are unavailable on this deployment.</p>
            <section class="space-y-3 border-t border-[var(--ui-border)] pt-4"><div class="flex items-center justify-between gap-2"><div><h3 class="font-semibold">Current concurrency</h3><p class="text-xs text-[var(--ui-text-muted)]">Admitted state and observed in-flight requests.</p></div><AppButton size="sm" color="neutral" variant="outline" :loading="loadingConcurrency" @click="loadConcurrency()">Refresh</AppButton></div><div v-if="concurrencyState" class="space-y-2"><p>Admitted: <strong>{{ concurrencyState.admitted_in_flight }}</strong> / {{ concurrencyState.max_in_flight ?? '∞' }} <UBadge v-if="concurrencyState.total_saturated" color="warning" variant="subtle">Saturated</UBadge></p><p class="text-xs text-[var(--ui-text-muted)]">Remaining: {{ concurrencyState.remaining ?? 'unlimited' }} · Policy version: {{ concurrencyState.policy_version }} · Fully enforced: {{ concurrencyState.fully_enforced }}</p><div v-for="model in concurrencyState.models || []" :key="model.model" class="rounded-md border border-[var(--ui-border)] p-3"><span class="font-medium">{{ model.model }}</span> · {{ model.admitted_in_flight }} / {{ model.max_in_flight }} <UBadge v-if="model.saturated" color="warning" variant="subtle">Saturated</UBadge></div></div><p v-if="flightDetails?.stale || flightDetails?.details_truncated || flightDetails?.coverage_complete === false" class="text-xs text-amber-500">Observation may be stale or incomplete.</p><p v-if="flightDetails?.observed_at" class="text-xs text-[var(--ui-text-muted)]">Observed at {{ flightDetails.observed_at }} · {{ flightDetails.total }} request(s)</p><div v-for="request in flightDetails?.items || []" :key="request.request_id" class="rounded-md border border-[var(--ui-border)] p-3"><p class="break-all font-mono text-xs">{{ request.request_id }}</p><p>{{ request.model || 'Unknown model' }} · {{ request.request_kind || 'request' }}</p><p class="text-xs text-[var(--ui-text-muted)]">Started {{ request.started_at }}</p></div><p v-if="snapshotsSupported && !loadingConcurrency && !flightDetails?.items?.length" class="text-[var(--ui-text-muted)]">No observed requests.</p><AppButton v-if="flightDetails?.next_offset != null" color="neutral" variant="outline" :loading="loadingConcurrency" @click="loadConcurrency(flightDetails.next_offset)">Load more</AppButton></section>
          </section>
          <section v-else-if="detailsTab === 'Models'" class="space-y-3 text-sm">
            <div class="flex items-center justify-between gap-2"><div><h3 class="font-semibold">Models</h3><p class="text-xs text-[var(--ui-text-muted)]">Models exposed by this credential and runtime-only history.</p></div><AppButton size="sm" color="neutral" variant="outline" :loading="modelsLoading" @click="loadModels(detailsTarget, true)">Refresh</AppButton></div>
            <UAlert v-if="modelsError" color="error" variant="subtle" :description="modelsError" />
            <UAlert v-if="modelStatesNotice" color="warning" variant="subtle" :description="modelStatesNotice" />
            <p v-if="modelsLoading" class="py-8 text-center text-[var(--ui-text-muted)]">Loading models…</p>
            <template v-else>
              <div v-if="modelStates?.credential" class="space-y-2"><p class="text-xs text-[var(--ui-text-muted)]">Runtime node {{ modelStates.node?.ip }}:{{ modelStates.node?.port }} · Observed {{ modelStates.observed_at }} · State version {{ modelStates.credential.state_version }}</p><p>Status: {{ modelStates.credential.status }} · Unavailable: {{ modelStates.credential.unavailable }} · Refresh blocked: {{ modelStates.credential.refresh_blocked }}</p><p v-if="modelStates.credential.status_message">{{ modelStates.credential.status_message }}</p></div>
              <USelect v-model="modelScope" aria-label="Model scope" :items="modelScopeOptions" value-key="value" label-key="label" class="w-full" />
              <div v-for="model in scopedModelCards" :key="model.id" class="rounded-md border border-[var(--ui-border)] p-3">
                <p class="font-medium">{{ model.display_name || model.id }}</p>
                <p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ model.id }}</p>
                <div v-for="state in model.diagnostics" :key="JSON.stringify([state.upstream_model, state.state_key])" class="mt-2 space-y-1">
                  <p class="font-mono text-xs">Upstream {{ state.upstream_model }} · State {{ state.state_key }}</p>
                  <p class="text-xs text-[var(--ui-text-muted)]">{{ state.status }} · {{ state.blocked ? state.block_reason : 'Not blocked' }} · Registered: {{ state.registered }}</p>
                  <p v-if="state.remaining_cooldown || state.next_retry_after" class="text-xs">Cooldown {{ state.remaining_cooldown || '—' }} · Retry {{ state.next_retry_after || '—' }}</p>
                  <p v-if="state.status_message || state.last_error?.message" class="text-xs">{{ state.status_message || state.last_error?.message }}</p>
                </div>
              </div>
              <p v-if="!scopedModelCards.length" class="py-6 text-center text-[var(--ui-text-muted)]">No models found.</p>
            </template>
          </section>
          <section v-else-if="detailsTab === 'Recovery'" class="space-y-3"><h3 class="font-semibold">Credential recovery</h3><p class="text-xs text-[var(--ui-text-muted)]">OAuth refresh updates tokens. Cooldown reset clears quota cooldowns only; it does not redeem credits or clear unrelated errors.</p><UAlert v-if="actionError" color="warning" variant="subtle" :description="actionError" /><div class="flex flex-wrap gap-2"><AppButton v-if="refreshAvailable" size="sm" variant="outline" :disabled="busy || Boolean(credentialAction)" :loading="credentialAction === 'refresh'" @click="runCredentialAction('refresh')">Refresh OAuth credential</AppButton><AppButton v-if="supports('credential_cooldown_reset', false) && cooldownAvailable" size="sm" color="warning" variant="outline" :disabled="busy || Boolean(credentialAction)" :loading="credentialAction === 'cooldown'" @click="runCredentialAction('cooldown')">Reset quota cooldown</AppButton></div><p v-if="!supports('credential_cooldown_reset', false) || !cooldownAvailable" class="text-xs text-[var(--ui-text-muted)]">Cooldown reset is unavailable on this deployment.</p></section>
          <section v-else class="space-y-3"><div><h3 class="font-semibold text-red-600 dark:text-red-400">Danger zone</h3><p class="text-xs text-[var(--ui-text-muted)]">Download a backup or permanently remove this credential.</p></div><div class="flex flex-wrap gap-2"><AppButton size="sm" color="neutral" variant="outline" @click="downloadCredential(detailsTarget)">Download credential</AppButton><AppButton size="sm" color="error" variant="outline" @click="confirmDelete(detailsTarget)">Delete credential</AppButton></div></section>
        </div>
      </template>
    </USlideover>

    <AppModal v-model:open="resetCreditOpen" :dismissible="false" title="Reset Codex quota" description="Confirm the credit redemption for this credential." @update:open="handleResetCreditOpen">
      <template #body>
        <div class="space-y-4">
          <UAlert color="info" variant="subtle" title="This consumes one reset credit" :description="`Resetting ${resetCreditTarget?.label || resetCreditTarget?.name || resetCreditTarget?.id || 'this credential'} uses one available credit. This action cannot be undone.`" />
          <UAlert v-if="resetCreditError" color="error" variant="subtle" :description="resetCreditError" />
          <div class="flex justify-end gap-2"><AppButton color="neutral" variant="ghost" :disabled="resetCreditSubmitting" @click="resetCreditOpen = false">Cancel</AppButton><AppButton color="primary" :loading="resetCreditSubmitting" :disabled="!canConfirmResetCredit" @click="redeemResetCredit">Consume one credit</AppButton></div>
        </div>
      </template>
    </AppModal>

    <AppModal v-model:open="connectivityOpen" :dismissible="false" title="Test credential connectivity" description="Home sends a GET request using the selected credential for proxy selection and $TOKEN$ replacement.">
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
          <div class="flex justify-end gap-2"><AppButton type="button" color="neutral" variant="ghost" @click="connectivityOpen = false">Close</AppButton><AppButton type="submit" :loading="testingConnectivity">Run test</AppButton></div>
        </form>
      </template>
    </AppModal>



    <AppModal v-model:open="bulkDeleteOpen" :dismissible="false" title="Delete selected credentials"><template #body><div class="space-y-5"><UAlert color="warning" variant="subtle" title="Delete selected credentials?" :description="`${selectedIDs.size} credential(s) will be removed. This cannot be undone.`"/><div class="flex justify-end gap-3"><AppButton color="neutral" variant="ghost" :disabled="bulkBusy" @click="bulkDeleteOpen = false">Cancel</AppButton><AppButton color="error" :loading="bulkBusy" :disabled="!selectedIDs.size" @click="bulkDelete">Delete {{ selectedIDs.size }}</AppButton></div></div></template></AppModal>
    <AppModal v-model:open="deleteOpen" :dismissible="false" title="Delete credential"><template #body><div class="space-y-5"><UAlert color="warning" variant="subtle" title="This credential will be removed" :description="deleteTarget?.label || deleteTarget?.name || deleteTarget?.id"/><div class="flex justify-end gap-3"><AppButton color="neutral" variant="ghost" @click="deleteOpen = false">Cancel</AppButton><AppButton color="error" :loading="deleting" :disabled="bulkBusy" @click="deleteCredential">Delete</AppButton></div></div></template></AppModal>
  </div>
</template>

<script setup>
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useStoreData } from '~/composables/useStoreData'
import { credentialModelCards, normalizeCredentialModels } from '~/composables/credentialModelCards'
import { quotaDisplayWindows, quotaWindowAmount, quotaCollectionMessage, credentialWeightPatch } from '~/composables/upstreamQuota'
import { useQuotaCollection } from '~/composables/useQuotaCollection'
const quotaCollection = useQuotaCollection()
const props = defineProps({ attentionRequest: { type: Number, default: 0 }, syncRequest: { type: Number, default: 0 } })
const { fetchAPI, resolveUrl, token } = useApi()
const { supports } = useCapabilities()
const toast = useToast()
const value = row => row?.original ?? row
const credentialIdentifier = item => String(item?.name || item?.auth_index || item?.id || '')
function compactIdentifier(value, maxLength = 42) {
  const text = String(value || '')
  if (text.length <= maxLength) return text
  const suffixLength = 18
  return `${text.slice(0, maxLength - suffixLength - 1)}…${text.slice(-suffixLength)}`
}
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
const pageError = useWorkspaceState('admin:upstream-accounts:pageError', () => (''))
const uploading = useWorkspaceState('admin:upstream-accounts:uploading', () => (false))
const uploadResults = useWorkspaceState('admin:upstream-accounts:uploadResults', () => ([]))
const failedUploads = computed(() => uploadResults.value.filter(result => result.status === 'error'))
const uploadActive = computed(() => uploadResults.value.some(result => result.status === 'queued' || result.status === 'uploading'))
let uploadID = 0
const changing = useWorkspaceState('admin:upstream-accounts:changing', () => (''))
const inlineChanging = useWorkspaceState('admin:upstream-accounts:inlineChanging', () => (''))
const busy = computed(() => bulkBusy.value || deleting.value || Boolean(changing.value) || Boolean(inlineChanging.value) || savingFields.value || savingPolicy.value)
const detailsOpen = ref(false)
const detailsTarget = ref(null)
const detailsTab = ref('Overview')
const detailSections = ['Overview', 'Metadata', 'Quota', 'Concurrency', 'Models', 'Recovery', 'Danger']
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
    ['Priority', item.priority], ['Weight', item.weight ?? 'Unset (default 1)'], ['Request retries', item['request-retry']],
    ['WebSockets', supportsWebsockets(item) ? (item.websockets ? 'Enabled' : 'Disabled') : 'N/A'],
    ['Cooling', item['disable-cooling'] ? 'Disabled' : 'Enabled'],
    ['Path', item.path], ['Size', item.size], ['Updated at', item.mod_time || item.updated_at],
    ['Last refresh', item.last_refresh], ['Note', item.note],
    ['Quota status', quotaByID.value.get(item.id)?.quota_status]
  ].map(([label, value]) => ({ label, value: value == null || value === '' ? fallback : String(value) }))
}
const accountQuotaTarget = computed(() => detailsTarget.value)
const accountQuotaDetail = useWorkspaceState('admin:upstream-accounts:accountQuotaDetail', () => (null))
const accountQuotaError = useWorkspaceState('admin:upstream-accounts:accountQuotaError', () => (''))
const accountQuotaLoading = useWorkspaceState('admin:upstream-accounts:accountQuotaLoading', () => (false))
const accountQuotaCollecting = computed(() => quotaCollection.collectingAll.value || quotaCollection.collectingIDs.value.has(detailsTarget.value?.id))
const accountQuotaNotice = ref('')
const resetCreditOpen = ref(false)
const resetCreditTarget = ref(null)
const resetCreditAttempts = useWorkspaceState('admin:upstream-accounts:resetCreditAttempts', () => ({}))
const resetCreditAttempt = computed(() => resetCreditAttempts.value[resetCreditTarget.value?.id] || null)
const resetCreditSubmitting = useWorkspaceState('admin:upstream-accounts:resetCreditSubmitting', () => (false))
const resetCreditError = ref('')
const resetCreditNotice = ref('')
const resetCreditNoticeColor = ref('success')
const resetCreditNoticeCredential = ref('')
const resetCreditSupported = computed(() => supports('codex_reset_credit_consume', false) &&
  String(accountQuotaDetail.value?.credential?.provider || detailsTarget.value?.provider || '').toLowerCase() === 'codex')
const canResetCredit = computed(() => resetCreditSupported.value &&
  Number(accountQuotaDetail.value?.reset_credits?.available_count) > 0)
const resetCreditDisabledReason = computed(() => {
  if (!resetCreditSupported.value) return ''
  const detail = accountQuotaDetail.value
  if (resetCreditAttempts.value[detailsTarget.value?.id]) return 'A previous reset request may already have consumed a credit. Refresh quota before trying again.'
  if (!detail?.reset_credits || detail.reset_credits.available_count == null) return 'Reset-credit availability has not been reported yet.'
  if (Number(detail.reset_credits.available_count) <= 0) return 'No reset credits are currently available.'
  return ''
})
const canConfirmResetCredit = computed(() => !resetCreditSubmitting.value && !accountQuotaLoading.value &&
  !resetCreditAttempts.value[resetCreditTarget.value?.id] && resetCreditTarget.value?.id === detailsTarget.value?.id && canResetCredit.value)

const connectivityOpen = ref(false)
const connectivityTarget = ref(null)
const connectivityURL = ref('')
const connectivityError = useWorkspaceState('admin:upstream-accounts:connectivityError', () => (''))
const connectivityResult = useWorkspaceState('admin:upstream-accounts:connectivityResult', () => (null))
const testingConnectivity = useWorkspaceState('admin:upstream-accounts:testingConnectivity', () => (false))
const connectivityBody = computed(() => {
  const body = connectivityResult.value?.body || ''
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
})
const modelsError = ref('')
const modelsLoading = ref(false)
const credentialModels = ref([])

const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleting = useWorkspaceState('admin:upstream-accounts:deleting', () => (false))
const selectedIDs = ref(new Set())
const bulkBusy = useWorkspaceState('admin:upstream-accounts:bulkBusy', () => (false))
const bulkAction = ref('')
const bulkDeleteOpen = ref(false)
const fieldsTarget = computed(() => detailsTarget.value)
const fields = reactive({ prefix: '', proxy_url: '', priority: '', weight: '', request_retry: '', note: '', websockets: false, disable_cooling: 'inherit', enabled: true })
const excludedModels = ref('')
const originalExcludedModels = ref('')
const exclusionsLoaded = ref(false)
const exclusionsLoading = ref(false)
const exclusionsError = ref('')
const policyAvailable = ref(true)
const snapshotsAvailable = ref(true)
const policySupported = computed(() => supports('credential_concurrency_limits_v2', false) && policyAvailable.value)
const snapshotsSupported = computed(() => supports('credential_in_flight_snapshots', false) && snapshotsAvailable.value)
const modelStates = ref(null)
const modelStatesNotice = ref('')
const modelCards = computed(() => credentialModelCards(credentialModels.value, modelStates.value?.credential?.models || []))
const modelScope = ref('all')
const modelScopeOptions = [{ label: 'All routes and history', value: 'all' }, { label: 'Currently exposed routes', value: 'registered' }, { label: 'Runtime-only history', value: 'history' }]
const scopedModelCards = computed(() => {
  const registered = new Set(credentialModels.value.map(model => model.id))
  return modelCards.value.filter(model => modelScope.value === 'all' || (modelScope.value === 'registered' ? registered.has(model.id) : !registered.has(model.id)))
})
const credentialAction = ref('')
const actionError = ref('')
const refreshAvailable = ref(true)
const cooldownAvailable = ref(true)
let detailGeneration = 0
let modelsRequest = 0
watch(detailsOpen, open => {
  if (!open) { detailGeneration++; policyRequest++; concurrencyRequest++; modelsRequest++; loadingPolicy.value = false; loadingConcurrency.value = false; modelsLoading.value = false; exclusionsLoading.value = false; policy.value = null }
})
onBeforeUnmount(() => { detailGeneration++; policyRequest++; concurrencyRequest++; modelsRequest++ })
watch(token, () => { detailGeneration++; detailsOpen.value = false; accountQuotaNotice.value = '' }, { flush: 'sync' })
const unavailable = error => [404, 405, 501].includes(error?.statusCode)
const ownsDetails = (id, generation) => detailsOpen.value && detailsTarget.value?.id === id && detailGeneration === generation
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
const policyDraft = () => JSON.stringify([String(policyTotal.value), policyModels.value.map(({ model, limit }) => [model, String(limit)])])
const originalPolicyDraft = ref(policyDraft())
const policyDirty = computed(() => policyDraft() !== originalPolicyDraft.value)
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
const vertexResult = useWorkspaceState('admin:upstream-accounts:vertexResult', () => (null))
const vertexLocation = ref('us-central1')
const vertexError = ref('')
const importingVertex = useWorkspaceState('admin:upstream-accounts:importingVertex', () => (false))

const oauthError = useWorkspaceState('admin:upstream-accounts:oauthError', () => (''))
const startingOAuth = useWorkspaceState('admin:upstream-accounts:startingOAuth', () => (''))
const oauthSessions = useWorkspaceState('admin:upstream-accounts:oauthSessions', () => ({}))
const checkingOAuth = useWorkspaceState('admin:upstream-accounts:checkingOAuth', () => (''))
let oauthGeneration = 0
function stopOAuthPolling() { oauthGeneration++ }
onBeforeUnmount(stopOAuthPolling)

const submittingCallback = useWorkspaceState('admin:upstream-accounts:submittingCallback', () => (''))
const oauthProviders = [
  { label: 'Claude', value: 'claude' }, { label: 'Codex', value: 'codex' },
  { label: 'Antigravity', value: 'antigravity' }, { label: 'Kimi', value: 'kimi' },
  { label: 'xAI', value: 'xai' }, { label: 'Devin', value: 'devin' }, { label: 'Meta', value: 'meta' }
]
const credentialRoute = suffix => `/credentials${suffix}`
function handleCreateOpen(open) {
  if (!open && uploadActive.value) { nextTick(() => { createOpen.value = true }); return }
  if (!open) { stopOAuthPolling(); oauthSessions.value = {}; uploadResults.value = []; if (fileInput.value) fileInput.value.value = '' }
}

const columns = [{ id: 'select', header: '' }, { accessorKey: 'identity', header: 'Credential' }, { accessorKey: 'provider', header: 'Provider' }, { accessorKey: 'status', header: 'Enabled' }, { accessorKey: 'quota', header: 'Quota / reset' }, { accessorKey: 'websockets', header: 'WS' }, { accessorKey: 'cooling', header: 'Cooling' }, { accessorKey: 'priority', header: 'Priority' }, { id: 'actions', header: 'Actions', meta: { class: { th: 'w-px whitespace-nowrap text-right', td: 'w-px whitespace-nowrap text-right' } } }]

const flightError = useWorkspaceState('admin:upstream-accounts:flightError', () => (''))
async function loadData() {
  pageError.value = ''
  try {
    return await fetchAPI(credentialRoute(''))
  } catch (error) {
    pageError.value = message(error)
    return { files: [] }
  }
}
const { data: authData, pending, refresh: refreshCredentialsData } = useStoreData('admin:upstream-accounts:management-credentials', loadData, { lazy: true, default: () => ({ files: [] }) })
let flightRequest = 0
onBeforeUnmount(() => { flightRequest++ })
async function loadFlight() {
  const requestID = ++flightRequest
  const requestToken = token.value
  flightError.value = ''
  if (!snapshotsSupported.value) return { items: [] }
  try { return await fetchAPI('/credentials/in-flight/summary') }
  catch (error) {
    if (requestID === flightRequest && requestToken === token.value && snapshotsSupported.value) {
      if (unavailable(error)) snapshotsAvailable.value = false
      flightError.value = unavailable(error) ? 'In-flight snapshots are unavailable on this deployment.' : message(error)
    }
    return { items: [] }
  }
}
const { data: flightData, refresh: refreshFlightData } = useStoreData('admin:upstream-accounts:management-credentials-flight', loadFlight, { lazy: true, default: () => ({ items: [] }), watch: [snapshotsSupported] })
async function refreshData(notify = true) {
  try {
    await refreshCredentialsData()
    void refreshFlightData()
    void refreshQuotaSummary()
    if (notify) emit('changed')
  } finally { selectedIDs.value = new Set() }
}
watch(() => props.syncRequest, () => { void refreshData(false) })
const credentials = computed(() => {
  const data = authData.value
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.files)) return data.files
  if (Array.isArray(data?.credentials)) return data.credentials
  return Array.isArray(data?.items) ? data.items : []
})
const credentialIDs = computed(() => credentials.value.map(item => item.id).filter(Boolean).join(','))
const quotaError = useWorkspaceState('admin:upstream-accounts:quotaError', () => (''))
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
const { data: quotaSummary, pending: quotaPending, refresh: refreshQuotaSummary } = useStoreData('admin:upstream-accounts:management-account-quota', loadQuotaSummary, { lazy: true, default: () => [], watch: [credentialIDs] })
const quotaByID = computed(() => new Map((quotaSummary.value || []).map(item => [item.credential_id, item])))
function quotaColor(status) { return status === 'healthy' || status === 'available' ? 'success' : status === 'low' ? 'warning' : status === 'exhausted' || status === 'error' ? 'error' : 'neutral' }
function quotaWindowRatio(window) {
  const ratio = Number(window.remaining_ratio)
  return window.remaining_ratio == null || !Number.isFinite(ratio) ? null : Math.max(0, Math.min(1, ratio))
}
function quotaWindowRemaining(window) {
  if (window.is_unlimited) return 'Unlimited'
  if (window.remaining != null) return `${quotaWindowAmount(window.remaining, window)}${window.limit != null ? ` / ${quotaWindowAmount(window.limit, window)}` : ''} remaining`
  const ratio = quotaWindowRatio(window)
  return ratio == null ? '—' : `${Math.round(ratio * 100)}% remaining`
}
async function openAccountQuota(item) {
  await showDetails(item, 'Quota')
}
async function refreshAccountQuota() {
  if (!accountQuotaTarget.value) return
  const id = accountQuotaTarget.value.id
  const generation = detailGeneration
  const session = token.value
  const current = () => token.value === session && ownsDetails(id, generation)
  accountQuotaLoading.value = true
  accountQuotaError.value = ''
  try {
    const detail = await fetchAPI(`/quota/credentials/${encodeURIComponent(id)}`)
    if (current()) accountQuotaDetail.value = detail
    await refreshQuotaSummary()
  } catch (error) { if (current()) accountQuotaError.value = message(error) }
  finally { if (current()) accountQuotaLoading.value = false }
}
function openResetCredit() {
  if (!canResetCredit.value || !detailsTarget.value?.id || resetCreditSubmitting.value || resetCreditAttempts.value[detailsTarget.value.id]) return
  resetCreditTarget.value = detailsTarget.value
  resetCreditError.value = ''
  resetCreditOpen.value = true
}
function handleResetCreditOpen(open) {
  if (!open && resetCreditSubmitting.value) nextTick(() => { resetCreditOpen.value = true })
}
async function redeemResetCredit() {
  if (!canConfirmResetCredit.value) return
  const id = resetCreditTarget.value.id
  resetCreditSubmitting.value = true
  resetCreditError.value = ''
  resetCreditNotice.value = ''
  try {
    if (!resetCreditAttempt.value) {
      resetCreditAttempts.value = { ...resetCreditAttempts.value, [id]: { credentialId: id, id: crypto.randomUUID() } }
    }
    const result = await fetchAPI(`/quota/credentials/${encodeURIComponent(id)}/reset-credits/consume`, {
      method: 'POST', body: { idempotency_key: resetCreditAttempt.value.id }
    })
    resetCreditAttempts.value = Object.fromEntries(Object.entries(resetCreditAttempts.value).filter(([credentialId]) => credentialId !== id))
    resetCreditOpen.value = false
    resetCreditNoticeCredential.value = id
    resetCreditNoticeColor.value = 'success'
    resetCreditNotice.value = result?.outcome === 'alreadyRedeemed' ? 'This reset credit was already redeemed.' : 'Codex accepted the reset. Recollecting quota in the background.'
    toast.add({ title: 'Reset credit request completed', description: resetCreditNotice.value, color: 'success' })
    if (detailsTarget.value?.id === id) accountQuotaDetail.value = null
    await collectAccountQuota()
    if (detailsTarget.value?.id === id) await refreshAccountQuota()
  } catch (error) {
    resetCreditError.value = resetCreditAttempt.value
      ? `${message(error)}. The request may have consumed a credit. Check Codex quota before trying again; this session will not submit a second reset for this credential.`
      : message(error)
  } finally { resetCreditSubmitting.value = false }
}
watch(quotaCollection.revision, () => { void refreshQuotaSummary() })
watch(() => quotaCollection.details.value[detailsTarget.value?.id], detail => {
  if (detailsOpen.value && detail) accountQuotaDetail.value = detail
})
async function collectAccountQuota() {
  if (!accountQuotaTarget.value || accountQuotaCollecting.value) return
  const id = accountQuotaTarget.value.id
  const generation = detailGeneration
  const session = token.value
  accountQuotaError.value = ''; accountQuotaNotice.value = ''
  const result = await quotaCollection.collect(id)
  if (session !== token.value || !ownsDetails(id, generation) || !result) return
  accountQuotaNotice.value = result.completion === 'pending' ? 'Collection remains unconfirmed. Home may still be working; refresh later.' : result.completion === 'settled' ? 'A newer collection result is available. Inspect its status and any errors above.' : 'No new collection was queued.'
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
  await runBulk(disabled ? 'Disable' : 'Enable', items, item => fetchAPI(credentialRoute('/status'), { method: 'PATCH', body: { name: item.id, disabled } }))
}
async function bulkDelete() {
  if (!selectedIDs.value.size || bulkBusy.value) return
  const items = credentials.value.filter(item => selectedIDs.value.has(item.id))
  bulkDeleteOpen.value = false
  await runBulk('Delete', items, item => fetchAPI(`${credentialRoute('')}?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }))
}

function supportsWebsockets(item) { return ['codex', 'xai'].includes(String(item.provider || '').toLowerCase()) }
async function setInlineField(item, field, nextValue) {
  if (!item.id || busy.value) return
  inlineChanging.value = item.id
  try {
    await fetchAPI(credentialRoute('/fields'), { method: 'PATCH', body: { id: item.id, [field]: nextValue } })
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
    xhr.open('POST', resolveUrl(credentialRoute('')))
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
async function toggleStatus(item) { changing.value = item.id; try { await fetchAPI(credentialRoute('/status'), { method: 'PATCH', body: { name: item.id, disabled: !item.disabled } }); await refreshData() } catch (error) { toast.add({ title: 'Status update failed', description: message(error), color: 'error' }) } finally { changing.value = '' } }
async function showDetails(item, section = 'Overview') {
  if (savingFields.value || savingPolicy.value || credentialAction.value) return
  detailGeneration++
  policyRequest++; concurrencyRequest++; modelsRequest++
  loadingPolicy.value = false; loadingConcurrency.value = false; modelsLoading.value = false
  exclusionsLoaded.value = false; exclusionsLoading.value = false; exclusionsError.value = ''
  excludedModels.value = ''; originalExcludedModels.value = ''
  policyConflict.value = false; policyTotal.value = ''; policyModels.value = []
  originalPolicyDraft.value = policyDraft()
  modelStates.value = null; modelStatesNotice.value = ''; actionError.value = ''
  detailsTarget.value = item

  initializeFields(item)
  detailsTab.value = section
  accountQuotaDetail.value = null
  accountQuotaError.value = ''; accountQuotaNotice.value = ''
  policy.value = null
  policyError.value = ''
  concurrencyState.value = null
  flightDetails.value = null
  credentialModels.value = []
  modelScope.value = 'all'
  modelsError.value = ''
  detailsOpen.value = true
  await selectDetailSection(section)
}
async function selectDetailSection(section) {
  if (savingFields.value || savingPolicy.value || credentialAction.value) return
  detailsTab.value = section
  if (section === 'Metadata') await Promise.all([loadExclusions(), policy.value ? Promise.resolve() : loadPolicy()])
  if (section === 'Quota') await refreshAccountQuota()
  if (section === 'Concurrency') {
    concurrencyError.value = ''
    await Promise.all([policy.value ? Promise.resolve() : loadPolicy(), loadConcurrency()])
  }
  if (section === 'Models') await loadModels(detailsTarget.value)
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
    connectivityResult.value = await fetchAPI('/requests/api-call', {
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
    weight: item.weight == null ? '' : String(item.weight),
        priority: item.priority == null ? '' : String(item.priority), request_retry: item['request-retry'] == null ? '' : String(item['request-retry']),
    note: item.note || '', websockets: Boolean(item.websockets), disable_cooling: item['disable-cooling'] == null ? 'inherit' : item['disable-cooling'] ? 'disable' : 'enable', enabled: !item.disabled
  })
  originalFields.value = { ...fields }
}
async function loadExclusions() {
  if (!detailsTarget.value || exclusionsLoaded.value || exclusionsLoading.value) return
  const id = detailsTarget.value.id
  const generation = detailGeneration
  exclusionsLoading.value = true; exclusionsError.value = ''
  try {
    // The list response omits exclusions; read metadata without displaying or retaining tokens.
    const metadata = await fetchAPI(credentialRoute('/download'), { query: { id } })
    if (!ownsDetails(id, generation)) return
    if (fields.weight === originalFields.value.weight) {
      fields.weight = metadata.weight == null ? '' : String(metadata.weight)
      originalFields.value.weight = fields.weight
    }
    const models = metadata.excluded_models ?? metadata['excluded-models'] ?? []
    if (!Array.isArray(models) || models.some(model => typeof model !== 'string')) throw new Error('Stored exclusions are not a string array. Download the credential to inspect them.')
    excludedModels.value = JSON.stringify(models, null, 2)
    originalExcludedModels.value = excludedModels.value
    exclusionsLoaded.value = true
  } catch (error) { if (ownsDetails(id, generation)) exclusionsError.value = message(error) }
  finally { if (ownsDetails(id, generation)) exclusionsLoading.value = false }
}
function addPolicyModel() {
  if (!savingFields.value && !savingPolicy.value && !policyConflict.value) policyModels.value.push({ key: ++modelKey, model: '', limit: '' })
}
function canonicalPolicyModel(raw) {
  // Match Home's limiter key normalization, including recognized reasoning suffixes.
  const trim = value => value.replace(/^[ \t\r\n\v\f]+|[ \t\r\n\v\f]+$/g, '')
  let model = trim(raw).toLowerCase()
  const suffix = model.match(/\(([^()]*)\)$/)
  if (suffix && (['-1', 'none', 'auto', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(suffix[1]) || (/^\d{1,10}$/.test(suffix[1]) && Number(suffix[1]) <= 2147483647))) {
    const base = trim(model.slice(0, suffix.index))
    if (base) model = base
  }
  if (!model || new TextEncoder().encode(model).length > 256 || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(model)) throw new Error('Model IDs must be valid UTF-8 and at most 256 bytes after normalization.')
  return model
}
function policyPatch() {
  if (!policySupported.value) {
    if (policyDirty.value) throw new Error('Concurrency policy is unavailable. Unsaved limits were retained; metadata cannot be saved without them.')
    return {}
  }
  if (loadingPolicy.value || !policy.value || policy.value.credential_id !== detailsTarget.value?.id) throw new Error('Load the credential policy before saving.')
  if (policyConflict.value) throw new Error('Policy changed elsewhere. Reload before saving.')
  const total = policyLimit(policyTotal.value)
  const models = Object.create(null)
  const seen = new Set()
  for (const entry of policyModels.value) {
    if (!entry.model.trim()) throw new Error('Enter a model ID or remove the empty row.')
    const model = canonicalPolicyModel(entry.model)
    if (seen.has(model)) throw new Error(`Duplicate model: ${model}`)
    seen.add(model)
    const limit = policyLimit(entry.limit)
    if (limit) models[model] = limit
  }
  const body = {}
  if (total !== (policy.value.max_in_flight ?? null)) body.max_in_flight = total
  if (JSON.stringify(Object.entries(models).sort()) !== JSON.stringify(Object.entries(policy.value.max_in_flight_by_model || {}).sort())) body.max_in_flight_by_model = models
  if (Object.keys(body).length) body.version = policy.value.version
  return body
}
async function saveFields() {
  if (!fieldsTarget.value || savingFields.value || savingPolicy.value || credentialAction.value) return
  const generation = detailGeneration
  const body = { id: fieldsTarget.value.id }
  for (const key of Object.keys(fields)) {
    if (fields[key] === originalFields.value[key]) continue
    if (key === 'weight') {
      try {
        body.weight = credentialWeightPatch(fields.weight, String(fields.weight).trim() === '')

      } catch (error) { fieldsError.value = message(error); return }
    } else if (key === 'priority' || key === 'request_retry') {
      const raw = String(fields[key]).trim()
      if (raw && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))) { fieldsError.value = `${key} must be a non-negative integer.`; return }
      body[key] = raw ? Number(raw) : null
    } else if (key === 'disable_cooling') body['disable-cooling'] = fields[key] === 'inherit' ? null : fields[key] === 'disable'
    else if (key === 'enabled') body.disabled = !fields.enabled
    else body[key] = fields[key]
  }
  try {
    if (exclusionsLoaded.value && excludedModels.value !== originalExcludedModels.value) {
      const models = excludedModels.value.trim() ? JSON.parse(excludedModels.value) : []
      if (!Array.isArray(models) || models.some(model => typeof model !== 'string')) throw new Error('Excluded models must be a JSON array of strings.')
      body.excluded_models = models
    }
    Object.assign(body, policyPatch())
  } catch (error) { fieldsError.value = message(error); return }
  if (Object.keys(body).length === 1) return
  savingFields.value = true; fieldsError.value = ''
  try {
    await fetchAPI(credentialRoute('/fields'), { method: 'PATCH', body })
    await refreshData()
    const updated = credentials.value.find(item => item.id === body.id)
    if (ownsDetails(body.id, generation)) {
      if (updated) {
        detailsTarget.value = updated; initializeFields(updated)
        // Older list responses omit weight; retain the value just persisted by this form.
        if (body.weight != null && updated.weight == null) { fields.weight = String(body.weight); originalFields.value.weight = fields.weight }
      }
      if (body.excluded_models) { excludedModels.value = JSON.stringify(body.excluded_models, null, 2); originalExcludedModels.value = excludedModels.value }
      if (body.version != null) { policy.value = null; await loadPolicy(true) }
    }
    toast.add({ title: 'Credential fields updated', color: 'success' })
  } catch (error) {
    if (ownsDetails(body.id, generation)) {
      policyConflict.value = error?.statusCode === 409
      fieldsError.value = policyConflict.value ? 'Policy changed elsewhere. Reload before saving; no metadata or policy changes were applied.' : message(error)
    }
  }
  finally { savingFields.value = false }
}

async function loadPolicy(internal = false) {
  if (!policyTarget.value || !policySupported.value || savingPolicy.value || (savingFields.value && internal !== true)) return
  const requestID = ++policyRequest
  const id = policyTarget.value.id
  const generation = detailGeneration
  loadingPolicy.value = true
  policyError.value = ''
  try {
    const result = await fetchAPI(`/credentials/${encodeURIComponent(id)}/concurrency-policy`)
    if (requestID !== policyRequest || !ownsDetails(id, generation)) return
    if (result.credential_id !== id) throw new Error('Policy response belongs to a different credential.')
    policy.value = result
    policyTotal.value = result.max_in_flight == null ? '' : String(result.max_in_flight)
    policyModels.value = Object.entries(result.max_in_flight_by_model || {}).sort(([a], [b]) => a.localeCompare(b)).map(([model, limit]) => ({ key: ++modelKey, model, limit: String(limit) }))
    originalPolicyDraft.value = policyDraft()
    policyConflict.value = false
  } catch (error) {
    if (requestID === policyRequest && ownsDetails(id, generation)) {
      if (unavailable(error)) policyAvailable.value = false
      policyError.value = unavailable(error) ? 'Concurrency policy is unavailable on this deployment.' : message(error)
    }
  }
  finally { if (requestID === policyRequest) loadingPolicy.value = false }
}
function policyLimit(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) throw new Error('Limits must be non-negative whole numbers.')
  return Number(text) || null
}
async function savePolicy() {
  if (!policyTarget.value || !policySupported.value || savingFields.value || savingPolicy.value || loadingPolicy.value || credentialAction.value) return
  const id = policyTarget.value.id
  const generation = detailGeneration
  const requestID = ++policyRequest
  let body
  try {
    body = policyPatch()
    if (!Object.keys(body).length) return
  } catch (error) { policyError.value = message(error); return }
  savingPolicy.value = true
  policyError.value = ''
  try {
    const result = await fetchAPI(`/credentials/${encodeURIComponent(id)}/concurrency-policy`, { method: 'PATCH', body })
    if (requestID !== policyRequest || !ownsDetails(id, generation)) return
    policy.value = result
    policyTotal.value = result.max_in_flight == null ? '' : String(result.max_in_flight)
    policyModels.value = Object.entries(result.max_in_flight_by_model || {}).sort(([a], [b]) => a.localeCompare(b)).map(([model, limit]) => ({ key: ++modelKey, model, limit: String(limit) }))
    originalPolicyDraft.value = policyDraft()
    await refreshData()
    toast.add({ title: 'Concurrency policy updated', color: 'success' })
  } catch (error) {
    if (requestID !== policyRequest || !ownsDetails(id, generation)) return
    if (unavailable(error)) policyAvailable.value = false
    policyConflict.value = error?.statusCode === 409
    policyError.value = policyConflict.value ? 'Policy changed elsewhere. Reload the latest version before editing and saving again.' : message(error)
  } finally { savingPolicy.value = false }
}

async function loadConcurrency(offset = 0) {
  if (!concurrencyTarget.value || loadingConcurrency.value) return
  const id = concurrencyTarget.value.id
  const generation = detailGeneration
  const requestID = ++concurrencyRequest
  loadingConcurrency.value = true; concurrencyError.value = ''
  try {
    const query = { credential_id: id, limit: 25, offset }
    if (supports('credential_in_flight_snapshot_cursor', false)) {
      if (offset && flightDetails.value?.snapshot_cursor) query.snapshot_cursor = flightDetails.value.snapshot_cursor
      else query.stable_snapshot = true
    }
    const [states, details] = await Promise.all([
      policySupported.value ? fetchAPI('/credentials/concurrency').catch(error => {
        if (unavailable(error)) {
          if (requestID === concurrencyRequest && ownsDetails(id, generation)) policyAvailable.value = false
          return { items: [] }
        }
        throw error
      }) : Promise.resolve({ items: [] }),
      snapshotsSupported.value ? fetchAPI('/credentials/in-flight', { query }) : Promise.resolve(null)
    ])
    if (requestID !== concurrencyRequest || !ownsDetails(id, generation)) return
    concurrencyState.value = (states.items || []).find(item => item.credential_id === id) || null
    flightDetails.value = offset && details ? { ...details, items: [...(flightDetails.value?.items || []), ...(details.items || [])] } : details
  } catch (error) {
    if (requestID === concurrencyRequest && ownsDetails(id, generation)) {
      if (unavailable(error)) snapshotsAvailable.value = false
      concurrencyError.value = unavailable(error) ? 'Concurrency snapshots are unavailable on this deployment.' : error?.statusCode === 409 ? 'Request snapshot expired. Refresh to load current requests.' : message(error)
    }
  } finally { if (requestID === concurrencyRequest) loadingConcurrency.value = false }
}
async function importVertex() {
  if (importingVertex.value) return
  if (!vertexFile.value) { vertexError.value = 'Choose a service-account JSON file.'; return }
  importingVertex.value = true; vertexError.value = ''
  try {
    const body = new FormData()
    body.append('file', vertexFile.value)
    if (vertexLocation.value.trim()) body.append('location', vertexLocation.value.trim())
    vertexResult.value = await fetchAPI('/oauth/import', { method: 'POST', query: { provider: 'vertex' }, body })
    vertexFile.value = null
    await refreshData()
    toast.add({ title: 'Vertex credential imported', color: 'success' })
  } catch (error) { vertexError.value = message(error) }
  finally { importingVertex.value = false }
}
async function loadModels(item, refresh = false) {
  if (!item?.id || modelsLoading.value) return
  const generation = detailGeneration
  const requestID = ++modelsRequest
  const current = () => requestID === modelsRequest && ownsDetails(item.id, generation)
  modelsLoading.value = true; modelsError.value = ''; modelStatesNotice.value = ''
  credentialModels.value = []; modelStates.value = null
  try {
    const [models, states] = await Promise.all([
      fetchAPI(credentialRoute('/models'), { query: { name: item.id }, refresh }),
      fetchAPI(`/credentials/${encodeURIComponent(item.id)}/model-states`).catch(async error => {
        if (error?.statusCode === 404) {
          try {
            const result = await fetchAPI('/credentials/model-states', { query: { credential_id: item.id } })
            return { ...result, credential: (result.credentials || []).find(entry => entry.credential_id === item.id) }
          } catch (fallbackError) {
            if (current()) modelStatesNotice.value = unavailable(fallbackError) ? 'Runtime model-state diagnostics are unavailable; showing registered models only.' : message(fallbackError)
            return null
          }
        }
        if (current()) modelStatesNotice.value = unavailable(error) ? 'Runtime model-state diagnostics are unavailable; showing registered models only.' : message(error)
        return null
      })
    ])
    if (!current()) return
    credentialModels.value = normalizeCredentialModels(models.models)
    modelStates.value = states
    if (states && !states.credential) modelStatesNotice.value = 'No runtime state is available for this credential on the current Home node.'
  } catch (error) { if (current()) modelsError.value = message(error) }
  finally { if (requestID === modelsRequest) modelsLoading.value = false }
}
async function runCredentialAction(action) {
  if (!detailsTarget.value || credentialAction.value || savingFields.value || savingPolicy.value || busy.value) return
  if (action === 'refresh' ? !refreshAvailable.value : !supports('credential_cooldown_reset', false) || !cooldownAvailable.value) return
  const item = detailsTarget.value
  const generation = detailGeneration
  credentialAction.value = action; actionError.value = ''
  try {
    const result = action === 'refresh'
      ? await fetchAPI('/credentials/refresh', { method: 'POST', body: { auth_index: item.id } })
      : await fetchAPI(`/credentials/${encodeURIComponent(item.id)}/cooldown`, { method: 'DELETE' })
    if (action === 'refresh' && !result.auth) throw new Error('This credential does not support OAuth refresh.')
    await refreshData()
    if (ownsDetails(item.id, generation)) {
      const updated = credentials.value.find(entry => entry.id === item.id)
      if (updated) { detailsTarget.value = updated; initializeFields(updated) }
      if (detailsTab.value === 'Models') await loadModels(detailsTarget.value)
    }
    toast.add({ title: action === 'refresh' ? 'Credential refreshed' : result.cleared ? 'Quota cooldown cleared' : 'No quota cooldown to clear', color: 'success' })
  } catch (error) {
    if (ownsDetails(item.id, generation)) {
      if (unavailable(error)) { if (action === 'refresh') refreshAvailable.value = false; else cooldownAvailable.value = false }
      actionError.value = unavailable(error) ? 'This action is unavailable on this deployment.' : message(error)
    }
  } finally { credentialAction.value = '' }
}
async function downloadCredential(item) {
  try {
    const blob = await fetchAPI(credentialRoute('/download'), { query: { id: item.id }, responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = item.name || `${item.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) { toast.add({ title: 'Download failed', description: message(error), color: 'error' }) }
}

function credentialRowActions(item) {
  return [
    { id: 'view', label: 'View', ariaLabel: 'View credential details', icon: 'i-tabler-eye', onSelect: () => showDetails(item) },
    { id: 'test', label: 'Test', ariaLabel: 'Test connectivity', icon: 'i-tabler-plug-connected', onSelect: () => openConnectivity(item) },
    { id: 'download', label: 'Download', ariaLabel: 'Download credential', icon: 'i-tabler-download', disabled: busy.value, onSelect: () => downloadCredential(item) },
    { id: 'delete', label: 'Delete', ariaLabel: 'Delete credential', icon: 'i-tabler-trash', destructive: true, disabled: busy.value, onSelect: () => confirmDelete(item) }
  ]
}
function confirmDelete(item) { deleteTarget.value = item; deleteOpen.value = true }
async function deleteCredential() { if (!deleteTarget.value) return; deleting.value = true; try { await fetchAPI(`${credentialRoute('')}?id=${encodeURIComponent(deleteTarget.value.id)}`, { method: 'DELETE' }); deleteOpen.value = false; await refreshData(); toast.add({ title: 'Credential deleted', color: 'success' }) } catch (error) { toast.add({ title: 'Delete failed', description: message(error), color: 'error' }) } finally { deleting.value = false } }
async function startOAuth(provider) {
  if (startingOAuth.value) return
  startingOAuth.value = provider; oauthError.value = ''
  try {
    const result = await fetchAPI('/oauth/auth-url', { query: { provider, is_webui: true } })
    const url = result?.url || result?.auth_url
    if (!url) throw new Error('Authorization URL was not returned.')
    stopOAuthPolling()
    const sessions = { ...oauthSessions.value, [provider]: { url, state: result.state || '', status: '', code: '', redirect_url: '', callback_error: '' } }
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
    const result = await fetchAPI('/oauth/status', { query: { state: session.state.trim() || undefined } })
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
      const result = await fetchAPI('/oauth/status', { query: { state } })
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
    await fetchAPI('/oauth/callback', { method: 'POST', body: { provider, redirect_url: redirectURL, code, state, error: errorText } })
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
.accounts-table :deep(td:first-child) { width: 2.75rem; }

</style>
