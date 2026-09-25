<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">Users</h1>
        <p class="mt-1 text-sm text-[var(--ui-text-muted)]">
          Manage user identities, balances, passwords, and account-level billing access.
        </p>
      </div>
      <UButton color="primary" icon="i-heroicons-plus" @click="openCreate">
        New User
      </UButton>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <UCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Total users</p>
        <p class="mt-2 text-2xl font-bold">{{ users.length }}</p>
      </UCard>
      <UCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Unlimited balance</p>
        <p class="mt-2 text-2xl font-bold">{{ unlimitedCount }}</p>
      </UCard>
      <UCard>
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Combined balance</p>
        <p class="mt-2 text-2xl font-bold">{{ formatCredits(totalCredits) }}</p>
      </UCard>
    </div>

    <UAlert
      v-if="pageError"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-triangle"
      title="Unable to load users"
      :description="pageError"
    />

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search by username or ID..."
        class="w-full sm:max-w-sm"
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="i-heroicons-arrow-path"
        :loading="pending"
        @click="refreshUsers"
      >
        Refresh
      </UButton>
    </div>

    <UCard :ui="{ body: { padding: '' } }">
      <UTable :columns="columns" :data="filteredUsers" :loading="pending">
        <template #username-data="{ row }">
          <div>
            <p class="font-medium text-[var(--ui-text-highlighted)]">{{ row.username }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">User #{{ row.id }}</p>
          </div>
        </template>

        <template #credits-data="{ row }">
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm">{{ formatCredits(row.credits) }}</span>
            <UBadge v-if="row.credits_unlimited" color="success" variant="subtle" size="sm">Unlimited</UBadge>
          </div>
        </template>

        <template #security-data="{ row }">
          <div class="flex flex-wrap gap-1.5">
            <UBadge :color="row.password_set ? 'success' : 'neutral'" variant="subtle" size="sm">
              {{ row.password_set ? 'Password' : 'No password' }}
            </UBadge>
            <UBadge v-if="row.mfa?.enabled" color="info" variant="subtle" size="sm">MFA</UBadge>
            <UBadge v-if="passkeyCount(row)" color="info" variant="subtle" size="sm">
              {{ passkeyCount(row) }} passkey{{ passkeyCount(row) === 1 ? '' : 's' }}
            </UBadge>
          </div>
        </template>

        <template #period_limits-data="{ row }">
          <div v-if="row.period_limits_summary?.enabled_windows?.length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="window in row.period_limits_summary.enabled_windows"
              :key="window"
              :color="row.period_limits_summary.zero_limit_windows?.includes(window) ? 'error' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ window }}
            </UBadge>
          </div>
          <span v-else class="text-sm text-[var(--ui-text-muted)]">None</span>
        </template>

        <template #actions-data="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-heroicons-pencil-square"
              aria-label="Edit user"
              @click="openEdit(row)"
            />
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-heroicons-trash"
              aria-label="Delete user"
              @click="confirmDelete(row)"
            />
          </div>
        </template>

        <template #empty-state>
          <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div class="mb-3 rounded-full bg-[var(--ui-bg-elevated)] p-3">
              <UIcon name="i-heroicons-users" class="size-6 text-[var(--ui-text-muted)]" />
            </div>
            <p class="font-medium">{{ search ? 'No matching users' : 'No users yet' }}</p>
            <p class="mt-1 text-sm text-[var(--ui-text-muted)]">
              {{ search ? 'Try a different search term.' : 'Create a user to assign balances and client API keys.' }}
            </p>
          </div>
        </template>
      </UTable>
    </UCard>

    <UModal
      v-model:open="formOpen"
      :title="editingUser ? `Edit ${editingUser.username}` : 'Create user'"
      :description="editingUser ? 'Only supplied values are changed.' : 'Create a new Home user account.'"
    >
      <template #body>
        <form class="space-y-5" @submit.prevent="submitUser">
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-circle"
            title="Could not save user"
            :description="formError"
          />

          <UFormField label="Username" required :error="fieldError('username')">
            <UInput v-model="form.username" class="w-full" placeholder="alice" autocomplete="off" />
          </UFormField>

          <UFormField :label="editingUser ? 'New password' : 'Password'" :hint="editingUser ? 'Leave blank to keep the current password.' : 'Optional'">
            <UInput
              v-model="form.password"
              class="w-full"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
            />
          </UFormField>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Credits" :error="fieldError('credits')">
              <UInput v-model="form.credits" class="w-full" type="number" min="0" step="0.000001" />
            </UFormField>
            <UFormField label="Timezone" :error="fieldError('timezone')">
              <UInput v-model="form.timezone" class="w-full" placeholder="Asia/Shanghai" />
            </UFormField>
          </div>

          <div class="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-muted)] p-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="font-medium">Unlimited total balance</p>
                <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
                  Dispatch ignores the total credit balance. Configured period limits still apply.
                </p>
              </div>
              <USwitch v-model="form.credits_unlimited" />
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t border-[var(--ui-border)] pt-4">
            <UButton color="neutral" variant="ghost" type="button" @click="formOpen = false">Cancel</UButton>
            <UButton color="primary" type="submit" :loading="submitting">
              {{ editingUser ? 'Save changes' : 'Create user' }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Delete user" description="This soft-deletes the user account.">
      <template #body>
        <div class="space-y-5">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            title="Client keys bound to this user may stop dispatching"
            :description="deleteTarget ? `You are deleting ${deleteTarget.username} (#${deleteTarget.id}).` : ''"
          />
          <div class="flex justify-end gap-3">
            <UButton color="neutral" variant="ghost" @click="deleteOpen = false">Cancel</UButton>
            <UButton color="error" :loading="deleting" @click="deleteUser">Delete user</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup>
const { fetchAPI } = useApi()
const toast = useToast()

const search = ref('')
const pageError = ref('')
const formOpen = ref(false)
const formError = ref('')
const formFieldErrors = ref([])
const submitting = ref(false)
const editingUser = ref(null)
const deleteOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

const emptyForm = () => ({
  username: '',
  password: '',
  credits: '0',
  credits_unlimited: false,
  timezone: 'Asia/Shanghai'
})

const form = ref(emptyForm())

const columns = [
  { accessorKey: 'username', header: 'User' },
  { accessorKey: 'credits', header: 'Balance' },
  { accessorKey: 'security', header: 'Security' },
  { accessorKey: 'period_limits', header: 'Period limits' },
  { accessorKey: 'actions', header: '' }
]

const loadUsers = async () => {
  pageError.value = ''
  try {
    return await fetchAPI('/users')
  } catch (error) {
    pageError.value = errorMessage(error)
    return { users: [] }
  }
}

const { data, pending, refresh: refreshUsers } = await useAsyncData('management-users', loadUsers)

const users = computed(() => Array.isArray(data.value?.users) ? data.value.users : [])
const filteredUsers = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return users.value
  return users.value.filter(user =>
    String(user.id).includes(query) || String(user.username || '').toLowerCase().includes(query)
  )
})
const unlimitedCount = computed(() => users.value.filter(user => user.credits_unlimited).length)
const totalCredits = computed(() => users.value.reduce((sum, user) => sum + Number(user.credits || 0), 0))

function openCreate() {
  editingUser.value = null
  form.value = emptyForm()
  formError.value = ''
  formFieldErrors.value = []
  formOpen.value = true
}

function openEdit(user) {
  editingUser.value = user
  form.value = {
    username: user.username || '',
    password: '',
    credits: String(user.credits ?? 0),
    credits_unlimited: Boolean(user.credits_unlimited),
    timezone: user.timezone || 'Asia/Shanghai'
  }
  formError.value = ''
  formFieldErrors.value = []
  formOpen.value = true
}

async function submitUser() {
  formError.value = ''
  formFieldErrors.value = []
  if (!form.value.username.trim()) {
    formError.value = 'Username is required.'
    return
  }

  const credits = Number(form.value.credits)
  if (!Number.isFinite(credits) || credits < 0) {
    formError.value = 'Credits must be a non-negative number.'
    return
  }

  const body = {
    username: form.value.username.trim(),
    credits,
    credits_unlimited: form.value.credits_unlimited,
    timezone: form.value.timezone.trim() || 'Asia/Shanghai'
  }
  if (form.value.password) body.password = form.value.password

  submitting.value = true
  try {
    if (editingUser.value) {
      await fetchAPI(`/users/${editingUser.value.id}`, { method: 'PATCH', body })
    } else {
      await fetchAPI('/users', { method: 'POST', body })
    }
    formOpen.value = false
    await refreshUsers()
    toast.add({
      title: editingUser.value ? 'User updated' : 'User created',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  } catch (error) {
    formError.value = errorMessage(error)
    formFieldErrors.value = error?.data?.field_errors || error?.response?._data?.field_errors || []
  } finally {
    submitting.value = false
  }
}

function confirmDelete(user) {
  deleteTarget.value = user
  deleteOpen.value = true
}

async function deleteUser() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await fetchAPI(`/users/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteOpen.value = false
    await refreshUsers()
    toast.add({ title: 'User deleted', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (error) {
    toast.add({ title: 'Could not delete user', description: errorMessage(error), color: 'error' })
  } finally {
    deleting.value = false
  }
}

function fieldError(field) {
  return formFieldErrors.value.find(item => item.field === field)?.code || ''
}

function passkeyCount(user) {
  return Array.isArray(user.passkey) ? user.passkey.length : 0
}

function formatCredits(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(Number(value || 0))
}

function errorMessage(error) {
  return error?.data?.message || error?.data?.error || error?.response?._data?.message || error?.response?._data?.error || error?.message || 'Unexpected request error.'
}
</script>
