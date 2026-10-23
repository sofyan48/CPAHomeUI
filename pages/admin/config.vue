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
        class="hidden min-w-0 self-start xl:sticky xl:top-0 xl:block xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:overscroll-contain"
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
          :loading="loading || saving"
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
                  <UAlert
                    v-if="modelsError"
                    color="warning"
                    variant="subtle"
                    title="Channel model definitions unavailable"
                    :description="modelsError"
                  />
                  <div
                    class="max-h-80 overflow-y-auto rounded-md border border-[var(--ui-border)]"
                  >
                    <label
                      v-for="model in filteredChannelModels"
                      :key="model.id"
                      class="flex items-start gap-3 border-b border-[var(--ui-border)] px-3 py-2 last:border-b-0"
                      ><UCheckbox
                        :model-value="excludedForChannel.includes(model.id)"
                        :disabled="loading || saving || Boolean(validationErrors.oauthExcludedModelsJson)"
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
                      v-if="modelsLoading || !filteredChannelModels.length"
                      class="p-6 text-center text-sm text-[var(--ui-text-muted)]"
                    >
                      {{ modelsLoading ? 'Loading channel models…' : 'No matching model definitions. Manual rules remain available below.' }}
                    </p>
                  </div>
                  <div class="flex items-center justify-between">
                    <UBadge color="neutral" variant="subtle"
                      >{{ excludedForChannel.length }} disabled</UBadge
                    ><AppButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :disabled="!excludedForChannel.length || loading || saving || Boolean(validationErrors.oauthExcludedModelsJson)"
                      @click="clearExcludedChannel"
                      >Clear channel</AppButton
                    >
                  </div>
                  <UFormField label="Manual exclusion rules (JSON)" hint="Map channel IDs to arrays of model IDs or wildcard patterns. Rules outside the catalog and custom channels are preserved." :error="validationErrors.oauthExcludedModelsJson">
                    <UTextarea v-model="draft.oauthExcludedModelsJson" :disabled="loading || saving" :rows="6" class="w-full font-mono text-xs" spellcheck="false" />
                  </UFormField>
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
                      body: 'grid gap-3 p-3 lg:grid-cols-2 lg:items-end',
                    }"
                    ><UFormField label="Channel"
                      ><UInput v-model="row.channel" /></UFormField
                    ><UFormField label="Upstream model"
                      ><UInput v-model="row.name" /></UFormField
                    ><UFormField label="Client alias"
                      ><UInput v-model="row.alias" /></UFormField
                    ><UFormField label="Display name (optional)"
                      ><UInput v-model="row.displayName" /></UFormField
                    ><UCheckbox v-model="row.fork" label="Fork" /><UCheckbox
                      v-model="row.forceMapping"
                      label="Force mapping" /><AppButton
                      color="error"
                      variant="ghost"
                      icon="i-tabler-trash"
                      aria-label="Remove model alias"
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
            <AdminConfigSharedUpstream
              v-model:draft="draft"
              :sections="sharedConfigSections"
              :validation-errors="validationErrors"
              :loading="loading || saving"
              class="mb-6"
            />
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
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useDataSync } from '~/composables/useDataSync'
import { parseDocument } from "yaml";

const { fetchAPI } = useApi();
const toast = useToast();
const loading = useWorkspaceState('admin:config:loading', () => (false));
const loaded = useWorkspaceState('admin:config:loaded', () => (false));
const saving = useWorkspaceState('admin:config:saving', () => (false));
const pageError = useWorkspaceState('admin:config:pageError', () => (""));
const updatedAt = useWorkspaceState('admin:config:updatedAt', () => (null));
const runtimeMode = useWorkspaceState('admin:config:runtimeMode', () => ("home"));
const draft = ref({});
const baseline = useWorkspaceState('admin:config:baseline', () => ({}));
const yamlText = useWorkspaceState('admin:config:yamlText', () => (""));
const configSnapshot = useWorkspaceState('admin:config:configSnapshot', () => ({}));
const changesOpen = ref(false);
const reloadConfirmOpen = ref(false);
const modelSearch = ref("");
const exclusionChannel = ref("claude");
const channelModels = useWorkspaceState('admin:config:channelModels', () => ([]));
const modelsLoading = useWorkspaceState('admin:config:modelsLoading', () => (false));
const modelsError = ref("");
let modelRequestVersion = 0;
const aliasRows = ref([]);
let aliasKey = 0;
let aliasEditorBaseline = "";
let aliasEditorSource = "{}";
const payloadDraft = reactive({
  default: [],
  "default-raw": [],
  override: [],
  "override-raw": [],
  filter: [],
});
let payloadEditorBaseline = "";
let payloadEditorSource = "{}";
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
  ["codex-free", "Codex Free"],
  ["codex-team", "Codex Team"],
  ["codex-plus", "Codex Plus"],
  ["codex-pro", "Codex Pro"],
  ["kimi", "Kimi"],
  ["kimi-ai", "Kimi AI"],
  ["antigravity", "Antigravity"],
  ["xai", "xAI"],
  ["devin", "Devin"],
  ["meta", "Meta"],
].map(([value, label]) => ({ value, label }));
const sharedConfigSections = [
  {
    id: "session-streaming", title: "Session routing and streaming", description: "Session-sticky routing and downstream response keepalives. Unset settings retain backend defaults.",
    fields: [
      { key: "sessionAffinity", path: ["routing", "session-affinity"], label: "Session affinity", type: "boolean", description: "Keep a session on its selected credential, with automatic failover when unavailable." },
      { key: "sessionAffinityTtl", path: ["routing", "session-affinity-ttl"], label: "Session affinity TTL", type: "session-duration", placeholder: "1h or 30m", description: "Session-to-credential binding duration, for example 1h or 30m. Backend default: 1h; empty uses the backend fallback." },
      { key: "sessionAffinitySubagents", path: ["routing", "session-affinity-subagents"], label: "Subagent credential inheritance", type: "boolean", description: "Optional CPA compatibility setting for inheriting a parent session's credential. Home continues to manage its own session hierarchy." },
      { key: "streamingKeepaliveSeconds", path: ["requests", "streaming", "keepalive-seconds"], label: "SSE keepalive interval (seconds)", type: "number", description: "SSE heartbeat interval; zero or negative values disable heartbeats." },
      { key: "streamingSendKeepaliveBeforeFt", path: ["requests", "streaming", "send-keepalive-before-ft"], label: "SSE keepalive before first token", type: "boolean", description: "Send heartbeats before the first token only when the SSE keepalive interval is greater than zero." },
      { key: "streamingBootstrapRetries", path: ["requests", "streaming", "bootstrap-retries"], label: "Streaming bootstrap retries", type: "number", description: "Retries before the first byte of a stream; zero or negative values disable retries." },
      { key: "nonstreamKeepaliveInterval", path: ["requests", "nonstream-keepalive-interval"], label: "Non-streaming keepalive interval (seconds)", type: "number", description: "Blank-line heartbeat interval for non-streaming responses; zero or negative values disable it." },
    ],
  },
  {
    id: "oauth-request-errors", title: "OAuth request-scoped errors", description: "Provider-keyed OAuth error overrides, separate from API-key group and credential rules. Custom provider IDs and additional rule fields are preserved.",
    fields: [
      { key: "oauthRequestScopedErrorsJson", path: ["oauth", "request-scoped-errors"], label: "Request-scoped error rules (JSON)", type: "json", description: 'Map provider IDs to rule arrays, e.g. {"codex":[{"status":429,"match-regexr":["rate.*limit"],"action":"continue-and-cooldown"}]}. Actions: stop, stop-and-cooldown, continue, continue-and-cooldown. Use the exact spelling match-regexr. An empty object is explicit; backend default removes the setting.' },
    ],
  },
  {
    id: "upstream-claude", title: "Claude shared upstream", description: "Applies to OAuth and API-key routes under their existing execution conditions. Explicit credential options keep precedence.",
    fields: [
      { key: "claudeToolSearch", path: ["upstream", "claude", "tool-search"], label: "Tool search", type: "boolean", description: "Enable Codex tool_search on Claude Responses routes. Native Anthropic tool search is used on api.anthropic.com or keys with native-tool-search; other credentials use plain translation. Default: false." },
      { key: "claudeModelLevelCooling", path: ["upstream", "claude", "model-level-cooling"], label: "Model-level cooling", type: "boolean", description: "Scope quota cooldowns to the requested model. CPA compatibility option: Home cooldown scheduling remains authoritative. Default: false." },
      { key: "claudeDisableCloakMode", path: ["upstream", "claude", "disable-claude-cloak-mode"], label: "Disable request cloaking", type: "boolean", description: "Pass through the original system prompt on OAuth and API-key CLI profiles. Credential attributes and explicit per-key cloak modes override this shared default. Default: false (per-client auto behavior)." },
      { key: "claudeDisableCloakingModelList", path: ["upstream", "claude", "disable-cloaking-model-list"], label: "Disable model-list cloaking", type: "boolean", description: "Return original model IDs in Anthropic model-list responses. Default: false." },
      ...[
        ["UserAgent", "user-agent", "User-Agent", "Unconfirmed clients use this Claude CLI baseline; update only after measuring a release."],
        ["PackageVersion", "package-version", "Package version", "Shared Claude CLI package baseline."],
        ["RuntimeVersion", "runtime-version", "Runtime version", "Shared Claude CLI runtime baseline."],
        ["Os", "os", "Operating system", "Verified native OS values are preserved unless device-profile stabilization is enabled."],
        ["Arch", "arch", "Architecture", "Verified native architecture is preserved unless device-profile stabilization is enabled."],
        ["Timeout", "timeout", "Timeout header", "Claude timeout header fallback, not a proxy request timeout."],
        ["Timezone", "timezone", "Timezone", "Fallback IANA timezone for cloaked currentDate; credential JSON timezone takes priority."],
      ].map(([suffix, name, label, description]) => ({ key: `claudeHeader${suffix}`, path: ["upstream", "claude", "header-defaults", name], label, description, type: "text" })),
      { key: "claudeHeaderStabilizeDeviceProfile", path: ["upstream", "claude", "header-defaults", "stabilize-device-profile"], label: "Stabilize device profile", type: "boolean", description: "Pin OS/architecture and cached profiles to the configured software baseline. Unset retains the backend fallback; explicit false disables pinning." },
    ],
  },
  {
    id: "upstream-codex", title: "Codex shared upstream", description: "Shared behavior for OAuth and API-key credentials; these are not OAuth-only settings.",
    fields: [
      { key: "codexResponseSteering", path: ["upstream", "codex", "response-steering"], label: "Response steering", type: "boolean", description: "Experimental full-duplex Responses WebSocket steering. One account/model per socket; accepted input is never replayed. Default: false." },
      { key: "codexDisableCloaking", path: ["upstream", "codex", "disable-codex-cloaking"], label: "Disable identity cloaking", type: "boolean", description: "Stop forcing official Codex User-Agent and Originator headers on HTTP/SSE and WebSocket requests. Explicit credential overrides retain precedence. Default: false." },
      { key: "codexStreamBootstrapBuffering", path: ["upstream", "codex", "stream-bootstrap-buffering"], label: "Stream bootstrap buffering", type: "boolean", description: "Hold handshake, heartbeat and early empty frames until generation to allow overload/rate-limit failover before stream commitment. Delays headers; review client and reverse-proxy timeouts. Default: false." },
      { key: "codexStreamBootstrapTimeout", path: ["upstream", "codex", "stream-bootstrap-timeout"], label: "Stream bootstrap timeout", type: "duration", description: "Optional buffering ceiling, e.g. 20s. Evaluated as upstream frames arrive; never aborts the upstream connection. Translators may still wait for generated text before committing headers. Empty, 0, 0s, none, unlimited, disabled, off or never means no time ceiling (frame/byte budgets only)." },
      { key: "codexOrphanDelegationCompatibility", path: ["upstream", "codex", "orphan-delegation-compatibility"], label: "Orphan delegation compatibility", type: "boolean", description: "Convert orphan codex_app/create_thread and send_message_to_thread outputs into user messages when X-Openai-Subagent is collab_spawn. Default: false." },
      { key: "codexModelLevelCooling", path: ["upstream", "codex", "model-level-cooling"], label: "Model-level cooling", type: "boolean", description: "Scope usage_limit_reached cooldowns to the requested model. CPA compatibility option: Home cooldown scheduling remains authoritative. Default: false." },
    ],
  },
  {
    id: "client-codex", title: "Codex client compatibility", description: "Client-facing compatibility across OAuth and API-key routes, including non-Codex upstream protocols.",
    fields: [
      { key: "codexOptimizeMultiAgentV2", path: ["client", "codex", "optimize-multi-agent-v2"], label: "Optimize multi-agent v2", type: "boolean", description: "Refresh spawn_agent model details, remove message parameter encryption, normalize encrypted agent_message content, and translate agent_message inputs for non-Codex protocols. Default: false." },
    ],
  },
  {
    id: "upstream-xai", title: "xAI shared upstream", description: "Native xAI behavior shared by OAuth and API-key routes.",
    fields: [
      { key: "xaiInjectXSearch", path: ["upstream", "xai", "inject-x-search"], label: "Inject X search", type: "boolean", description: "Inject native x_search when absent, also adding it to tool_choice.allowed_tools when applicable. Default: false." },
    ],
  },
];
const sharedConfigFields = sharedConfigSections.flatMap(section => section.fields);
const outline = [
  { id: "server", short: "Server", keys: ["debug", "port", "cpaPublicUrl"] },
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
    id: "user-email",
    short: "Mail Setup",
    keys: ["userEmailEnabled", "userEmailPublicUrl", "userEmailFromAddress", "userEmailFromName", "userEmailSenderType", "userEmailSmtpHost", "userEmailSmtpPort", "userEmailSmtpUsername", "userEmailSmtpPasswordEnv", "userEmailSmtpStarttls", "userEmailVerificationTtl", "userEmailResetTtl"],
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

      "loggingToFile",
      "logsMaxTotalSizeMb",
      "errorLogsMaxFiles",
    ],
  },
  { id: "models", short: "Model catalogs", keys: ["modelsCatalog", "modelsCodexCatalog", "modelsDevinCatalog"] },
  { id: "network", short: "Network", keys: ["proxyUrl", "tlsHandshakeTimeoutSeconds"] },
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
  ...sharedConfigSections.map(section => ({ id: section.id, short: section.title, keys: section.fields.map(field => field.key) })),
  { id: "payload", short: "Parameters", keys: ["payloadJson"] },
  { id: "devin", short: "Devin OAuth", keys: ["devinSensitiveWordsJson"] },
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
    "tlsHandshakeTimeoutSeconds",
  ];
  if (
    !Number.isInteger(Number(draft.value.port)) ||
    Number(draft.value.port) < 1 ||
    Number(draft.value.port) > 65535
  )
    errors.port = "Enter an integer from 1 to 65535.";
  for (const key of integerKeys)
    if (
      draft.value[key] === null || draft.value[key] === "" ||
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
  if (String(draft.value.cpaPublicUrl || "").trim()) {
    try {
      const url = new URL(String(draft.value.cpaPublicUrl).trim());
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      errors.cpaPublicUrl = "Enter an absolute HTTP or HTTPS URL without credentials.";
    }
  }
  for (const key of ["modelsCatalog", "modelsCodexCatalog", "modelsDevinCatalog"]) {
    const source = String(draft.value[key] || "").trim();
    if (!source || source.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(source) || source.startsWith("\\\\")) continue;
    try {
      const url = new URL(source);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname) throw new Error();
    } catch {
      errors[key] = "Enter an HTTP(S) URL or an absolute server file path, or leave empty for the default.";
    }
  }
  if (draft.value.userEmailEnabled) {
    const text = key => String(draft.value[key] || "").trim();
    const isLoopback = host => host === "localhost" || host === "::1" || host === "[::1]" || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(host);
    try {
      const url = new URL(text("userEmailPublicUrl"));
      if (url.username || url.password || !(url.protocol === "https:" || (url.protocol === "http:" && isLoopback(url.hostname)))) throw new Error();
    } catch {
      errors.userEmailPublicUrl = "Enter an absolute HTTPS URL (HTTP is allowed only for loopback).";
    }
    if (!/^[^\s<>@]+@[^\s<>@]+$/.test(text("userEmailFromAddress"))) errors.userEmailFromAddress = "Enter one mailbox without a display name.";
    if (text("userEmailSenderType") !== "smtp") errors.userEmailSenderType = "Only SMTP is supported.";
    if (!text("userEmailSmtpHost")) errors.userEmailSmtpHost = "Enter the SMTP host.";
    const port = Number(draft.value.userEmailSmtpPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 465) errors.userEmailSmtpPort = "Enter a port from 1 to 65535, excluding unsupported port 465.";
    if (!draft.value.userEmailSmtpStarttls && !isLoopback(text("userEmailSmtpHost").toLowerCase())) errors.userEmailSmtpStarttls = "STARTTLS is required for non-loopback SMTP hosts.";
    if (text("userEmailSmtpUsername") && !text("userEmailSmtpPasswordEnv")) errors.userEmailSmtpPasswordEnv = "Enter the environment variable name containing the SMTP password.";
    for (const key of ["userEmailVerificationTtl", "userEmailResetTtl"]) {
      const value = text(key);
      if (!/^\+?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:ns|us|µs|μs|ms|s|m|h))+$/.test(value) || !/[1-9]/.test(value)) errors[key] = "Enter a positive Go duration, for example 24h or 30m.";
    }
  }
  const exclusions = parseJSON(draft.value.oauthExcludedModelsJson, null);
  if (!exclusions || typeof exclusions !== "object" || Array.isArray(exclusions) || Object.values(exclusions).some(rules => !Array.isArray(rules) || rules.some(rule => typeof rule !== "string"))) {
    errors.oauthExcludedModelsJson = "Enter a JSON object mapping channel IDs to arrays of strings.";
  }
  for (const field of sharedConfigFields) {
    const value = draft.value[field.key];
    if (value === null || value === undefined) continue;
    if (field.type === "boolean") {
      if (typeof value !== "boolean") errors[field.key] = "Select the backend default, enabled or disabled.";
    } else if (field.type === "number") {
      if (typeof value !== "number" || !Number.isSafeInteger(value)) errors[field.key] = "Enter an integer, or use the backend default.";
    } else if (field.type === "json") {
      const rules = parseJSON(value, null);
      const isObject = item => item !== null && typeof item === "object" && !Array.isArray(item);
      const actions = ["stop", "stop-and-cooldown", "continue", "continue-and-cooldown"];
      if (!isObject(rules) || Object.values(rules).some(entries => !Array.isArray(entries) || entries.some(rule =>
        !isObject(rule) || !actions.includes(rule.action) ||
        (rule.status !== undefined && !Number.isSafeInteger(rule.status)) ||
        ["match", "match-regexr"].some(key => rule[key] !== undefined && (!Array.isArray(rule[key]) || rule[key].some(item => typeof item !== "string"))) ||
        Object.hasOwn(rule, "match-regex")
      ))) errors[field.key] = "Enter a provider-to-rule-array JSON object with a supported action, optional integer status, and optional string arrays match / match-regexr (not match-regex).";
    } else if (typeof value !== "string") {
      errors[field.key] = "Enter a string value or use the backend default.";
    } else if (field.type === "session-duration") {
      if (value.trim() !== "" && value.trim() !== "0" && !/^\+?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:ns|us|µs|μs|ms|s|m|h))+$/.test(value.trim())) {
        errors[field.key] = "Enter a non-negative Go duration (e.g. 1h or 30m), or leave empty for the backend fallback.";
      }
    } else if (field.type === "duration") {
      const text = value.trim().toLowerCase();
      if (!["", "0", "0s", "none", "unlimited", "disabled", "off", "never"].includes(text) && !/^\+?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:ns|us|µs|μs|ms|s|m|h))+$/.test(value.trim())) {
        errors[field.key] = "Enter a non-negative Go duration (e.g. 20s or 1m30s), or an unlimited alias.";
      }
    } else if (/[\r\n\u0000]/.test(value)) {
      errors[field.key] = "Header defaults must not contain line breaks or NUL characters.";
    }
  }
  return errors;
});
const validationCount = computed(
  () => Object.keys(validationErrors.value).length,
);
const changes = computed(() =>
  Object.keys(draft.value)
    .filter((key) => fieldChanged(key))
    .map((key) => ({
      key,
      label: labels[key] || key,
      before: formatChangeValue(key, baseline.value[key]),
      after: formatChangeValue(key, draft.value[key]),
      section:
        outline.find((section) => section.keys.includes(key))?.id || "server",
    })),
);
const dirtyCount = computed(() => changes.value.length);
const excludedMap = computed(() => {
  const value = parseJSON(draft.value.oauthExcludedModelsJson, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
});
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
function fieldChanged(key) {
  if (sharedConfigFields.some(field => field.key === key)) {
    return draft.value[key] !== baseline.value[key];
  }
  return String(draft.value[key]) !== String(baseline.value[key]);
}
function formatChangeValue(key, value) {
  if (sharedConfigFields.some(field => field.key === key)) {
    if (value === null || value === undefined) return "Backend default (unset)";
    if (value === "") return '"" (explicit empty string)';
  }
  return String(value ?? "");
}
function sectionDirty(keys) {
  return keys.some(fieldChanged);
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

  const oauth = config.oauth || yamlRoot.oauth || {};
  const antigravity = oauth.providers?.antigravity || {};
  const devin = oauth.providers?.devin || {};
  const models = config.models || yamlRoot.models || {};
  const email = config["user-email"] || yamlRoot["user-email"] || {};
  const smtp = email.sender?.smtp || {};
  return {
    // Read shared settings from YAML so omitted/null, false and empty strings stay distinct.
    ...Object.fromEntries(sharedConfigFields.map(field => {
      const value = field.path.reduce((node, part) => node?.[part], yamlRoot) ?? null;
      return [field.key, field.type === "json" && value !== null ? JSON.stringify(value, null, 2) : value];
    })),
    debug: Boolean(logs.debug),
    port: Number(server.port || 8317),
    cpaPublicUrl: (config["user-panel"] || yamlRoot["user-panel"])?.["cpa-public-url"] || "",
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
    userEmailEnabled: Boolean(email.enabled),
    userEmailPublicUrl: email["public-user-url"] || "",
    userEmailFromAddress: email["from-address"] || "",
    userEmailFromName: email["from-name"] || "",
    userEmailSenderType: email.sender?.type || "smtp",
    userEmailSmtpHost: smtp.host || "",
    userEmailSmtpPort: Number(smtp.port ?? 587),
    userEmailSmtpUsername: smtp.username || "",
    userEmailSmtpPasswordEnv: smtp["password-env"] || "HOME_USER_EMAIL_SMTP_PASSWORD",
    userEmailSmtpStarttls: smtp.starttls ?? true,
    userEmailVerificationTtl: email["verification-token-ttl"] || "24h",
    userEmailResetTtl: email["reset-token-ttl"] || "30m",
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

    loggingToFile: Boolean(logs["logging-to-file"]),
    logsMaxTotalSizeMb: Number(logs["logs-max-total-size-mb"] || 0),
    errorLogsMaxFiles: Number(logs["error-logs-max-files"] ?? 10),
    proxyUrl: requests["proxy-url"] || "",
    tlsHandshakeTimeoutSeconds: Number(requests["tls-handshake-timeout-seconds"] ?? 0),
    modelsCatalog: models.catalog || "",
    modelsCodexCatalog: models["codex-catalog"] || "",
    modelsDevinCatalog: models["devin-catalog"] || "",
    devinSensitiveWordsJson: (devin["sensitive-words"] || []).join("\n"),
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
      original: structuredClone(entry),
      displayName: entry["display-name"] || "",
      name: entry.name || "",
      alias: entry.alias || "",
      fork: Boolean(entry.fork),
      forceMapping: Boolean(entry["force-mapping"]),
    })),
  );
  aliasEditorBaseline = JSON.stringify(aliasRows.value);
  aliasEditorSource = draft.value.oauthModelAliasJson;
  const payload = parseJSON(draft.value.payloadJson, {});
  for (const mode of payloadModes)
    payloadDraft[mode.value] = structuredClone(
      Array.isArray(payload[mode.value]) ? payload[mode.value] : [],
    );
  payloadEditorBaseline = JSON.stringify(payloadDraft);
  payloadEditorSource = draft.value.payloadJson;
}
function syncSpecialDrafts() {
  const grouped = {};
  for (const row of aliasRows.value) {
    const channel = row.channel.trim().toLowerCase();
    if (!channel || !row.name.trim() || !row.alias.trim()) continue;
    (grouped[channel] ||= []).push({
      ...row.original,
      ...(row.displayName?.trim() ? { "display-name": row.displayName.trim() } : row.original?.["display-name"] !== undefined ? { "display-name": "" } : {}),
      name: row.name.trim(),
      alias: row.alias.trim(),
      fork: row.fork,
      "force-mapping": row.forceMapping,
    });
  }
  if (JSON.stringify(aliasRows.value) !== aliasEditorBaseline) {
    draft.value.oauthModelAliasJson = JSON.stringify(grouped, null, 2);
  } else {
    draft.value.oauthModelAliasJson = aliasEditorSource;
  }
  draft.value.payloadJson = JSON.stringify(payloadDraft) === payloadEditorBaseline
    ? payloadEditorSource
    : JSON.stringify({
        ...parseJSON(payloadEditorSource, {}),
        ...Object.fromEntries(payloadModes.map((mode) => [mode.value, payloadDraft[mode.value]])),
      }, null, 2);
}
async function loadWorkspace(preserveDraft = false) {
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
    baseline.value = structuredClone(next);
    if (preserveDraft !== true) {
      draft.value = structuredClone(next);
      syncEditors();
    }
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
  const version = ++modelRequestVersion;
  const channel = exclusionChannel.value;
  modelsLoading.value = true;
  modelsError.value = "";
  channelModels.value = [];
  try {
    const response = await fetchAPI(`/routing/model-definitions/${encodeURIComponent(channel)}`);
    if (version !== modelRequestVersion) return;
    if (!Array.isArray(response?.models)) throw new Error("Invalid model definitions response.");
    channelModels.value = response.models;
  } catch (error) {
    if (version !== modelRequestVersion) return;
    modelsError.value = error?.message || "Unable to load channel model definitions. Edit rules manually below.";
  } finally {
    if (version === modelRequestVersion) modelsLoading.value = false;
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
    displayName: "",
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
  ...Object.fromEntries(sharedConfigFields.map(field => [field.key, field.path])),
  debug: ["observability", "logs", "debug"],
  port: ["server", "port"],
  cpaPublicUrl: ["user-panel", "cpa-public-url"],
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
  userEmailEnabled: ["user-email", "enabled"],
  userEmailPublicUrl: ["user-email", "public-user-url"],
  userEmailFromAddress: ["user-email", "from-address"],
  userEmailFromName: ["user-email", "from-name"],
  userEmailSenderType: ["user-email", "sender", "type"],
  userEmailSmtpHost: ["user-email", "sender", "smtp", "host"],
  userEmailSmtpPort: ["user-email", "sender", "smtp", "port"],
  userEmailSmtpUsername: ["user-email", "sender", "smtp", "username"],
  userEmailSmtpPasswordEnv: ["user-email", "sender", "smtp", "password-env"],
  userEmailSmtpStarttls: ["user-email", "sender", "smtp", "starttls"],
  userEmailVerificationTtl: ["user-email", "verification-token-ttl"],
  userEmailResetTtl: ["user-email", "reset-token-ttl"],
  pluginsEnabled: ["plugins", "enabled"],
  pluginsDir: ["plugins", "dir"],
  pluginStoreSourcesJson: ["plugins", "store-sources"],
  oauthExcludedModelsJson: ["oauth", "excluded-models"],
  oauthModelAliasJson: ["oauth", "model-alias"],
  requestLog: ["observability", "logs", "request-log"],

  loggingToFile: ["observability", "logs", "logging-to-file"],
  logsMaxTotalSizeMb: ["observability", "logs", "logs-max-total-size-mb"],
  errorLogsMaxFiles: ["observability", "logs", "error-logs-max-files"],
  proxyUrl: ["requests", "proxy-url"],
  tlsHandshakeTimeoutSeconds: ["requests", "tls-handshake-timeout-seconds"],
  modelsCatalog: ["models", "catalog"],
  modelsCodexCatalog: ["models", "codex-catalog"],
  modelsDevinCatalog: ["models", "devin-catalog"],
  devinSensitiveWordsJson: ["oauth", "providers", "devin", "sensitive-words"],
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
      if (sharedConfigFields.some(field => field.key === key) && value === null) {
        document.deleteIn(path);
        continue;
      }
      if (
        [
          "port",
          "userEmailSmtpPort",
          "logsMaxTotalSizeMb",
          "errorLogsMaxFiles",
          "requestRetry",
          "maxRetryCredentials",
          "maxRetryInterval",
          "tlsHandshakeTimeoutSeconds",
        ].includes(key)
      )
        value = Number(value);
      else if (
        ["pluginStoreSourcesJson", "antigravitySensitiveWordsJson", "devinSensitiveWordsJson"].includes(
          key,
        )
      )
        value = lines(value);
      else if (
        [
          "oauthExcludedModelsJson",
          "oauthRequestScopedErrorsJson",
          "oauthModelAliasJson",
          "payloadJson",
        ].includes(key)
      )
        value = parseJSON(value, {});
      else if (["proxyUrl", "cpaPublicUrl", "modelsCatalog", "modelsCodexCatalog", "modelsDevinCatalog"].includes(key)) value = String(value).trim();
      document.setIn(path, value);
    }
    if (changed.some(key => key.startsWith("userEmail"))) {
      for (const key of outline.find(section => section.id === "user-email").keys) {
        const value = key === "userEmailSmtpPort" ? Number(draft.value[key]) : draft.value[key];
        document.setIn(v8YamlPaths[key], value);
      }
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

watch(aliasRows, syncSpecialDrafts, { deep: true });

useDataSync('admin:config:sync', () => loadWorkspace(true));
onMounted(loadWorkspace);
</script>
