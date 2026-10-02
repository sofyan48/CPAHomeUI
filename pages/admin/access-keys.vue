<template>
  <section class="grid w-full gap-5">
    <header
      class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
    </header>

    <AppCard v-if="primaryError">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="font-semibold text-[var(--ui-text-highlighted)]">
            Access keys could not be loaded
          </h2>
          <p class="mt-1 text-sm text-[var(--ui-text-muted)]">
            Check the management endpoint, key, and /access/api-keys route.
          </p>
        </div>
        <AppButton
          color="neutral"
          variant="outline"
          icon="i-tabler-refresh"
          :loading="loading"
          @click="syncData"
          >Retry</AppButton
        >
      </div>
    </AppCard>

    <AppCard v-else-if="loading && !hasLoaded">
      <div class="py-8 text-center">
        <h2 class="font-semibold text-[var(--ui-text-highlighted)]">
          Loading access keys
        </h2>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">
          Reading client access keys and related ownership metadata from the
          Management API.
        </p>
      </div>
    </AppCard>

    <AdminTablePanel
      v-else
      title="Access keys"
      :description="`${filteredResources.length} of ${resources.length} keys`"
    >
      <template #filters>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <UFormField label="Search"
            ><UInput
              v-model="search"
              icon="i-tabler-search"
              placeholder="Filter name, key, owner, or scope"
              class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #actions
        ><AppButton icon="i-tabler-plus" @click="openCreate"
          >New access key</AppButton
        ></template
      >

      <template v-if="selectedIDs.size" #bulk>
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span class="text-sm font-medium"
            >{{ selectedIDs.size }} keys selected</span
          >
          <div class="flex flex-wrap gap-2">
            <AppButton
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="bulkDeleting"
              @click="clearSelection"
              >Clear selection</AppButton
            >
            <AppButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-tabler-trash"
              :disabled="bulkDeleting"
              @click="openBulkDelete"
              >Delete selected</AppButton
            >
          </div>
        </div>
      </template>

      <AppTable
        :columns="columns"
        :data="filteredResources"
        :loading="loading"
        class="access-keys-table min-w-[980px]"
      >
        <template #select-header>
          <UCheckbox
            :model-value="allFilteredSelected"
            :indeterminate="someFilteredSelected"
            :disabled="loading || bulkDeleting || !filteredResources.length"
            aria-label="Select all keys in the current list"
            @update:model-value="toggleAllFiltered(Boolean($event))"
          />
        </template>

        <template #select-cell="{ row }">
          <UCheckbox
            :model-value="selectedIDs.has(rowValue(row).id)"
            :disabled="bulkDeleting"
            :aria-label="`Select access key ${resourceSummary(rowValue(row))}`"
            @update:model-value="toggleSelected(rowValue(row), Boolean($event))"
          />
        </template>

        <template #number-cell="{ row }">
          <span class="font-mono text-xs text-[var(--ui-text-muted)]"
            >#{{ rowValue(row).index + 1 }}</span
          >
        </template>

        <template #identity-header>
          <div class="flex items-center gap-1.5">
            <span>Name / key</span>
            <UTooltip
              :text="[
                'The display name is an editable label and does not affect authentication.',
                'The stable identifier (api-key-N) survives renames and key rotations,',
                'and links the same key across usage, billing, and request records.'
              ].join(' ')"
            >
              <UIcon
                name="i-tabler-info-circle"
                class="size-4 text-[var(--ui-text-muted)]"
              />
            </UTooltip>
          </div>
        </template>

        <template #identity-cell="{ row }">
          <div class="min-w-0">
            <p
              v-if="rowValue(row).displayName"
              class="truncate text-sm font-medium"
            >
              {{ rowValue(row).displayName }}
            </p>
            <p
              v-if="rowValue(row).identifier"
              class="truncate font-mono text-xs font-medium"
            >
              {{ rowValue(row).identifier }}
            </p>
            <p v-else class="truncate text-xs text-[var(--ui-text-muted)]">
              No stable identifier
            </p>
            <div class="mt-1 flex min-w-0 items-center gap-1.5">
              <p
                class="min-w-0 truncate font-mono text-xs text-[var(--ui-text-muted)]"
              >
                {{ rowValue(row).maskedValue }}
              </p>
              <AppButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-tabler-clipboard"
                :aria-label="`Copy key ${rowValue(row).maskedValue}`"
                @click="copyText(rowValue(row).value, 'Access key copied.')"
              />
            </div>
          </div>
        </template>

        <template #owner-cell="{ row }">
          <span
            :class="{
              'text-[var(--ui-text-muted)]':
                rowValue(row).userId == null || rowValue(row).userId === 0,
            }"
          >
            {{ ownerName(rowValue(row)) }}
          </span>
        </template>

        <template #credential-scope-cell="{ row }">
          <span class="block max-w-[220px] truncate">{{
            credentialScope(rowValue(row))
          }}</span>
        </template>

        <template #model-scope-cell="{ row }">
          <span class="block max-w-[220px] truncate">{{
            modelScope(rowValue(row))
          }}</span>
        </template>

        <template #length-cell="{ row }">{{ rowValue(row).length }}</template>

        <template #status-cell>
          <UBadge color="success" variant="subtle"
            ><UIcon
              name="i-tabler-circle-check"
              class="mr-1 size-3"
            />Accepted</UBadge
          >
        </template>

        <template #actions-cell="{ row }"
          ><div class="flex justify-end gap-1">
            <AdminTableAction
              action="view"
              label="View access key"
              @click="openDetail(rowValue(row))"
            /><AdminTableAction
              action="edit"
              label="Edit access key"
              @click="openEdit(rowValue(row))"
            /><AdminTableAction
              v-if="rowValue(row).identifier"
              action="copy"
              label="Copy identifier"
              @click="copyText(rowValue(row).identifier, 'Identifier copied.')"
            /><AdminTableAction
              action="delete"
              label="Delete access key"
              destructive
              @click="openDelete(rowValue(row))"
            /></div
        ></template>

        <template #empty>
          <div
            class="px-6 py-12 text-center text-sm text-[var(--ui-text-muted)]"
          >
            No access keys match the current filter.
          </div>
        </template>
      </AppTable>
    </AdminTablePanel>

    <USlideover
      v-model:open="detailOpen"
      :title="detailTitle"
      :description="detailDescription"
      :ui="{ content: 'sm:max-w-xl' }"
      @update:open="handleDetailOpen"
    >
      <template #body>
        <form
          v-if="sheetMode === 'create' || sheetMode === 'edit'"
          class="grid gap-4"
          @submit.prevent="submitKey"
        >
          <p
            v-if="sheetMode === 'create'"
            class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]"
          >
            Create access key
          </p>

          <UFormField
            v-if="supportsDisplayNames"
            label="Display name"
            hint="Optional, up to 128 characters. Renaming does not change the key value, owner, or scopes."
            :error="displayNameError"
          >
            <UInput
              v-model="form.displayName"
              class="w-full"
              placeholder="e.g. Production key"
              :disabled="submitting"
              @input="displayNameError = ''"
            />
          </UFormField>

          <UFormField label="Key value" required :error="keyValueError">
            <div class="flex gap-2">
              <UInput
                v-model="form.value"
                :type="formSecretVisible ? 'text' : 'password'"
                class="min-w-0 flex-1 font-mono"
                autocomplete="off"
                :disabled="submitting"
                @input="keyValueError = ''"
              />
              <AppButton
                type="button"
                color="neutral"
                variant="outline"
                :icon="formSecretVisible ? 'i-tabler-eye-off' : 'i-tabler-eye'"
                :aria-label="formSecretVisible ? 'Hide' : 'Reveal'"
                @click="formSecretVisible = !formSecretVisible"
              />
            </div>
          </UFormField>

          <AppButton
            type="button"
            color="neutral"
            variant="outline"
            icon="i-tabler-sparkles"
            :disabled="submitting"
            @click="generateKey"
          >
            Generate key
          </AppButton>

          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AppButton
              type="button"
              color="neutral"
              variant="outline"
              :disabled="submitting"
              @click="cancelForm"
              >Cancel</AppButton
            >
            <AppButton type="submit" :loading="submitting">{{
              sheetMode === "edit" ? "Save key" : "Create key"
            }}</AppButton>
          </div>
        </form>

        <div v-else-if="selectedResource" class="space-y-5">
          <div class="rounded-md border border-[var(--ui-border)] p-3">
            <p class="text-xs text-[var(--ui-text-muted)]">Secret value</p>
            <p class="mt-2 break-all font-mono text-sm">
              {{
                detailSecretVisible
                  ? selectedResource.value
                  : selectedResource.maskedValue
              }}
            </p>
            <div class="mt-3 flex gap-2">
              <AppButton
                color="neutral"
                variant="outline"
                size="sm"
                :icon="
                  detailSecretVisible ? 'i-tabler-eye-off' : 'i-tabler-eye'
                "
                @click="detailSecretVisible = !detailSecretVisible"
              >
                {{ detailSecretVisible ? "Hide" : "Reveal" }}
              </AppButton>
              <AppButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-tabler-clipboard"
                @click="copyText(selectedResource.value, 'Access key copied.')"
                >Copy</AppButton
              >
            </div>
          </div>

          <dl class="grid gap-3 text-sm">
            <div
              v-if="supportsDisplayNames"
              class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <dt class="text-xs text-[var(--ui-text-muted)]">Display name</dt>
              <dd class="mt-1 break-words font-mono text-xs">
                {{ selectedResource.displayName || "No display name" }}
              </dd>
            </div>
            <div
              class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <dt class="text-xs text-[var(--ui-text-muted)]">Prefix</dt>
              <dd class="mt-1 break-words font-mono text-xs">
                {{ selectedResource.prefix }}
              </dd>
            </div>
            <div
              class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <dt class="text-xs text-[var(--ui-text-muted)]">Suffix</dt>
              <dd class="mt-1 break-words font-mono text-xs">
                {{ selectedResource.suffix }}
              </dd>
            </div>
            <div
              class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <dt class="text-xs text-[var(--ui-text-muted)]">Length</dt>
              <dd class="mt-1 break-words font-mono text-xs">
                {{ selectedResource.length }}
              </dd>
            </div>
            <div
              class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <dt class="text-xs text-[var(--ui-text-muted)]">Owner</dt>
              <dd class="mt-1 break-words font-mono text-xs">
                {{ ownerName(selectedResource) }}
              </dd>
            </div>
            <div
              class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <dt class="text-xs text-[var(--ui-text-muted)]">
                Credential scope
              </dt>
              <dd class="mt-1 break-words font-mono text-xs">
                {{ credentialScope(selectedResource) }}
              </dd>
            </div>
            <div
              class="rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <dt class="text-xs text-[var(--ui-text-muted)]">Model scope</dt>
              <dd class="mt-1 break-words font-mono text-xs">
                {{ modelScope(selectedResource) }}
              </dd>
            </div>
          </dl>

          <div class="grid gap-2">
            <AppButton icon="i-tabler-pencil" @click="openEdit(selectedResource)"
              >Edit</AppButton
            >
            <AppButton
              color="error"
              variant="outline"
              icon="i-tabler-trash"
              @click="openDelete(selectedResource)"
              >Delete</AppButton
            >
          </div>
        </div>
      </template>
    </USlideover>

    <AppModal
      v-model:open="confirmationOpen"
      :title="confirmationTitle"
      :description="confirmationDescription"
    >
      <template #body>
        <div class="flex justify-end gap-2">
          <AppButton
            color="neutral"
            variant="outline"
            :disabled="confirmationBusy"
            @click="closeConfirmation"
            >Cancel</AppButton
          >
          <AppButton
            color="error"
            :loading="confirmationBusy"
            @click="confirmDestructiveAction"
            >{{ confirmationActionLabel }}</AppButton
          >
        </div>
      </template>
    </AppModal>
  </section>
</template>

<script setup>
import { useWorkspaceState } from '~/composables/useWorkspaceState'
const { fetchAPI, fetchRaw } = useApi();
const { supports } = useCapabilities();
const toast = useToast();

const MAX_DISPLAY_NAME_LENGTH = 128;
const rowValue = (row) => row?.original ?? row;

const search = ref("");
const loading = useWorkspaceState('admin:access-keys:loading', () => (false));
const hasLoaded = useWorkspaceState('admin:access-keys:hasLoaded', () => (false));
const primaryError = useWorkspaceState('admin:access-keys:primaryError', () => (""));
const resources = useWorkspaceState('admin:access-keys:resources', () => ([]));
const users = useWorkspaceState('admin:access-keys:users', () => ([]));
const channelGroups = useWorkspaceState('admin:access-keys:channelGroups', () => ([]));
const modelGroups = useWorkspaceState('admin:access-keys:modelGroups', () => ([]));

const supportsDisplayNames = useWorkspaceState('admin:access-keys:supportsDisplayNames', () => (true));
const selectedIDs = ref(new Set());
const wideTable = ref(false);

const detailOpen = ref(false);
const sheetMode = ref("detail");
const selectedResource = ref(null);
const detailSecretVisible = ref(false);
const formSecretVisible = ref(false);
const submitting = useWorkspaceState('admin:access-keys:submitting', () => (false));
const keyValueError = ref("");
const displayNameError = ref("");
const form = reactive({ value: "", displayName: "" });

const confirmationOpen = ref(false);
const confirmationType = ref(null);
const confirmationResources = ref([]);
const deleting = useWorkspaceState('admin:access-keys:deleting', () => (false));
const bulkDeleting = useWorkspaceState('admin:access-keys:bulkDeleting', () => (false));

const compactColumns = [
  { accessorKey: "select", header: "" },
  { accessorKey: "identity", header: "Name / key" },
  { accessorKey: "status", header: "Status" },
  {
    id: "actions",
    header: "Actions",
    meta: {
      class: {
        th: "w-px whitespace-nowrap text-right",
        td: "w-px whitespace-nowrap text-right",
      },
    },
  },
];

const fullColumns = [
  { accessorKey: "select", header: "" },
  { accessorKey: "number", header: "No." },
  { accessorKey: "identity", header: "Name / key" },
  { accessorKey: "owner", header: "Owner" },
  { accessorKey: "credential-scope", header: "Credential scope" },
  { accessorKey: "model-scope", header: "Model scope" },
  { accessorKey: "length", header: "Length" },
  { accessorKey: "status", header: "Status" },
  {
    id: "actions",
    header: "Actions",
    meta: {
      class: {
        th: "w-px whitespace-nowrap text-right",
        td: "w-px whitespace-nowrap text-right",
      },
    },
  },
];

const columns = computed(() =>
  wideTable.value ? fullColumns : compactColumns,
);
const detailTitle = computed(() =>
  sheetMode.value === "create"
    ? "New downstream key"
    : sheetMode.value === "edit"
      ? "Update downstream key"
      : "Key detail",
);
const detailDescription = computed(() => {
  if (sheetMode.value === "create") return "Create access key";
  return selectedResource.value
    ? resourceSummary(selectedResource.value)
    : "Select a key or create a new one.";
});

const filteredResources = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return resources.value;
  return resources.value.filter((resource) =>
    [
      resource.value,
      resource.maskedValue,
      resource.identifier ?? "",
      resource.displayName ?? "",
      resource.prefix,
      resource.suffix,
      String(resource.index),
      resource.userId == null || resource.userId === 0
        ? ""
        : ownerName(resource),
      credentialScope(resource),
      modelScope(resource),
    ].some((value) => String(value).toLowerCase().includes(query)),
  );
});

const selectedResources = computed(() =>
  resources.value.filter((resource) => selectedIDs.value.has(resource.id)),
);
const selectedFilteredResources = computed(() =>
  filteredResources.value.filter((resource) =>
    selectedIDs.value.has(resource.id),
  ),
);
const allFilteredSelected = computed(
  () =>
    filteredResources.value.length > 0 &&
    selectedFilteredResources.value.length === filteredResources.value.length,
);
const someFilteredSelected = computed(
  () =>
    selectedFilteredResources.value.length > 0 && !allFilteredSelected.value,
);
const confirmationBusy = computed(() => deleting.value || bulkDeleting.value);
const confirmationTitle = computed(() =>
  confirmationType.value === "bulk"
    ? "Delete selected access keys?"
    : "Delete access key?",
);
const confirmationDescription = computed(() => {
  if (confirmationType.value === "bulk")
    return `Delete ${confirmationResources.value.length} selected access keys?`;
  const resource = confirmationResources.value[0];
  return resource ? `Delete access key ${resourceSummary(resource)}?` : "";
});
const confirmationActionLabel = computed(() =>
  confirmationType.value === "bulk" ? "Delete selected" : "Delete",
);

let mediaQuery;
let mediaQueryListener;

onMounted(() => {
  mediaQuery = window.matchMedia("(min-width: 640px)");
  mediaQueryListener = (event) => {
    wideTable.value = event.matches;
  };
  wideTable.value = mediaQuery.matches;
  mediaQuery.addEventListener?.("change", mediaQueryListener);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener?.("change", mediaQueryListener);
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(object, keys) {
  for (const key of keys) {
    if (typeof object?.[key] === "string") return object[key];
  }
  return null;
}

function firstNumber(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function numericArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "number" && Number.isFinite(item))
    : [];
}

function selectAPIKeyEntries(payload) {
  if (Array.isArray(payload)) return payload;
  const entries = payload?.api_key_entries ?? payload?.items;
  if (Array.isArray(entries) && entries.length > 0) return entries;
  const legacy = payload?.["api-keys"] ?? payload?.api_keys;
  return Array.isArray(legacy)
    ? legacy.filter((value) => typeof value === "string")
    : [];
}

function normalizeResource(raw, index) {
  const object = isPlainObject(raw) ? raw : null;
  const value = (
    object
      ? (firstString(object, ["api_key", "api-key", "key", "value"]) ?? "")
      : typeof raw === "string"
        ? raw
        : ""
  ).trim();
  const numericId = object
    ? firstNumber(object, ["id", "api_key_id", "api-key-id"])
    : null;
  const displayNameValue = object
    ? firstString(object, ["display_name"])
    : null;
  const displayName = displayNameValue?.trim() || null;
  const modelGroupValue = object
    ? (object.model_groups ?? object["model-groups"])
    : null;
  return {
    id: numericId != null ? String(numericId) : `${index}:${value}`,
    index,
    numericId,
    identifier: numericId != null ? `api-key-${numericId}` : null,
    displayName,
    value,
    maskedValue: value
      ? value.length <= 10
        ? `${value.slice(0, 2)}***`
        : `${value.slice(0, 6)}...${value.slice(-4)}`
      : "",
    prefix: value.slice(0, 6),
    suffix: value.slice(-4),
    length: value.length,
    userId: object ? firstNumber(object, ["user_id", "user-id"]) : null,
    channelGroupIds: numericArray(object?.channels),
    modelGroupIds: numericArray(modelGroupValue),
    raw,
  };
}

function serializeEntry(resource, displayName) {
  return {
    api_key: resource.value.trim(),
    ...(displayName === undefined
      ? {}
      : { display_name: displayName.trim() || null }),
    user_id: resource.userId ?? 0,
    channels: resource.channelGroupIds ?? [],
    model_groups: resource.modelGroupIds ?? [],
  };
}

function topLevelArray(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function normalizeUsers(payload) {
  return topLevelArray(payload, ["users", "items", "records", "data"])
    .map((item) => {
      if (!isPlainObject(item)) return null;
      const id = firstNumber(item, ["id", "user_id", "userId"]);
      if (id == null) return null;
      return {
        id,
        name:
          firstString(item, [
            "username",
            "user_name",
            "userName",
            "name",
          ])?.trim() || String(id),
      };
    })
    .filter(Boolean);
}

function normalizeGroups(payload, kind) {
  const topLevelKey = kind === "channel" ? "channel_groups" : "model_groups";
  const nameKeys =
    kind === "channel"
      ? ["channel_name", "name", "label"]
      : ["group_name", "name", "label"];
  const fallbackPrefix = kind === "channel" ? "channel-group" : "model-group";
  return topLevelArray(payload, [topLevelKey, "items"]).map((item, index) => {
    const object = isPlainObject(item) ? item : {};
    const id = firstNumber(object, ["id"]) ?? index + 1;
    return {
      id,
      name:
        firstString(object, nameKeys)?.trim() ||
        `${fallbackPrefix}-${index + 1}`,
    };
  });
}

async function loadPrimary() {
  const response = await fetchRaw("/access/api-keys");
  const payload = response._data;
  const entries = selectAPIKeyEntries(payload);
  resources.value = entries
    .map(normalizeResource)
    .filter((resource) => resource.value);
  supportsDisplayNames.value =
    entries.length === 0 ||
    entries.some(
      (entry) =>
        isPlainObject(entry) &&
        Object.prototype.hasOwnProperty.call(entry, "display_name"),
    );
}

async function supplementalRequest(path) {
  try {
    return await fetchAPI(path);
  } catch {
    return null;
  }
}

async function loadSupplemental() {
  const tasks = [];
  let usersIndex = -1;
  let channelGroupsIndex = -1;
  let modelGroupsIndex = -1;

  if (supports("users", true)) {
    usersIndex = tasks.length;
    tasks.push(supplementalRequest("/users"));
  }

  if (supports("access_groups", true)) {
    channelGroupsIndex = tasks.length;
    tasks.push(supplementalRequest("/channel-groups"));
    tasks.push(supplementalRequest("/channel-group-details"));
    modelGroupsIndex = tasks.length;
    tasks.push(supplementalRequest("/model-groups"));
    tasks.push(supplementalRequest("/model-group-details"));
  }

  const results = await Promise.all(tasks);
  users.value = usersIndex >= 0 ? normalizeUsers(results[usersIndex]) : [];
  channelGroups.value =
    channelGroupsIndex >= 0
      ? normalizeGroups(results[channelGroupsIndex], "channel")
      : [];
  modelGroups.value =
    modelGroupsIndex >= 0
      ? normalizeGroups(results[modelGroupsIndex], "model")
      : [];
}

async function syncData() {
  loading.value = true;
  primaryError.value = "";
  try {
    await loadPrimary();
    await loadSupplemental();
    const validIDs = new Set(resources.value.map((resource) => resource.id));
    selectedIDs.value = new Set(
      [...selectedIDs.value].filter((id) => validIDs.has(id)),
    );
    if (selectedResource.value)
      selectedResource.value =
        resources.value.find(
          (resource) => resource.id === selectedResource.value.id,
        ) ?? null;
    hasLoaded.value = true;
  } catch (error) {
    resources.value = [];
    users.value = [];
    channelGroups.value = [];
    modelGroups.value = [];

    primaryError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  selectedResource.value = null;
  sheetMode.value = "create";
  form.value = "";
  form.displayName = "";
  resetFormState();
  detailOpen.value = true;
}

function openDetail(resource) {
  selectedResource.value = resource;
  sheetMode.value = "detail";
  detailSecretVisible.value = false;
  detailOpen.value = true;
}

function openEdit(resource) {
  selectedResource.value = resource;
  sheetMode.value = "edit";
  form.value = resource.value;
  form.displayName = resource.displayName || "";
  resetFormState();
  detailOpen.value = true;
}

function resetFormState() {
  keyValueError.value = "";
  displayNameError.value = "";
  formSecretVisible.value = false;
}

function cancelForm() {
  if (sheetMode.value === "edit") {
    sheetMode.value = "detail";
    resetFormState();
    return;
  }
  detailOpen.value = false;
}

function handleDetailOpen(open) {
  if (!open) {
    sheetMode.value = "detail";
    detailSecretVisible.value = false;
    resetFormState();
  }
}

function validateForm() {
  const value = form.value.trim();
  const displayName = form.displayName.trim();
  if (!value) keyValueError.value = "Key value is required.";
  if (
    supportsDisplayNames.value &&
    Array.from(displayName).length > MAX_DISPLAY_NAME_LENGTH
  ) {
    displayNameError.value = "The display name must not exceed 128 characters.";
  }
  return Boolean(value) && !displayNameError.value;
}

async function submitKey() {
  keyValueError.value = "";
  displayNameError.value = "";
  if (!validateForm()) return;

  submitting.value = true;
  try {
    if (sheetMode.value === "edit" && selectedResource.value) {
      const changed = await updateResource(selectedResource.value);
      if (!changed) {
        sheetMode.value = "detail";
        return;
      }
      await syncData();
      selectedResource.value =
        resources.value.find(
          (resource) => resource.id === selectedResource.value?.id,
        ) ?? null;
      sheetMode.value = "detail";
      toast.add({ title: "Access key updated.", color: "success" });
    } else {
      await createResource();
      detailOpen.value = false;
      await syncData();
      toast.add({ title: "Access key created.", color: "success" });
    }
  } catch (error) {
    showErrorToast(error);
  } finally {
    submitting.value = false;
  }
}

async function createResource() {
  const response = await fetchRaw("/access/api-keys");
  const entries = selectAPIKeyEntries(response._data);
  const existingResources = entries
    .map(normalizeResource)
    .filter((resource) => resource.value);
  const newResource = {
    value: form.value.trim(),
    userId: 0,
    channelGroupIds: [],
    modelGroupIds: [],
  };
  const newEntry = serializeEntry(
    newResource,
    supportsDisplayNames.value ? form.displayName : undefined,
  );

  if (
    existingResources.length === 0 ||
    existingResources.every((resource) => resource.numericId != null)
  ) {
    try {
      await fetchAPI("/access/api-keys", { method: "POST", body: newEntry });
      return;
    } catch (error) {
      if (error?.statusCode !== 404 && error?.statusCode !== 405) throw error;
    }
  }

  await fetchAPI("/access/api-keys", {
    method: "PUT",
    body: {
      api_key_entries: [
        ...existingResources.map((resource) =>
          serializeEntry(
            resource,
            supportsDisplayNames.value ? resource.displayName || "" : undefined,
          ),
        ),
        newEntry,
      ],
    },
  });
}

async function updateResource(resource) {
  const nextValue = form.value.trim();
  const nextDisplayName = form.displayName.trim();
  const valueChanged = nextValue !== resource.value;
  const displayNameChanged =
    supportsDisplayNames.value &&
    nextDisplayName !== (resource.displayName || "");
  if (!valueChanged && !displayNameChanged) return false;

  if (valueChanged) {
    await fetchAPI("/access/api-keys", {
      method: "PATCH",
      body: {
        ...(resource.numericId != null
          ? { id: resource.numericId }
          : { index: resource.index }),
        value: {
          api_key: nextValue,
          user_id: resource.userId ?? 0,
          channels: resource.channelGroupIds,
          model_groups: resource.modelGroupIds,
        },
        ...(displayNameChanged
          ? { display_name: nextDisplayName || null }
          : {}),
      },
    });
  } else {
    await fetchAPI("/access/api-keys", {
      method: "PATCH",
      body: {
        ...(resource.numericId != null
          ? { id: resource.numericId }
          : { api_key: resource.value }),
        display_name: nextDisplayName || null,
      },
    });
  }
  return true;
}

function openDelete(resource) {
  confirmationType.value = "delete";
  confirmationResources.value = [resource];
  confirmationOpen.value = true;
}

function openBulkDelete() {
  confirmationType.value = "bulk";
  confirmationResources.value = [...selectedResources.value];
  confirmationOpen.value = true;
}

function closeConfirmation() {
  confirmationOpen.value = false;
  confirmationType.value = null;
  confirmationResources.value = [];
}

async function confirmDestructiveAction() {
  if (confirmationType.value === "bulk") await deleteSelected();
  else await deleteOne();
}

async function requestDelete(resource) {
  await fetchAPI("/access/api-keys", {
    method: "DELETE",
    query:
      resource.numericId != null
        ? { id: resource.numericId }
        : { index: resource.index },
  });
}

async function deleteOne() {
  const resource = confirmationResources.value[0];
  if (!resource) return;
  deleting.value = true;
  try {
    await requestDelete(resource);
    selectedIDs.value = new Set(
      [...selectedIDs.value].filter((id) => id !== resource.id),
    );
    selectedResource.value = null;
    sheetMode.value = "detail";
    detailOpen.value = false;
    closeConfirmation();
    await syncData();
    toast.add({ title: "Access key deleted.", color: "success" });
  } catch (error) {
    showErrorToast(error);
  } finally {
    deleting.value = false;
  }
}

async function deleteSelected() {
  const targets = [...confirmationResources.value].sort(
    (left, right) => right.index - left.index,
  );
  if (!targets.length) return;
  bulkDeleting.value = true;
  try {
    for (const resource of targets) await requestDelete(resource);
    selectedIDs.value = new Set();
    selectedResource.value = null;
    sheetMode.value = "detail";
    detailOpen.value = false;
    closeConfirmation();
    await syncData();
    toast.add({
      title: `${targets.length} access keys deleted.`,
      color: "success",
    });
  } catch (error) {
    showErrorToast(error);
  } finally {
    bulkDeleting.value = false;
  }
}

function rowActions(resource) {
  return [
    [
      {
        label: "View",
        icon: "i-tabler-eye",
        onSelect: () => openDetail(resource),
      },
      {
        label: "Edit",
        icon: "i-tabler-pencil",
        onSelect: () => openEdit(resource),
      },
      ...(resource.identifier
        ? [
            {
              label: "Copy identifier",
              icon: "i-tabler-clipboard",
              onSelect: () =>
                copyText(resource.identifier, "Identifier copied."),
            },
          ]
        : []),
      {
        label: "Delete",
        icon: "i-tabler-trash",
        color: "error",
        onSelect: () => openDelete(resource),
      },
    ],
  ];
}

function toggleSelected(resource, checked) {
  const next = new Set(selectedIDs.value);
  if (checked) next.add(resource.id);
  else next.delete(resource.id);
  selectedIDs.value = next;
}

function toggleAllFiltered(checked) {
  const next = new Set(selectedIDs.value);
  for (const resource of filteredResources.value) {
    if (checked) next.add(resource.id);
    else next.delete(resource.id);
  }
  selectedIDs.value = next;
}

function clearSelection() {
  selectedIDs.value = new Set();
}

function generatedKey() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sk-${hex}`;
}

function generateKey() {
  form.value = generatedKey();
  keyValueError.value = "";
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    toast.add({ title: successMessage, color: "success" });
  } catch (error) {
    showErrorToast(error);
  }
}

function resourceSummary(resource) {
  const identity = resource.identifier
    ? `${resource.identifier} · ${resource.maskedValue}`
    : resource.maskedValue;
  return resource.displayName
    ? `${resource.displayName} · ${identity}`
    : identity;
}

function ownerName(resource) {
  if (resource.userId == null || resource.userId === 0) return "Unassigned";
  return (
    users.value.find((user) => user.id === resource.userId)?.name ||
    String(resource.userId)
  );
}

function groupName(id, groups) {
  return groups.find((group) => group.id === id)?.name || String(id);
}

function credentialScope(resource) {
  return resource.channelGroupIds.length
    ? resource.channelGroupIds
        .map((id) => groupName(id, channelGroups.value))
        .join(", ")
    : "Unrestricted";
}

function modelScope(resource) {
  return resource.modelGroupIds.length
    ? resource.modelGroupIds
        .map((id) => groupName(id, modelGroups.value))
        .join(", ")
    : "Unrestricted";
}

function errorMessage(error) {
  return typeof error?.message === "string" && error.message.trim()
    ? error.message
    : "Management API request failed";
}

function showErrorToast(error) {
  toast.add({ title: errorMessage(error), color: "error" });
}

await syncData();
</script>

<style scoped>
.access-keys-table :deep(th:first-child),
.access-keys-table :deep(td:first-child) {
  width: 2.75rem;
  min-width: 2.75rem;
}

.access-keys-table :deep(th:nth-child(2)),
.access-keys-table :deep(td:nth-child(2)) {
  min-width: 12rem;
}

.access-keys-table :deep(th:nth-last-child(2)),
.access-keys-table :deep(td:nth-last-child(2)) {
  white-space: nowrap;
}
</style>
