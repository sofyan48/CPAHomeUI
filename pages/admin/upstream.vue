<template>
  <div class="space-y-5">
    <p
      v-if="summaryPending"
      role="status"
      class="text-sm text-[var(--ui-text-muted)]"
    >
      Loading Upstream summary…
    </p>
    <UAlert
      v-if="summaryError"
      color="warning"
      variant="subtle"
      title="Upstream summary unavailable"
      :description="summaryError"
    />
    <section aria-label="Upstream summary" class="metric-strip">
      <dl class="metric">
        <dt>Accounts</dt>
        <dd class="metric-value">{{ accounts.length }}</dd>
        <dd class="metric-detail">
          {{ activeAccounts }} active · {{ disabledAccounts }} disabled ·
          {{ unavailableAccounts }} unavailable
        </dd>
      </dl>
      <dl class="metric">
        <dt>Provider keys</dt>
        <dd class="metric-value">{{ providerKeyCount }}</dd>
        <dd class="metric-detail truncate" :title="providerGroups">
          {{ providerGroups || "No entries" }}
        </dd>
      </dl>
      <div class="metric">
        <dl>
          <dt>Quota attention</dt>
          <dd class="metric-value">{{ quotaError ? "Unavailable" : attentionCount }}</dd>
          <dd class="metric-detail">Quota status and collection freshness</dd>
        </dl>
        <AppButton
          type="button"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-tabler-arrow-right"
          class="mt-1"
          aria-label="Show accounts needing attention"
          @click="showAttention"
        >Review accounts</AppButton>
      </div>
      <dl class="metric">
        <dt>WebSockets</dt>
        <dd class="metric-value">
          {{ accounts.filter((item) => item.websockets).length }}
        </dd>
        <dd class="metric-detail">Enabled accounts</dd>
      </dl>
    </section>

    <AppPanelTabs
      :model-value="tab"
      :items="upstreamTabs"
      label="Upstream"
      @update:model-value="selectTab"
    />
    <AdminUpstreamAccounts
      v-if="tab === 'accounts'"
      :attention-request="attentionRequest"
      :sync-request="syncRequest"
      @changed="refreshSummary"
    />
    <AdminUpstreamProviders
      v-else
      :sync-request="syncRequest"
      @changed="refreshSummary"
    />
  </div>
</template>

<script setup>
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useStoreData } from '~/composables/useStoreData'
import { useQuotaCollection } from '~/composables/useQuotaCollection'
import { isQuotaAttention } from '~/composables/upstreamQuota'
import { useDataSync } from '~/composables/useDataSync'
const quotaCollection = useQuotaCollection()
const route = useRoute();
if (route.query.tab === "proxy")
  await navigateTo("/admin/proxy-network", { replace: true });
watch(
  () => route.query.tab,
  (value) => {
    if (value === "proxy")
      void navigateTo("/admin/proxy-network", { replace: true });
  },
);
const router = useRouter();
const { fetchAPI, token } = useApi();
const toast = useToast();
const tab = computed(() =>
  route.query.credential
    ? "accounts"
    : route.query.tab === "providers"
      ? "providers"
      : "accounts",
);
const upstreamTabs = [
  { label: "Accounts", value: "accounts" },
  { label: "Providers", value: "providers" },
];
const summaryError = useWorkspaceState('admin:upstream:summaryError', () => (""));
const quotaError = useWorkspaceState('admin:upstream:quotaError', () => (""));
const syncing = useWorkspaceState('admin:upstream:syncing', () => (false));

const attentionRequest = ref(0);
const syncRequest = ref(0);
const providerRoutes = [
  "gemini",
  "interactions",
  "claude",
  "codex",
  "xai",
  "meta",
  "vertex",
  "openai-compatibility",
];
async function loadSummary() {
  summaryError.value = "";
  quotaError.value = "";
  const [auth, ...providers] = await Promise.allSettled([
    fetchAPI("/credentials"),
    ...providerRoutes.map((name) => fetchAPI(`/config/api-keys/${name}`)),
  ]);
  if (auth.status === "rejected")
    summaryError.value = auth.reason?.message || "Could not load accounts.";
  const authData = auth.status === "fulfilled" ? auth.value : null;
  const accounts = Array.isArray(authData)
    ? authData
    : Array.isArray(authData?.files)
      ? authData.files
      : Array.isArray(authData?.credentials)
        ? authData.credentials
        : Array.isArray(authData?.items)
          ? authData.items
          : [];
  const groups = providerRoutes.map((name, index) => {
    const result = providers[index];
    const response = result.status === "fulfilled" ? result.value : null;
    const groups = Array.isArray(response) ? response : [];
    return {
      name,
      count: groups.reduce(
        (total, group) =>
          total + (Array.isArray(group?.keys) ? group.keys.length : 0),
        0,
      ),
    };
  });
  if (providers.some((result) => result.status === "rejected"))
    summaryError.value = [
      summaryError.value,
      "Some provider groups could not be loaded.",
    ]
      .filter(Boolean)
      .join(" ");
  return { accounts, groups };
}
const {
  data: summary,
  pending: summaryPending,
  refresh: refreshSummary,
} = useStoreData('admin:upstream:upstream-summary', loadSummary, {
  lazy: true,
  default: () => ({ accounts: [], groups: [] }),
});
const accounts = computed(() => summary.value?.accounts || []);
async function loadSummaryQuota() {
  quotaError.value = "";
  const items = accounts.value;
  if (!items.length) return [];
  try {
    const quota = [];
    for (let index = 0; index < items.length; index += 200) {
      const ids = items
        .slice(index, index + 200)
        .map((item) => item.id)
        .filter(Boolean)
        .join(",");
      if (!ids) continue;
      const result = await fetchAPI("/quota/credentials", {
        query: { ids, limit: 200 },
      });
      quota.push(...(result.items || []));
    }
    return quota;
  } catch (error) {
    quotaError.value = error?.message || "Quota snapshots unavailable.";
    return [];
  }
}
const summaryIDs = computed(() =>
  accounts.value
    .map((item) => item.id)
    .filter(Boolean)
    .join(","),
);
const { data: summaryQuota, refresh: refreshSummaryQuota } = useStoreData('admin:upstream:upstream-summary-quota',
  loadSummaryQuota,
  { lazy: true, default: () => [], watch: [summaryIDs] },
);
const activeAccounts = computed(
  () =>
    accounts.value.filter((item) => !item.disabled && !item.unavailable).length,
);
const disabledAccounts = computed(
  () => accounts.value.filter((item) => item.disabled).length,
);
const unavailableAccounts = computed(
  () =>
    accounts.value.filter((item) => !item.disabled && item.unavailable).length,
);
const providerKeyCount = computed(() =>
  (summary.value?.groups || []).reduce((total, item) => total + item.count, 0),
);
const providerGroups = computed(() =>
  (summary.value?.groups || [])
    .filter((item) => item.count)
    .map((item) => item.name)
    .join(", "),
);
const attentionCount = computed(
  () => (summaryQuota.value || []).filter(isQuotaAttention).length,
);
function selectTab(value) {
  void router.replace({
    query: { ...route.query, tab: value, credential: undefined },
  });
}
function showAttention() {
  if (tab.value === "providers") selectTab("accounts");
  attentionRequest.value++;
}
watch(quotaCollection.revision, () => { void refreshSummaryQuota() });
useDataSync('admin:upstream:quota-collection', syncData);
async function syncData() {
  if (syncing.value) return;
  const session = token.value;
  syncing.value = true;
  try {
    await Promise.all([quotaCollection.collect(), refreshSummary()]);
    if (session !== token.value) return;
    void refreshSummaryQuota();
    syncRequest.value++;
  } catch (error) {
    if (session !== token.value) return;
    toast.add({
      title: "Sync failed",
      description: error?.message || "Could not queue quota collection.",
      color: "error",
    });
  } finally {
    syncing.value = false;
  }
}
</script>

<style scoped>
.metric-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  background: var(--ui-border);
}

.metric {
  min-width: 0;
  padding: 0.75rem 1rem;
  background: var(--ui-bg-elevated);
}

.metric dt,
.metric-detail {
  font-size: 0.75rem;
  line-height: 1rem;
  color: var(--ui-text-muted);
}

.metric-value {
  margin-block: 0.25rem;
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 40rem) {
  .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 80rem) {
  .metric-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
