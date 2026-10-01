<template>
  <div class="space-y-6">
    <UAlert
      v-if="pageError"
      color="error"
      variant="subtle"
      icon="i-tabler-alert-triangle"
      title="Billing request failed"
      :description="pageError"
    />

    <AppPanelTabs v-model="activeSection" :items="sections" label="Billing sections" />

    <template v-if="activeSection === 'overview'">
      <AppCard class="workbench-filter-panel">
        <form class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6" @submit.prevent="applyOverviewFilters">
          <UFormField label="Time range"><USelect v-model="overviewPreset" :items="rangeOptions" value-key="value" label-key="label" class="w-full" @update:model-value="selectRange('overview', $event)" /></UFormField>
          <UFormField label="From">
            <UInput v-model="overviewFilters.from" type="date" class="w-full" @update:model-value="overviewPreset = 'custom'" />
          </UFormField>
          <UFormField label="To">
            <UInput v-model="overviewFilters.to" type="date" class="w-full" @update:model-value="overviewPreset = 'custom'" />
          </UFormField>
          <UFormField label="User">
            <UInputMenu v-model="overviewFilters.user" :items="userSearchOptions" create-item @create="overviewFilters.user = $event.trim()" placeholder="Search users or enter ID..." class="w-full" />
          </UFormField>
          <UFormField label="Provider">
            <UInputMenu v-model="overviewFilters.provider" :items="providerSearchOptions" create-item @create="overviewFilters.provider = $event.trim()" placeholder="Search providers..." class="w-full" />
          </UFormField>
          <UFormField label="Model">
            <UInputMenu v-model="overviewFilters.model" :items="modelSearchOptions" create-item @create="overviewFilters.model = $event.trim()" placeholder="Search models..." class="w-full" />
          </UFormField>

          <div class="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-6">
            <AppButton type="submit" color="primary" :loading="overviewLoading">Apply filters</AppButton>
            <AppButton color="neutral" variant="ghost" @click="resetOverviewFilters">Reset</AppButton>
          </div>
        </form>
      </AppCard>

      <template v-if="overview">
        <AppCard>
          <template #header><h2 class="text-sm font-semibold">Finance summary</h2></template>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AppCard v-for="metric in financeMetrics" :key="metric.label" :ui="{ body: 'p-4' }">
              <p class="text-xs font-medium text-[var(--ui-text-muted)]">{{ metric.label }}</p>
              <p class="mt-2 text-xl font-semibold tabular-nums text-[var(--ui-text-highlighted)]">{{ metric.value }}</p>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ metric.hint }}</p>
            </AppCard>
          </div>
        </AppCard>
        <AppCard>
          <template #header><h2 class="text-sm font-semibold">Usage summary</h2></template>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <AppCard v-for="metric in usageMetrics" :key="metric.label" :ui="{ body: 'p-4' }">
              <p class="text-xs font-medium text-[var(--ui-text-muted)]">{{ metric.label }}</p>
              <p class="mt-2 text-xl font-semibold tabular-nums text-[var(--ui-text-highlighted)]">{{ metric.value }}</p>
            </AppCard>
          </div>
        </AppCard>
      </template>
      <p v-else-if="!overviewLoading && !pageError" class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No billing overview available.</p>

      <div v-if="overview" class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AppCard class="xl:col-span-2">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="font-semibold">Daily charges</h2>
                <p class="text-xs text-[var(--ui-text-muted)]">Charge amount and request volume in {{ overviewRange.timezone || 'UTC' }}</p>
              </div>
              <span class="text-xs text-[var(--ui-text-muted)]">{{ overviewRange.from || 'All time' }} – {{ overviewRange.to || 'Now' }}</span>
            </div>
          </template>
          <div v-if="dailyTrend.length" class="max-h-96 overflow-y-auto pr-2">
            <div v-for="point in dailyTrend" :key="point.date" class="grid grid-cols-[6rem_1fr_auto] items-center gap-3 border-b border-[var(--ui-border-muted)] py-3 text-sm first:pt-0 last:border-b-0 last:pb-0">
              <span class="text-xs text-[var(--ui-text-muted)]">{{ point.date }}</span>
              <div class="h-2 overflow-hidden rounded-full bg-[var(--ui-bg-elevated)]">
                <div class="h-full rounded-full bg-[var(--ui-primary)]" :style="{ width: `${trendWidth(point.charge_amount)}%` }" />
              </div>
              <div class="min-w-28 text-right">
                <p class="font-medium tabular-nums">{{ formatCredits(point.charge_amount) }}</p>
                <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(point.request_count) }} requests</p>
              </div>
            </div>
          </div>
          <div v-else class="py-12 text-center text-sm text-[var(--ui-text-muted)]">No charges in the selected range.</div>
        </AppCard>

        <AppCard>
          <template #header>
            <div>
              <h2 class="font-semibold">Top consumers</h2>
              <p class="text-xs text-[var(--ui-text-muted)]">Users by charged amount</p>
            </div>
          </template>
          <div v-if="topUsers.length" class="max-h-96 overflow-y-auto pr-2">
            <div v-for="(item, index) in topUsers" :key="item.id || item.label" class="flex items-center justify-between gap-4 border-b border-[var(--ui-border-muted)] py-3 first:pt-0 last:border-b-0 last:pb-0">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ index + 1 }}. {{ item.label || `User #${item.id}` }}</p>
                <p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(item.request_count) }} requests</p>
              </div>
              <span class="font-mono text-sm font-semibold tabular-nums">{{ formatCredits(item.amount) }}</span>
            </div>
          </div>
          <div v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No user charges found.</div>
        </AppCard>
      </div>

      <div v-if="overview" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AppCard>
          <template #header><h2 class="font-semibold">Top models</h2></template>
          <div v-if="topModels.length" class="space-y-3">
            <div v-for="item in topModels" :key="item.id || item.label" class="flex items-center justify-between gap-3 text-sm">
              <span class="min-w-0 truncate">{{ item.label }}</span>
              <span class="font-mono font-medium">{{ formatCredits(item.amount) }}</span>
            </div>
          </div>
          <p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No model charges found.</p>
        </AppCard>
        <AppCard>
          <template #header><h2 class="font-semibold">Top providers</h2></template>
          <div v-if="topProviders.length" class="space-y-3">
            <div v-for="item in topProviders" :key="item.id || item.label" class="flex items-center justify-between gap-3 text-sm">
              <span class="min-w-0 truncate">{{ item.label }}</span>
              <span class="font-mono font-medium">{{ formatCredits(item.amount) }}</span>
            </div>
          </div>
          <p v-else class="py-8 text-center text-sm text-[var(--ui-text-muted)]">No provider charges found.</p>
        </AppCard>
      </div>
    </template>

    <template v-else-if="activeSection === 'charges'">
      <AppCard class="workbench-filter-panel">
        <form class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5" @submit.prevent="applyChargeFilters">
          <UFormField label="Time range"><USelect v-model="chargePreset" :items="rangeOptions" value-key="value" label-key="label" class="w-full" @update:model-value="selectRange('charges', $event)" /></UFormField>
          <UFormField label="From"><UInput v-model="chargeFilters.from" type="date" class="w-full" @update:model-value="chargePreset = 'custom'" /></UFormField>
          <UFormField label="To"><UInput v-model="chargeFilters.to" type="date" class="w-full" @update:model-value="chargePreset = 'custom'" /></UFormField>
          <UFormField label="User"><UInputMenu v-model="chargeFilters.user" :items="userSearchOptions" create-item @create="chargeFilters.user = $event.trim()" placeholder="Search users..." class="w-full" /></UFormField>
          <UFormField label="Provider"><UInputMenu v-model="chargeFilters.provider" :items="providerSearchOptions" create-item @create="chargeFilters.provider = $event.trim()" placeholder="Search providers..." class="w-full" /></UFormField>
          <UFormField label="Model"><UInputMenu v-model="chargeFilters.model" :items="modelSearchOptions" create-item @create="chargeFilters.model = $event.trim()" placeholder="Search models..." class="w-full" /></UFormField>
          <div class="flex gap-2 md:col-span-2 xl:col-span-5">
            <AppButton type="submit" :loading="chargesLoading">Apply filters</AppButton>
            <AppButton color="neutral" variant="ghost" @click="resetChargeFilters">Reset</AppButton>
          </div>
        </form>
      </AppCard>

      <AdminDataPanel title="Charges" :description="`${formatNumber(chargesTotal)} matching records`">
        <AppTable :columns="chargeColumns" :data="charges" :loading="chargesLoading">
          <template #created_at-cell="{ row }"><div class="min-w-36"><p class="text-sm">{{ formatDateTime(rowValue(row).created_at) }}</p><p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).request_id || rowValue(row).id }}</p></div></template>
          <template #user-cell="{ row }"><div class="min-w-32"><p class="text-sm">{{ chargeUserName(rowValue(row)) }}</p><p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).api_key_masked || rowValue(row).api_key_label || 'No client key' }}</p></div></template>
          <template #model-cell="{ row }"><div class="min-w-40"><p class="font-medium">{{ rowValue(row).model || 'Unknown' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).provider || 'Unknown' }}<span v-if="rowValue(row).original_model && rowValue(row).original_model !== rowValue(row).model"> · from {{ rowValue(row).original_model }}</span></p></div></template>
          <template #tokens-cell="{ row }"><div class="min-w-28 text-sm tabular-nums"><p>{{ formatNumber(totalChargeTokens(rowValue(row))) }} total</p><p class="text-xs text-[var(--ui-text-muted)]">{{ formatNumber(rowValue(row).input_tokens) }} in / {{ formatNumber(rowValue(row).output_tokens) }} out</p></div></template>
          <template #amount-cell="{ row }"><div class="text-right"><p class="font-mono font-semibold">{{ formatCredits(rowValue(row).amount) }}</p><p class="text-xs text-[var(--ui-text-muted)]">Bal. {{ formatCredits(rowValue(row).balance_after) }}</p></div></template>
          <template #actions-cell="{ row }"><div class="flex justify-end"><AdminTableAction action="view" label="View charge details" @click="openChargeDetail(rowValue(row))" /></div></template>
          <template #empty><div class="py-12 text-center text-sm text-[var(--ui-text-muted)]">No charges match these filters.</div></template>
        </AppTable>
        <template v-if="chargesTotal > 0" #footer><div class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p class="text-sm text-[var(--ui-text-muted)]">{{ chargeRangeStart }}–{{ chargeRangeEnd }} / {{ formatNumber(chargesTotal) }} total</p><div class="flex flex-wrap items-center gap-2"><span class="text-xs text-[var(--ui-text-muted)]">Rows per page</span><USelect v-model="chargePageSize" :items="pageSizeOptions" value-key="value" label-key="label" class="w-24" @update:model-value="changePageSize('charges')" /><AppButton size="sm" color="neutral" variant="outline" :disabled="chargePage <= 1 || chargesLoading" @click="changeChargePage(-1)">Previous</AppButton><AppButton size="sm" color="neutral" variant="outline" :disabled="chargePage >= chargePageCount || chargesLoading" @click="changeChargePage(1)">Next</AppButton></div></div></template>
      </AdminDataPanel>
    </template>

    <template v-else-if="activeSection === 'balances'">

      <AppCard class="workbench-filter-panel">
        <form class="grid grid-cols-1 gap-3 md:grid-cols-4" @submit.prevent="applyBalanceFilters">
          <UFormField label="Time range"><USelect v-model="balancePreset" :items="rangeOptions" value-key="value" label-key="label" class="w-full" @update:model-value="selectRange('balances', $event)" /></UFormField>
          <UFormField label="From"><UInput v-model="balanceFilters.from" type="date" class="w-full" @update:model-value="balancePreset = 'custom'" /></UFormField>
          <UFormField label="To"><UInput v-model="balanceFilters.to" type="date" class="w-full" @update:model-value="balancePreset = 'custom'" /></UFormField>
          <UFormField label="User"><UInputMenu v-model="balanceFilters.user" :items="userSearchOptions" create-item @create="balanceFilters.user = $event.trim()" placeholder="Search users..." class="w-full" /></UFormField>
          <div class="flex items-end gap-2"><AppButton type="submit" :loading="balancesLoading">Apply</AppButton><AppButton color="neutral" variant="ghost" @click="resetBalanceFilters">Reset</AppButton></div>
        </form>
      </AppCard>
      <AdminDataPanel title="Balance records" :description="`${formatNumber(balancesTotal)} matching adjustments`">
        <template #actions><USelect v-model="balancePageSize" :items="pageSizeOptions" value-key="value" label-key="label" class="w-24" @update:model-value="changePageSize('balances')" /></template>
        <AppTable :columns="balanceColumns" :data="balanceRecords" :loading="balancesLoading">
          <template #created_at-cell="{ row }"><div><p class="text-sm">{{ formatDateTime(rowValue(row).created_at) }}</p><p class="font-mono text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).id }}</p></div></template>
          <template #type-cell="{ row }"><UBadge :color="rowValue(row).type === 'recharge' ? 'success' : 'warning'" variant="subtle">{{ rowValue(row).type }}</UBadge></template>
          <template #amount-cell="{ row }"><span class="font-mono font-semibold" :class="rowValue(row).type === 'recharge' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'">{{ rowValue(row).type === 'recharge' ? '+' : '−' }}{{ formatCredits(rowValue(row).amount) }}</span></template>
          <template #balance-cell="{ row }"><div class="text-sm tabular-nums"><p>{{ formatCredits(rowValue(row).balance_after) }}</p><p class="text-xs text-[var(--ui-text-muted)]">from {{ formatCredits(rowValue(row).balance_before) }}</p></div></template>
          <template #note-cell="{ row }"><div class="max-w-72"><p class="truncate text-sm">{{ rowValue(row).note || '—' }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ rowValue(row).operator || '—' }}</p></div></template>
          <template #actions-cell="{ row }"><AdminTableAction action="view" label="View balance details" @click="openBalanceDetail(rowValue(row))" /></template>
          <template #empty><div class="py-12 text-center text-sm text-[var(--ui-text-muted)]">No balance records match these filters.</div></template>
        </AppTable>
        <template #footer><PaginationFooter :page="balancePage" :total="balancesTotal" :page-size="balancePageSize" :loading="balancesLoading" @previous="changeBalancePage(-1)" @next="changeBalancePage(1)" /></template>
      </AdminDataPanel>
    </template>

    <template v-else-if="activeSection === 'prices'">
      <section class="overflow-hidden rounded-lg border border-blue-500/30 bg-blue-500/5" aria-labelledby="tier-policy-title"><div class="flex flex-wrap items-center justify-between gap-4 p-4"><div class="flex items-start gap-3"><span class="flex size-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-500"><UIcon name="i-tabler-arrows-exchange" class="size-5" /></span><div><div class="flex flex-wrap items-center gap-2"><h2 id="tier-policy-title" class="font-semibold">Runtime billing context</h2><UBadge color="info" variant="subtle">Global</UBadge><UBadge v-if="priceSchemaVersion >= 2" color="success" variant="subtle">Tier and context pricing supported</UBadge></div><p class="mt-1 text-sm text-[var(--ui-text-muted)]">{{ settingsForm.service_tier_source === 'response' ? 'Rules match the provider response tier, falling back to the requested tier when absent.' : 'Rules match the service tier requested by the client.' }}</p><p v-if="priceSchemaVersion < 2" class="mt-1 text-xs text-[var(--ui-text-muted)]">This Home instance supports flat-price compatibility rules only.</p></div></div><AppButton v-if="priceSchemaVersion >= 2" color="neutral" variant="outline" icon="i-tabler-settings" @click="openMatchingSettings">Configure matching</AppButton></div></section>
      <BillingPriceImport :providers="providerSearchOptions" :models="modelSearchOptions" @applied="loadPrices" />
      <AdminTablePanel title="Model prices" :description="`${filteredPriceRules.length} rules`">
        <template #filters>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UFormField label="Search"><UInput v-model="priceFilters.search" icon="i-tabler-search" placeholder="Search model ID or provider" class="w-full" /></UFormField>
            <UFormField label="Status"><USelect :model-value="priceFilters.enabled || allOptionValue" @update:model-value="priceFilters.enabled = $event === allOptionValue ? '' : $event" :items="enabledOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
            <UFormField label="Service tier"><UInputMenu v-model="priceFilters.service_tier" :items="priceTierOptions" create-item @create="priceFilters.service_tier = $event.trim()" placeholder="All tiers" class="w-full" /></UFormField>
            <UFormField label="Source"><USelect :model-value="priceFilters.source || allOptionValue" @update:model-value="priceFilters.source = $event === allOptionValue ? '' : $event" :items="priceSourceOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          </div>
        </template>
        <template #actions><AppButton v-if="hasPriceFilters" color="neutral" variant="ghost" @click="clearPriceFilters">Clear filters</AppButton><AppButton color="primary" icon="i-tabler-plus" @click="openPriceForm()">New price</AppButton></template>
        <AppTable :columns="priceColumns" :data="filteredPriceRules" :loading="pricesLoading" class="min-w-[1260px]">
          <template #provider-cell="{ row }"><span class="font-medium">{{ rowValue(row).provider }}</span></template>
          <template #model-cell="{ row }"><div class="flex min-w-52 items-center gap-1"><span class="truncate font-mono">{{ rowValue(row).model }}</span><AppButton size="xs" color="neutral" variant="ghost" icon="i-tabler-clipboard" aria-label="Copy model ID" @click="copyText(rowValue(row).model)" /></div></template>
          <template #scope-cell="{ row }"><div class="min-w-36"><template v-if="priceSchemaVersion >= 2"><UBadge color="neutral" variant="subtle">{{ rowValue(row).service_tier || '*' }}</UBadge><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ contextBandLabel(rowValue(row).min_input_tokens) }}</p></template><span v-else class="text-xs text-[var(--ui-text-muted)]">Flat price compatibility rule</span></div></template>
          <template #input-cell="{ row }"><span class="font-mono text-xs">{{ formatCredits(rowValue(row).input_price_per_million) }}</span></template>
          <template #output-cell="{ row }"><span class="font-mono text-xs">{{ formatCredits(rowValue(row).output_price_per_million) }}</span></template>
          <template #cache_read-cell="{ row }"><span class="font-mono text-xs">{{ formatCredits(rowValue(row).cache_read_price_per_million) }}</span></template>
          <template #cache_write-cell="{ row }"><span v-if="Number(rowValue(row).cache_write_price_per_million)" class="font-mono text-xs">{{ formatCredits(rowValue(row).cache_write_price_per_million) }}</span><span v-else class="text-xs text-[var(--ui-text-muted)]" title="No separate cache-write rate; billing fallback behavior is preserved in the charge snapshot.">No separate rate</span></template>
          <template #request-cell="{ row }"><span class="font-mono text-xs">{{ formatCredits(rowValue(row).request_price) }}</span></template>
          <template #source-cell="{ row }"><UBadge color="neutral" variant="subtle">{{ rowValue(row).source || 'manual' }}</UBadge></template>
          <template #state-cell="{ row }"><div class="flex items-center gap-2"><USwitch :model-value="Boolean(rowValue(row).enabled)" :loading="togglingPrice === rowValue(row).id" @update:model-value="togglePriceEnabled(rowValue(row), $event)" /><UBadge :color="rowValue(row).enabled ? 'success' : 'neutral'" variant="subtle">{{ rowValue(row).enabled ? 'Enabled' : 'Disabled' }}</UBadge></div></template>
          <template #updated-cell="{ row }"><span class="whitespace-nowrap text-xs text-[var(--ui-text-muted)]">{{ formatDateTime(rowValue(row).updated_at) }}</span></template>
          <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><AdminTableAction action="edit" label="Edit model price" @click="openPriceForm(rowValue(row))" /><AdminTableAction action="delete" label="Delete model price" destructive @click="confirmDeletePrice(rowValue(row))" /></div></template>
          <template #empty><div class="py-12 text-center text-sm text-[var(--ui-text-muted)]">No model price rules match these filters.</div></template>
        </AppTable>
      </AdminTablePanel>
    </template>



    <AppModal v-model:open="matchingSettingsOpen" title="Configure global tier matching" description="Choose which service tier Home uses when matching future model-price rules.">
      <template #body><form class="space-y-5" @submit.prevent="saveSettings"><UFormField label="Tier matching source"><div class="grid gap-2"><button v-for="option in tierSourceOptions" :key="option.value" type="button" class="rounded-lg border border-[var(--ui-border)] p-3 text-left" :class="settingsForm.service_tier_source === option.value ? 'border-[var(--ui-primary)] bg-[var(--ui-primary)]/10' : ''" @click="settingsForm.service_tier_source = option.value"><span class="font-medium">{{ option.label }}</span><UBadge v-if="option.value === 'request'" class="ml-2" color="neutral" variant="subtle">Default</UBadge><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ option.value === 'request' ? 'Match the tier requested by the client.' : 'Match the provider response tier and fall back to the requested tier when absent.' }}</p></button></div></UFormField><UAlert v-if="diagnosticsError" color="warning" variant="subtle" title="Tier diagnostics unavailable" :description="diagnosticsError" /><div v-else-if="settingsForm.service_tier_source === 'response' && tierDiagnostics" class="rounded-lg border border-[var(--ui-border)] p-4 text-sm"><p>{{ formatNumber(tierDiagnostics.fallback_requests) }} of {{ formatNumber(tierDiagnostics.eligible_requests) }} recent eligible requests would fall back to the requested tier.</p></div><div class="flex justify-end gap-2 border-t border-[var(--ui-border)] pt-4"><AppButton type="button" color="neutral" variant="ghost" @click="matchingSettingsOpen = false">Cancel</AppButton><AppButton type="submit" :loading="settingsSaving || diagnosticsLoading">Save matching</AppButton></div></form></template>
    </AppModal>

    <AppModal v-model:open="adjustmentOpen" :title="adjustmentForm.type === 'recharge' ? 'Recharge user balance' : 'Deduct user balance'" description="Creates an immutable billing balance record.">
      <template #body>
        <form class="space-y-5" @submit.prevent="submitBalanceAdjustment">
          <UAlert v-if="modalError" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Could not adjust balance" :description="modalError" />
          <div class="grid grid-cols-2 gap-2">
            <AppButton type="button" :color="adjustmentForm.type === 'recharge' ? 'success' : 'neutral'" :variant="adjustmentForm.type === 'recharge' ? 'soft' : 'outline'" @click="adjustmentForm.type = 'recharge'">Recharge</AppButton>
            <AppButton type="button" :color="adjustmentForm.type === 'deduct' ? 'warning' : 'neutral'" :variant="adjustmentForm.type === 'deduct' ? 'soft' : 'outline'" @click="adjustmentForm.type = 'deduct'">Deduct</AppButton>
          </div>
          <UFormField label="User" required>
            <USelectMenu v-model="adjustmentForm.user_id" :items="userOptions" value-key="value" label-key="label" placeholder="Search users..." :search-input="{ placeholder: 'Search username or ID...' }" class="w-full" />
          </UFormField>
          <UFormField label="Amount" required><UInput v-model="adjustmentForm.amount" type="number" min="0.000001" step="0.000001" class="w-full" /></UFormField>
          <UFormField label="Note" :required="adjustmentForm.type === 'deduct'" :hint="adjustmentForm.type === 'deduct' ? 'Required for deductions' : 'Optional'"><UTextarea v-model="adjustmentForm.note" :rows="3" class="w-full" /></UFormField>
          <div class="flex justify-end gap-3 border-t border-[var(--ui-border)] pt-4"><AppButton type="button" color="neutral" variant="ghost" @click="adjustmentOpen = false">Cancel</AppButton><AppButton type="submit" :color="adjustmentForm.type === 'recharge' ? 'success' : 'warning'" :loading="adjustmentSaving">{{ adjustmentForm.type === 'recharge' ? 'Recharge' : 'Deduct' }}</AppButton></div>
        </form>
      </template>
    </AppModal>

    <AppModal v-model:open="priceFormOpen" :title="editingPrice ? 'Edit model price' : 'New model price'" description="Prices affect future charges only; historical charges retain their snapshots." :ui="{ content: 'sm:max-w-4xl' }">
      <template #body>
        <form class="space-y-5" @submit.prevent="submitPrice">
          <UAlert v-if="modalError" color="error" variant="subtle" icon="i-tabler-alert-circle" title="Could not save price rule" :description="modalError" />
          <UAlert v-if="modelCandidatesError" color="warning" variant="subtle" title="Model candidates unavailable" :description="modelCandidatesError" />
          <fieldset class="space-y-3 rounded-lg border border-[var(--ui-border)] p-4">
            <div class="flex flex-wrap items-center justify-between gap-2"><div><legend class="font-medium">Models</legend><p class="text-xs text-[var(--ui-text-muted)]">{{ editingPrice ? 'Select one provider/model identity.' : 'Select one or more models. The same pricing is created sequentially for each selection.' }}</p></div><AppButton v-if="selectedPriceCandidates.length" type="button" size="sm" color="neutral" variant="ghost" @click="clearPriceCandidateSelection">Clear selection</AppButton></div>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center"><UInput v-model="modelCandidateSearch" icon="i-tabler-search" placeholder="Search model ID, label, description, provider, owner, or type..." class="w-full" /><UCheckbox v-model="availableModelsOnly" label="Available only" class="shrink-0" /></div>
            <div v-if="selectedPriceCandidates.length" class="flex flex-wrap gap-2"><UBadge v-for="candidate in selectedPriceCandidates" :key="candidate.key" color="primary" variant="subtle">{{ candidate.provider }} / {{ candidate.model }}</UBadge></div>
            <div class="max-h-72 overflow-y-auto rounded-md border border-[var(--ui-border)]">
              <button v-for="candidate in filteredModelCandidates" :key="candidate.key" type="button" class="flex w-full items-start gap-3 border-b border-[var(--ui-border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--ui-bg-elevated)]" :class="isPriceCandidateSelected(candidate) ? 'bg-[var(--ui-primary)]/10' : ''" @click="togglePriceCandidate(candidate)">
                <input :type="editingPrice ? 'radio' : 'checkbox'" :checked="isPriceCandidateSelected(candidate)" tabindex="-1" class="mt-1" />
                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--ui-bg-elevated)] text-xs font-semibold">{{ providerMark(candidate.provider) }}</span>
                <span class="min-w-0 flex-1"><span class="block truncate font-medium">{{ candidate.displayName || candidate.model }}</span><span class="block truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ candidate.model }}</span><span class="block truncate text-xs text-[var(--ui-text-muted)]">{{ candidate.provider }} · {{ candidate.available ? 'Available' : 'Static catalog' }}<template v-if="candidate.ownedBy"> · {{ candidate.ownedBy }}</template><template v-if="candidate.type"> · {{ candidate.type }}</template></span><span v-if="candidate.description" class="mt-1 block line-clamp-2 text-xs text-[var(--ui-text-muted)]">{{ candidate.description }}</span></span>
              </button>
              <p v-if="modelCandidatesLoading" class="p-6 text-center text-sm text-[var(--ui-text-muted)]">Loading model candidates…</p><p v-else-if="!filteredModelCandidates.length" class="p-6 text-center text-sm text-[var(--ui-text-muted)]">No matching model candidates.</p>
            </div>
          </fieldset>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField v-if="priceSchemaVersion >= 2" label="Service tier"><USelect v-model="priceForm.service_tier" :items="serviceTierOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
            <UFormField v-if="priceSchemaVersion >= 2" label="Context band"><USelect v-model="contextPreset" :items="contextPresetOptions" value-key="value" label-key="label" class="w-full" @update:model-value="applyContextPreset" /></UFormField>
            <UFormField v-if="priceSchemaVersion >= 2 && contextPreset === 'custom'" label="Minimum input tokens"><UInput v-model="priceForm.min_input_tokens" type="number" min="0" step="1" class="w-full" /></UFormField>
            <UFormField label="Input / 1M"><UInput v-model="priceForm.input_price_per_million" type="number" min="0" step="0.000001" class="w-full" /></UFormField>
            <UFormField label="Output / 1M"><UInput v-model="priceForm.output_price_per_million" type="number" min="0" step="0.000001" class="w-full" /></UFormField>
            <UFormField label="Cache read / 1M"><UInput v-model="priceForm.cache_read_price_per_million" type="number" min="0" step="0.000001" class="w-full" /></UFormField>
            <UFormField label="Cache write / 1M"><UInput v-model="priceForm.cache_write_price_per_million" type="number" min="0" step="0.000001" class="w-full" /></UFormField>
            <UFormField label="Per request"><UInput v-model="priceForm.request_price" type="number" min="0" step="0.000001" class="w-full" /></UFormField>
            <UFormField label="Source"><USelect v-model="priceForm.source" :items="sourceOptions" value-key="value" label-key="label" class="w-full" /></UFormField>
          </div>
          <UFormField label="Note"><UTextarea v-model="priceForm.note" :rows="3" class="w-full" /></UFormField>
          <div class="flex items-center justify-between rounded-lg border border-[var(--ui-border)] p-4"><div><p class="font-medium">Enabled</p><p class="text-xs text-[var(--ui-text-muted)]">Allow this rule to match new usage.</p></div><USwitch v-model="priceForm.enabled" /></div>
          <div class="flex justify-end gap-3 border-t border-[var(--ui-border)] pt-4"><AppButton type="button" color="neutral" variant="ghost" :disabled="priceSaving" @click="priceFormOpen = false">Cancel</AppButton><AppButton type="submit" :loading="priceSaving">{{ editingPrice ? 'Save changes' : `Create ${selectedPriceCandidates.length || ''} price${selectedPriceCandidates.length === 1 ? '' : 's'}` }}</AppButton></div>
        </form>
      </template>
    </AppModal>

    <AppModal v-model:open="deletePriceOpen" title="Delete price rule" description="Historical charges keep their stored price snapshots.">
      <template #body><div class="space-y-5"><UAlert color="warning" variant="subtle" icon="i-tabler-alert-triangle" title="This rule will no longer match future usage" :description="deletePriceTarget ? `${deletePriceTarget.provider} / ${deletePriceTarget.model} / ${deletePriceTarget.service_tier || '*'}` : ''" /><div class="flex justify-end gap-3"><AppButton color="neutral" variant="ghost" @click="deletePriceOpen = false">Cancel</AppButton><AppButton color="error" :loading="priceDeleting" @click="deletePrice">Delete rule</AppButton></div></div></template>
    </AppModal>

    <AppModal v-model:open="balanceDetailOpen" title="Balance record details" description="Immutable ledger adjustment and balance transition.">
          <template #body><dl v-if="selectedBalance" class="grid grid-cols-1 gap-4 sm:grid-cols-2"><div v-for="item in balanceDetailItems" :key="item.label" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="mt-1 break-words text-sm" :class="item.mono ? 'font-mono text-xs' : ''">{{ item.value }}</dd></div></dl></template>
        </AppModal>

        <AppModal v-model:open="tierConfirmOpen" title="Use provider response tiers?" description="Changing this setting affects future charges only.">
          <template #body><div class="space-y-4"><p class="text-sm">{{ formatNumber(tierDiagnostics?.fallback_requests) }} of {{ formatNumber(tierDiagnostics?.eligible_requests) }} observed eligible requests lacked a response tier and would use the requested tier instead. This evidence does not guarantee future coverage. Continue?</p><div class="flex justify-end gap-2"><AppButton color="neutral" variant="ghost" @click="tierConfirmOpen = false">Cancel</AppButton><AppButton :loading="settingsSaving" @click="persistSettings">Confirm and save</AppButton></div></div></template>
        </AppModal>

        <AppModal v-model:open="chargeDetailOpen" title="Charge details" description="Price attribution and balance transition for this request.">
      <template #body>
        <div v-if="selectedCharge" class="space-y-5">
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div v-for="item in chargeDetailItems" :key="item.label" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="mt-1 break-words text-sm" :class="item.mono ? 'font-mono text-xs' : ''">{{ item.value }}</dd></div>
          </dl>
          <div class="space-y-3"><p class="text-sm font-semibold">Price snapshot</p><dl v-if="snapshotDetailItems.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2"><div v-for="item in snapshotDetailItems" :key="item.label" class="min-w-0"><dt class="text-xs font-medium text-[var(--ui-text-muted)]">{{ item.label }}</dt><dd class="mt-1 break-words text-sm">{{ item.value }}</dd></div></dl><p v-else class="text-sm text-[var(--ui-text-muted)]">No price snapshot recorded.</p><details v-if="selectedCharge.price_snapshot"><summary class="cursor-pointer text-xs text-[var(--ui-text-muted)]">Raw snapshot</summary><pre class="mt-2 max-h-72 overflow-auto rounded-lg bg-[var(--ui-bg-muted)] p-4 text-xs">{{ prettyJSON(selectedCharge.price_snapshot) }}</pre></details></div>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const allOptionValue = '__all__'
const toast = useToast()
const pageSizeOptions = [50, 100, 200].map(value => ({ label: String(value), value }))
const rangeOptions = [
  { label: 'Today', value: 'today' }, { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' }, { label: 'Custom', value: 'custom' }
]
const rowValue = row => row?.original ?? row
const dateInputValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function datesForRange(preset) {
  const to = new Date()
  const from = new Date(to)
  if (preset === 'all') return { from: '', to: '' }
  if (preset === 'yesterday') { from.setDate(to.getDate() - 1); return { from: dateInputValue(from), to: dateInputValue(from) } }
  if (preset === 'month') from.setDate(1)
  if (preset === '7d') from.setDate(to.getDate() - 6)
  if (preset === '30d') from.setDate(to.getDate() - 29)
  return { from: dateInputValue(from), to: dateInputValue(to) }
}
const defaultRange = () => datesForRange('7d')

const sections = [
  { label: 'Overview', value: 'overview', icon: 'i-tabler-chart-pie' },
  { label: 'Charge records', value: 'charges', icon: 'i-tabler-receipt-tax' },
  { label: 'Balance records', value: 'balances', icon: 'i-tabler-cash-banknote' },
  { label: 'Model prices', value: 'prices', icon: 'i-tabler-tag' }
]
const activeSection = ref('overview')
const pageError = ref('')
const overview = ref(null)
const chargesResponse = ref(null)
const balancesResponse = ref(null)
const priceResponse = ref(null)
const usersResponse = ref(null)
const modelCandidatesResponse = ref({ available: [], static: [] })
const modelCandidatesLoading = ref(false)
const modelCandidatesError = ref('')
const modelCandidateSearch = ref('')
const availableModelsOnly = ref(true)
const selectedPriceCandidateKeys = ref([])
const overviewLoading = ref(false)
const chargesLoading = ref(false)
const balancesLoading = ref(false)
const pricesLoading = ref(false)
const settingsLoading = ref(false)
const settingsSaving = ref(false)

const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const settingsForm = ref({ service_tier_source: 'request', report_timezone: deviceTimezone })
const overviewFilters = ref({ ...defaultRange(), user: '', provider: '', model: '' })
const appliedOverviewFilters = ref({ ...overviewFilters.value })
const chargeFilters = ref({ ...defaultRange(), user: '', provider: '', model: '' })
const appliedChargeFilters = ref({ ...chargeFilters.value })
const balanceFilters = ref({ ...defaultRange(), user: '' })
const appliedBalanceFilters = ref({ ...balanceFilters.value })
const priceFilters = ref({ search: '', enabled: '', service_tier: '', source: '' })
const overviewPreset = ref('7d')
const chargePreset = ref('7d')
const balancePreset = ref('7d')
const chargePageSize = ref(50)
const balancePageSize = ref(50)
const tierDiagnostics = ref(null)
const diagnosticsLoading = ref(false)
const diagnosticsError = ref('')
const tierConfirmOpen = ref(false)
const matchingSettingsOpen = ref(false)
const savedTierSource = ref('request')
const chargePage = ref(1)
const balancePage = ref(1)

const adjustmentOpen = ref(false)
const adjustmentSaving = ref(false)
const adjustmentForm = ref({ type: 'recharge', user_id: '', amount: '', note: '' })
const priceFormOpen = ref(false)
const priceSaving = ref(false)

const editingPrice = ref(null)
const modalError = ref('')
const deletePriceOpen = ref(false)
const deletePriceTarget = ref(null)
const priceDeleting = ref(false)
const togglingPrice = ref('')
const chargeDetailOpen = ref(false)
const selectedCharge = ref(null)
const balanceDetailOpen = ref(false)
const selectedBalance = ref(null)

const chargeColumns = [
  { accessorKey: 'created_at', header: 'Time / Request' },
  { accessorKey: 'user', header: 'User / Key' },
  { accessorKey: 'model', header: 'Provider / Model' },
  { accessorKey: 'tokens', header: 'Tokens' },
  { accessorKey: 'amount', header: 'Charge / Balance' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]
const balanceColumns = [
  { accessorKey: 'created_at', header: 'Time / Record' },
  { accessorKey: 'user_id', header: 'User ID' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'balance', header: 'Balance after' },
  { accessorKey: 'note', header: 'Note / Operator' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]
const priceColumns = [
  { accessorKey: 'provider', header: 'Model provider' },
  { accessorKey: 'model', header: 'Model ID' },
  { accessorKey: 'scope', header: 'Rule scope' },
  { accessorKey: 'input', header: 'Input / 1M' },
  { accessorKey: 'output', header: 'Output / 1M' },
  { accessorKey: 'cache_read', header: 'Cache read / 1M' },
  { accessorKey: 'cache_write', header: 'Cache write / 1M' },
  { accessorKey: 'request', header: 'Per request' },
  { accessorKey: 'source', header: 'Source' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'updated', header: 'Updated' },
  { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }
]
const enabledOptions = [{ label: 'All rules', value: allOptionValue }, { label: 'Enabled', value: 'true' }, { label: 'Disabled', value: 'false' }]
const sourceOptions = [{ label: 'Manual', value: 'manual' }, { label: 'Default', value: 'default' }, { label: 'Synchronized', value: 'sync' }]
const priceSourceOptions = [{ label: 'All sources', value: allOptionValue }, ...sourceOptions]
const tierSourceOptions = [{ label: 'Requested service tier', value: 'request' }, { label: 'Provider response tier', value: 'response' }]
const serviceTierOptions = [{ label: 'All tiers (*)', value: '*' }, { label: 'Standard', value: 'standard' }, { label: 'Flex', value: 'flex' }, { label: 'Priority', value: 'priority' }]
const contextPresetOptions = [{ label: 'Base context', value: 'base' }, { label: '>272K input', value: '272k' }, { label: 'Custom lower bound', value: 'custom' }]
const contextPreset = ref('base')
function applyContextPreset(value) { if (value === 'base') priceForm.value.min_input_tokens = '0'; else if (value === '272k') priceForm.value.min_input_tokens = '272001' }

const emptyPriceForm = () => ({ provider: '', model: '', service_tier: '*', min_input_tokens: '0', input_price_per_million: '0', output_price_per_million: '0', cache_read_price_per_million: '0', cache_write_price_per_million: '0', request_price: '0', source: 'manual', enabled: true, note: '' })
const priceForm = ref(emptyPriceForm())

const overviewData = computed(() => overview.value?.overview || {})
const overviewRange = computed(() => overviewData.value.range || {})
const dailyTrend = computed(() => (Array.isArray(overviewData.value.daily_trend) ? overviewData.value.daily_trend : [])
  .slice()
  .sort((left, right) => Date.parse(right.date) - Date.parse(left.date)))
const topUsers = computed(() => (Array.isArray(overviewData.value.top_users) ? overviewData.value.top_users : [])
  .slice()
  .sort((left, right) => (Number(right.amount) || 0) - (Number(left.amount) || 0)))
const topModels = computed(() => Array.isArray(overviewData.value.top_models) ? overviewData.value.top_models : [])
const topProviders = computed(() => Array.isArray(overviewData.value.top_providers) ? overviewData.value.top_providers : [])
const maxTrendCharge = computed(() => Math.max(0.000001, ...dailyTrend.value.map(point => Number(point.charge_amount) || 0)))
const charges = computed(() => Array.isArray(chargesResponse.value?.items) ? chargesResponse.value.items : [])
const chargesTotal = computed(() => Number(chargesResponse.value?.total) || 0)
const chargePageCount = computed(() => Math.max(1, Math.ceil(chargesTotal.value / chargePageSize.value)))
const chargeRangeStart = computed(() => chargesTotal.value ? ((chargePage.value - 1) * chargePageSize.value) + 1 : 0)
const chargeRangeEnd = computed(() => Math.min(chargePage.value * chargePageSize.value, chargesTotal.value))
const balanceRecords = computed(() => Array.isArray(balancesResponse.value?.items) ? balancesResponse.value.items : [])
const balancesTotal = computed(() => Number(balancesResponse.value?.total) || 0)
const priceRules = computed(() => Array.isArray(priceResponse.value?.items) ? priceResponse.value.items : [])
const priceSchemaVersion = computed(() => Number(priceResponse.value?.price_rule_schema_version || priceResponse.value?.schema_version || 1))
const priceTierOptions = computed(() => [...new Set(priceRules.value.map(rule => rule.service_tier).filter(Boolean))].sort())
const filteredPriceRules = computed(() => {
  const search = priceFilters.value.search.trim().toLowerCase()
  return [...priceRules.value].filter(rule =>
    (!search || [rule.provider, rule.model].some(value => String(value || '').toLowerCase().includes(search))) &&
    (!priceFilters.value.service_tier.trim() || rule.service_tier?.toLowerCase() === priceFilters.value.service_tier.trim().toLowerCase()) &&
    (!priceFilters.value.source || rule.source === priceFilters.value.source) &&
    (!priceFilters.value.enabled || String(Boolean(rule.enabled)) === priceFilters.value.enabled)
  ).sort((a, b) => String(a.provider || '').localeCompare(String(b.provider || '')) || String(a.model || '').localeCompare(String(b.model || '')) || String(a.service_tier || '').localeCompare(String(b.service_tier || '')) || Number(a.min_input_tokens || 0) - Number(b.min_input_tokens || 0))
})
const hasPriceFilters = computed(() => Boolean(priceFilters.value.search.trim() || priceFilters.value.service_tier.trim() || priceFilters.value.source || priceFilters.value.enabled))
function clearPriceFilters() { priceFilters.value = { search: '', enabled: '', service_tier: '', source: '' } }
const users = computed(() => Array.isArray(usersResponse.value?.users) ? usersResponse.value.users : [])
const userOptions = computed(() => users.value.map(user => ({ label: `${user.username} (#${user.id}) · balance ${formatCredits(user.credits)}${user.credits_unlimited ? ' · unlimited' : ''}`, value: String(user.id) })))
const userSearchOptions = computed(() => users.value.map(user => user.username))
const providerSearchOptions = computed(() => [...new Set([
  ...priceRules.value.map(rule => rule.provider),
  ...charges.value.map(charge => charge.provider),
  ...topProviders.value.map(item => item.label || item.provider)
].filter(Boolean))].sort())
const modelSearchOptions = computed(() => [...new Set([
  ...priceRules.value.map(rule => rule.model),
  ...charges.value.map(charge => charge.model),
  ...topModels.value.map(item => item.label || item.model),
  ...modelCandidates.value.map(item => item.model)
].filter(Boolean))].sort())
function flattenModels(source) { return Array.isArray(source) ? source : source && typeof source === 'object' ? Object.values(source).flatMap(group => Array.isArray(group) ? group : []) : [] }
const modelCandidates = computed(() => {
  const map = new Map()
  const add = (model, available) => {
    if (!model?.id || !Array.isArray(model.providers) || !model.providers.length) return
    for (const provider of model.providers) {
      const normalizedProvider = String(provider || '').trim()
      if (!normalizedProvider) continue
      const key = `${normalizedProvider.toLowerCase()}::${model.id}`
      const previous = map.get(key)
      map.set(key, { key, provider: normalizedProvider, model: model.id, displayName: model.display_name || model.name || model.id, description: model.description || '', ownedBy: model.owned_by || '', type: model.type || '', available: Boolean(available || previous?.available), raw: model })
    }
  }
  flattenModels(modelCandidatesResponse.value.static).forEach(model => add(model, false))
  flattenModels(modelCandidatesResponse.value.available).forEach(model => add(model, true))
  priceRules.value.forEach(rule => {
    if (!rule?.provider || !rule?.model) return
    const key = `${String(rule.provider).toLowerCase()}::${rule.model}`
    if (!map.has(key)) map.set(key, { key, provider: rule.provider, model: rule.model, displayName: rule.model, description: 'Existing model price rule', ownedBy: '', type: '', available: false, raw: null })
  })
  return [...map.values()].sort((a, b) => Number(b.available) - Number(a.available) || a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))
})
const filteredModelCandidates = computed(() => {
  const query = modelCandidateSearch.value.trim().toLowerCase()
  return modelCandidates.value.filter(candidate =>
    (!availableModelsOnly.value || candidate.available) &&
    (!query || [candidate.model, candidate.displayName, candidate.description, candidate.provider, candidate.ownedBy, candidate.type].some(value => String(value || '').toLowerCase().includes(query)))
  )
})
const selectedPriceCandidates = computed(() => selectedPriceCandidateKeys.value.map(key => modelCandidates.value.find(candidate => candidate.key === key)).filter(Boolean))
const loading = computed(() => overviewLoading.value || chargesLoading.value || balancesLoading.value || pricesLoading.value || settingsLoading.value)
const financeMetrics = computed(() => [
  { label: 'Charged', value: formatCredits(overviewData.value.total_charge_amount), hint: 'Selected range' },
  { label: 'Recharged', value: formatCredits(overviewData.value.total_recharge_amount), hint: 'Selected range' },
  { label: 'Deducted', value: formatCredits(overviewData.value.total_deduct_amount), hint: 'Selected range' },
  { label: 'Total balance', value: formatCredits(overviewData.value.total_balance), hint: 'Current snapshot' }
])
const usageMetrics = computed(() => [
  { label: 'Requests', value: formatNumber(overviewData.value.request_count) },
  { label: 'Input tokens', value: formatNumber(overviewData.value.input_tokens) },
  { label: 'Output tokens', value: formatNumber(overviewData.value.output_tokens) },
  { label: 'Cache tokens', value: formatNumber(overviewData.value.cache_tokens) },
  { label: 'Active users', value: formatNumber(overviewData.value.active_user_count) }
])
const balanceDetailItems = computed(() => selectedBalance.value ? [
  { label: 'Record ID', value: selectedBalance.value.id || '—', mono: true },
  { label: 'Created', value: formatDateTime(selectedBalance.value.created_at) },
  { label: 'User ID', value: selectedBalance.value.user_id ?? '—' },
  { label: 'Type', value: selectedBalance.value.type || '—' },
  { label: 'Amount', value: formatCredits(selectedBalance.value.amount) },
  { label: 'Balance before', value: formatCredits(selectedBalance.value.balance_before) },
  { label: 'Balance after', value: formatCredits(selectedBalance.value.balance_after) },
  { label: 'Operator', value: selectedBalance.value.operator || '—' },
  { label: 'Note', value: selectedBalance.value.note || '—' }
] : [])
const snapshotDetailItems = computed(() => {
  const source = selectedCharge.value?.price_snapshot
  if (!source) return []
  let snapshot = source
  if (typeof source === 'string') {
    try { snapshot = JSON.parse(source) } catch { return [] }
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return []
  const fields = [
    ['provider', 'Provider'], ['model', 'Model'],
    ['matched_service_tier', 'Selected rule tier'], ['min_input_tokens', 'Selected band lower bound (input tokens)'],
    ['requested_service_tier', 'Requested service tier'], ['response_service_tier', 'Response service tier'],
    ['service_tier_source', 'Service tier source'], ['effective_service_tier', 'Effective service tier'],
    ['response_tier_fallback', 'Response tier fallback'],
    ['input_price_per_million', 'Input / million'], ['output_price_per_million', 'Output / million'],
    ['cache_read_price_per_million', 'Cache read / million'], ['cache_write_price_per_million', 'Cache write / million'],
    ['request_price', 'Price / request']
  ]
  return fields.filter(([key]) => Object.hasOwn(snapshot, key)).map(([key, label]) => ({ label, value: typeof snapshot[key] === 'boolean' ? (snapshot[key] ? 'Yes' : 'No') : String(snapshot[key]) }))
})
const chargeDetailItems = computed(() => selectedCharge.value ? [
  { label: 'Charge ID', value: selectedCharge.value.id || '—', mono: true },
  { label: 'Request ID', value: selectedCharge.value.request_id || '—', mono: true },
  { label: 'Created', value: formatDateTime(selectedCharge.value.created_at) },
  { label: 'Endpoint', value: selectedCharge.value.endpoint || '—', mono: true },
  { label: 'Provider / Model', value: `${selectedCharge.value.provider || 'Unknown'} / ${selectedCharge.value.model || 'Unknown'}` },
  { label: 'Actual model', value: selectedCharge.value.actual_model || selectedCharge.value.model || '—' },
  ...[['input_tokens', 'Input tokens'], ['output_tokens', 'Output tokens'], ['cache_tokens', 'Cache tokens']]
    .filter(([key]) => selectedCharge.value[key] != null)
    .map(([key, label]) => ({ label, value: formatNumber(selectedCharge.value[key]) })),
  { label: 'Matched price rule', value: selectedCharge.value.matched_price_rule || '—', mono: true },
  { label: 'Amount', value: formatCredits(selectedCharge.value.amount) },
  { label: 'Balance transition', value: `${formatCredits(selectedCharge.value.balance_before)} → ${formatCredits(selectedCharge.value.balance_after)}` },
  { label: 'Client key', value: selectedCharge.value.api_key_label || selectedCharge.value.api_key_masked || '—' }
] : [])

function buildRangeQuery(source, includeTimezone = true) {
  const query = {}
  if (source.from) query.from = source.from
  if (source.to) query.to = source.to
  if (includeTimezone) query.timezone = deviceTimezone
  if (source.user?.trim()) (/^\d+$/.test(source.user.trim()) ? query.user_id = source.user.trim() : query.user = source.user.trim())
  if (source.provider?.trim()) query.provider = source.provider.trim()
  if (source.model?.trim()) query.model = source.model.trim()
  return query
}
async function loadOverview() { overviewLoading.value = true; try { overview.value = await fetchAPI('/billing/overview', { query: buildRangeQuery(appliedOverviewFilters.value) }) } finally { overviewLoading.value = false } }
async function loadCharges() { chargesLoading.value = true; try { chargesResponse.value = await fetchAPI('/billing/charges', { query: { ...buildRangeQuery(appliedChargeFilters.value), limit: chargePageSize.value, offset: (chargePage.value - 1) * chargePageSize.value } }) } finally { chargesLoading.value = false } }
async function loadBalances() { balancesLoading.value = true; try { balancesResponse.value = await fetchAPI('/billing/balance-records', { query: { ...buildRangeQuery(appliedBalanceFilters.value), limit: balancePageSize.value, offset: (balancePage.value - 1) * balancePageSize.value } }) } finally { balancesLoading.value = false } }
async function loadPrices() { pricesLoading.value = true; try { priceResponse.value = await fetchAPI('/billing/model-prices') } finally { pricesLoading.value = false } }
async function loadSettings() { settingsLoading.value = true; try { const settings = await fetchAPI('/billing/settings'); settingsForm.value = { service_tier_source: settings?.service_tier_source || 'request', report_timezone: settings?.report_timezone || deviceTimezone }; savedTierSource.value = settingsForm.value.service_tier_source } finally { settingsLoading.value = false } }
async function loadDiagnostics() {
  diagnosticsLoading.value = true
  diagnosticsError.value = ''
  try { tierDiagnostics.value = await fetchAPI('/billing/settings/diagnostics') }
  catch (error) { tierDiagnostics.value = null; diagnosticsError.value = errorMessage(error, 'Could not load tier diagnostics.') }
  finally { diagnosticsLoading.value = false }
}
async function loadUsers() { try { usersResponse.value = await fetchAPI('/users') } catch { usersResponse.value = { users: [] } } }
async function loadModelCandidates() {
  if (modelCandidatesLoading.value) return
  modelCandidatesLoading.value = true; modelCandidatesError.value = ''
  try {
    const [available, staticResult] = await Promise.allSettled([fetchAPI('/models?scope=available'), fetchAPI('/models?scope=static')])
    modelCandidatesResponse.value = { available: available.status === 'fulfilled' ? available.value?.models : [], static: staticResult.status === 'fulfilled' ? staticResult.value?.models : [] }
    if (available.status === 'rejected' && staticResult.status === 'rejected') modelCandidatesError.value = 'Could not load available or static model candidates.'
    else if (available.status === 'rejected' || staticResult.status === 'rejected') modelCandidatesError.value = 'Some model candidates could not be loaded.'
  } finally { modelCandidatesLoading.value = false }
}
async function safely(action, fallback) { pageError.value = ''; try { await action() } catch (error) { pageError.value = errorMessage(error, fallback) } }
async function loadPricesSafely() { await safely(loadPrices, 'Failed to load model prices.') }
async function refreshCurrent() {
  const actions = { overview: loadOverview, charges: loadCharges, balances: loadBalances, prices: loadPrices }
  await safely(actions[activeSection.value], 'Failed to refresh billing data.')
}
function selectRange(section, preset) {
  if (preset === 'custom') return
  const filters = { overview: overviewFilters, charges: chargeFilters, balances: balanceFilters }[section]
  Object.assign(filters.value, datesForRange(preset))
}
async function changePageSize(section) {
  if (section === 'charges') { chargePage.value = 1; await safely(loadCharges, 'Failed to load charges.') }
  else { balancePage.value = 1; await safely(loadBalances, 'Failed to load balance records.') }
}
async function openMatchingSettings() { await loadSettings(); await loadDiagnostics(); matchingSettingsOpen.value = true }
async function applyOverviewFilters() { appliedOverviewFilters.value = { ...overviewFilters.value }; await safely(loadOverview, 'Failed to load billing overview.') }
async function resetOverviewFilters() { overviewPreset.value = '7d'; overviewFilters.value = { ...defaultRange(), user: '', provider: '', model: '' }; appliedOverviewFilters.value = { ...overviewFilters.value }; await safely(loadOverview, 'Failed to load billing overview.') }
async function applyChargeFilters() { appliedChargeFilters.value = { ...chargeFilters.value }; chargePage.value = 1; await safely(loadCharges, 'Failed to load charges.') }
async function resetChargeFilters() { chargePreset.value = '7d'; chargeFilters.value = { ...defaultRange(), user: '', provider: '', model: '' }; appliedChargeFilters.value = { ...chargeFilters.value }; chargePage.value = 1; await safely(loadCharges, 'Failed to load charges.') }
async function applyBalanceFilters() { appliedBalanceFilters.value = { ...balanceFilters.value }; balancePage.value = 1; await safely(loadBalances, 'Failed to load balance records.') }
async function resetBalanceFilters() { balancePreset.value = '7d'; balanceFilters.value = { ...defaultRange(), user: '' }; appliedBalanceFilters.value = { ...balanceFilters.value }; balancePage.value = 1; await safely(loadBalances, 'Failed to load balance records.') }
async function changeChargePage(delta) { const next = chargePage.value + delta; const pages = Math.max(1, Math.ceil(chargesTotal.value / chargePageSize.value)); if (next < 1 || next > pages) return; chargePage.value = next; await safely(loadCharges, 'Failed to load charges.') }
async function changeBalancePage(delta) { const next = balancePage.value + delta; const pages = Math.max(1, Math.ceil(balancesTotal.value / balancePageSize.value)); if (next < 1 || next > pages) return; balancePage.value = next; await safely(loadBalances, 'Failed to load balance records.') }

function openBalanceAdjustment(type) { modalError.value = ''; adjustmentForm.value = { type, user_id: '', amount: '', note: '' }; adjustmentOpen.value = true }
async function submitBalanceAdjustment() {
  modalError.value = ''
  const userID = Number(adjustmentForm.value.user_id)
  const amount = Number(adjustmentForm.value.amount)
  if (!Number.isInteger(userID) || userID <= 0) return modalError.value = 'Select a user.'
  if (!Number.isFinite(amount) || amount <= 0) return modalError.value = 'Amount must be positive.'
  if (adjustmentForm.value.type === 'deduct' && !adjustmentForm.value.note.trim()) return modalError.value = 'A note is required for deductions.'
  adjustmentSaving.value = true
  try {
    await fetchAPI(`/billing/balance-records/${adjustmentForm.value.type}`, { method: 'POST', body: { user_id: userID, amount, note: adjustmentForm.value.note.trim() } })
    adjustmentOpen.value = false
    await Promise.all([loadOverview(), loadBalances(), loadUsers()])
    toast.add({ title: adjustmentForm.value.type === 'recharge' ? 'Balance recharged' : 'Balance deducted', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error) { modalError.value = errorMessage(error, 'Could not adjust the balance.') } finally { adjustmentSaving.value = false }
}

async function openPriceForm(rule = null) {
  modalError.value = ''
  editingPrice.value = rule
  modelCandidateSearch.value = ''
  priceFormOpen.value = true
  await loadModelCandidates()
  priceForm.value = rule ? {
    provider: rule.provider || '', model: rule.model || '', service_tier: rule.service_tier || '*', min_input_tokens: String(rule.min_input_tokens ?? 0), input_price_per_million: String(rule.input_price_per_million ?? 0), output_price_per_million: String(rule.output_price_per_million ?? 0), cache_read_price_per_million: String(rule.cache_read_price_per_million ?? 0), cache_write_price_per_million: String(rule.cache_write_price_per_million ?? 0), request_price: String(rule.request_price ?? 0), source: rule.source || 'manual', enabled: Boolean(rule.enabled), note: rule.note || ''
  } : emptyPriceForm()
  contextPreset.value = String(priceForm.value.min_input_tokens) === '0' ? 'base' : String(priceForm.value.min_input_tokens) === '272001' ? '272k' : 'custom'
  const existingKey = rule ? `${String(rule.provider || '').toLowerCase()}::${rule.model || ''}` : ''
  selectedPriceCandidateKeys.value = existingKey ? [existingKey] : []
}
function isPriceCandidateSelected(candidate) { return selectedPriceCandidateKeys.value.includes(candidate.key) }
function togglePriceCandidate(candidate) {
  if (editingPrice.value) { selectedPriceCandidateKeys.value = [candidate.key]; return }
  selectedPriceCandidateKeys.value = isPriceCandidateSelected(candidate) ? selectedPriceCandidateKeys.value.filter(key => key !== candidate.key) : [...selectedPriceCandidateKeys.value, candidate.key]
}
function clearPriceCandidateSelection() { selectedPriceCandidateKeys.value = [] }
function providerMark(provider) { return String(provider || '?').split(/[-_\s]+/).map(part => part[0]).join('').slice(0, 3).toUpperCase() }

async function submitPrice() {
  modalError.value = ''
  const selected = selectedPriceCandidates.value
  if (!selected.length) return modalError.value = 'Select at least one model.'
  if (editingPrice.value && selected.length !== 1) return modalError.value = 'Select one model when editing.'
  const numericFields = ['min_input_tokens', 'input_price_per_million', 'output_price_per_million', 'cache_read_price_per_million', 'cache_write_price_per_million', 'request_price']
  const body = { service_tier: priceForm.value.service_tier.trim() || '*', source: priceForm.value.source, enabled: priceForm.value.enabled, note: priceForm.value.note.trim() }
  for (const field of numericFields) { const value = Number(priceForm.value[field]); if (!Number.isFinite(value) || value < 0 || (field === 'min_input_tokens' && !Number.isSafeInteger(value))) return modalError.value = `${field.replaceAll('_', ' ')} must be a non-negative number.`; body[field] = value }
  priceSaving.value = true
  try {
    if (editingPrice.value) {
      const candidate = selected[0]
      await fetchAPI(`/billing/model-prices/${encodeURIComponent(editingPrice.value.id)}`, { method: 'PATCH', body: { ...body, provider: candidate.provider, model: candidate.model } })
      toast.add({ title: 'Price rule updated', color: 'success', icon: 'i-tabler-circle-check' })
    } else {
      const failed = []
      for (const candidate of selected) {
        try { await fetchAPI('/billing/model-prices', { method: 'POST', body: { ...body, provider: candidate.provider, model: candidate.model } }) }
        catch (error) { failed.push(`${candidate.provider}/${candidate.model}: ${errorMessage(error, 'Could not create rule.')}`) }
      }
      if (failed.length) { modalError.value = `${failed.length} price rule(s) failed. ${failed.join(' | ')}`; await loadPrices(); return }
      toast.add({ title: `${selected.length} price rule(s) created`, color: 'success', icon: 'i-tabler-circle-check' })
    }
    priceFormOpen.value = false
    await loadPrices()
  } catch (error) { modalError.value = errorMessage(error, 'Could not save the price rule.') } finally { priceSaving.value = false }
}

async function copyText(value) { try { await navigator.clipboard.writeText(String(value || '')); toast.add({ title: 'Copied', color: 'success' }) } catch {} }
function contextBandLabel(value) { const amount = Number(value || 0); return amount === 0 ? 'Base context' : amount === 272001 ? '>272K input' : `From ${formatNumber(amount)} input tokens` }
async function togglePriceEnabled(rule, enabled) { togglingPrice.value = rule.id; try { await fetchAPI(`/billing/model-prices/${encodeURIComponent(rule.id)}`, { method: 'PATCH', body: { enabled } }); await loadPrices() } catch (error) { pageError.value = errorMessage(error, 'Could not update the price rule.') } finally { togglingPrice.value = '' } }
function confirmDeletePrice(rule) { deletePriceTarget.value = rule; deletePriceOpen.value = true }
async function deletePrice() { if (!deletePriceTarget.value) return; priceDeleting.value = true; try { await fetchAPI(`/billing/model-prices/${encodeURIComponent(deletePriceTarget.value.id)}`, { method: 'DELETE' }); deletePriceOpen.value = false; await loadPrices(); toast.add({ title: 'Price rule deleted', color: 'success', icon: 'i-tabler-circle-check' }) } catch (error) { pageError.value = errorMessage(error, 'Could not delete the price rule.') } finally { priceDeleting.value = false } }
async function saveSettings() {
  if (settingsForm.value.service_tier_source === 'response' && savedTierSource.value !== 'response') {
    await loadDiagnostics()
    if (diagnosticsError.value || !tierDiagnostics.value?.supported) {
      pageError.value = diagnosticsError.value || 'Response-tier diagnostics are not supported; cannot confirm this change.'
      return
    }
    tierConfirmOpen.value = true
    return
  }
  await persistSettings()
}
async function persistSettings() {
  settingsSaving.value = true
  pageError.value = ''
  try {
    const saved = await fetchAPI('/billing/settings', { method: 'PATCH', body: { service_tier_source: settingsForm.value.service_tier_source } })
    settingsForm.value = saved
    savedTierSource.value = saved.service_tier_source
    tierConfirmOpen.value = false
    matchingSettingsOpen.value = false
    toast.add({ title: 'Tier matching saved', color: 'success', icon: 'i-tabler-circle-check' })
  } catch (error) { pageError.value = errorMessage(error, 'Could not save tier matching.') }
  finally { settingsSaving.value = false }
}
function chargeUserName(charge) {
  if (charge.username) return charge.username
  const user = users.value.find(item => String(item.id) === String(charge.user_id))
  if (user?.username) return user.username
  return charge.user_id ? `User #${charge.user_id}` : 'Unknown user'
}
function openBalanceDetail(record) { selectedBalance.value = record; balanceDetailOpen.value = true }
function openChargeDetail(charge) { selectedCharge.value = charge; chargeDetailOpen.value = true }
function totalChargeTokens(charge) { return (Number(charge.input_tokens) || 0) + (Number(charge.output_tokens) || 0) + (Number(charge.cache_tokens) || 0) }
function trendWidth(value) { return Math.max(2, Math.round(((Number(value) || 0) / maxTrendCharge.value) * 100)) }
function formatCredits(value) { return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(Number(value) || 0) }
function formatNumber(value) { return new Intl.NumberFormat().format(Number(value) || 0) }

function formatDateTime(value) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function prettyJSON(value) { return JSON.stringify(value || {}, null, 2) }
function errorMessage(error, fallback = 'Unexpected request error.') { return error?.data?.message || error?.data?.error || error?.message || fallback }

onMounted(async () => {
  await safely(async () => {
    await loadSettings()
    await Promise.all([loadOverview(), loadCharges(), loadBalances(), loadPrices(), loadUsers()])
  }, 'Failed to load billing data.')
})
</script>

<script>
export default {
  components: {
    PaginationFooter: {
      props: { page: Number, total: Number, pageSize: Number, loading: Boolean },
      emits: ['previous', 'next'],
      computed: {
        pages() { return Math.max(1, Math.ceil((this.total || 0) / this.pageSize)) },
        start() { return this.total ? ((this.page - 1) * this.pageSize) + 1 : 0 },
        end() { return Math.min(this.page * this.pageSize, this.total || 0) }
      },
      template: `<div class="flex flex-col gap-3 border-t border-[var(--ui-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p class="text-xs text-[var(--ui-text-muted)]">Showing {{ start }}–{{ end }} of {{ total || 0 }}</p><div class="flex items-center gap-2"><AppButton size="sm" color="neutral" variant="outline" :disabled="page <= 1 || loading" @click="$emit('previous')">Previous</AppButton><span class="min-w-20 text-center text-sm">Page {{ page }} of {{ pages }}</span><AppButton size="sm" color="neutral" variant="outline" :disabled="page >= pages || loading" @click="$emit('next')">Next</AppButton></div></div>`
    }
  }
}
</script>
