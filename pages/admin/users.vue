<template>
  <section class="grid gap-5">
    <UAlert
      v-if="capabilitiesError"
      color="warning"
      variant="subtle"
      title="Capability discovery failed"
      :description="capabilitiesError"
    />
    <UAlert
      v-if="pageErrors.length"
      color="warning"
      variant="subtle"
      title="Some data could not be loaded"
      :description="pageErrors.join(' · ')"
    />

    <UAlert
      v-if="!usersSupported"
      color="info"
      variant="subtle"
      title="This runtime does not expose user management"
      description="The connected runtime did not declare user management support. The page will not load user management tables or invent users, key ownership, or access scopes."
    />

    <template v-else>
      <AppPanelTabs v-model="activeTab" :items="tabs" label="Users & Access" />

      <AdminTablePanel
        v-if="activeTab === 'users'"
        title="Users"
        :description="`${filteredUsers.length} of ${users.length} users`"
      >
        <template #filters>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UFormField label="Search"
              ><UInput
                v-model="search"
                icon="i-tabler-search"
                placeholder="Filter users or scopes"
                class="w-full"
            /></UFormField>
          </div>
        </template>
        <template #actions
          ><AppButton icon="i-tabler-plus" @click="openUserCreate"
            >New user</AppButton
          ></template
        >

        <template v-if="selectedUsers.length" #bulk>
          <div
            class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p class="text-sm font-medium">
                {{ selectedUsers.length }} users selected
              </p>
              <p class="mt-0.5 text-xs text-[var(--ui-text-muted)]">
                Bulk operations create separate balance records for each user.
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <AppButton
                size="sm"
                color="neutral"
                variant="ghost"
                @click="selectedUserIds = new Set()"
                >Clear selection</AppButton
              ><AppButton
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-tabler-cash-banknote"
                @click="openBalance(selectedUsers)"
                >Balance operation</AppButton
              >
            </div>
          </div>
        </template>

        <AppTable
          :columns="userColumns"
          :data="filteredUsers"
          :loading="loading"
          empty="No users match the current filter."
        >
          <template #select-header>
            <UCheckbox
              :model-value="allFilteredUsersSelected"
              :indeterminate="someFilteredUsersSelected"
              :disabled="!operableFilteredUsers.length"
              aria-label="Select operable users in the current list"
              @update:model-value="toggleAllFilteredUsers(Boolean($event))"
            />
          </template>
          <template #select-cell="{ row }"
            ><UCheckbox
              :model-value="selectedUserIds.has(row.original.id)"
              :disabled="!isOperableUser(row.original)"
              :aria-label="`Select user ${row.original.username}`"
              @update:model-value="
                toggleUserSelection(row.original.id, Boolean($event))
              "
          /></template>
          <template #user-cell="{ row }"
            ><p class="font-medium">{{ row.original.username }}</p></template
          >
          <template #status-cell="{ row }"
            ><UBadge
              :color="row.original.deleted_at ? 'warning' : 'success'"
              variant="subtle"
              >{{ row.original.deleted_at ? "Deleted" : "Active" }}</UBadge
            ></template
          >
          <template #credits-cell="{ row }"
            ><span class="tabular-nums">{{
              formatCredits(row.original.credits)
            }}</span></template
          >
          <template #periodLimits-cell="{ row }"
            ><span
              v-if="zeroPeriodWindows(row.original).length"
              :class="[
                'inline-flex rounded-md border px-2 py-1 text-xs font-medium',
                'border-amber-300 bg-amber-50 text-amber-700',
                'dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
              ]"
              >Blocked: {{ zeroPeriodWindows(row.original).join(", ") }}</span
            ><span
              v-else-if="periodWindows(row.original).length"
              class="inline-flex rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] px-2 py-1 text-xs text-[var(--ui-text-muted)]"
              >{{ periodWindows(row.original).length }} windows</span
            ><span v-else class="text-[var(--ui-text-muted)]">—</span></template
          >
          <template #keys-cell="{ row }">{{
            keysForUser(row.original.id).length
          }}</template>
          <template #credentialScope-cell="{ row }"
            ><span
              class="block max-w-52 truncate"
              :title="effectiveChannelScopes(row.original.id).join(', ')"
              >{{ scopeSummary(effectiveChannelScopes(row.original.id)) }}</span
            ></template
          >
          <template #modelScope-cell="{ row }"
            ><span
              class="block max-w-52 truncate"
              :title="effectiveModelScopes(row.original.id).join(', ')"
              >{{ scopeSummary(effectiveModelScopes(row.original.id)) }}</span
            ></template
          >
          <template #updatedAt-cell="{ row }"
            ><span class="whitespace-nowrap text-[var(--ui-text-muted)]">{{
              formatDate(row.original.updated_at)
            }}</span></template
          >
          <template #actions-cell="{ row }"
            ><div class="flex items-center justify-end gap-1">
              <AdminTableAction
                action="view"
                label="View user"
                @click="openUserDetail(row.original)"
              /><AdminTableAction
                action="edit"
                label="Edit user"
                @click="openUserEdit(row.original)"
              /><AdminTableAction
                action="edit"
                icon="i-tabler-cash-banknote"
                label="Balance operation"
                :disabled="!isOperableUser(row.original)"
                @click="openBalance([row.original])"
              /><AdminTableAction
                action="delete"
                label="Delete user"
                destructive
                @click="confirmUserDelete(row.original)"
              /></div
          ></template>
        </AppTable>
      </AdminTablePanel>

      <AdminTablePanel
        v-else-if="activeTab === 'keys'"
        title="Client keys"
        :description="`${filteredKeys.length} of ${keys.length} keys`"
      >
        <template #filters>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UFormField label="Search"
              ><UInput
                v-model="search"
                icon="i-tabler-search"
                placeholder="Filter keys, owners, or scopes"
                class="w-full"
            /></UFormField>
          </div>
        </template>
        <template #actions
          ><AppButton icon="i-tabler-plus" @click="openKeyCreate"
            >New key</AppButton
          ></template
        >
        <AppTable
          :columns="keyColumns"
          :data="filteredKeys"
          :loading="loading"
          class="min-w-0"
        >
          <template #key-cell="{ row }"
            ><div>
              <p class="font-mono text-xs">
                {{ maskKey(rowValue(row).api_key) }}
              </p>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
                Sequence {{ keySequence(rowValue(row)) }}
              </p>
            </div></template
          >
          <template #owner-cell="{ row }"
            ><span v-if="userById(rowValue(row).user_id)">{{
              userById(rowValue(row).user_id).username
            }}</span
            ><span v-else class="text-[var(--ui-text-muted)]"
              >Unassigned</span
            ></template
          >
          <template #credentialScope-cell="{ row }"
            ><span class="block max-w-60 truncate">{{
              scopeSummary(keyChannelNames(rowValue(row)))
            }}</span></template
          >
          <template #modelScope-cell="{ row }"
            ><span class="block max-w-60 truncate">{{
              scopeSummary(keyModelNames(rowValue(row)))
            }}</span></template
          >
          <template #length-cell="{ row }">{{
            rowValue(row).api_key.length
          }}</template>
          <template #actions-cell="{ row }"
            ><div class="flex justify-end gap-1">
              <AdminTableAction
                action="edit"
                label="Edit client key"
                @click="openKeyEdit(rowValue(row))"
              /><AdminTableAction
                action="delete"
                label="Delete client key"
                destructive
                @click="confirmKeyDelete(rowValue(row))"
              /></div
          ></template>
          <template #empty
            ><EmptyState icon="i-tabler-key" text="No client keys yet."
          /></template>
        </AppTable>
      </AdminTablePanel>

      <AdminDataPanel
        v-else-if="activeTab === 'channelGroups'"
        title="Credential scopes"
        :description="`${filteredChannelGroups.length} scopes`"
        content-class="p-4"
      >
        <template #actions
          ><AppButton
            v-if="accessGroupsSupported"
            size="sm"
            icon="i-tabler-plus"
            @click="openGroupForm('channel')"
            >New credential scope</AppButton
          ></template
        >
        <UnsupportedScopes v-if="!accessGroupsSupported" />
        <template v-else>
          <GroupCards
            kind="channel"
            :groups="filteredChannelGroups"
            :details="channelDetailsData"
            :channel-groups="channelGroups"
            :channel-bindings-supported="modelChannelBindingsSupported"
            @edit="openGroupForm('channel', $event)"
            @delete="confirmGroupDelete('channel', $event)"
            @add="openBindings('credential', $event)"
            @delete-detail="confirmDetailDelete('channel', $event)"
          />
        </template>
      </AdminDataPanel>

      <AdminDataPanel
        v-else
        title="Model scopes"
        :description="`${filteredModelGroups.length} scopes`"
        content-class="p-4"
      >
        <UnsupportedScopes v-if="!accessGroupsSupported" />
        <section v-else class="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside
            class="self-start rounded-lg border border-[var(--ui-border)] bg-[var(--glass-card)] p-3 max-xl:hidden"
            aria-label="Model scopes"
          >
            <div class="flex items-center justify-between px-2 pb-2">
              <p
                class="text-xs font-medium uppercase text-[var(--ui-text-muted)]"
              >
                Model scopes
              </p>
              <AppButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-tabler-plus"
                aria-label="New model scope"
                @click="openGroupForm('model')"
              />
            </div>
            <nav class="grid gap-1" aria-label="Model scopes">
              <button
                v-for="group in filteredModelGroups"
                :key="group.id"
                type="button"
                :aria-current="
                  Number(selectedModelGroup?.id) === Number(group.id)
                    ? 'page'
                    : undefined
                "
                class="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-3 text-left transition-colors"
                :class="
                  Number(selectedModelGroup?.id) === Number(group.id)
                    ? 'border-[var(--ui-primary)] bg-[var(--ui-primary)]/10 text-[var(--ui-primary)]'
                    : 'border-transparent hover:border-[var(--ui-border)] hover:bg-[var(--ui-bg-elevated)]'
                "
                @click="selectedModelGroupId = group.id"
              >
                <span class="flex min-w-0 items-center gap-2.5"
                  ><span
                    :class="[
                      'flex size-6 shrink-0 items-center justify-center rounded-md border',
                      'border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] app-surface',
                      'text-[10px] font-semibold'
                    ]"
                    >M</span
                  ><span class="min-w-0"
                    ><span class="block truncate text-sm font-medium">{{
                      group.group_name
                    }}</span
                    ><span
                      class="mt-0.5 block text-xs text-[var(--ui-text-muted)]"
                      >{{ modelDetailsFor(group.id).length }} models</span
                    ></span
                  ></span
                >
                <UIcon
                  v-if="group.disabled"
                  name="i-tabler-alert-triangle"
                  class="size-4 shrink-0 text-[var(--ui-warning)]"
                /><span
                  v-else
                  class="shrink-0 rounded-md border border-[var(--ui-border)] px-2 py-1 text-xs"
                  >{{ modelDetailsFor(group.id).length }}</span
                >
              </button>
              <p
                v-if="!filteredModelGroups.length"
                class="px-3 py-8 text-center text-sm text-[var(--ui-text-muted)]"
              >
                No model scopes match.
              </p>
            </nav>
          </aside>

          <div class="min-w-0">
            <AdminDataPanel
              :title="selectedModelGroup?.group_name || 'Model scopes'"
              :description="
                selectedModelGroup
                  ? `Scope #${selectedModelGroup.id} · ${selectedModelBindings.length} model bindings`
                  : 'Select or create a model scope'
              "
            >
              <template #actions>
                <USelectMenu
                  v-model="selectedModelGroupId"
                  :items="modelScopeOptions"
                  value-key="value"
                  label-key="label"
                  :search-input="{ placeholder: 'Search model scopes...' }"
                  class="w-56 xl:hidden"
                />
                <AppButton
                  v-if="selectedModelGroup"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-tabler-pencil"
                  aria-label="Edit model scope"
                  @click="openGroupForm('model', selectedModelGroup)"
                />
                <AppButton
                  v-if="selectedModelGroup"
                  size="sm"
                  color="error"
                  variant="ghost"
                  icon="i-tabler-trash"
                  aria-label="Delete model scope"
                  @click="confirmGroupDelete('model', selectedModelGroup)"
                />
                <AppButton
                  size="sm"
                  icon="i-tabler-plus"
                  @click="
                    selectedModelGroup
                      ? openBindings('model', selectedModelGroup)
                      : openGroupForm('model')
                  "
                  >{{
                    selectedModelGroup ? "Add models" : "New scope"
                  }}</AppButton
                >
              </template>
              <div class="min-w-0">
                <AppTable
                  :columns="modelBindingColumns"
                  :data="selectedModelBindings"
                  :loading="loading"
                  class="min-w-0"
                >
                  <template #model-cell="{ row }"
                    ><div class="min-w-0">
                      <p
                        class="truncate font-mono text-xs font-medium text-[var(--ui-text-highlighted)]"
                        :title="rowValue(row).model_id"
                      >
                        {{ rowValue(row).model_id }}
                      </p>
                    </div></template
                  >
                  <template #channels-cell="{ row }"
                    ><span
                      class="block max-w-64 truncate text-xs text-[var(--ui-text-muted)]"
                      :title="modelBindingChannelLabel(rowValue(row))"
                      >{{ modelBindingChannelLabel(rowValue(row)) }}</span
                    ></template
                  >
                  <template #updated-cell="{ row }"
                    ><span
                      class="whitespace-nowrap text-xs text-[var(--ui-text-muted)]"
                      >{{ formatDate(rowValue(row).updated_at) }}</span
                    ></template
                  >
                  <template #actions-cell="{ row }"
                    ><div class="flex justify-end">
                      <AdminTableAction
                        action="remove"
                        label="Remove model from scope"
                        destructive
                        @click="confirmDetailDelete('model', rowValue(row))"
                      /></div
                  ></template>
                  <template #empty
                    ><EmptyState
                      icon="i-tabler-cube"
                      :text="
                        selectedModelGroup
                          ? 'No models are bound to this scope.'
                          : 'Select a model scope.'
                      "
                  /></template>
                </AppTable>
              </div>
            </AdminDataPanel>
          </div>
        </section>
      </AdminDataPanel>
    </template>

    <USlideover
      v-model:open="userFormOpen"
      :title="editingUser ? 'Edit user' : 'New user'"
      :description="
        editingUser
          ? 'Username stays fixed after creation. This only updates password and other maintainable fields.'
          : 'Create an access subject that can own client keys. Password can be left blank.'
      "
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body
        ><form class="space-y-4" @submit.prevent="submitUser">
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          />
          <UFormField label="Username" :error="fieldError('username')"
            ><UInput
              v-model="userForm.username"
              class="w-full"
              placeholder="user@example.com"
              :disabled="saving || !!editingUser"
            />
            <p
              v-if="editingUser"
              class="mt-1 text-xs text-[var(--ui-text-muted)]"
            >
              Username identifies the access subject and is locked after
              creation. Delete and recreate the user to change it.
            </p></UFormField
          >
          <UFormField
            :label="
              editingUser ? 'New password (optional)' : 'Initial password'
            "
            ><UInput
              v-model="userForm.password"
              type="password"
              class="w-full"
              placeholder="Optional. Leave blank to create the user without a password."
              :disabled="saving"
          /></UFormField>
          <UFormField label="Credits"
            ><UInput
              v-model="userForm.credits"
              type="text"
              inputmode="decimal"
              class="w-full"
              :disabled="
                saving || (periodLimitsSupported && userForm.credits_unlimited)
              "
            />
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
              {{
                periodLimitsSupported && userForm.credits_unlimited
                  ? "Unlimited mode is on: the stored balance is preserved but not enforced."
                  : "Client keys bound to this user are blocked when credits are 0 or lower. Dot and comma decimal separators are accepted."
              }}
            </p></UFormField
          >
          <div
            v-if="periodLimitsSupported"
            class="grid gap-3 rounded-md border border-[var(--ui-border)] p-4"
          >
            <div>
              <h3 class="text-sm font-semibold">Period limits</h3>
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
                Enabled windows are enforced together for every client key owned
                by this user.
              </p>
            </div>
            <div
              class="flex items-center justify-between gap-3 rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <div>
                <p class="text-sm font-medium">Unlimited total balance</p>
                <p class="text-xs text-[var(--ui-text-muted)]">
                  The total balance is not enforced or deducted; enabled period
                  limits still apply.
                </p>
              </div>
              <USwitch
                v-model="userForm.credits_unlimited"
                :disabled="saving"
              />
            </div>
            <div
              v-for="window in periodWindowIds"
              :key="window"
              class="grid gap-2 rounded-md border border-[var(--ui-border)] px-3 py-2.5"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{
                  periodWindowLabel(window)
                }}</span
                ><USwitch
                  v-model="userForm.periods[window].enabled"
                  :disabled="saving"
                />
              </div>
              <div
                v-if="userForm.periods[window].enabled"
                class="grid gap-3 sm:grid-cols-2"
              >
                <UFormField label="Credits limit"
                  ><UInput
                    v-model="userForm.periods[window].limit"
                    type="text"
                    inputmode="decimal"
                    class="w-full" /></UFormField
                ><UFormField label="Window mode"
                  ><USelect
                    v-model="userForm.periods[window].mode"
                    :items="periodModeOptions(window)"
                    value-key="value"
                    label-key="label"
                    class="w-full"
                /></UFormField>
              </div>
              <p
                v-if="
                  userForm.periods[window].enabled &&
                  parseLocalizedNumber(userForm.periods[window].limit) === 0
                "
                class="text-xs text-amber-600 dark:text-amber-400"
              >
                A limit of 0 blocks new requests immediately.
              </p>
              <div
                v-if="
                  window === '7d' &&
                  userForm.periods[window].enabled &&
                  userForm.periods[window].mode === 'calendar'
                "
                class="grid gap-3 sm:grid-cols-2"
              >
                <UFormField label="Week starts on"
                  ><USelect
                    v-model="userForm.week_reset_day"
                    :items="weekDayOptions"
                    value-key="value"
                    label-key="label"
                    class="w-full" /></UFormField
                ><UFormField label="Week start hour (0–23)"
                  ><UInput
                    v-model="userForm.week_reset_hour"
                    type="number"
                    min="0"
                    max="23"
                    step="1"
                    class="w-full"
                /></UFormField>
              </div>
            </div>
            <UFormField label="Timezone"
              ><UInputMenu
                v-model="userForm.timezone"
                :items="timezoneOptions"
                class="w-full"
                :search-input="{ placeholder: 'Search IANA timezones…' }"
              />
              <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
                IANA timezone used by calendar windows. New users default to
                this device's timezone.
              </p></UFormField
            >
          </div>
          <div
            v-else
            class="rounded-md border border-dashed border-[var(--ui-border)] px-3 py-2.5 text-xs text-[var(--ui-text-muted)]"
          >
            This runtime does not expose period-limit management. Period-limit
            fields will not be sent.
          </div>
          <div
            class="flex justify-end gap-2 border-t border-[var(--ui-border)] pt-4"
          >
            <AppButton
              type="button"
              color="neutral"
              variant="outline"
              @click="userFormOpen = false"
              >Cancel</AppButton
            ><AppButton type="submit" :loading="saving">{{
              editingUser ? "Save changes" : "Create user"
            }}</AppButton>
          </div>
        </form></template
      >
    </USlideover>

    <USlideover
      v-model:open="userDetailOpen"
      title="User detail"
      description="Review this user profile, client key count, and assigned access scopes."
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body
        ><div v-if="userDetail" class="grid gap-5">
          <div class="rounded-md border border-[var(--ui-border)] p-4">
            <div class="flex flex-wrap gap-2">
              <UBadge
                :color="userDetail.deleted_at ? 'warning' : 'success'"
                variant="subtle"
                >{{ userDetail.deleted_at ? "Deleted" : "Active" }}</UBadge
              ><UBadge
                v-if="userDetail.password_set || userDetail.has_password"
                color="neutral"
                variant="subtle"
                >Password stored</UBadge
              >
            </div>
            <p class="mt-3 font-semibold">{{ userDetail.username }}</p>
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
              User ID: {{ userDetail.id }}
            </p>
          </div>
          <DetailSection title="Profile" :items="profileItems(userDetail)" />
          <section class="grid gap-3">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-sm font-semibold">Period limits</h3>
              <AppButton
                v-if="periodLimitsSupported"
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-tabler-refresh"
                :disabled="saving || !detailPeriods || !!detailPeriodError"
                @click="openPeriodReset(userDetail)"
                >Reset…</AppButton
              >
            </div>
            <div
              v-if="detailPeriodLoading && !detailPeriods"
              class="grid gap-2"
            >
              <USkeleton
                v-for="window in periodWindowIds"
                :key="window"
                class="h-20 w-full rounded-md"
              />
            </div>
            <div
              v-else-if="detailPeriodError"
              class="grid gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950"
            >
              <p class="text-sm text-red-700 dark:text-red-300">
                Period-limit status could not be loaded.
              </p>
              <p class="break-words text-xs text-red-600 dark:text-red-400">
                {{ detailPeriodError }}
              </p>
              <div>
                <AppButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  @click="loadUserPeriods(userDetail)"
                  >Retry</AppButton
                >
              </div>
            </div>
            <div v-else-if="detailPeriods" class="grid gap-3">
              <div class="flex flex-wrap gap-2">
                <UBadge color="neutral" variant="subtle"
                  >Timezone:
                  {{
                    detailPeriods.timezone ||
                    userDetail.timezone ||
                    "Asia/Shanghai"
                  }}</UBadge
                ><UBadge
                  v-if="
                    detailPeriods.credits_unlimited ||
                    detailPeriods.creditsUnlimited ||
                    userDetail.credits_unlimited
                  "
                  color="info"
                  variant="subtle"
                  >Unlimited total balance</UBadge
                >
              </div>
              <PeriodCard
                v-for="window in normalizedDetailWindows"
                :key="window.id"
                :window="window"
              />
            </div>
            <div
              v-else
              class="rounded-md border border-dashed border-[var(--ui-border)] px-3 py-2.5 text-xs text-[var(--ui-text-muted)]"
            >
              This runtime does not expose period-limit status.
            </div>
          </section>
          <DetailSection
            title="Access scope"
            :items="accessItems(userDetail)"
          /></div
      ></template>
    </USlideover>

    <USlideover
      v-model:open="keyFormOpen"
      :title="editingKey ? 'Edit key access' : 'New client key'"
      :description="
        editingKey
          ? 'Adjust this key owner and access scopes. The key value itself is unchanged.'
          : 'Generate a client access key and optionally bind a user, credential scopes, and model scopes.'
      "
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body
        ><form class="space-y-4" @submit.prevent="submitKey">
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          /><UFormField label="Key value"
            ><UInput
              v-model="keyForm.api_key"
              class="w-full font-mono text-xs"
              :disabled="saving || !!editingKey" /></UFormField
          ><UFormField label="Owner"
            ><USelectMenu
              v-model="keyForm.user_id"
              :items="userOptions"
              value-key="value"
              label-key="label"
              class="w-full"
              :search-input="{ placeholder: 'Search users…' }"
          /></UFormField>
          <div class="grid gap-4">
            <ScopePicker
              title="Credential scope"
              empty-label="No credential scopes have been created yet."
              :items="channelOptions"
              :selected="keyForm.channels"
              @toggle="toggleId(keyForm.channels, $event)"
            /><ScopePicker
              title="Model scope"
              empty-label="No model scopes have been created yet."
              :items="modelGroupOptions"
              :selected="keyForm.model_groups"
              @toggle="toggleId(keyForm.model_groups, $event)"
            />
          </div>
          <p class="text-sm leading-6 text-[var(--ui-text-muted)]">
            When no scope is selected, this key does not add credential or model
            restrictions.
          </p>
          <div
            class="flex justify-end gap-2 border-t border-[var(--ui-border)] pt-4"
          >
            <AppButton
              type="button"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="keyFormOpen = false"
              >Cancel</AppButton
            ><AppButton type="submit" :loading="saving">{{
              editingKey ? "Save changes" : "Create key"
            }}</AppButton>
          </div>
        </form></template
      >
    </USlideover>

    <USlideover
      v-model:open="bindingOpen"
      :title="
        bindingKind === 'credential'
          ? 'Add credential binding'
          : 'Add model binding'
      "
      :description="
        bindingKind === 'credential'
          ? 'Search for and select one or more account credentials to add to this scope. Client keys bound to this scope can use those credentials.'
          : 'Search for and select one or more models to add to this scope. Client keys bound to this scope can use those models.'
      "
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body
        ><form class="space-y-4" @submit.prevent="addBindings">
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          />
          <div>
            <p class="text-sm font-medium">Scope</p>
            <div
              class="mt-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] px-3 py-2 text-sm"
            >
              {{ bindingGroupName }}
            </div>
          </div>
          <CandidatePicker
            :kind="bindingKind"
            :items="bindingCandidates"
            :selected="bindingSelection"
            :search="bindingSearch"
            :source-filter="modelSourceFilter"
            :pending="
              bindingKind === 'model'
                ? modelCandidatesPending
                : credentialCandidatesPending
            "
            :issue-message="
              bindingKind === 'model'
                ? modelCandidatesIssue
                : credentialCandidatesIssue
            "
            :error-message="
              bindingKind === 'model'
                ? modelCandidatesError
                : credentialCandidatesError
            "
            :mutating="saving"
            @update:search="bindingSearch = $event"
            @update:source-filter="modelSourceFilter = $event"
            @update:selected="setBindingSelection"
            @retry="
              bindingKind === 'model'
                ? loadModelCandidates()
                : loadCredentialCandidates()
            "
            @clear-error="formError = ''"
          />
          <ScopePicker
            v-if="bindingKind === 'model' && modelChannelBindingsSupported"
            title="Credential scope"
            empty-label="No credential scopes yet."
            :items="channelOptions"
            :selected="bindingChannels"
            @toggle="toggleId(bindingChannels, $event)"
          />
          <p
            v-if="bindingKind === 'model' && modelChannelBindingsSupported"
            class="text-xs text-[var(--ui-text-muted)]"
          >
            With nothing selected, this model binding inherits the credential
            scope of the client key; selections restrict dispatch to the chosen
            scopes.
          </p>
          <div
            class="flex justify-end gap-2 border-t border-[var(--ui-border)] pt-4"
          >
            <AppButton
              type="button"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="bindingOpen = false"
              >Cancel</AppButton
            ><AppButton
              type="submit"
              :loading="saving"
              :disabled="bindingSubmitDisabled"
              >Add binding</AppButton
            >
          </div>
        </form></template
      >
    </USlideover>

    <USlideover
      v-model:open="balanceOpen"
      :title="
        balanceTargets.length > 1
          ? 'Batch balance operation'
          : 'Balance operation'
      "
      :description="
        balanceTargets.length > 1
          ? 'Operations are submitted one user at a time, and each user receives a separate balance record.'
          : 'The target user is set from the table action. Enter an amount to create a balance record.'
      "
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body
        ><form class="space-y-4" @submit.prevent="reviewBalance">
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          />
          <div>
            <p class="text-sm font-medium">Target</p>
            <div
              class="mt-2 grid gap-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] px-3 py-2.5 text-sm"
            >
              <SummaryRow
                :label="balanceTargets.length === 1 ? 'User' : 'Users'"
                :value="balanceTargetLabel"
              /><SummaryRow
                label="Current balance total"
                :value="formatCredits(balanceCurrentTotal)"
              /><SummaryRow
                label="Balance total after"
                :value="
                  balanceAfterTotal == null
                    ? '—'
                    : formatCredits(balanceAfterTotal)
                "
                :warning="balanceAfterTotal != null && balanceAfterTotal < 0"
              />
            </div>
            <p
              v-if="balanceTargets.length > 1"
              class="mt-2 text-xs text-[var(--ui-text-muted)]"
            >
              The same amount and note will be used for each user, with separate
              records on the backend.
            </p>
          </div>
          <UFormField label="Operation type"
            ><div class="grid grid-cols-2 gap-2">
              <AppButton
                type="button"
                :color="balanceForm.type === 'recharge' ? 'primary' : 'neutral'"
                :variant="balanceForm.type === 'recharge' ? 'solid' : 'outline'"
                icon="i-tabler-plus"
                @click="balanceForm.type = 'recharge'"
                >Recharge</AppButton
              ><AppButton
                type="button"
                :color="balanceForm.type === 'deduct' ? 'warning' : 'neutral'"
                :variant="balanceForm.type === 'deduct' ? 'solid' : 'outline'"
                icon="i-tabler-minus"
                @click="balanceForm.type = 'deduct'"
                >Deduct</AppButton
              >
            </div></UFormField
          ><UAlert
            v-if="negativeBalanceCount"
            color="warning"
            variant="subtle"
            :description="`${negativeBalanceCount} users will have negative balances after this deduction. Home allows negative balances, but confirm this is intended.`"
          /><UFormField label="Amount"
            ><UInput
              v-model="balanceForm.amount"
              type="number"
              min="0"
              step="0.000001"
              class="w-full"
            />
            <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
              {{
                balanceTargets.length > 1
                  ? "The amount applies to each selected user."
                  : "The amount applies to the current user."
              }}
            </p></UFormField
          ><UFormField
            :label="balanceForm.type === 'deduct' ? 'Note, required' : 'Note'"
            ><UTextarea v-model="balanceForm.note" class="w-full"
          /></UFormField>
          <div
            class="flex justify-end gap-2 border-t border-[var(--ui-border)] pt-4"
          >
            <AppButton
              type="button"
              color="neutral"
              variant="outline"
              @click="balanceOpen = false"
              >Cancel</AppButton
            ><AppButton
              type="submit"
              :color="balanceForm.type === 'deduct' ? 'warning' : 'primary'"
              >{{
                balanceForm.type === "deduct" ? "Deduct" : "Recharge"
              }}</AppButton
            >
          </div>
        </form></template
      >
    </USlideover>

    <AppModal
      v-model:open="balanceConfirmOpen"
      :title="balanceConfirmTitle"
      :description="
        balanceTargets.length > 1
          ? 'Requests will be submitted for each selected user. Confirm the user count, per-user amount, and balance totals.'
          : balanceForm.type === 'deduct'
            ? 'Deduction creates a balance record. Confirm the user, amount, and resulting balance.'
            : 'Submitting creates a balance record. Confirm the user and resulting balance.'
      "
      ><template #body
        ><div class="space-y-4">
          <div
            class="grid gap-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] px-3 py-2.5 text-sm"
          >
            <SummaryRow
              :label="balanceTargets.length === 1 ? 'User' : 'Users'"
              :value="balanceTargetLabel"
            /><SummaryRow
              label="Amount per user"
              :value="signedBalanceAmount"
              :warning="balanceForm.type === 'deduct'"
            /><SummaryRow
              v-if="balanceTargets.length > 1"
              label="Total change"
              :value="signedBalanceTotal"
              :warning="balanceForm.type === 'deduct'"
            /><SummaryRow
              label="Current balance total"
              :value="formatCredits(balanceCurrentTotal)"
            /><SummaryRow
              label="Balance total after"
              :value="formatCredits(balanceAfterTotal)"
              :warning="balanceAfterTotal < 0"
            />
            <div class="border-t border-[var(--ui-border)] pt-2">
              <p class="text-xs text-[var(--ui-text-muted)]">Note</p>
              <p class="mt-1 break-words">{{ balanceForm.note || "—" }}</p>
            </div>
            <UAlert
              v-if="negativeBalanceCount"
              color="warning"
              variant="subtle"
              :description="`${negativeBalanceCount} users will have negative balances after this operation. Home allows negative balances, but confirm this is intended.`"
            />
          </div>
          <div class="flex justify-end gap-2">
            <AppButton
              color="neutral"
              variant="outline"
              @click="balanceConfirmOpen = false"
              >Cancel</AppButton
            ><AppButton
              :color="balanceForm.type === 'deduct' ? 'warning' : 'primary'"
              :loading="saving"
              @click="applyBalance"
              >Confirm</AppButton
            >
          </div>
        </div></template
      ></AppModal
    >

    <AppModal
      v-model:open="groupFormOpen"
      :title="groupFormTitle"
      :description="groupFormDescription"
      ><template #body
        ><form class="space-y-4" @submit.prevent="submitGroup">
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          /><UFormField
            :label="
              groupFormKind === 'channel'
                ? 'Credential scope name'
                : 'Model scope name'
            "
            ><UInput
              v-model="groupForm.name"
              class="w-full"
              :placeholder="
                groupFormKind === 'channel' ? 'team-a' : 'premium-models'
              " /></UFormField
          ><label class="flex items-start gap-2 text-sm"
            ><UCheckbox v-model="groupForm.disabled" /><span
              ><span class="font-medium">Disabled</span
              ><span class="block text-[var(--ui-text-muted)]"
                >Disabled scopes are not used by the backend for access
                matching.</span
              ></span
            ></label
          >
          <div class="flex justify-end gap-2">
            <AppButton
              type="button"
              color="neutral"
              variant="outline"
              @click="groupFormOpen = false"
              >Cancel</AppButton
            ><AppButton type="submit" :loading="saving">{{
              editingGroup
                ? "Save changes"
                : groupFormKind === "channel"
                  ? "Create credential scope"
                  : "Create model scope"
            }}</AppButton>
          </div>
        </form></template
      ></AppModal
    >

    <AppModal
      v-model:open="periodResetOpen"
      title="Reset period counters"
      :description="`Soft-reset period counters for ${periodResetUser?.username || ''}. Billing history is preserved, and enabled limits keep enforcing new requests.`"
      ><template #body
        ><div class="space-y-4">
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :description="formError"
          />
          <div>
            <p class="mb-2 text-sm font-medium">Windows to reset</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <label
                v-for="window in periodWindowIds"
                :key="window"
                class="flex items-center gap-2 rounded-md border border-[var(--ui-border)] px-3 py-2 text-sm"
                ><UCheckbox
                  :model-value="resetWindows.has(window)"
                  :disabled="saving"
                  @update:model-value="toggleResetWindow(window)"
                /><span class="flex-1">{{ periodWindowLabel(window) }}</span
                ><span
                  v-if="detailWindow(window)?.enabled"
                  class="text-xs text-[var(--ui-text-muted)]"
                  >enabled</span
                ></label
              >
            </div>
          </div>
          <div>
            <p class="mb-2 text-sm font-medium">Reset mode</p>
            <div class="grid gap-2">
              <label
                v-for="option in resetModeOptions"
                :key="option.value"
                class="flex items-start gap-2 rounded-md border border-[var(--ui-border)] px-3 py-2"
                ><input
                  v-model="resetMode"
                  type="radio"
                  :value="option.value"
                  class="mt-1"
                /><span
                  ><span class="text-sm font-medium">{{ option.label }}</span
                  ><span class="block text-xs text-[var(--ui-text-muted)]">{{
                    option.hint
                  }}</span></span
                ></label
              >
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <AppButton
              color="neutral"
              variant="outline"
              @click="periodResetOpen = false"
              >Cancel</AppButton
            ><AppButton :loading="saving" @click="resetPeriods"
              >Reset counters</AppButton
            >
          </div>
        </div></template
      ></AppModal
    >

    <AppModal v-model:open="deleteOpen" title="Confirm deletion"
      ><template #body
        ><div class="space-y-4">
          <p class="text-sm">{{ deleteDescription }}</p>
          <div class="flex justify-end gap-2">
            <AppButton
              color="neutral"
              variant="outline"
              @click="deleteOpen = false"
              >Cancel</AppButton
            ><AppButton color="error" :loading="saving" @click="performDelete"
              >Delete</AppButton
            >
          </div>
        </div></template
      ></AppModal
    >
  </section>
</template>

<script setup>
import { useWorkspaceState } from '~/composables/useWorkspaceState'
import { useDataSync } from '~/composables/useDataSync'
import EmptyState from "@/components/admin/users/UsersEmptyState.vue";

import UnsupportedScopes from "@/components/admin/users/UsersUnsupportedScopes.vue";
import SummaryRow from "@/components/admin/users/UsersSummaryRow.vue";
import DetailSection from "@/components/admin/users/UsersDetailSection.vue";
import PeriodCard from "@/components/admin/users/UsersPeriodCard.vue";
import ScopePicker from "@/components/admin/users/UsersScopePicker.vue";
import CandidatePicker from "@/components/admin/users/UsersCandidatePicker.vue";
import GroupCards from "@/components/admin/users/UsersGroupCards.vue";

const { fetchAPI } = useApi();
const {
  supports,
  refreshCapabilities,
  error: capabilitiesError,
} = useCapabilities();
const toast = useToast();

const activeTab = ref("users");
const tabs = [
  { label: "Users", value: "users" },
  { label: "Client keys", value: "keys" },
  { label: "Credential scopes", value: "channelGroups" },
  { label: "Model scopes", value: "modelGroups" },
];
const search = ref(""),
  loading = useWorkspaceState('admin:users:loading', () => (false)),
  saving = useWorkspaceState('admin:users:saving', () => (false)),
  pageErrors = useWorkspaceState('admin:users:pageErrors', () => ([])),
  formError = ref(""),
  formFieldErrors = ref([]);
const usersData = useWorkspaceState('admin:users:usersData', () => ([])),
  keysData = useWorkspaceState('admin:users:keysData', () => ([])),
  channelGroupsData = useWorkspaceState('admin:users:channelGroupsData', () => ([])),
  channelDetailsData = useWorkspaceState('admin:users:channelDetailsData', () => ([])),
  modelGroupsData = useWorkspaceState('admin:users:modelGroupsData', () => ([])),
  modelDetailsData = useWorkspaceState('admin:users:modelDetailsData', () => ([])),
  credentialsData = useWorkspaceState('admin:users:credentialsData', () => ([])),
  providerCredentialsData = useWorkspaceState('admin:users:providerCredentialsData', () => ([])),
  runtimeModelsData = useWorkspaceState('admin:users:runtimeModelsData', () => ([])),
  staticModelsData = useWorkspaceState('admin:users:staticModelsData', () => ([]));
const users = computed(() => usersData.value),
  keys = computed(() => keysData.value),
  channelGroups = computed(() => channelGroupsData.value),
  modelGroups = computed(() => modelGroupsData.value);
const usersSupported = computed(() => supports("users", true)),
  accessGroupsSupported = computed(() => supports("access_groups", true)),
  periodLimitsSupported = computed(() => supports("user_period_limits", false)),
  modelChannelBindingsSupported = computed(() =>
    supports("model_channel_bindings", false),
  );
const unassignedKeyCount = computed(
  () =>
    keys.value.filter((key) => key.user_id == null || Number(key.user_id) === 0)
      .length,
);
const rowValue = (row) => row?.original ?? row;
const userColumns = [
  { id: "select", header: "" },
  { accessorKey: "user", header: "User" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "credits", header: "Credits" },
  { accessorKey: "periodLimits", header: "Period limits" },
  { accessorKey: "keys", header: "Client keys" },
  { accessorKey: "credentialScope", header: "Credential scope" },
  { accessorKey: "modelScope", header: "Model scope" },
  { accessorKey: "updatedAt", header: "Updated" },
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
const keyColumns = [
  { accessorKey: "key", header: "Client key" },
  { accessorKey: "owner", header: "Owner" },
  { accessorKey: "credentialScope", header: "Credential scope" },
  { accessorKey: "modelScope", header: "Model scope" },
  { accessorKey: "length", header: "Length" },
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
const normalize = (value) => String(value ?? "").toLowerCase();
const matches = (values) => {
  const query = normalize(search.value).trim();
  return !query || values.some((value) => normalize(value).includes(query));
};
const filteredUsers = computed(() =>
  users.value.filter((user) => matches([user.id, user.username])),
);

const filteredKeys = computed(() =>
  keys.value.filter((key) =>
    matches([
      key.api_key,
      userById(key.user_id)?.username,
      ...keyChannelNames(key),
      ...keyModelNames(key),
    ]),
  ),
);
const filteredChannelGroups = computed(() =>
  channelGroups.value.filter((group) =>
    matches([
      group.id,
      group.channel_name,
      ...channelDetailsFor(group.id).map((item) => item.auth_id),
    ]),
  ),
);
const selectedModelGroupId = ref(null);
const filteredModelGroups = computed(() =>
  modelGroups.value.filter((group) =>
    matches([
      group.id,
      group.group_name,
      ...modelDetailsFor(group.id).map((item) => item.model_id),
    ]),
  ),
);
const modelScopeOptions = computed(() =>
  filteredModelGroups.value.map((group) => ({
    label: `${group.group_name} · ${modelDetailsFor(group.id).length} models`,
    value: Number(group.id),
  })),
);
const selectedModelGroup = computed(
  () =>
    modelGroups.value.find(
      (group) => Number(group.id) === Number(selectedModelGroupId.value),
    ) ||
    filteredModelGroups.value[0] ||
    null,
);
const selectedModelBindings = computed(() =>
  selectedModelGroup.value ? modelDetailsFor(selectedModelGroup.value.id) : [],
);
const modelBindingColumns = [
  { accessorKey: "model", header: "Model ID" },
  { accessorKey: "channels", header: "Credential scope" },
  { accessorKey: "updated", header: "Updated" },
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
watch(
  filteredModelGroups,
  (groups) => {
    if (!groups.length) selectedModelGroupId.value = null;
    else if (
      !groups.some(
        (group) => Number(group.id) === Number(selectedModelGroupId.value),
      )
    )
      selectedModelGroupId.value = Number(groups[0].id);
  },
  { immediate: true },
);

async function safeLoad(label, request, fallback) {
  try {
    return await request();
  } catch (error) {
    pageErrors.value.push(`${label}: ${errorMessage(error)}`);
    return fallback;
  }
}

async function syncAll(notify = false) {
  loading.value = true;
  pageErrors.value = [];
  try {
    try {
      await refreshCapabilities(true);
    } catch {}
    if (!usersSupported.value) {
      usersData.value = [];
      keysData.value = [];
      channelGroupsData.value = [];
      channelDetailsData.value = [];
      modelGroupsData.value = [];
      modelDetailsData.value = [];
      return;
    }

    const tasks = [
      safeLoad("Users", () => fetchAPI("/users"), { users: [] }).then(
        (value) => {
          usersData.value = Array.isArray(value)
            ? value
            : value?.users ||
              value?.items ||
              value?.records ||
              value?.data ||
              [];
        },
      ),
      safeLoad("Client keys", () => fetchAPI("/access/api-keys"), {
        items: [],
      }).then((value) => {
        keysData.value = keyEntries(value).map(normalizeKey);
      }),
    ];
    if (accessGroupsSupported.value) {
      tasks.push(
        safeLoad("Credential scopes", () => fetchAPI("/channel-groups"), {
          channel_groups: [],
        }).then((value) => {
          channelGroupsData.value = value?.channel_groups || value?.items || [];
        }),
        safeLoad(
          "Credential bindings",
          () => fetchAPI("/channel-group-details"),
          { channel_group_details: [] },
        ).then((value) => {
          channelDetailsData.value =
            value?.channel_group_details || value?.items || [];
        }),
        safeLoad("Model scopes", () => fetchAPI("/model-groups"), {
          model_groups: [],
        }).then((value) => {
          modelGroupsData.value = value?.model_groups || value?.items || [];
        }),
        safeLoad("Model bindings", () => fetchAPI("/model-group-details"), {
          model_group_details: [],
        }).then((value) => {
          modelDetailsData.value =
            value?.model_group_details || value?.items || [];
        }),
      );
    } else {
      channelGroupsData.value = [];
      channelDetailsData.value = [];
      modelGroupsData.value = [];
      modelDetailsData.value = [];
    }
    await Promise.all(tasks);
    if (notify) toast.add({ title: "Data synchronized", color: "success" });
  } finally {
    loading.value = false;
  }
}
useDataSync('admin:users:sync', syncAll);
await syncAll();

function keyEntries(value) {
  const entries = value?.api_key_entries ?? value?.items;
  if (Array.isArray(entries) && entries.length) return entries;
  const legacy = value?.["api-keys"] ?? value?.api_keys;
  return Array.isArray(legacy)
    ? legacy.filter((entry) => typeof entry === "string")
    : [];
}
function normalizeKey(entry, index = 0) {
  const raw = typeof entry === "string" ? { api_key: entry } : entry || {};
  const numericId = raw.id ?? raw.api_key_id ?? raw["api-key-id"] ?? null;
  return {
    ...raw,
    id:
      numericId != null
        ? String(numericId)
        : `${index}:${raw.api_key || raw["api-key"] || raw.key || raw.value || ""}`,
    numeric_id: numericId,
    index,
    api_key: raw.api_key || raw["api-key"] || raw.key || raw.value || "",
    user_id: raw.user_id ?? raw["user-id"] ?? null,
    channels: Array.isArray(raw.channels)
      ? raw.channels.filter(Number.isFinite).map(Number)
      : [],
    model_groups: Array.isArray(raw.model_groups || raw["model-groups"])
      ? (raw.model_groups || raw["model-groups"])
          .filter(Number.isFinite)
          .map(Number)
      : [],
  };
}
function flattenModels(models) {
  if (Array.isArray(models))
    return models.map((item) => ({
      ...item,
      channelBucket:
        item?.channel || item?.channel_bucket || item?.["channel-bucket"] || "",
    }));
  if (models && typeof models === "object")
    return Object.entries(models).flatMap(([channelBucket, items]) =>
      Array.isArray(items)
        ? items.map((item) => ({
            ...item,
            channelBucket:
              item?.channel ||
              item?.channel_bucket ||
              item?.["channel-bucket"] ||
              channelBucket,
          }))
        : [],
    );
  return [];
}
function firstModelText(item, fields) {
  for (const field of fields) {
    const value = item?.[field];
    if (
      (typeof value === "string" || typeof value === "number") &&
      String(value).trim()
    )
      return String(value).trim();
  }
  return "";
}
function normalizeProviders(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [
    ...new Set(
      values
        .map((item) =>
          typeof item === "string" || typeof item === "number"
            ? String(item).trim()
            : firstModelText(item, ["id", "name", "provider"]),
        )
        .filter(Boolean),
    ),
  ];
}
function normalizeModelCandidate(item, scope) {
  const modelId = firstModelText(item, [
    "id",
    "model_id",
    "model-id",
    "model",
    "name",
  ]);
  if (!modelId) return null;
  const displayName = firstModelText(item, [
    "displayName",
    "display_name",
    "display-name",
    "label",
  ]);
  return {
    id: `model:${modelId}`,
    modelId,
    label: displayName || modelId,
    displayName,
    ownedBy: firstModelText(item, ["ownedBy", "owned_by", "owned-by"]),
    type: firstModelText(item, ["type"]),
    providers: normalizeProviders(item?.providers ?? item?.provider),
    channel: firstModelText(item, [
      "channelBucket",
      "channel",
      "channel_bucket",
      "channel-bucket",
      "source",
    ]),
    scopes: [scope],
  };
}
function mergeModelCandidates() {
  const merged = new Map();
  const add = (item, scope) => {
    const candidate = normalizeModelCandidate(item, scope);
    if (!candidate) return;
    const existing = merged.get(candidate.modelId);
    if (!existing) {
      merged.set(candidate.modelId, candidate);
      return;
    }
    existing.scopes = [...new Set([...existing.scopes, ...candidate.scopes])];
    existing.displayName ||= candidate.displayName;
    existing.label = existing.displayName || existing.modelId;
    existing.ownedBy ||= candidate.ownedBy;
    existing.type ||= candidate.type;
    existing.channel ||= candidate.channel;
    existing.providers = [
      ...new Set([...existing.providers, ...candidate.providers]),
    ];
  };
  for (const item of runtimeModelsData.value) add(item, "available");
  for (const item of staticModelsData.value) add(item, "static");
  return [...merged.values()].sort(
    (left, right) =>
      Number(!left.scopes.includes("available")) -
        Number(!right.scopes.includes("available")) ||
      left.modelId.localeCompare(right.modelId),
  );
}
function userById(id) {
  return users.value.find((user) => Number(user.id) === Number(id));
}
function channelName(id) {
  return (
    channelGroups.value.find((group) => Number(group.id) === Number(id))
      ?.channel_name || `#${id}`
  );
}
function modelGroupName(id) {
  return (
    modelGroups.value.find((group) => Number(group.id) === Number(id))
      ?.group_name || `#${id}`
  );
}
function keyChannelNames(key) {
  return key.channels.map(channelName);
}
function keyModelNames(key) {
  return key.model_groups.map(modelGroupName);
}
function keysForUser(id) {
  return keys.value.filter((key) => Number(key.user_id) === Number(id));
}
function effectiveChannelScopes(id) {
  const owned = keysForUser(id);
  if (!owned.length || owned.some((key) => !key.channels.length)) return [];
  return [...new Set(owned.flatMap(keyChannelNames))];
}
function effectiveModelScopes(id) {
  const owned = keysForUser(id);
  if (!owned.length || owned.some((key) => !key.model_groups.length)) return [];
  return [...new Set(owned.flatMap(keyModelNames))];
}
function scopeSummary(names) {
  return names.length ? names.join(", ") : "Unrestricted";
}
function channelDetailsFor(id) {
  return channelDetailsData.value.filter(
    (item) => Number(item.channel_group_id) === Number(id) && !item.deleted_at,
  );
}
function modelDetailsFor(id) {
  return modelDetailsData.value.filter(
    (item) => Number(item.model_group_id) === Number(id) && !item.deleted_at,
  );
}
function modelBindingChannelLabel(detail) {
  const ids = Array.isArray(detail?.channels) ? detail.channels : [];
  return ids.length ? ids.map(channelName).join(", ") : "Inherits key scope";
}
function periodWindows(user) {
  return (
    user.period_limits_summary?.enabled_windows ||
    user.periodLimitsSummary?.enabledWindows ||
    []
  );
}
function zeroPeriodWindows(user) {
  return (
    user.period_limits_summary?.zero_limit_windows ||
    user.periodLimitsSummary?.zeroLimitWindows ||
    []
  );
}
function parseLocalizedNumber(value) {
  const input = String(value ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!input) return Number.NaN;
  const lastComma = input.lastIndexOf(",");
  const lastDot = input.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    return Number(
      input.split(groupingSeparator).join("").replace(decimalSeparator, "."),
    );
  }
  return Number(input.replace(",", "."));
}
function formatCredits(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(Number(value || 0));
}
function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not returned";
}
function maskKey(value) {
  const text = String(value || "").trim();
  return !text
    ? ""
    : text.length <= 10
      ? `${text.slice(0, 2)}***`
      : `${text.slice(0, 6)}...${text.slice(-4)}`;
}
function keySequence(key) {
  return (
    Math.max(
      keys.value.findIndex((item) => item.id === key.id),
      0,
    ) + 1
  );
}
function toggleId(target, id) {
  const value = Number(id);
  const index = target.indexOf(value);
  index >= 0 ? target.splice(index, 1) : target.push(value);
}
function isOperableUser(user) {
  return user && !user.deleted_at && Number.isFinite(Number(user.id));
}
function errorMessage(error) {
  return (
    error?.data?.message ||
    error?.data?.error ||
    error?.response?._data?.message ||
    error?.response?._data?.error ||
    error?.message ||
    "Unexpected request error."
  );
}
function clearFormError() {
  formError.value = "";
  formFieldErrors.value = [];
}
function fieldError(field) {
  return (
    formFieldErrors.value.find((item) => item.field === field)?.message || ""
  );
}

const selectedUserIds = ref(new Set());
const operableFilteredUsers = computed(() =>
    filteredUsers.value.filter(isOperableUser),
  ),
  selectedUsers = computed(() =>
    users.value.filter(
      (user) => selectedUserIds.value.has(user.id) && isOperableUser(user),
    ),
  );
const allFilteredUsersSelected = computed(
  () =>
    operableFilteredUsers.value.length > 0 &&
    operableFilteredUsers.value.every((user) =>
      selectedUserIds.value.has(user.id),
    ),
);
const someFilteredUsersSelected = computed(
  () =>
    !allFilteredUsersSelected.value &&
    operableFilteredUsers.value.some((user) =>
      selectedUserIds.value.has(user.id),
    ),
);
function toggleUserSelection(id, checked) {
  const next = new Set(selectedUserIds.value);
  checked ? next.add(id) : next.delete(id);
  selectedUserIds.value = next;
}
function toggleAllFilteredUsers(checked) {
  const next = new Set(selectedUserIds.value);
  for (const user of operableFilteredUsers.value)
    checked ? next.add(user.id) : next.delete(user.id);
  selectedUserIds.value = next;
}

const periodWindowIds = ["5h", "1d", "7d", "30d"];
const deviceTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const fallbackTimezones = [
  "UTC",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];
const timezoneOptions = (() => {
  try {
    const supported =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];
    return [
      ...new Set(["UTC", deviceTimezone, ...supported, ...fallbackTimezones]),
    ]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [...new Set([deviceTimezone, ...fallbackTimezones])]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  }
})();
const weekDayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
].map((label, index) => ({ label, value: index + 1 }));
const periodWindowLabel = (id) =>
  ({ "5h": "5 hours", "1d": "1 day", "7d": "7 days", "30d": "30 days" })[id];
const periodModeOptions = (id) =>
  (id === "5h"
    ? ["first_use", "sliding"]
    : ["first_use", "sliding", "calendar"]
  ).map((value) => ({
    value,
    label:
      value === "first_use"
        ? "First use"
        : value[0].toUpperCase() + value.slice(1),
  }));
const newPeriods = () =>
  Object.fromEntries(
    periodWindowIds.map((id) => [
      id,
      { enabled: false, limit: "0", mode: "first_use" },
    ]),
  );
const emptyUserForm = () => ({
  username: "",
  password: "",
  credits: "0",
  credits_unlimited: false,
  timezone: deviceTimezone,
  week_reset_day: 1,
  week_reset_hour: 0,
  periods: newPeriods(),
});
const userFormOpen = ref(false),
  editingUser = ref(null),
  userForm = ref(emptyUserForm());
function openUserCreate() {
  editingUser.value = null;
  userForm.value = emptyUserForm();
  clearFormError();
  userFormOpen.value = true;
}
async function openUserEdit(user) {
  clearFormError();
  try {
    const response = await fetchAPI(`/users/${user.id}`);
    const detail = response?.user || user;
    editingUser.value = detail;
    userForm.value = userToForm(detail);
    userFormOpen.value = true;
  } catch (error) {
    toast.add({
      title: "Could not load user",
      description: errorMessage(error),
      color: "error",
    });
  }
}
function userToForm(user) {
  const form = emptyUserForm();
  form.username = user.username || "";
  form.credits = String(user.credits ?? 0);
  form.credits_unlimited = !!user.credits_unlimited;
  form.timezone = user.timezone || "Asia/Shanghai";
  form.week_reset_day = Number(user.week_reset_day ?? 1);
  form.week_reset_hour = Number(user.week_reset_hour ?? 0);
  for (const id of periodWindowIds) {
    const limit = user[`limit_${id}_credits`];
    form.periods[id] = {
      enabled: limit != null,
      limit: String(limit ?? 0),
      mode: user[`window_mode_${id}`] || "first_use",
    };
  }
  return form;
}
async function submitUser() {
  clearFormError();
  const username = userForm.value.username.trim();
  const credits = parseLocalizedNumber(userForm.value.credits);
  if (!username) return void (formError.value = "Username is required.");
  if (!Number.isFinite(credits) || credits < 0)
    return void (formError.value =
      "Credits must be a number greater than or equal to 0.");
  const body = {
    username,
    credits,
    credits_unlimited: userForm.value.credits_unlimited,
  };
  if (userForm.value.password.trim())
    body.password = userForm.value.password.trim();
  if (periodLimitsSupported.value) {
    const timezone = userForm.value.timezone.trim();
    const weekResetDay = Number(userForm.value.week_reset_day);
    const weekResetHour = Number(userForm.value.week_reset_hour);
    if (!timezone) return void (formError.value = "Timezone is required.");
    if (!Number.isInteger(weekResetDay) || weekResetDay < 1 || weekResetDay > 7)
      return void (formError.value =
        "Week start day must be an integer between 1 and 7.");
    if (
      !Number.isInteger(weekResetHour) ||
      weekResetHour < 0 ||
      weekResetHour > 23
    )
      return void (formError.value =
        "Week start hour must be an integer between 0 and 23.");
    body.timezone = timezone;
    body.week_reset_day = weekResetDay;
    body.week_reset_hour = weekResetHour;
    for (const id of periodWindowIds) {
      const period = userForm.value.periods[id];
      const limit = parseLocalizedNumber(period.limit);
      if (period.enabled && (!Number.isFinite(limit) || limit < 0))
        return void (formError.value = `The ${periodWindowLabel(id)} limit must be a number greater than or equal to 0.`);
      body[`limit_${id}_credits`] = period.enabled ? limit : null;
      body[`window_mode_${id}`] = period.mode;
    }
  }
  saving.value = true;
  try {
    await fetchAPI(
      editingUser.value
        ? `/users/${encodeURIComponent(editingUser.value.id)}`
        : "/users",
      { method: editingUser.value ? "PATCH" : "POST", body },
    );
    userFormOpen.value = false;
    await syncAll();
    toast.add({
      title: editingUser.value ? "User updated." : "User created.",
      color: "success",
    });
  } catch (error) {
    formError.value = errorMessage(error);
    formFieldErrors.value =
      error?.data?.field_errors ||
      error?.data?.fieldErrors ||
      error?.response?._data?.field_errors ||
      error?.response?._data?.fieldErrors ||
      [];
  } finally {
    saving.value = false;
  }
}

const userDetailOpen = ref(false),
  userDetail = useWorkspaceState('admin:users:userDetail', () => (null)),
  detailPeriods = useWorkspaceState('admin:users:detailPeriods', () => (null)),
  detailPeriodLoading = useWorkspaceState('admin:users:detailPeriodLoading', () => (false)),
  detailPeriodError = useWorkspaceState('admin:users:detailPeriodError', () => (""));
async function openUserDetail(user) {
  userDetailOpen.value = true;
  userDetail.value = user;
  detailPeriods.value = null;
  detailPeriodError.value = "";
  try {
    const response = await fetchAPI(`/users/${encodeURIComponent(user.id)}`);
    userDetail.value = response?.user || response || user;
  } catch {}
  if (periodLimitsSupported.value) await loadUserPeriods(user);
}
async function loadUserPeriods(user) {
  detailPeriodLoading.value = true;
  detailPeriodError.value = "";
  try {
    detailPeriods.value = await fetchAPI(
      `/users/${encodeURIComponent(user.id)}/period-limits`,
    );
  } catch (error) {
    detailPeriodError.value = errorMessage(error);
  } finally {
    detailPeriodLoading.value = false;
  }
}
function profileItems(user) {
  const mfa = Array.isArray(user.mfa)
    ? user.mfa.length > 0
    : user.mfa && typeof user.mfa === "object"
      ? Object.keys(user.mfa).length > 0
      : Boolean(user.mfa || user.totp_enabled);
  const passkeys = Array.isArray(user.passkey)
    ? user.passkey.length
    : Array.isArray(user.passkeys)
      ? user.passkeys.length
      : user.passkey && typeof user.passkey === "object"
        ? 1
        : Number(user.passkey_count || 0);
  return [
    { label: "Created", value: formatDate(user.created_at) },
    { label: "Updated", value: formatDate(user.updated_at) },
    {
      label: "Deleted at",
      value: user.deleted_at ? formatDate(user.deleted_at) : "Not deleted",
    },
    { label: "Credits", value: formatCredits(user.credits) },
    { label: "MFA", value: mfa ? "Enabled" : "Disabled" },
    { label: "Passkeys", value: String(passkeys) },
  ];
}
function accessItems(user) {
  return [
    { label: "Client keys", value: String(keysForUser(user.id).length) },
    {
      label: "Credential scope",
      value: scopeSummary(effectiveChannelScopes(user.id)),
    },
    {
      label: "Model scope",
      value: scopeSummary(effectiveModelScopes(user.id)),
    },
  ];
}
const normalizedDetailWindows = computed(() => {
  const windows =
    detailPeriods.value?.windows || detailPeriods.value?.limits?.windows || [];
  return periodWindowIds.map((id) => {
    const item =
      windows.find((window) => (window.id || window.window) === id) || {};
    const enabled = item.enabled ?? item.limit != null;
    const remainingNumber = Number.isFinite(Number(item.remaining))
      ? Number(item.remaining)
      : null;
    const exhausted =
      enabled && remainingNumber != null && remainingNumber <= 0;
    const active = Boolean(item.active);
    const used = Number(item.used || 0);
    const limit = Number.isFinite(Number(item.limit))
      ? Number(item.limit)
      : null;
    const progress =
      !enabled || limit == null
        ? null
        : limit > 0
          ? Math.min(Math.round((used / limit) * 100), 100)
          : 100;
    const mode =
      item.mode === "sliding" || item.mode === "rolling"
        ? "Sliding"
        : item.mode === "calendar" && id !== "5h"
          ? "Calendar"
          : "First use";
    const start = item.window_start || item.windowStart;
    const end = item.window_end || item.windowEnd;
    const reset = item.reset_at || item.resetAt;
    const state =
      active && start && end
        ? `${formatDate(start)} – ${formatDate(end)}`
        : !active && mode === "First use"
          ? "window opens on the first billable charge"
          : "";
    return {
      id,
      label: periodWindowLabel(id),
      enabled,
      status: !enabled
        ? "Disabled"
        : exhausted
          ? "Exhausted"
          : active
            ? "Active"
            : "Not started",
      progress,
      used: formatCredits(used),
      limit: limit == null ? "—" : formatCredits(limit),
      remaining: remainingNumber == null ? "—" : formatCredits(remainingNumber),
      description: `${mode}${state ? ` · ${state}` : ""}${reset ? ` · resets ${formatDate(reset)}` : ""}`,
    };
  });
});

const keyFormOpen = ref(false),
  editingKey = ref(null),
  keyForm = ref({});
const userOptions = computed(() => [
  { label: "Unassigned", value: 0 },
  ...users.value
    .filter((user) => !user.deleted_at)
    .map((user) => ({ label: user.username, value: Number(user.id) })),
]);
const channelOptions = computed(() =>
    channelGroups.value.map((group) => ({
      label: group.channel_name,
      value: Number(group.id),
    })),
  ),
  modelGroupOptions = computed(() =>
    modelGroups.value.map((group) => ({
      label: group.group_name,
      value: Number(group.id),
    })),
  );
function generateSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `sk-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function openKeyCreate() {
  editingKey.value = null;
  keyForm.value = {
    api_key: generateSecret(),
    user_id: 0,
    channels: [],
    model_groups: [],
  };
  clearFormError();
  keyFormOpen.value = true;
}
function openKeyEdit(key) {
  editingKey.value = key;
  keyForm.value = {
    api_key: key.api_key,
    user_id: Number(key.user_id || 0),
    channels: [...key.channels],
    model_groups: [...key.model_groups],
  };
  clearFormError();
  keyFormOpen.value = true;
}
async function submitKey() {
  if (!keyForm.value.api_key.trim())
    return void (formError.value = "Key value is required.");
  const channels = [
    ...new Set(
      (keyForm.value.channels || [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  const modelGroups = [
    ...new Set(
      (keyForm.value.model_groups || [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  saving.value = true;
  clearFormError();
  try {
    const bindings = {
      user_id: Number(keyForm.value.user_id) || 0,
      channels,
      model_groups: modelGroups,
    };
    if (editingKey.value) {
      await fetchAPI("/access/api-keys", {
        method: "PATCH",
        body: {
          ...(editingKey.value.numeric_id != null
            ? { id: editingKey.value.numeric_id }
            : { api_key: editingKey.value.api_key }),
          ...bindings,
        },
      });
    } else {
      const body = { api_key: keyForm.value.api_key.trim(), ...bindings };
      const response = await fetchAPI("/access/api-keys");
      const existing = keyEntries(response)
        .map((entry, index) => normalizeKey(entry, index))
        .filter((key) => key.api_key);
      if (!existing.length || existing.every((key) => key.numeric_id != null)) {
        try {
          await fetchAPI("/access/api-keys", { method: "POST", body });
        } catch (error) {
          const status =
            error?.statusCode || error?.status || error?.response?.status;
          if (![404, 405].includes(Number(status))) throw error;
          await fetchAPI("/access/api-keys", {
            method: "PUT",
            body: { api_key_entries: [...existing.map(keyPayload), body] },
          });
        }
      } else
        await fetchAPI("/access/api-keys", {
          method: "PUT",
          body: { api_key_entries: [...existing.map(keyPayload), body] },
        });
    }
    keyFormOpen.value = false;
    await syncAll();
    toast.add({
      title: editingKey.value ? "Key access updated." : "Client key created.",
      color: "success",
    });
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}
function keyPayload(key) {
  return {
    api_key: key.api_key.trim(),
    user_id: key.user_id ?? 0,
    channels: key.channels || [],
    model_groups: key.model_groups || [],
  };
}

const groupFormOpen = ref(false),
  groupFormKind = ref("channel"),
  editingGroup = ref(null),
  groupForm = ref({ name: "", disabled: false });
const groupFormTitle = computed(() =>
  editingGroup.value
    ? `Edit ${groupFormKind.value === "channel" ? "credential" : "model"} scope`
    : `New ${groupFormKind.value === "channel" ? "credential" : "model"} scope`,
);
const groupFormDescription = computed(() =>
  editingGroup.value
    ? `Maintain the ${groupFormKind.value === "channel" ? "credential" : "model"} scope name and enabled state.`
    : `Create a ${groupFormKind.value === "channel" ? "credential" : "model"} scope that client keys can reference.`,
);
function openGroupForm(kind, group = null) {
  groupFormKind.value = kind;
  editingGroup.value = group;
  groupForm.value = {
    name: group
      ? kind === "channel"
        ? group.channel_name
        : group.group_name
      : "",
    disabled: !!group?.disabled,
  };
  clearFormError();
  groupFormOpen.value = true;
}
async function submitGroup() {
  const name = groupForm.value.name.trim();
  if (!name) return void (formError.value = "Scope name is required.");
  const channel = groupFormKind.value === "channel",
    base = channel ? "/channel-groups" : "/model-groups";
  saving.value = true;
  try {
    await fetchAPI(
      editingGroup.value ? `${base}/${editingGroup.value.id}` : base,
      {
        method: editingGroup.value ? "PATCH" : "POST",
        body: {
          [channel ? "channel_name" : "group_name"]: name,
          disabled: groupForm.value.disabled,
        },
      },
    );
    groupFormOpen.value = false;
    await syncAll();
    toast.add({
      title: editingGroup.value ? "Scope updated." : "Scope created.",
      color: "success",
    });
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}

const bindingOpen = ref(false),
  bindingKind = ref("credential"),
  bindingGroup = ref(null),
  bindingSearch = ref(""),
  bindingSelection = ref([]),
  bindingChannels = ref([]),
  modelSourceFilter = ref("all");
const credentialCandidatesPending = useWorkspaceState('admin:users:credentialCandidatesPending', () => (false)),
  credentialCandidatesIssue = useWorkspaceState('admin:users:credentialCandidatesIssue', () => ("")),
  credentialCandidatesError = useWorkspaceState('admin:users:credentialCandidatesError', () => (""));
const modelCandidatesPending = useWorkspaceState('admin:users:modelCandidatesPending', () => (false)),
  modelCandidatesIssue = useWorkspaceState('admin:users:modelCandidatesIssue', () => ("")),
  modelCandidatesError = useWorkspaceState('admin:users:modelCandidatesError', () => (""));
const bindingGroupName = computed(() =>
  bindingGroup.value
    ? bindingKind.value === "credential"
      ? bindingGroup.value.channel_name
      : bindingGroup.value.group_name
    : "",
);
const bindingCandidates = computed(() => {
  if (!bindingGroup.value) return [];
  if (bindingKind.value === "credential") {
    const bound = new Set(
      channelDetailsFor(bindingGroup.value.id).map((item) =>
        String(item.auth_id),
      ),
    );
    return [...credentialsData.value, ...providerCredentialsData.value]
      .map((item) => {
        const value = credentialAuthId(item);
        const unavailable = Boolean(item.disabled || item.unavailable);
        return {
          id: `${item.source || "credential"}:${value}`,
          value,
          label:
            item.label ||
            item.email ||
            item.account ||
            item.name ||
            item.identifier ||
            value,
          description: value,
          provider:
            item.provider || item.providerId || item.type || "credential",
          type: item.type || "",
          status: item.status || "",
          scopes: [],
          disabled: bound.has(value) || unavailable,
          badges: [
            item.provider || item.providerId || item.type || "credential",
            ...(bound.has(value)
              ? ["Bound"]
              : unavailable
                ? ["Unavailable"]
                : []),
          ],
        };
      })
      .filter((item) => item.value);
  }
  const bound = new Set(
    modelDetailsFor(bindingGroup.value.id).map((item) => String(item.model_id)),
  );
  return mergeModelCandidates().map((item) => ({
    ...item,
    value: item.modelId,
    description: item.modelId,
    disabled: bound.has(item.modelId),
    badges: [
      ...item.scopes.map((scope) =>
        scope === "available" ? "Available" : "Static catalog",
      ),
      ...(item.channel ? [item.channel] : []),
      ...(bound.has(item.modelId) ? ["Bound"] : []),
    ],
  }));
});
const bindingSubmitDisabled = computed(
  () =>
    saving.value ||
    !bindingGroup.value?.id ||
    (bindingKind.value === "model"
      ? modelCandidatesPending.value || !!modelCandidatesError.value
      : credentialCandidatesPending.value || !!credentialCandidatesError.value),
);
const providerCandidateRoutes = [
  { id: "gemini", path: "/config/api-keys/gemini" },
  { id: "interactions", path: "/config/api-keys/interactions" },
  { id: "claude", path: "/config/api-keys/claude" },
  { id: "codex", path: "/config/api-keys/codex" },
  { id: "vertex", path: "/config/api-keys/vertex" },
  { id: "xai", path: "/config/api-keys/xai" },
  { id: "openaiCompatibility", path: "/config/api-keys/openai-compatibility" },
];
function credentialAuthId(item) {
  return String(
    item?.auth_id ||
      item?.auth_index ||
      item?.["auth-index"] ||
      item?.id ||
      item?.uuid ||
      "",
  ).trim();
}
async function loadCredentialCandidates() {
  credentialCandidatesPending.value = true;
  credentialCandidatesIssue.value = "";
  credentialCandidatesError.value = "";
  const results = await Promise.allSettled([
    fetchAPI("/credentials"),
    ...providerCandidateRoutes.map((route) => fetchAPI(route.path)),
  ]);
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => errorMessage(result.reason));
  const credentialResponse =
    results[0].status === "fulfilled" ? results[0].value : null;
  const credentialEntries = Array.isArray(credentialResponse)
    ? credentialResponse
    : credentialResponse?.credentials || credentialResponse?.items || [];
  credentialsData.value = credentialEntries
    .map((item) => ({ ...item, source: "credential" }))
    .filter((item) => credentialAuthId(item));
  providerCredentialsData.value = providerCandidateRoutes.flatMap(
    (route, index) => {
      const result = results[index + 1];
      if (result.status !== "fulfilled" || !Array.isArray(result.value))
        return [];
      return result.value
        .flatMap((group) =>
          (Array.isArray(group?.keys) ? group.keys : []).map((item) => ({
            ...group,
            ...item,
            keys: undefined,
            source: "provider",
            providerId: route.id,
          })),
        )
        .filter((item) => credentialAuthId(item));
    },
  );
  const deduped = new Set();
  credentialsData.value = [
    ...credentialsData.value,
    ...providerCredentialsData.value,
  ].filter((item) => {
    const id = credentialAuthId(item);
    if (!id || deduped.has(id)) return false;
    deduped.add(id);
    return true;
  });
  providerCredentialsData.value = [];
  if (!credentialsData.value.length && failures.length)
    credentialCandidatesError.value = failures.join(" · ");
  else if (failures.length)
    credentialCandidatesIssue.value = failures.join(" · ");
  credentialCandidatesPending.value = false;
}
async function loadModelCandidates() {
  modelCandidatesPending.value = true;
  modelCandidatesIssue.value = "";
  modelCandidatesError.value = "";
  const [available, staticResult] = await Promise.allSettled([
    fetchAPI("/models", { query: { scope: "available" } }),
    fetchAPI("/models", { query: { scope: "static" } }),
  ]);
  runtimeModelsData.value =
    available.status === "fulfilled"
      ? flattenModels(available.value?.models)
      : [];
  staticModelsData.value =
    staticResult.status === "fulfilled"
      ? flattenModels(staticResult.value?.models)
      : [];
  const failures = [available, staticResult]
    .filter((result) => result.status === "rejected")
    .map((result) => errorMessage(result.reason));
  if (failures.length === 2 && !mergeModelCandidates().length)
    modelCandidatesError.value = failures.join(" · ");
  else if (failures.length) modelCandidatesIssue.value = failures.join(" · ");
  modelCandidatesPending.value = false;
}
function openBindings(kind, group) {
  bindingKind.value = kind;
  bindingGroup.value = group;
  bindingSearch.value = "";
  bindingSelection.value = [];
  bindingChannels.value = [];
  modelSourceFilter.value = "all";
  clearFormError();
  bindingOpen.value = true;
  if (kind === "model") void loadModelCandidates();
  else void loadCredentialCandidates();
}
function setBindingSelection(value) {
  bindingSelection.value = Array.isArray(value) ? [...value] : [];
}
function replaceModelGroupDetails(groupId, details) {
  modelDetailsData.value = [
    ...modelDetailsData.value.filter(
      (item) => Number(item.model_group_id) !== Number(groupId),
    ),
    ...details,
  ];
}
async function loadModelGroupDetails(groupId) {
  const response = await fetchAPI("/model-group-details", {
    query: { model_group_id: groupId },
  });
  const details = response?.model_group_details || response?.items || [];
  replaceModelGroupDetails(groupId, details);
  return details;
}
async function refreshModelScopeData(groupId) {
  const [detailsResult, groupsResult] = await Promise.allSettled([
    loadModelGroupDetails(groupId),
    fetchAPI("/model-groups"),
  ]);
  if (groupsResult.status === "fulfilled")
    modelGroupsData.value =
      groupsResult.value?.model_groups || groupsResult.value?.items || [];
  return detailsResult;
}
async function addModelBindings(targets) {
  const groupId = Number(bindingGroup.value.id);
  await loadModelGroupDetails(groupId);
  const nowBound = new Set(
    modelDetailsFor(groupId).map((item) => String(item.model_id).trim()),
  );
  if (targets.some((target) => nowBound.has(target)))
    throw new Error("This model is already bound to the current scope.");
  const channels = modelChannelBindingsSupported.value
    ? [
        ...new Set(
          bindingChannels.value
            .map(Number)
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      ]
    : [];
  const bodies = targets.map((modelId) => ({
    model_group_id: groupId,
    model_id: modelId,
    ...(channels.length ? { channels } : {}),
  }));
  if (bodies.length === 1) {
    await fetchAPI("/model-group-details", { method: "POST", body: bodies[0] });
    await refreshModelScopeData(groupId);
    bindingOpen.value = false;
    toast.add({ title: "Binding added.", color: "success" });
    return;
  }
  const results = await Promise.allSettled(
    bodies.map((body) =>
      fetchAPI("/model-group-details", { method: "POST", body }),
    ),
  );
  await refreshModelScopeData(groupId);
  const failed = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ target: targets[index], message: errorMessage(result.reason) }]
      : [],
  );
  const created = results.length - failed.length;
  if (failed.length) {
    if (created)
      toast.add({
        title: `${created} bindings added, ${failed.length} failed.`,
        color: "warning",
      });
    throw new Error(
      `${failed.length} bindings failed: ${failed[0].target}: ${failed[0].message}`,
    );
  }
  bindingOpen.value = false;
  toast.add({ title: `${created} bindings added.`, color: "success" });
}
async function addBindings() {
  if (!bindingGroup.value?.id)
    return void (formError.value =
      "Select a valid scope before adding bindings.");
  const targets = [
    ...new Set(
      bindingSelection.value
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!targets.length)
    return void (formError.value =
      bindingKind.value === "credential"
        ? "Select at least one credential."
        : "Select at least one model.");
  saving.value = true;
  clearFormError();
  try {
    if (bindingKind.value === "model") {
      await addModelBindings(targets);
      return;
    }
    const failed = [];
    let created = 0;
    for (const target of targets) {
      try {
        await fetchAPI("/channel-group-details", {
          method: "POST",
          body: {
            channel_group_id: Number(bindingGroup.value.id),
            auth_id: target,
          },
        });
        created++;
      } catch (error) {
        failed.push(`${target}: ${errorMessage(error)}`);
      }
    }
    await syncAll();
    if (failed.length) {
      if (created)
        toast.add({
          title: `${created} binding(s) added`,
          description: `${failed.length} failed.`,
          color: "warning",
        });
      formError.value = failed.join(" | ");
      return;
    }
    bindingOpen.value = false;
    toast.add({
      title: created === 1 ? "Binding added." : `${created} bindings added.`,
      color: "success",
    });
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}

const balanceOpen = ref(false),
  balanceConfirmOpen = ref(false),
  balanceTargets = ref([]),
  balanceForm = ref({ type: "recharge", amount: "", note: "" });
const balanceCurrentTotal = computed(() =>
    balanceTargets.value.reduce(
      (sum, user) => sum + Number(user.credits || 0),
      0,
    ),
  ),
  balanceDelta = computed(() => {
    const amount = Number(balanceForm.value.amount);
    return Number.isFinite(amount) && amount > 0
      ? balanceForm.value.type === "deduct"
        ? -amount
        : amount
      : null;
  }),
  balanceAfterTotal = computed(() =>
    balanceDelta.value == null
      ? null
      : balanceCurrentTotal.value +
        balanceDelta.value * balanceTargets.value.length,
  ),
  negativeBalanceCount = computed(() =>
    balanceDelta.value == null
      ? 0
      : balanceTargets.value.filter(
          (user) => Number(user.credits || 0) + balanceDelta.value < 0,
        ).length,
  );
const balanceTargetLabel = computed(() =>
  balanceTargets.value.length === 1
    ? `${balanceTargets.value[0].username} (#${balanceTargets.value[0].id})`
    : `${balanceTargets.value.length} users`,
);
const balanceConfirmTitle = computed(() =>
  balanceTargets.value.length > 1
    ? `Confirm batch ${balanceForm.value.type === "deduct" ? "deduction" : "recharge"}?`
    : `Confirm ${balanceForm.value.type === "deduct" ? "deduction" : "recharge"}?`,
);
const signedBalanceAmount = computed(
    () =>
      `${balanceForm.value.type === "deduct" ? "−" : "+"}${formatCredits(balanceForm.value.amount)}`,
  ),
  signedBalanceTotal = computed(
    () =>
      `${balanceForm.value.type === "deduct" ? "−" : "+"}${formatCredits(Number(balanceForm.value.amount) * balanceTargets.value.length)}`,
  );
function openBalance(targets) {
  balanceTargets.value = targets.filter(isOperableUser);
  balanceForm.value = { type: "recharge", amount: "", note: "" };
  clearFormError();
  balanceOpen.value = true;
}
function reviewBalance() {
  const amount = Number(balanceForm.value.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return void (formError.value = "Amount must be greater than 0.");
  if (balanceForm.value.type === "deduct" && !balanceForm.value.note.trim())
    return void (formError.value = "Deduction requires a note.");
  balanceConfirmOpen.value = true;
}
async function applyBalance() {
  saving.value = true;
  let succeeded = 0;
  const failed = [];
  for (const user of balanceTargets.value) {
    try {
      await fetchAPI(`/billing/balance-records/${balanceForm.value.type}`, {
        method: "POST",
        body: {
          user_id: user.id,
          amount: Number(balanceForm.value.amount),
          note: balanceForm.value.note.trim(),
        },
      });
      succeeded++;
    } catch (error) {
      failed.push(errorMessage(error));
    }
  }
  await syncAll();
  saving.value = false;
  if (failed.length)
    toast.add({
      title: succeeded
        ? `${succeeded} users completed, ${failed.length} failed: ${failed[0]}`
        : `${failed.length} user operations failed: ${failed[0]}`,
      color: "error",
    });
  else
    toast.add({
      title:
        balanceTargets.value.length === 1
          ? balanceForm.value.type === "recharge"
            ? "Recharge submitted."
            : "Deduction submitted."
          : `Balance operation completed for ${succeeded} users.`,
      color: "success",
    });
  if (succeeded) {
    balanceConfirmOpen.value = false;
    balanceOpen.value = false;
    selectedUserIds.value = new Set();
  }
}

const periodResetOpen = ref(false),
  periodResetUser = ref(null),
  resetWindows = ref(new Set(periodWindowIds)),
  resetMode = ref("counter");
const resetModeOptions = [
  {
    label: "Reset counters",
    value: "counter",
    hint: "Usage restarts from now; first-use windows reopen on the next charge.",
  },
  {
    label: "Reset window start only",
    value: "window_only",
    hint: "Clears active window start times; sliding and calendar windows also restart usage.",
  },
];
function openPeriodReset(user) {
  periodResetUser.value = user;
  resetWindows.value = new Set(periodWindowIds);
  resetMode.value = "counter";
  clearFormError();
  periodResetOpen.value = true;
}
function toggleResetWindow(window) {
  const next = new Set(resetWindows.value);
  next.has(window) ? next.delete(window) : next.add(window);
  resetWindows.value = next;
}
function detailWindow(id) {
  const windows =
    detailPeriods.value?.windows || detailPeriods.value?.limits?.windows || [];
  return windows.find((window) => (window.id || window.window) === id);
}
async function resetPeriods() {
  if (!resetWindows.value.size)
    return void (formError.value = "Select at least one window.");
  saving.value = true;
  try {
    const response = await fetchAPI(
      `/users/${encodeURIComponent(periodResetUser.value.id)}/period-limits/reset`,
      {
        method: "POST",
        body: {
          windows: periodWindowIds.filter((id) => resetWindows.value.has(id)),
          mode: resetMode.value,
        },
      },
    );
    detailPeriods.value = response?.limits || response || null;
    periodResetOpen.value = false;
    await syncAll();
    toast.add({ title: "Period counters reset.", color: "success" });
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}

const deleteOpen = ref(false),
  deleteKind = ref(""),
  deleteTarget = ref(null);
const deleteDescription = computed(() => {
  const target = deleteTarget.value;
  if (!target) return "";
  if (deleteKind.value === "user")
    return `Delete user “${target.username}”? This will not automatically delete global credentials.`;
  if (deleteKind.value === "key")
    return `Delete client key ${maskKey(target.api_key)}? Linked clients will stop working immediately.`;
  if (deleteKind.value === "detail")
    return `Delete binding “${target.auth_id || target.model_id}”?`;
  return `Delete scope “${target.channel_name || target.group_name}”? Bound keys will lose this scope reference.`;
});
function openDelete(kind, target, subkind = "") {
  deleteKind.value = kind;
  deleteTarget.value = { ...target, subkind };
  deleteOpen.value = true;
}
function confirmUserDelete(user) {
  openDelete("user", user);
}
function confirmKeyDelete(key) {
  openDelete("key", key);
}
function confirmGroupDelete(kind, group) {
  openDelete("group", group, kind);
}
function confirmDetailDelete(kind, detail) {
  openDelete("detail", detail, kind);
}
async function performDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  let url = "";
  if (deleteKind.value === "user")
    url = `/users/${encodeURIComponent(target.id)}`;
  if (deleteKind.value === "key")
    url = `/access/api-keys?${target.numeric_id != null ? `id=${encodeURIComponent(target.numeric_id)}` : `index=${encodeURIComponent(target.index)}`}`;
  if (deleteKind.value === "group")
    url = `/${target.subkind === "channel" ? "channel-groups" : "model-groups"}/${encodeURIComponent(target.id)}`;
  if (deleteKind.value === "detail")
    url = `/${target.subkind === "channel" ? "channel-group-details" : "model-group-details"}/${encodeURIComponent(target.id)}`;
  saving.value = true;
  try {
    await fetchAPI(url, { method: "DELETE" });
    deleteOpen.value = false;
    await syncAll();
    toast.add({
      title:
        deleteKind.value === "detail"
          ? "Binding deleted."
          : deleteKind.value === "group"
            ? "Scope deleted."
            : deleteKind.value === "key"
              ? "Client key deleted."
              : "User deleted.",
      color: "success",
    });
  } catch (error) {
    toast.add({
      title: "Delete failed",
      description: errorMessage(error),
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}
</script>
