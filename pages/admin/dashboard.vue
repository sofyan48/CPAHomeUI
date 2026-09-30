<template>
  <div class="space-y-6">
    <UAlert
      v-if="loadError"
      color="error"
      variant="subtle"
      title="Dashboard data could not be loaded"
      :description="loadError"
    >
      <template #actions
        ><AppButton
          color="neutral"
          variant="outline"
          size="sm"
          @click="refreshDashboard"
          >Retry</AppButton
        ></template
      >
    </UAlert>

    <template v-if="snapshot && !loadError">
      <AppCard
        class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
      >
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="font-semibold">{{ health.title }}</h1>
                <UBadge :color="health.color" variant="subtle">{{
                  health.label
                }}</UBadge>
              </div>
              <p class="mt-1 text-sm text-[var(--ui-text-muted)]">
                {{ health.description }}
              </p>
            </div>
            <AppButton
              icon="i-tabler-refresh"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="loading"
              @click="refreshDashboard"
              >{{ loading ? "Syncing" : "Sync data" }}</AppButton
            >
          </div>
        </template>
        <div class="flex flex-wrap gap-2">
          <UBadge color="info" variant="subtle" icon="i-tabler-server"
            >Server: {{ runtimeMode || "Home" }}</UBadge
          >
          <UBadge color="success" variant="subtle" icon="i-tabler-tag"
            >Version: {{ latestVersion || "Unavailable" }}</UBadge
          >
          <UBadge color="warning" variant="subtle" icon="i-tabler-clock-check"
            >Synced:
            {{
              lastUpdated ? lastUpdated.toLocaleString() : "Not synced"
            }}</UBadge
          >
        </div>
        <div
          v-if="missingCapabilities.length"
          class="mt-4 flex flex-wrap gap-2"
        >
          <UBadge
            v-for="item in missingCapabilities"
            :key="item.label"
            color="neutral"
            variant="subtle"
            >{{ item.label }} unavailable</UBadge
          >
        </div>
        <div
          v-if="suggestedActions.length"
          class="mt-4 flex flex-wrap items-center gap-2"
        >
          <span class="text-xs font-medium">Suggested actions</span
          ><AppButton
            v-for="action in suggestedActions"
            :key="action.label"
            :to="action.to"
            size="sm"
            color="neutral"
            variant="outline"
            >{{ action.label }}</AppButton
          >
        </div>
      </AppCard>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="card in operatingCards"
          :key="card.label"
          :to="card.to"
          class="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <AppCard
            class="h-full border-white/40 bg-white/40 transition-shadow group-hover:shadow-lg dark:border-white/10 dark:bg-neutral-900/40"
          >
            <template #header
              ><h2 class="font-semibold">{{ card.label }}</h2></template
            >
            <p class="text-2xl font-semibold tabular-nums">{{ card.value }}</p>
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
              {{ card.detail }}
            </p>
          </AppCard>
        </NuxtLink>
      </section>

      <section
        v-if="tokenTrend.length || activity.length"
        class="grid gap-4 lg:grid-cols-2"
      >
        <AdminDashboardTokenTrend
          v-if="tokenTrend.length"
          :trend="tokenTrend"
          :range="usage?.range"
        />
        <AdminDashboardRequestHealth
          v-if="activity.length"
          :activity="activity"
          :range="usage?.range"
        />
      </section>

      <section class="grid gap-4 lg:grid-cols-2">
        <AppCard
          class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
        >
          <template #header
            ><div class="flex items-center justify-between">
              <div>
                <h2 class="font-semibold">Key status</h2>
                <p class="text-xs text-[var(--ui-text-muted)]">
                  {{
                    formatNumber(usage?.totals?.active_client_key_count ?? 0)
                  }}
                  active · {{ formatNumber(quietKeyCount) }} quiet ·
                  {{ formatNumber(clientKeys.length) }} configured
                </p>
              </div>
              <AppButton
                to="/admin/usage"
                color="neutral"
                variant="ghost"
                size="sm"
                >Usage details</AppButton
              >
            </div></template
          >
          <div v-if="topClientKeys.length" class="space-y-3">
            <div
              v-for="(item, index) in topClientKeys"
              :key="item.id || index"
              class="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] pb-3 last:border-0 last:pb-0"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
                  {{ index + 1 }}. {{ keyLabel(item) }}
                </p>
                <p class="text-xs text-[var(--ui-text-muted)]">
                  {{ formatNumber(item.request_count) }} requests ·
                  {{ formatPercent(item.success_rate) }} success<span
                    v-if="item.failed_count"
                  >
                    · {{ formatNumber(item.failed_count) }} failed</span
                  >
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold"
                >{{
                  item.token_breakdown?.total_tokens == null
                    ? "--"
                    : formatCompact(item.token_breakdown.total_tokens)
                }}
                tokens</span
              >
            </div>
          </div>
          <p
            v-else
            class="py-8 text-center text-sm text-[var(--ui-text-muted)]"
          >
            {{
              usage
                ? "No client key activity in this range."
                : "Key usage is unavailable."
            }}
          </p>
        </AppCard>
        <AppCard
          class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
        >
          <template #header
            ><div class="flex items-center justify-between">
              <div>
                <h2 class="font-semibold">Model usage distribution</h2>
                <p class="text-xs text-[var(--ui-text-muted)]">
                  {{
                    formatNumber(usage?.totals?.active_model_count ?? 0)
                  }}
                  models used
                </p>
              </div>
              <AppButton
                to="/admin/usage"
                color="neutral"
                variant="ghost"
                size="sm"
                >Usage details</AppButton
              >
            </div></template
          >
          <div v-if="topModels.length" class="space-y-3">
            <div
              v-for="(item, index) in topModels"
              :key="item.id || index"
              class="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] pb-3 last:border-0 last:pb-0"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
                  {{ index + 1 }}. {{ item.label || item.id }}
                </p>
                <p class="text-xs text-[var(--ui-text-muted)]">
                  {{ formatNumber(item.request_count) }} requests ·
                  {{ formatPercent(item.success_rate) }} success<span
                    v-if="item.failed_count"
                  >
                    · {{ formatNumber(item.failed_count) }} failed</span
                  >
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold"
                >{{
                  item.token_breakdown?.total_tokens == null
                    ? "--"
                    : formatCompact(item.token_breakdown.total_tokens)
                }}
                tokens</span
              >
            </div>
          </div>
          <p
            v-else
            class="py-8 text-center text-sm text-[var(--ui-text-muted)]"
          >
            {{
              usage
                ? "No model activity in this range."
                : "Model usage is unavailable."
            }}
          </p>
        </AppCard>
      </section>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink
          v-for="card in inventoryCards"
          :key="card.label"
          :to="card.to"
          class="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <AppCard
            class="h-full border-white/40 bg-white/40 transition-shadow group-hover:shadow-lg dark:border-white/10 dark:bg-neutral-900/40"
          >
            <template #header
              ><h2 class="font-semibold">{{ card.label }}</h2></template
            >
            <p class="text-2xl font-semibold tabular-nums">
              {{ formatNumber(card.value) }}
            </p>
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
              {{ card.detail }}
            </p>
          </AppCard>
        </NuxtLink>
      </section>

      <section class="grid gap-4 lg:grid-cols-2">
        <AppCard
          class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
          ><template #header
            ><div class="flex items-center justify-between">
              <h2 class="font-semibold">Model service access</h2>
              <AppButton
                to="/admin/providers"
                color="neutral"
                variant="ghost"
                size="sm"
                >Manage</AppButton
              >
            </div></template
          >
          <div class="space-y-2">
            <div
              v-for="provider in providerRows"
              :key="provider.path"
              class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] py-2 text-sm last:border-0"
            >
              <div>
                <p class="font-medium">{{ provider.label }}</p>
                <p class="font-mono text-xs text-[var(--ui-text-muted)]">
                  {{ provider.path }}
                </p>
              </div>
              <p class="text-xs">
                {{ provider.total }} total · {{ provider.active }} available ·
                {{ provider.disabled }} disabled
              </p>
            </div>
          </div>
          <AppButton
            v-if="providerRows.every((item) => item.total === 0)"
            to="/admin/providers"
            color="neutral"
            variant="outline"
            size="sm"
            class="mt-4"
            >Configure model service</AppButton
          >
        </AppCard>
        <AppCard
          class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
          ><template #header
            ><h2 class="font-semibold">Key switches</h2></template
          >
          <div class="space-y-3">
            <div
              v-for="item in configChecks"
              :key="item.label"
              class="flex items-center justify-between gap-4 text-sm"
            >
              <span>{{ item.label }}</span
              ><UBadge :color="item.color" variant="subtle">{{
                item.value
              }}</UBadge>
            </div>
          </div>
        </AppCard>
      </section>

      <section class="grid gap-4 lg:grid-cols-2">
        <AppCard
          v-if="dataIssues.length || missingCapabilities.length"
          class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
          ><template #header
            ><h2 class="font-semibold">
              Data loading status ·
              {{ dataIssues.length + missingCapabilities.length }}
            </h2></template
          >
          <div class="space-y-2">
            <div
              v-for="item in statusItems.slice(0, 4)"
              :key="item.label"
              class="flex items-center justify-between gap-2 text-sm"
            >
              <span>{{ item.label }} · {{ item.detail }}</span
              ><AppButton :to="item.to" size="xs" color="neutral" variant="ghost"
                >Review</AppButton
              >
            </div>
          </div>
        </AppCard>
        <AppCard
          class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
          ><template #header
            ><h2 class="font-semibold">Account credential sources</h2></template
          >
          <div v-if="credentialSources.length" class="space-y-2">
            <div
              v-for="source in credentialSources"
              :key="source.label"
              class="flex justify-between text-sm"
            >
              <span>{{ source.label }}</span
              ><strong>{{ source.count }}</strong>
            </div>
          </div>
          <p
            v-else
            class="py-6 text-center text-sm text-[var(--ui-text-muted)]"
          >
            No account credential sources available.
          </p>
        </AppCard>
      </section>
    </template>
    <p
      v-else-if="loading"
      class="py-12 text-center text-sm text-[var(--ui-text-muted)]"
    >
      Loading dashboard…
    </p>
  </div>
</template>

<script setup lang="ts">
const { fetchAPI } = useApi();
const { refreshCapabilities, supports } = useCapabilities();

type Issue = { label: string; detail: string; to: string };
type ProviderRow = {
  label: string;
  path: string;
  total: number;
  active: number;
  disabled: number;
};
const providers = [
  { label: "Gemini", path: "/config/api-keys/gemini" },
  { label: "Google Interactions", path: "/config/api-keys/interactions" },
  { label: "Claude", path: "/config/api-keys/claude" },
  { label: "Codex", path: "/config/api-keys/codex" },
  { label: "Vertex", path: "/config/api-keys/vertex" },
  {
    label: "OpenAI compatibility",
    path: "/config/api-keys/openai-compatibility",
  },
  { label: "xAI", path: "/config/api-keys/xai" },
];
const loading = ref(false);
const loadError = ref("");
const lastUpdated = ref<Date | null>(null);
const snapshot = ref(false);
const config = ref<Record<string, any>>({});
const latestVersion = ref("");
const clientKeys = ref<any[]>([]);
const accountFiles = ref<any[]>([]);
const providerRows = ref<ProviderRow[]>([]);
const availableModels = ref<number | null>(null);
const topology = ref<any>(null);
const nodes = ref<any[]>([]);
const usage = ref<any>(null);
const dataIssues = ref<Issue[]>([]);
const runtimeMode = computed(() =>
  String(
    config.value["mode"] || config.value["runtime-mode"] || "",
  ).toLowerCase(),
);
const visibleProviders = computed(() =>
  runtimeMode.value === "cpa"
    ? providers.filter((item) => item.label !== "xAI")
    : providers,
);
const availableProviders = computed(() =>
  providerRows.value.reduce((sum, item) => sum + item.active, 0),
);
const activeAccounts = computed(
  () =>
    accountFiles.value.filter(
      (item) => item.disabled !== true && item.unavailable !== true,
    ).length,
);
const hasUsage = computed(() => !!usage.value);
const topClientKeys = computed<any[]>(() =>
  Array.isArray(usage.value?.top?.client_keys)
    ? usage.value.top.client_keys.slice(0, 3)
    : [],
);
const topModels = computed<any[]>(() =>
  Array.isArray(usage.value?.top?.models)
    ? usage.value.top.models.slice(0, 3)
    : [],
);
const tokenTrend = computed(() =>
  Array.isArray(usage.value?.trend) &&
  usage.value?.totals?.token_breakdown?.total_tokens != null &&
  usage.value.trend.every(
    (point: any) => point.token_breakdown?.total_tokens != null,
  )
    ? usage.value.trend
    : [],
);
const activity = computed(() =>
  Array.isArray(usage.value?.activity) ? usage.value.activity : [],
);
const quietKeyCount = computed(() =>
  Math.max(
    0,
    clientKeys.value.length -
      Number(usage.value?.totals?.active_client_key_count || 0),
  ),
);
const homeCount = computed(
  () =>
    topology.value?.summary?.home_count ??
    new Set(
      nodes.value
        .filter((node) => node.home_ip)
        .map((node) => `${node.home_ip}:${node.home_port || 0}`),
    ).size,
);
const cpaCount = computed(
  () => topology.value?.summary?.cpa_count ?? nodes.value.length,
);
const routing = computed(() => {
  const value = String(
    config.value["routing"]?.strategy ||
      config.value["routing-strategy"] ||
      "round-robin",
  );
  return ["round-robin", "weighted-round-robin", "fill-first"].includes(value)
    ? value
    : "Unknown";
});
const missingCapabilities = computed(() =>
  [
    {
      label: "Node topology",
      enabled: supports("topology", false) || supports("nodes", false),
    },
    { label: "Usage statistics", enabled: supports("usage_overview", false) },
    { label: "Request logs", enabled: supports("logs", false) },
    { label: "Error logs", enabled: supports("request_error_logs", false) },
    { label: "User management", enabled: supports("users", false) },
    { label: "Access scopes", enabled: supports("access_groups", false) },
  ].filter((item) => !item.enabled),
);
const statusItems = computed<Issue[]>(() => [
  ...dataIssues.value,
  ...missingCapabilities.value.map((item) => ({
    label: item.label,
    detail: "Not provided by this runtime",
    to:
      item.label === "Usage statistics"
        ? "/admin/usage"
        : item.label === "Request logs" || item.label === "Error logs"
          ? "/admin/diagnostics"
          : item.label === "User management"
            ? "/admin/users"
            : item.label === "Access scopes"
              ? "/admin/users"
              : "/admin/system-nodes",
  })),
]);
const health = computed(() => {
  if (availableModels.value === null)
    return {
      title: "Model request status cannot be confirmed",
      description:
        "Available model data could not be loaded. Sync again or review data status instead of treating the current inventory counts as missing configuration.",
      label: "Needs review",
      color: "warning" as const,
    };
  if (availableModels.value === 0)
    return availableProviders.value || activeAccounts.value
      ? {
          title: "No models are currently available",
          description:
            "Upstream configuration was detected, but the runtime has not registered any available models. Review model services or account credential status and model mappings.",
          label: "Needs review",
          color: "warning" as const,
        }
      : {
          title: "Add upstream model access",
          description:
            "The runtime has no available models and no model service keys or account credentials were detected. Configure at least one upstream access method.",
          label: "Needs review",
          color: "warning" as const,
        };
  if (!clientKeys.value.length)
    return {
      title: "Create a client access key",
      description: "Model access is ready; add a client key to allow requests.",
      label: "Needs review",
      color: "warning" as const,
    };
  if (
    dataIssues.value.length ||
    config.value.debug === true ||
    config.value.observability?.logs?.debug === true ||
    routing.value === "Unknown"
  )
    return {
      title: "Service is connected with items to review",
      description: "Review the data loading status and configuration below.",
      label: "Needs review",
      color: "warning" as const,
    };
  if (missingCapabilities.value.length)
    return {
      title: "Service is connected with limited capabilities",
      description:
        "Core data loaded, but this runtime does not expose every observability route. Model, credential, and config management remain available.",
      label: "Limited",
      color: "info" as const,
    };
  return {
    title: "Model requests are available",
    description:
      "Available models and a client access key were detected. Model access can come from model service keys or OAuth and file-backed credentials.",
    label: "Ready",
    color: "success" as const,
  };
});
const suggestedActions = computed(() => {
  const actions: { label: string; to: string }[] = [];
  if (availableModels.value === null)
    actions.push({ label: "Review data status", to: "/admin/system-nodes" });
  if (availableModels.value === 0) {
    if (!activeAccounts.value)
      actions.push({ label: "Add credential", to: "/admin/credentials" });
    actions.push({
      label: availableProviders.value
        ? "Review model services"
        : "Configure providers",
      to: "/admin/providers",
    });
  }
  if (!clientKeys.value.length)
    actions.push({ label: "Create client key", to: "/admin/access-keys" });
  if (routing.value === "Unknown")
    actions.push({ label: "Check routing", to: "/admin/config" });
  if (
    config.value.debug === true ||
    config.value.observability?.logs?.debug === true
  )
    actions.push({ label: "Review debug mode", to: "/admin/config" });
  if (dataIssues.value.length)
    actions.push({ label: "Review data status", to: "/admin/system-nodes" });
  return actions.slice(0, 3);
});
const operatingCards = computed(() => [
  {
    label: "Total token consumption",
    value:
      hasUsage.value &&
      usage.value.totals?.token_breakdown?.total_tokens != null
        ? formatCompact(usage.value.totals.token_breakdown.total_tokens)
        : "--",
    detail:
      hasUsage.value &&
      usage.value.totals?.token_breakdown?.total_tokens != null
        ? `Across ${formatNumber(usage.value.totals?.active_model_count || 0)} active models`
        : "No usage yet",
    to: hasUsage.value ? "/admin/usage" : undefined,
  },
  {
    label: "Total requests",
    value: hasUsage.value
      ? formatNumber(usage.value.totals?.request_count)
      : "--",
    detail: hasUsage.value
      ? `${formatNumber(usage.value.totals?.failed_count)} failed requests`
      : "No requests yet",
    to: hasUsage.value ? "/admin/usage" : undefined,
  },
  {
    label: "Request success rate",
    value: hasUsage.value
      ? formatPercent(usage.value.totals?.success_rate)
      : "--",
    detail: hasUsage.value
      ? `${formatPercent(usage.value.totals?.error_rate)} error rate`
      : "No success rate yet",
    to: hasUsage.value ? "/admin/diagnostics" : undefined,
  },
  {
    label: "Active access keys",
    value: hasUsage.value
      ? formatNumber(usage.value.totals?.active_client_key_count)
      : "--",
    detail: hasUsage.value
      ? `${formatNumber(usage.value.totals?.active_credential_count)} execution credentials used`
      : "No active keys yet",
    to: hasUsage.value ? "/admin/usage" : undefined,
  },
]);
const inventoryCards = computed(() => [
  {
    label: "Enabled model service keys",
    value: availableProviders.value,
    detail: `${providerRows.value.filter((item) => item.total > 0).length} model service types connected`,
    to: "/admin/providers",
  },
  {
    label: "Enabled account credentials",
    value: activeAccounts.value,
    detail: `${accountFiles.value.length} total records`,
    to: "/admin/credentials",
  },
  {
    label: "Client access keys",
    value: clientKeys.value.length,
    detail: `${clientKeys.value.length} keys can call the server API`,
    to: "/admin/access-keys",
  },
  ...(supports("topology", false) || supports("nodes", false)
    ? [
        {
          label: "Runtime nodes",
          value: cpaCount.value,
          detail: `${homeCount.value} Home instances`,
          to: "/admin/system-nodes",
        },
      ]
    : []),
]);
const configChecks = computed(() => {
  const logs = config.value.observability?.logs || config.value;
  const usageConfig = config.value.observability?.usage || config.value;
  return [
    {
      label: "Request log",
      value: logs["request-log"] === true ? "Enabled" : "Disabled",
      color: logs["request-log"] === true ? "success" : "warning",
    },
    {
      label: "Usage statistics",
      value:
        usageConfig["usage-statistics-enabled"] === true
          ? "Enabled"
          : "Disabled",
      color:
        usageConfig["usage-statistics-enabled"] === true
          ? "success"
          : "warning",
    },
    {
      label: "File logging",
      value: logs["logging-to-file"] === true ? "Enabled" : "Disabled",
      color: "neutral",
    },
    {
      label: "Debug mode",
      value: logs.debug === true ? "Enabled" : "Disabled",
      color: logs.debug === true ? "warning" : "success",
    },
    {
      label: "Routing strategy",
      value: routing.value,
      color: routing.value === "Unknown" ? "warning" : "success",
    },
  ] as const;
});
const credentialSources = computed(() => {
  const counts = new Map<string, number>();
  for (const item of accountFiles.value) {
    const source = String(item.source || "unknown").toLowerCase();
    const label =
      source === "db" || source === "database"
        ? "Database"
        : source === "file"
          ? "File"
          : source === "memory"
            ? "Memory"
            : source === "unknown"
              ? "Unknown"
              : source;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
});
function formatNumber(value: unknown) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}
function formatCompact(value: unknown) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}
function formatPercent(value: unknown) {
  if (value == null) return "--";
  const num = Number(value);
  return Number.isFinite(num) ? `${(num * 100).toFixed(1)}%` : "--";
}
function keyLabel(item: any) {
  if (item.metadata?.username) return item.metadata.username;
  const userId = Number(item.metadata?.user_id);
  const owner = snapshotUsers.value.find((user) => Number(user.id) === userId);
  if (owner?.username) return owner.username;
  const key = clientKeys.value.find(
    (key) => String(key.id) === String(item.metadata?.api_key_id || item.id),
  );
  return (
    key?.display_name || key?.name || item.label || item.id || "Client key"
  );
}
const snapshotUsers = ref<any[]>([]);

async function refreshDashboard() {
  if (loading.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    const configResponse = await fetchAPI<Record<string, any>>("/config");
    const issues: Issue[] = [];
    try {
      await refreshCapabilities(true);
    } catch (error: any) {
      issues.push({
        label: "Capabilities",
        detail: error?.statusCode
          ? `HTTP ${error.statusCode}`
          : error?.message || "Request failed",
        to: "/admin/system-nodes",
      });
    }
    const optional = async <T,>(
      label: string,
      path: string,
      fallback: T,
      to: string,
    ): Promise<T> => {
      try {
        return await fetchAPI<T>(path);
      } catch (error: any) {
        issues.push({
          label,
          detail: error?.statusCode
            ? `HTTP ${error.statusCode}`
            : error?.message || "Request failed",
          to,
        });
        return fallback;
      }
    };
    const rawConfig =
      configResponse?.config && typeof configResponse.config === "object"
        ? configResponse.config
        : configResponse;
    config.value = rawConfig || {};
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const usageQuery = new URLSearchParams({
      from: from.toISOString(),
      to: now.toISOString(),
      timezone,
    });
    const [
      version,
      keys,
      files,
      models,
      rows,
      topologyResponse,
      nodeResponse,
      overview,
      users,
    ] = await Promise.all([
      optional<any>(
        "Latest version",
        "/server/latest-version",
        null,
        "/admin/system-nodes",
      ),
      optional<any>(
        "Client keys",
        "/access/api-keys",
        null,
        "/admin/access-keys",
      ),
      optional<any>(
        "Account credentials",
        "/credentials",
        { items: [] },
        "/admin/credentials",
      ),
      optional<any>(
        "Available models",
        "/models?scope=available",
        null,
        "/admin/providers",
      ),
      Promise.all(
        visibleProviders.value.map(async (provider) => {
          const groups = await optional<any[]>(
            provider.label,
            provider.path,
            [],
            "/admin/providers",
          );
          const entries = Array.isArray(groups)
            ? groups.flatMap((group) =>
                Array.isArray(group?.keys)
                  ? group.keys.map((key: any) => ({
                      ...key,
                      disabled:
                        key?.disabled === true || group?.disabled === true,
                    }))
                  : [],
              )
            : [];
          const disabled = entries.filter((item: any) => item.disabled).length;
          return {
            ...provider,
            total: entries.length,
            disabled,
            active: entries.length - disabled,
          };
        }),
      ),
      supports("topology", false)
        ? optional<any>("Topology", "/topology", null, "/admin/system-nodes")
        : Promise.resolve(null),
      supports("nodes", false) && !supports("topology", false)
        ? optional<any>("Nodes", "/nodes", { nodes: [] }, "/admin/system-nodes")
        : Promise.resolve(null),
      supports("usage_overview", false)
        ? optional<any>(
            "Usage overview",
            `/usage/overview?${usageQuery}`,
            null,
            "/admin/usage",
          )
        : Promise.resolve(null),
      supports("users", false)
        ? optional<any>("Users", "/users", { items: [] }, "/admin/users")
        : Promise.resolve({ items: [] }),
    ]);
    let nodeFallback = nodeResponse;
    if (
      !topologyResponse &&
      supports("topology", false) &&
      supports("nodes", false)
    )
      nodeFallback = await optional<any>(
        "Nodes",
        "/nodes",
        { nodes: [] },
        "/admin/system-nodes",
      );
    latestVersion.value = String(
      version?.["latest-version"] || version?.latest_version || "",
    );
    clientKeys.value = Array.isArray(keys?.items)
      ? keys.items
      : Array.isArray(keys?.api_key_entries)
        ? keys.api_key_entries
        : Array.isArray(keys?.keys)
          ? keys.keys
          : keys == null
            ? Array.isArray(rawConfig?.["api-keys"])
              ? rawConfig["api-keys"]
              : []
            : [];
    accountFiles.value = Array.isArray(files)
      ? files
      : Array.isArray(files?.credentials)
        ? files.credentials
        : Array.isArray(files?.files)
          ? files.files
          : Array.isArray(files?.items)
            ? files.items
            : [];
    availableModels.value = Array.isArray(models?.models)
      ? models.models.length
      : models?.models && typeof models.models === "object"
        ? Object.values(models.models).flat().length
        : null;
    providerRows.value = rows;
    topology.value = topologyResponse;
    nodes.value = Array.isArray(nodeFallback?.nodes) ? nodeFallback.nodes : [];
    usage.value = overview;
    snapshotUsers.value = Array.isArray(users?.items)
      ? users.items
      : Array.isArray(users?.users)
        ? users.users
        : [];
    dataIssues.value = issues;
    lastUpdated.value = new Date();
    snapshot.value = true;
  } catch (error: any) {
    loadError.value = error?.message || "Unable to load dashboard data.";
  } finally {
    loading.value = false;
  }
}
onMounted(refreshDashboard);
</script>
