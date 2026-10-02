<template>
  <section class="grid gap-5">
    <UAlert
      v-if="pageError"
      color="error"
      variant="subtle"
      title="System config could not be loaded"
      :description="pageError"
    />

    <div v-if="loading && !loaded" class="grid gap-4">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else class="grid items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside
        class="hidden min-w-0 self-start xl:block"
      >
        <AppCard :ui="{ body: 'p-2 sm:p-2' }">
          <p
            class="px-2 pb-2 text-xs font-semibold uppercase text-[var(--ui-text-muted)]"
          >
            Configuration
          </p>
          <button
            v-for="section in outline"
            :key="section.id"
            type="button"
            class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--ui-bg-elevated)]"
            @click="scrollToSection(section.id)"
          >
            <span>{{ section.short }}</span
            ><span
              v-if="sectionDirty(section.keys)"
              class="size-2 rounded-full bg-[var(--ui-primary)]"
            />
          </button>
        </AppCard>
      </aside>

      <div class="min-w-0">
        <AppCard
          class="sticky top-24 z-20 mb-4 xl:hidden"
          :ui="{ body: 'flex gap-1 overflow-x-auto p-2' }"
        >
          <AppButton
            v-for="section in outline"
            :key="section.id"
            size="sm"
            color="neutral"
            variant="ghost"
            class="shrink-0"
            @click="scrollToSection(section.id)"
            >{{ section.short }}</AppButton
          >
        </AppCard>

        <AdminConfigVisualSections
          v-model:draft="draft"
          :validation-errors="validationErrors"
          :loading="loading"
        >
          <template #oauth-rules>
            <AppCard
              id="config-oauth-rules"
              class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
            >
              <template #header
                ><div>
                  <h2 class="font-semibold">OAuth model rules</h2>
                  <p class="text-xs text-[var(--ui-text-muted)]">
                    Configure disabled models and client-visible aliases for
                    OAuth and file-backed credentials.
                  </p>
                </div></template
              >
              <div class="space-y-6">
                <section class="space-y-3">
                  <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <UFormField label="Channel" class="lg:w-64"
                      ><USelect
                        v-model="exclusionChannel"
                        :items="channelOptions"
                        value-key="value"
                        label-key="label"
                        class="w-full"
                        @update:model-value="loadChannelModels" /></UFormField
                    ><UInput
                      v-model="modelSearch"
                      icon="i-tabler-search"
                      placeholder="Search model ID, name, or owner"
                      class="flex-1"
                    /><AppButton
                      color="neutral"
                      variant="outline"
                      :loading="modelsLoading"
                      @click="loadChannelModels"
                      >Reload models</AppButton
                    >
                  </div>
                  <div
                    class="max-h-80 overflow-y-auto rounded-md border border-[var(--ui-border)]"
                  >
                    <label
                      v-for="model in filteredChannelModels"
                      :key="model.id"
                      class="flex items-start gap-3 border-b border-[var(--ui-border)] px-3 py-2 last:border-b-0"
                      ><UCheckbox
                        :model-value="excludedForChannel.includes(model.id)"
                        @update:model-value="toggleExcluded(model.id, $event)"
                      /><span
                        ><span class="block text-sm font-medium">{{
                          model.display_name || model.name || model.id
                        }}</span
                        ><span
                          class="font-mono text-xs text-[var(--ui-text-muted)]"
                          >{{ model.id }}</span
                        ></span
                      ></label
                    >
                    <p
                      v-if="!modelsLoading && !filteredChannelModels.length"
                      class="p-6 text-center text-sm text-[var(--ui-text-muted)]"
                    >
                      No matching models.
                    </p>
                  </div>
                  <div class="flex items-center justify-between">
                    <UBadge color="neutral" variant="subtle"
                      >{{ excludedForChannel.length }} disabled</UBadge
                    ><AppButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :disabled="!excludedForChannel.length"
                      @click="clearExcludedChannel"
                      >Clear channel</AppButton
                    >
                  </div>
                </section>

                <section
                  class="space-y-3 border-t border-[var(--ui-border)] pt-5"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="font-semibold">Model aliases</h3>
                      <p class="text-xs text-[var(--ui-text-muted)]">
                        Map upstream model names to client-visible aliases.
                      </p>
                    </div>
                    <AppButton
                      size="sm"
                      color="neutral"
                      variant="outline"
                      @click="addAlias"
                      >Add alias</AppButton
                    >
                  </div>
                  <AppCard
                    v-for="(row, index) in aliasRows"
                    :key="row.key"
                    :ui="{
                      body: 'grid gap-3 p-3 lg:grid-cols-[1fr_1.3fr_1.3fr_auto_auto_auto] lg:items-end',
                    }"
                    ><UFormField label="Channel"
                      ><UInput v-model="row.channel" /></UFormField
                    ><UFormField label="Upstream model"
                      ><UInput v-model="row.name" /></UFormField
                    ><UFormField label="Client alias"
                      ><UInput v-model="row.alias" /></UFormField
                    ><UCheckbox v-model="row.fork" label="Fork" /><UCheckbox
                      v-model="row.forceMapping"
                      label="Force mapping" /><AppButton
                      color="error"
                      variant="ghost"
                      icon="i-tabler-trash"
                      @click="aliasRows.splice(index, 1)"
                  /></AppCard>
                  <p
                    v-if="!aliasRows.length"
                    class="py-6 text-center text-sm text-[var(--ui-text-muted)]"
                  >
                    No rules configured.
                  </p>
                </section>
              </div>
            </AppCard>
          </template>

          <template #proxy-pool
            ><div id="config-proxy-pool"><AdminConfigProxyPool /></div
          ></template>

          <template #payload>
            <AppCard
              id="config-payload"
              class="border-white/40 bg-white/40 dark:border-white/10 dark:bg-neutral-900/40"
            >
              <template #header
                ><div>
                  <h2 class="font-semibold">Request parameter rewriting</h2>
                  <p class="text-xs text-[var(--ui-text-muted)]">
                    Match requests by model and protocol, then fill, override,
                    or remove parameters.
                  </p>
                </div></template
              >
              <div class="space-y-4">
                <div class="grid gap-2 sm:grid-cols-5">
                  <AppCard
                    v-for="mode in payloadModes"
                    :key="mode.value"
                    :ui="{ body: 'p-3' }"
                    ><p class="text-xs text-[var(--ui-text-muted)]">
                      {{ mode.label }}
                    </p>
                    <p class="mt-1 text-xl font-semibold tabular-nums">
                      {{ payloadDraft[mode.value]?.length || 0 }}
                    </p></AppCard
                  >
                </div>
                <div
                  v-for="mode in payloadModes"
                  :key="mode.value"
                  class="space-y-2"
                >
                  <div class="flex items-center justify-between">
                    <h3 class="font-semibold">{{ mode.label }}</h3>
                    <AppButton
                      size="sm"
                      color="neutral"
                      variant="outline"
                      @click="addPayloadRule(mode.value)"
                      >Add rule</AppButton
                    >
                  </div>
                  <AppCard
                    v-for="(rule, index) in payloadDraft[mode.value] || []"
                    :key="index"
                    :ui="{ body: 'p-3' }"
                    ><div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-sm font-medium">
                          {{ payloadRuleSummary(rule) }}
                        </p>
                        <p class="text-xs text-[var(--ui-text-muted)]">
                          {{ payloadRulePaths(rule, mode.value) }}
                        </p>
                      </div>
                      <div class="flex gap-1">
                        <AppButton
                          size="sm"
                          color="neutral"
                          variant="ghost"
                          @click="editPayload(mode.value, index)"
                          >Edit</AppButton
                        ><AppButton
                          size="sm"
                          color="neutral"
                          variant="ghost"
                          @click="duplicatePayload(mode.value, index)"
                          >Duplicate</AppButton
                        ><AppButton
                          size="sm"
                          color="error"
                          variant="ghost"
                          @click="removePayload(mode.value, index)"
                          >Remove</AppButton
                        >
                      </div>
                    </div></AppCard
                  >
                </div>
                <details>
                  <summary class="cursor-pointer text-sm">
                    View payload JSON to save
                  </summary>
                  <pre
                    class="mt-2 max-h-80 overflow-auto rounded-md bg-[var(--ui-bg-muted)] p-3 text-xs"
                    >{{ JSON.stringify(payloadDraft, null, 2) }}</pre
                  >
                </details>
              </div>
            </AppCard>
          </template>
        </AdminConfigVisualSections>
      </div>
    </div>

    <AppCard
      v-if="loaded"
      :ui="{
        body: 'flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between',
      }"
    >
      <div class="flex flex-wrap items-center gap-2">
        <UBadge color="neutral" variant="subtle"
          >Runtime: {{ runtimeMode }}</UBadge
        >
        <UBadge color="neutral" variant="subtle"
          >Updated {{ updatedLabel }}</UBadge
        >
        <UBadge :color="dirtyCount ? 'warning' : 'neutral'" variant="subtle">{{
          dirtyCount ? `${dirtyCount} visual changes` : "No unsaved changes"
        }}</UBadge>
        <UBadge v-if="validationCount" color="warning" variant="subtle"
          >{{ validationCount }} fields need attention</UBadge
        >
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton
          color="neutral"
          variant="outline"
          :disabled="!dirtyCount"
          @click="changesOpen = true"
          >View changes</AppButton
        >
        <AppButton
          color="neutral"
          variant="outline"
          icon="i-tabler-refresh"
          :loading="loading"
          :disabled="saving"
          @click="reloadWorkspace"
          >Reload</AppButton
        >
        <AppButton
          icon="i-tabler-check"
          :loading="saving"
          :disabled="!dirtyCount || validationCount > 0 || loading"
          @click="saveWorkspace"
          >Save</AppButton
        >
      </div>
    </AppCard>

    <USlideover
      v-model:open="changesOpen"
      title="Configuration changes"
      description="Review changed visual fields before saving."
      :ui="{ content: 'sm:max-w-xl' }"
      ><template #body
        ><div class="space-y-2">
          <AppCard
            v-for="change in changes"
            :key="change.key"
            :ui="{ body: 'p-0' }"
            ><button
              type="button"
              class="w-full p-3 text-left transition-colors hover:bg-[var(--ui-bg-elevated)]"
              @click="
                changesOpen = false;
                scrollToSection(change.section);
              "
            >
              <p class="font-medium">{{ change.label }}</p>
              <p class="mt-1 break-all text-xs text-[var(--ui-text-muted)]">
                {{ change.before }} → {{ change.after }}
              </p>
            </button></AppCard
          >
        </div></template
      ></USlideover
    >

    <AppModal
      v-model:open="reloadConfirmOpen"
      title="Reload config?"
      description="Discard unsaved local changes and reload?"
      ><template #body
        ><div class="flex justify-end gap-2">
          <AppButton
            color="neutral"
            variant="ghost"
            @click="reloadConfirmOpen = false"
            >Cancel</AppButton
          ><AppButton
            color="error"
            @click="
              reloadConfirmOpen = false;
              loadWorkspace();
            "
            >Discard and reload</AppButton
          >
        </div></template
      ></AppModal
    >

    <AppModal
      v-model:open="payloadEditorOpen"
      :title="payloadEditIndex < 0 ? 'Add payload rule' : 'Edit payload rule'"
      :ui="{ content: 'sm:max-w-3xl' }"
      ><template #body
        ><form class="space-y-4" @submit.prevent="savePayloadEditor">
          <UFormField label="Matched models (JSON array)" required
            ><UTextarea
              v-model="payloadEditor.models"
              :rows="8"
              class="font-mono text-xs" /></UFormField
          ><UFormField
            :label="
              payloadEditMode === 'filter'
                ? 'Paths to remove (JSON array)'
                : 'Parameters (JSON object)'
            "
            required
            ><UTextarea
              v-model="payloadEditor.params"
              :rows="10"
              class="font-mono text-xs" /></UFormField
          ><UAlert
            v-if="payloadEditorError"
            color="error"
            variant="subtle"
            :description="payloadEditorError"
          />
          <div class="flex justify-end gap-2">
            <AppButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="payloadEditorOpen = false"
              >Cancel</AppButton
            ><AppButton type="submit">Save rule</AppButton>
          </div>
        </form></template
      ></AppModal
    >
  </section>
</template>

<script setup>
import { parseDocument } from "yaml";

const { fetchAPI } = useApi();
const toast = useToast();
const loading = ref(false);
const loaded = ref(false);
const saving = ref(false);
const pageError = ref("");
const updatedAt = ref(null);
const runtimeMode = ref("home");
const draft = ref({});
const baseline = ref({});
const yamlText = ref("");
const configSnapshot = ref({});
const changesOpen = ref(false);
const reloadConfirmOpen = ref(false);
const modelSearch = ref("");
const exclusionChannel = ref("claude");
const channelModels = ref([]);
const modelsLoading = ref(false);
const aliasRows = ref([]);
let aliasKey = 0;
const payloadDraft = reactive({
  default: [],
  "default-raw": [],
  override: [],
  "override-raw": [],
  filter: [],
});
const payloadModes = [
  { label: "Fill", value: "default" },
  { label: "Raw fill", value: "default-raw" },
  { label: "Override", value: "override" },
  { label: "Raw override", value: "override-raw" },
  { label: "Remove", value: "filter" },
];
const payloadEditorOpen = ref(false);
const payloadEditMode = ref("default");
const payloadEditIndex = ref(-1);
const payloadEditor = reactive({ models: "[]", params: "{}" });
const payloadEditorError = ref("");

const channelOptions = [
  ["claude", "Claude"],
  ["gemini", "Gemini"],
  ["gemini-interactions", "Google Interactions"],
  ["vertex", "Vertex"],
  ["aistudio", "AI Studio"],
  ["codex", "Codex"],
  ["kimi", "Kimi"],
  ["antigravity", "Antigravity"],
  ["xai", "xAI"],
].map(([value, label]) => ({ value, label }));
const outline = [
  { id: "server", short: "Server", keys: ["debug", "port"] },
  { id: "tls", short: "TLS", keys: ["tlsEnable", "tlsCert", "tlsKey"] },
  {
    id: "remote-management",
    short: "Management",
    keys: [
      "remoteManagementAllowRemote",
      "remoteManagementSecretKey",
      "remoteManagementDisableControlPanel",
      "remoteManagementDisableAutoUpdatePanel",
      "remoteManagementPanelGithubRepository",
    ],
  },
  {
    id: "plugins",
    short: "Plugins",
    keys: ["pluginsEnabled", "pluginsDir", "pluginStoreSourcesJson"],
  },
  {
    id: "oauth-rules",
    short: "OAuth rules",
    keys: ["oauthExcludedModelsJson", "oauthModelAliasJson"],
  },
  {
    id: "logs",
    short: "Logs",
    keys: [
      "requestLog",
      "usageStatisticsEnabled",
      "loggingToFile",
      "logsMaxTotalSizeMb",
      "errorLogsMaxFiles",
    ],
  },
  { id: "network", short: "Network", keys: ["proxyUrl"] },
  {
    id: "quota",
    short: "Quota",
    keys: ["quotaSwitchProject", "quotaSwitchPreviewModel"],
  },
  {
    id: "retry-routing",
    short: "Routing",
    keys: [
      "requestRetry",
      "maxRetryCredentials",
      "maxRetryInterval",
      "disableCooling",
      "forceModelPrefix",
      "routingStrategy",
    ],
  },
  { id: "payload", short: "Parameters", keys: ["payloadJson"] },
  {
    id: "antigravity",
    short: "Antigravity",
    keys: ["antigravitySensitiveWordsJson"],
  },
];
const labels = Object.fromEntries(
  outline.flatMap((section) =>
    section.keys.map((key) => [
      key,
      key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (value) => value.toUpperCase()),
    ]),
  ),
);
const updatedLabel = computed(() =>
  updatedAt.value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(updatedAt.value)
    : "—",
);
const validationErrors = computed(() => {
  const errors = {};
  const integerKeys = [
    "requestRetry",
    "maxRetryCredentials",
    "maxRetryInterval",
    "logsMaxTotalSizeMb",
    "errorLogsMaxFiles",
  ];
  if (
    !Number.isInteger(Number(draft.value.port)) ||
    Number(draft.value.port) < 1 ||
    Number(draft.value.port) > 65535
  )
    errors.port = "Enter an integer from 1 to 65535.";
  for (const key of integerKeys)
    if (
      !Number.isInteger(Number(draft.value[key])) ||
      Number(draft.value[key]) < 0
    )
      errors[key] = "Enter a non-negative integer.";
  if (
    !["round-robin", "weighted-round-robin", "fill-first"].includes(
      draft.value.routingStrategy,
    )
  )
    errors.routingStrategy = "Select a supported strategy.";
  return errors;
});
const validationCount = computed(
  () => Object.keys(validationErrors.value).length,
);
const changes = computed(() =>
  Object.keys(draft.value)
    .filter((key) => String(draft.value[key]) !== String(baseline.value[key]))
    .map((key) => ({
      key,
      label: labels[key] || key,
      before: String(baseline.value[key] ?? ""),
      after: String(draft.value[key] ?? ""),
      section:
        outline.find((section) => section.keys.includes(key))?.id || "server",
    })),
);
const dirtyCount = computed(() => changes.value.length);
const excludedMap = computed(() =>
  parseJSON(draft.value.oauthExcludedModelsJson, {}),
);
const excludedForChannel = computed(() =>
  Array.isArray(excludedMap.value[exclusionChannel.value])
    ? excludedMap.value[exclusionChannel.value]
    : [],
);
const filteredChannelModels = computed(() => {
  const q = modelSearch.value.trim().toLowerCase();
  return channelModels.value.filter(
    (model) =>
      !q ||
      [
        model.id,
        model.display_name,
        model.name,
        model.owned_by,
        model.type,
        model.description,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(q),
      ),
  );
});

function parseJSON(value, fallback) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}
function scrollToSection(id) {
  document
    .getElementById(`config-${id}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function sectionDirty(keys) {
  return keys.some(
    (key) => String(draft.value[key]) !== String(baseline.value[key]),
  );
}
function lines(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
function buildDraft(config, yamlRoot) {
  const server = yamlRoot.server || config.server || {};
  const remote = yamlRoot.management || config.management || {};
  const plugins = yamlRoot.plugins || config.plugins || {};
  const routing = config.routing || yamlRoot.routing || {};
  const retry = routing.retry || {};
  const cooldown = routing.cooldown || {};
  const requests = config.requests || yamlRoot.requests || {};
  const observability = config.observability || yamlRoot.observability || {};
  const logs = observability.logs || {};
  const usage = observability.usage || {};
  const oauth = config.oauth || yamlRoot.oauth || {};
  const antigravity = oauth.providers?.antigravity || {};
  return {
    debug: Boolean(logs.debug),
    port: Number(server.port || 8317),
    tlsEnable: Boolean(server.tls?.enable),
    tlsCert: server.tls?.cert || "",
    tlsKey: server.tls?.key || "",
    remoteManagementAllowRemote: Boolean(remote["allow-remote"]),
    remoteManagementSecretKey: remote["secret-key"] || "",
    remoteManagementDisableControlPanel: Boolean(
      remote["disable-control-panel"],
    ),
    remoteManagementDisableAutoUpdatePanel: Boolean(
      remote["disable-auto-update-panel"],
    ),
    remoteManagementPanelGithubRepository:
      remote["panel-github-repository"] || remote["panel-repo"] || "",
    pluginsEnabled: Boolean(plugins.enabled),
    pluginsDir: plugins.dir || "plugins",
    pluginStoreSourcesJson: (plugins["store-sources"] || []).join("\n"),
    oauthExcludedModelsJson: JSON.stringify(
      oauth["excluded-models"] || {},
      null,
      2,
    ),
    oauthModelAliasJson: JSON.stringify(oauth["model-alias"] || {}, null, 2),
    requestLog: Boolean(logs["request-log"]),
    usageStatisticsEnabled: Boolean(usage["usage-statistics-enabled"]),
    loggingToFile: Boolean(logs["logging-to-file"]),
    logsMaxTotalSizeMb: Number(logs["logs-max-total-size-mb"] || 0),
    errorLogsMaxFiles: Number(logs["error-logs-max-files"] ?? 10),
    proxyUrl: requests["proxy-url"] || "",
    quotaSwitchProject: Boolean(config["quota-exceeded"]?.["switch-project"]),
    quotaSwitchPreviewModel: Boolean(
      config["quota-exceeded"]?.["switch-preview-model"],
    ),
    requestRetry: Number(retry["request-retry"] || 0),
    maxRetryCredentials: Number(retry["max-retry-credentials"] || 0),
    maxRetryInterval: Number(retry["max-retry-interval"] || 0),
    disableCooling: Boolean(cooldown["disable-cooling"]),
    forceModelPrefix: Boolean(
      routing["force-model-prefix"] ?? config["force-model-prefix"],
    ),
    routingStrategy: routing.strategy || "round-robin",
    payloadJson: JSON.stringify(requests.payload || {}, null, 2),
    antigravitySensitiveWordsJson: (antigravity["sensitive-words"] || []).join(
      "\n",
    ),
  };
}
function syncEditors() {
  const aliases = parseJSON(draft.value.oauthModelAliasJson, {});
  aliasRows.value = Object.entries(aliases).flatMap(([channel, entries]) =>
    (entries || []).map((entry) => ({
      key: ++aliasKey,
      channel,
      name: entry.name || "",
      alias: entry.alias || "",
      fork: Boolean(entry.fork),
      forceMapping: Boolean(entry["force-mapping"]),
    })),
  );
  const payload = parseJSON(draft.value.payloadJson, {});
  for (const mode of payloadModes)
    payloadDraft[mode.value] = structuredClone(
      Array.isArray(payload[mode.value]) ? payload[mode.value] : [],
    );
}
function syncSpecialDrafts() {
  const grouped = {};
  for (const row of aliasRows.value) {
    const channel = row.channel.trim().toLowerCase();
    if (!channel || !row.name.trim() || !row.alias.trim()) continue;
    (grouped[channel] ||= []).push({
      name: row.name.trim(),
      alias: row.alias.trim(),
      fork: row.fork,
      "force-mapping": row.forceMapping,
    });
  }
  draft.value.oauthModelAliasJson = JSON.stringify(grouped, null, 2);
  draft.value.payloadJson = JSON.stringify(
    Object.fromEntries(
      payloadModes.map((mode) => [mode.value, payloadDraft[mode.value]]),
    ),
    null,
    2,
  );
}
async function loadWorkspace() {
  if (loading.value) return;
  loading.value = true;
  pageError.value = "";
  try {
    const [config, yaml] = await Promise.all([
      fetchAPI("/config"),
      fetchAPI("/config.yaml", { responseType: "text" }),
    ]);
    configSnapshot.value = config;
    yamlText.value = String(yaml || "");
    const root = parseDocument(yamlText.value).toJS() || {};
    const next = buildDraft(config, root);
    draft.value = structuredClone(next);
    baseline.value = structuredClone(next);
    syncEditors();
    runtimeMode.value =
      String(config.mode || config["runtime-mode"] || "home").toLowerCase() ===
      "cpa"
        ? "cpa"
        : "home";
    updatedAt.value = new Date();
    loaded.value = true;
    await loadChannelModels();
  } catch (error) {
    pageError.value =
      error?.data?.message ||
      error?.data?.error ||
      error?.message ||
      "Check the management endpoint, key, and config routes.";
  } finally {
    loading.value = false;
  }
}
function reloadWorkspace() {
  syncSpecialDrafts();
  if (dirtyCount.value) reloadConfirmOpen.value = true;
  else loadWorkspace();
}
async function loadChannelModels() {
  modelsLoading.value = true;
  try {
    const response = await fetchAPI("/models", {
      query: { scope: "available", channel: exclusionChannel.value },
    });
    channelModels.value = Array.isArray(response?.models)
      ? response.models
      : [];
  } catch {
    channelModels.value = [];
  } finally {
    modelsLoading.value = false;
  }
}
function toggleExcluded(id, checked) {
  const map = structuredClone(excludedMap.value);
  const selected = new Set(map[exclusionChannel.value] || []);
  checked ? selected.add(id) : selected.delete(id);
  if (selected.size) map[exclusionChannel.value] = [...selected];
  else delete map[exclusionChannel.value];
  draft.value.oauthExcludedModelsJson = JSON.stringify(map, null, 2);
}
function clearExcludedChannel() {
  const map = structuredClone(excludedMap.value);
  delete map[exclusionChannel.value];
  draft.value.oauthExcludedModelsJson = JSON.stringify(map, null, 2);
}
function addAlias() {
  aliasRows.value.push({
    key: ++aliasKey,
    channel: aliasRows.value.at(-1)?.channel || "claude",
    name: "",
    alias: "",
    fork: false,
    forceMapping: false,
  });
}
function payloadRuleSummary(rule) {
  return Array.isArray(rule?.models)
    ? rule.models.map((model) => model?.name || "(unnamed)").join(", ")
    : "Unsupported matcher";
}
function payloadRulePaths(rule, mode) {
  return mode === "filter"
    ? Array.isArray(rule?.params)
      ? rule.params.join(", ")
      : ""
    : Object.keys(rule?.params || {}).join(", ");
}
function addPayloadRule(mode) {
  payloadEditMode.value = mode;
  payloadEditIndex.value = -1;
  payloadEditor.models = JSON.stringify([{ name: "" }], null, 2);
  payloadEditor.params = mode === "filter" ? "[]" : "{}";
  payloadEditorError.value = "";
  payloadEditorOpen.value = true;
}
function editPayload(mode, index) {
  const rule = payloadDraft[mode][index];
  payloadEditMode.value = mode;
  payloadEditIndex.value = index;
  payloadEditor.models = JSON.stringify(rule.models || [], null, 2);
  payloadEditor.params = JSON.stringify(
    rule.params ?? (mode === "filter" ? [] : {}),
    null,
    2,
  );
  payloadEditorError.value = "";
  payloadEditorOpen.value = true;
}
function duplicatePayload(mode, index) {
  payloadDraft[mode].push(structuredClone(payloadDraft[mode][index]));
  syncSpecialDrafts();
}
function removePayload(mode, index) {
  payloadDraft[mode].splice(index, 1);
  syncSpecialDrafts();
}
function savePayloadEditor() {
  try {
    const models = JSON.parse(payloadEditor.models);
    const params = JSON.parse(payloadEditor.params);
    if (
      !Array.isArray(models) ||
      !models.length ||
      models.some((model) => !model?.name?.trim())
    )
      throw new Error("Add at least one named model matcher.");
    if (
      payloadEditMode.value === "filter"
        ? !Array.isArray(params)
        : !params || typeof params !== "object" || Array.isArray(params)
    )
      throw new Error("Parameters use the wrong shape.");
    const rule = { models, params };
    if (payloadEditIndex.value < 0)
      payloadDraft[payloadEditMode.value].push(rule);
    else payloadDraft[payloadEditMode.value][payloadEditIndex.value] = rule;
    syncSpecialDrafts();
    payloadEditorOpen.value = false;
  } catch (error) {
    payloadEditorError.value = error.message;
  }
}

const v8YamlPaths = {
  debug: ["observability", "logs", "debug"],
  port: ["server", "port"],
  tlsEnable: ["server", "tls", "enable"],
  tlsCert: ["server", "tls", "cert"],
  tlsKey: ["server", "tls", "key"],
  remoteManagementAllowRemote: ["management", "allow-remote"],
  remoteManagementSecretKey: ["management", "secret-key"],
  remoteManagementDisableControlPanel: ["management", "disable-control-panel"],
  remoteManagementDisableAutoUpdatePanel: [
    "management",
    "disable-auto-update-panel",
  ],
  remoteManagementPanelGithubRepository: [
    "management",
    "panel-github-repository",
  ],
  pluginsEnabled: ["plugins", "enabled"],
  pluginsDir: ["plugins", "dir"],
  pluginStoreSourcesJson: ["plugins", "store-sources"],
  oauthExcludedModelsJson: ["oauth", "excluded-models"],
  oauthModelAliasJson: ["oauth", "model-alias"],
  requestLog: ["observability", "logs", "request-log"],
  usageStatisticsEnabled: [
    "observability",
    "usage",
    "usage-statistics-enabled",
  ],
  loggingToFile: ["observability", "logs", "logging-to-file"],
  logsMaxTotalSizeMb: ["observability", "logs", "logs-max-total-size-mb"],
  errorLogsMaxFiles: ["observability", "logs", "error-logs-max-files"],
  proxyUrl: ["requests", "proxy-url"],
  quotaSwitchProject: ["quota-exceeded", "switch-project"],
  quotaSwitchPreviewModel: ["quota-exceeded", "switch-preview-model"],
  requestRetry: ["routing", "retry", "request-retry"],
  maxRetryCredentials: ["routing", "retry", "max-retry-credentials"],
  maxRetryInterval: ["routing", "retry", "max-retry-interval"],
  disableCooling: ["routing", "cooldown", "disable-cooling"],
  forceModelPrefix: ["routing", "force-model-prefix"],
  routingStrategy: ["routing", "strategy"],
  payloadJson: ["requests", "payload"],
  antigravitySensitiveWordsJson: [
    "oauth",
    "providers",
    "antigravity",
    "sensitive-words",
  ],
};
async function saveWorkspace() {
  syncSpecialDrafts();
  if (!dirtyCount.value || validationCount.value) return;
  saving.value = true;
  pageError.value = "";
  try {
    const changed = changes.value.map((change) => change.key);
    const document = parseDocument(yamlText.value);
    document.set("config-version", 8);
    for (const key of changed) {
      const path = v8YamlPaths[key];
      if (!path) continue;
      let value = draft.value[key];
      if (
        [
          "port",
          "logsMaxTotalSizeMb",
          "errorLogsMaxFiles",
          "requestRetry",
          "maxRetryCredentials",
          "maxRetryInterval",
        ].includes(key)
      )
        value = Number(value);
      else if (
        ["pluginStoreSourcesJson", "antigravitySensitiveWordsJson"].includes(
          key,
        )
      )
        value = lines(value);
      else if (
        [
          "oauthExcludedModelsJson",
          "oauthModelAliasJson",
          "payloadJson",
        ].includes(key)
      )
        value = parseJSON(value, {});
      else if (key === "proxyUrl") value = String(value).trim();
      document.setIn(path, value);
    }
    await fetchAPI("/config.yaml", {
      method: "PUT",
      body: document.toString(),
      headers: { "Content-Type": "application/yaml; charset=utf-8" },
    });
    toast.add({ title: "Config saved", color: "success" });
    await loadWorkspace();
  } catch (error) {
    pageError.value =
      error?.data?.message ||
      error?.data?.error ||
      error?.message ||
      "Unable to save configuration.";
  } finally {
    saving.value = false;
  }
}

onMounted(loadWorkspace);
</script>
