<template>
  <div class="space-y-6">
    <div class="workbench-toolbar justify-between"><div><h2 class="font-semibold">Provider quota snapshots</h2><p class="text-xs text-[var(--ui-text-muted)]">Inspect normalized quota windows and request active collection.</p></div><div class="flex gap-2"><UButton color="neutral" variant="outline" icon="i-tabler-refresh" :loading="pending" @click="refreshQuota">Refresh</UButton><UButton icon="i-tabler-bolt" :loading="collectingAll" @click="collectAll">Collect all</UButton></div></div>
    <UAlert v-if="pageError" color="error" variant="subtle" title="Unable to load quota" :description="pageError" />
    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <UCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Credentials</p><p class="mt-2 text-2xl font-bold">{{ summary.total_credentials ?? total }}</p></UCard>
      <UCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Healthy</p><p class="mt-2 text-2xl font-bold">{{ summary.healthy ?? 0 }}</p></UCard>
      <UCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Low / exhausted</p><p class="mt-2 text-2xl font-bold">{{ (summary.low ?? 0) + (summary.exhausted ?? 0) }}</p></UCard>
      <UCard><p class="text-xs font-semibold uppercase text-[var(--ui-text-muted)]">Stale / never</p><p class="mt-2 text-2xl font-bold">{{ (summary.stale ?? 0) + (summary.never ?? 0) }}</p></UCard>
    </div>
    <div class="workbench-toolbar grid lg:grid-cols-[1fr_220px_220px_auto]">
      <UInput v-model="search" icon="i-tabler-search" placeholder="Search label, account, project..." @keyup.enter="applyFilters" />
      <USelectMenu v-model="provider" :items="providerOptions" value-key="value" label-key="label" :search-input="{ placeholder: 'Search providers...' }" />
      <USelect v-model="quotaStatus" :items="statusOptions" value-key="value" label-key="label" />
      <UButton color="neutral" variant="outline" @click="applyFilters">Apply filters</UButton>
    </div>
    <UCard :ui="{ body: { padding: '' } }">
      <UTable :columns="columns" :data="items" :loading="pending">
        <template #identity-cell="{ row }"><button class="min-w-0 text-left" @click="openDetail(value(row))"><p class="truncate font-medium text-primary-500 hover:underline">{{ value(row).label || value(row).credential_id }}</p><p class="mt-1 max-w-64 truncate font-mono text-xs text-[var(--ui-text-muted)]">{{ value(row).credential_id }}</p></button></template>
        <template #provider-cell="{ row }"><div><UBadge color="neutral" variant="subtle">{{ value(row).provider }}</UBadge><p v-if="value(row).plan?.name" class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ value(row).plan.name }}</p></div></template>
        <template #quota-cell="{ row }"><div><UBadge :color="statusColor(value(row).quota_status)" variant="subtle">{{ value(row).quota_status }}</UBadge><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ value(row).window_count || 0 }} window(s)</p></div></template>
        <template #collection-cell="{ row }"><div><UBadge :color="collectionColor(value(row).collection_status)" variant="subtle">{{ value(row).collection_status }}</UBadge><p class="mt-1 text-xs text-[var(--ui-text-muted)]">{{ value(row).freshness }} · {{ value(row).source || 'no source' }}</p></div></template>
        <template #observed-cell="{ row }"><div class="text-xs"><p>{{ formatDate(value(row).observed_at) }}</p><p v-if="value(row).earliest_reset_at" class="mt-1 text-[var(--ui-text-muted)]">Reset {{ formatDate(value(row).earliest_reset_at) }}</p></div></template>
        <template #actions-cell="{ row }"><div class="flex justify-end gap-1"><UButton color="neutral" variant="ghost" size="sm" icon="i-tabler-eye" @click="openDetail(value(row))"/><UButton color="neutral" variant="ghost" size="sm" icon="i-tabler-bolt" :loading="collectingID === value(row).credential_id" @click="collectOne(value(row))"/></div></template>
        <template #empty><div class="py-14 text-center text-sm text-[var(--ui-text-muted)]">No quota snapshots match these filters.</div></template>
      </UTable>
    </UCard>
    <div class="flex items-center justify-between"><p class="text-xs text-[var(--ui-text-muted)]">Showing {{ items.length }} of {{ total }}</p><div class="flex gap-2"><UButton color="neutral" variant="outline" size="sm" :disabled="offset === 0" @click="previousPage">Previous</UButton><UButton color="neutral" variant="outline" size="sm" :disabled="offset + limit >= total" @click="nextPage">Next</UButton></div></div>

    <UModal v-model:open="detailOpen" :title="detail?.credential?.label || 'Quota details'" description="Latest normalized quota snapshot and provider windows.">
      <template #body><div class="space-y-5"><UAlert v-if="detailError" color="error" variant="subtle" :description="detailError"/><div v-if="detailLoading" class="py-12 text-center"><UIcon name="i-tabler-refresh" class="mx-auto size-6 animate-spin" /></div><template v-else-if="detail"><div class="grid gap-3 sm:grid-cols-3"><div class="rounded-lg bg-[var(--ui-bg-muted)] p-3"><p class="text-xs text-[var(--ui-text-muted)]">Provider</p><p class="mt-1 font-medium">{{ detail.credential.provider }}</p></div><div class="rounded-lg bg-[var(--ui-bg-muted)] p-3"><p class="text-xs text-[var(--ui-text-muted)]">Quota</p><p class="mt-1 font-medium">{{ detail.credential.quota_status }}</p></div><div class="rounded-lg bg-[var(--ui-bg-muted)] p-3"><p class="text-xs text-[var(--ui-text-muted)]">Collection</p><p class="mt-1 font-medium">{{ detail.credential.collection_status }}</p></div></div><div class="space-y-3"><h3 class="font-semibold">Windows</h3><div v-for="window in detail.windows || []" :key="window.id" class="rounded-xl border border-[var(--ui-border)] p-4"><div class="flex items-start justify-between gap-3"><div><p class="font-medium">{{ window.label || window.id }}</p><p class="text-xs text-[var(--ui-text-muted)]">{{ window.scope }} · {{ window.mode }} · {{ window.unit }}</p></div><UBadge :color="statusColor(window.status)" variant="subtle">{{ window.status }}</UBadge></div><div class="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p class="text-xs text-[var(--ui-text-muted)]">Used</p><p>{{ metric(window.used, window.used_ratio) }}</p></div><div><p class="text-xs text-[var(--ui-text-muted)]">Remaining</p><p>{{ metric(window.remaining, window.remaining_ratio) }}</p></div><div><p class="text-xs text-[var(--ui-text-muted)]">Reset</p><p>{{ formatDate(window.reset_at) }}</p></div></div></div><p v-if="!detail.windows?.length" class="text-sm text-[var(--ui-text-muted)]">No quota windows recorded.</p></div><div v-if="detail.reset_credits" class="space-y-3"><h3 class="font-semibold">Reset credits</h3><p class="text-sm">Available: <span class="font-medium">{{ detail.reset_credits.available_count }}</span></p><p class="text-xs text-[var(--ui-text-muted)]">Observed {{ formatDate(detail.reset_credits.observed_at) }}</p><div v-for="(credit, index) in detail.reset_credits.credits || []" :key="index" class="flex items-center justify-between gap-3 rounded-lg border border-[var(--ui-border)] p-3 text-sm"><UBadge :color="statusColor(credit.status)" variant="subtle">{{ credit.status }}</UBadge><span>Expires {{ formatDate(credit.expires_at) }}</span></div><p v-if="!detail.reset_credits.credits?.length" class="text-sm text-[var(--ui-text-muted)]">No credit expiry details available.</p></div><UAlert v-if="detail.collection?.error" color="error" variant="subtle" title="Collection error" :description="detail.collection.error.message"/></template></div></template>
    </UModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const toast = useToast()
const value = row => row?.original ?? row
const search = ref('')
const appliedSearch = ref('')
const ALL_FILTER = '__all__'
const provider = ref(ALL_FILTER)
const appliedProvider = ref('')
const quotaStatus = ref(ALL_FILTER)
const appliedQuotaStatus = ref('')
const offset = ref(0)
const limit = 50
const pageError = ref('')
const collectingAll = ref(false)
const collectingID = ref('')
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detail = ref(null)
const columns = [{ accessorKey: 'identity', header: 'Credential' }, { accessorKey: 'provider', header: 'Provider' }, { accessorKey: 'quota', header: 'Quota' }, { accessorKey: 'collection', header: 'Collection' }, { accessorKey: 'observed', header: 'Observed / reset' }, { accessorKey: 'actions', header: '', meta: { class: { th: 'table-action-head', td: 'table-action-cell' } } }]
async function loadQuota() { pageError.value = ''; try { return await fetchAPI('/quota/credentials', { query: { limit, offset: offset.value, search: appliedSearch.value || undefined, provider: appliedProvider.value || undefined, quota_status: appliedQuotaStatus.value || undefined } }) } catch (error) { pageError.value = message(error); return { items: [], total: 0 } } }
const { data, pending, refresh: refreshQuota } = await useAsyncData('management-quota', loadQuota, { watch: [offset] })
const items = computed(() => Array.isArray(data.value?.items) ? data.value.items : [])
const total = computed(() => Number(data.value?.total || 0))
const summary = computed(() => data.value?.summary ?? data.value?.global_summary ?? {})
const providerOptions = computed(() => [{ label: 'All providers', value: ALL_FILTER }, ...Array.from(new Set([...(data.value?.facets?.providers || []), ...items.value.map(item => item.provider)].map(item => typeof item === 'string' ? item : item?.value).filter(Boolean))).sort().map(value => ({ label: value, value }))])
const statusOptions = [{ label: 'All quota states', value: ALL_FILTER }, ...['healthy', 'low', 'exhausted', 'unknown', 'error', 'unsupported'].map(value => ({ label: value, value }))]

function statusColor(status) { return status === 'healthy' || status === 'available' ? 'success' : status === 'low' ? 'warning' : status === 'exhausted' || status === 'error' ? 'error' : 'neutral' }
function collectionColor(status) { return status === 'success' ? 'success' : status === 'collecting' ? 'info' : status === 'failed' ? 'error' : status === 'partial' ? 'warning' : 'neutral' }
function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }
function metric(value, ratio) { if (value !== null && value !== undefined) return Number(value).toLocaleString(); if (ratio !== null && ratio !== undefined) return `${Math.round(Number(ratio) * 100)}%`; return '—' }
async function applyFilters() { const onFirstPage = offset.value === 0; appliedSearch.value = search.value.trim(); appliedProvider.value = provider.value === ALL_FILTER ? '' : provider.value; appliedQuotaStatus.value = quotaStatus.value === ALL_FILTER ? '' : quotaStatus.value; offset.value = 0; if (onFirstPage) await refreshQuota() }
async function collect(body, success) { const result = await fetchAPI('/quota/collect', { method: 'POST', body }); toast.add({ title: success, description: `${result.accepted || 0} collection(s) accepted`, color: 'success' }); setTimeout(() => refreshQuota(), 1000) }
async function collectAll() { collectingAll.value = true; try { await collect({}, 'Quota collection started') } catch (error) { toast.add({ title: 'Collection failed', description: message(error), color: 'error' }) } finally { collectingAll.value = false } }
async function collectOne(item) { collectingID.value = item.credential_id; try { await collect({ credential_ids: [item.credential_id] }, 'Credential collection started') } catch (error) { toast.add({ title: 'Collection failed', description: message(error), color: 'error' }) } finally { collectingID.value = '' } }
async function openDetail(item) { detailOpen.value = true; detailLoading.value = true; detailError.value = ''; detail.value = null; try { detail.value = await fetchAPI(`/quota/credentials/${encodeURIComponent(item.credential_id)}`) } catch (error) { detailError.value = message(error) } finally { detailLoading.value = false } }
function previousPage() { offset.value = Math.max(0, offset.value - limit) }
function nextPage() { offset.value += limit }
function message(error) { return error?.data?.message || error?.data?.error || error?.message || 'Unexpected request error.' }
</script>
