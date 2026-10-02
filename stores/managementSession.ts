import { useCookie } from '#imports'
import { defineStore } from 'pinia'
import { watch } from 'vue'
import { useManagementConfigStore } from '~/stores/managementConfig'
import { useWorkspaceStore } from '~/stores/workspace'

export const useManagementSessionStore = defineStore('managementSession', () => {
  const token = useCookie<string | null>('management_token', {
    sameSite: 'strict',
    secure: import.meta.client && window.location.protocol === 'https:'
  })
  const rememberSession = useCookie<boolean>('management_remember', {
    sameSite: 'strict',
    secure: import.meta.client && window.location.protocol === 'https:',
    default: () => false
  })
  const workspace = useWorkspaceStore()
  const managementConfig = useManagementConfigStore()

  watch(token, () => {
    workspace.clear('admin:')
    managementConfig.invalidate()
  }, { flush: 'sync' })

  return { token, rememberSession }
})
