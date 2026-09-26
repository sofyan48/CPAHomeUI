<template>
  <div v-if="groups.length" class="grid gap-3">
    <div v-for="group in groups" :key="group.id" class="rounded-md border border-[var(--ui-border)]">
      <div class="flex flex-col gap-3 border-b border-[var(--ui-border)] p-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium">{{ groupName(group) }}</p>
            <UBadge color="neutral" variant="subtle">{{ groupDetails(group).length }} bindings</UBadge>
            <UBadge v-if="group.disabled" color="warning" variant="subtle">Disabled</UBadge>
          </div>
          <p class="mt-1 text-xs text-[var(--ui-text-muted)]">Scope ID: {{ group.id }}</p>
        </div>
        <div class="flex gap-1">
          <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-plus" aria-label="Add binding" @click="$emit('add', group)" />
          <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-pencil-square" aria-label="Edit" @click="$emit('edit', group)" />
          <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" aria-label="Delete" @click="$emit('delete', group)" />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table :class="['w-full table-fixed text-sm', kind === 'model' && channelBindingsSupported ? 'min-w-[760px]' : 'min-w-[620px]']">
          <thead class="bg-[var(--ui-bg-muted)] text-left text-xs text-[var(--ui-text-muted)]">
            <tr>
              <th class="px-3 py-2">{{ kind === 'channel' ? 'Credential ID' : 'Model ID' }}</th>
              <th v-if="kind === 'model' && channelBindingsSupported" class="w-[26%] px-3 py-2">Credential scope</th>
              <th class="w-[20%] px-3 py-2">Updated</th>
              <th class="w-[18%] px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!groupDetails(group).length">
              <td :colspan="kind === 'model' && channelBindingsSupported ? 4 : 3" class="px-3 py-8 text-center text-[var(--ui-text-muted)]">No bindings yet.</td>
            </tr>
            <tr v-for="detail in groupDetails(group)" :key="detail.id" class="border-t border-[var(--ui-border)]">
              <td class="truncate px-3 py-2 font-mono text-xs" :title="target(detail)">{{ target(detail) }}</td>
              <td v-if="kind === 'model' && channelBindingsSupported" class="truncate px-3 py-2 text-[var(--ui-text-muted)]" :title="channels(detail)">{{ channels(detail) }}</td>
              <td class="truncate px-3 py-2 text-[var(--ui-text-muted)]">{{ updated(detail) }}</td>
              <td class="px-3 py-2 text-right">
                <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" @click="$emit('delete-detail', detail)">Delete</UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <UsersEmptyState v-else :icon="kind === 'channel' ? 'i-heroicons-rectangle-group' : 'i-heroicons-cube'" :text="kind === 'channel' ? 'No credential scopes yet.' : 'No model scopes yet.'" />
</template>

<script>
import UsersEmptyState from './UsersEmptyState.vue'

export default {
  components: { UsersEmptyState },
  props: ['kind', 'groups', 'details', 'channelGroups', 'channelBindingsSupported'],
  emits: ['edit', 'delete', 'add', 'delete-detail'],
  methods: {
    groupDetails(group) {
      return this.details.filter(item => Number(item[this.kind === 'channel' ? 'channel_group_id' : 'model_group_id']) === Number(group.id) && !item.deleted_at)
    },
    groupName(group) {
      return this.kind === 'channel' ? group.channel_name : group.group_name
    },
    target(detail) {
      return this.kind === 'channel' ? detail.auth_id : detail.model_id
    },
    channels(detail) {
      const ids = detail.channels || []
      return ids.length ? ids.map(id => this.channelGroups.find(group => Number(group.id) === Number(id))?.channel_name || `#${id}`).join(', ') : 'Inherits key scope'
    },
    updated(detail) {
      return detail.updated_at ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(detail.updated_at)) : 'Not returned'
    }
  }
}
</script>
