<template>
  <div v-if="groups.length" class="grid gap-3">
    <div v-for="group in groups" :key="group.id" class="min-w-0">
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
          <AppButton color="neutral" variant="ghost" size="sm" icon="i-tabler-plus" aria-label="Add binding" @click="$emit('add', group)" />
          <AppButton color="neutral" variant="ghost" size="sm" icon="i-tabler-pencil" aria-label="Edit" @click="$emit('edit', group)" />
          <AppButton color="error" variant="ghost" size="sm" icon="i-tabler-trash" aria-label="Delete" @click="$emit('delete', group)" />
        </div>
      </div>
      <AppCard :ui="{ body: 'p-0' }">
      <AppTable native>
        <table class="text-left text-sm">
          <thead>
            <tr>
              <th>{{ kind === 'channel' ? 'Credential ID' : 'Model ID' }}</th>
              <th v-if="kind === 'model' && channelBindingsSupported">Credential scope</th>
              <th class="whitespace-nowrap">Updated</th>
              <th class="w-px whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!groupDetails(group).length">
              <td :colspan="kind === 'model' && channelBindingsSupported ? 4 : 3" class="px-4 py-12 text-center text-sm text-muted">No bindings yet.</td>
            </tr>
            <tr v-for="detail in groupDetails(group)" :key="detail.id">
              <td class="min-w-32 max-w-64 truncate font-mono text-xs" :title="target(detail)">{{ target(detail) }}</td>
              <td v-if="kind === 'model' && channelBindingsSupported" class="min-w-32 max-w-64 truncate text-muted" :title="channels(detail)">{{ channels(detail) }}</td>
              <td class="whitespace-nowrap text-muted">{{ updated(detail) }}</td>
              <td class="w-px whitespace-nowrap text-right">
                <AppButton color="error" variant="ghost" size="sm" icon="i-tabler-trash" aria-label="Remove binding" title="Remove binding" @click="$emit('delete-detail', detail)" />
              </td>
            </tr>
          </tbody>
        </table>
      </AppTable>
      </AppCard>
    </div>
  </div>
  <UsersEmptyState v-else :icon="kind === 'channel' ? 'i-tabler-layout-grid' : 'i-tabler-cube'" :text="kind === 'channel' ? 'No credential scopes yet.' : 'No model scopes yet.'" />
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
