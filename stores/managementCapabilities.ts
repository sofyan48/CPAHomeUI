import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'

export interface ManagementCapabilities {
  [key: string]: boolean | undefined
  topology?: boolean
  users?: boolean
  access_groups?: boolean
  usage_overview?: boolean
  usage_records?: boolean
  usage_realtime?: boolean
  request_events?: boolean
  logs?: boolean
}

export interface ManagementServerInfo {
  home_version?: string
  home_commit?: string
  home_build_date?: string
}

export interface CapabilitiesResponse {
  capabilities?: ManagementCapabilities
  server_info?: ManagementServerInfo
}

export const useManagementCapabilitiesStore = defineStore('managementCapabilities', () => {
  const { fetchAPI, token } = useApi()
  const capabilities = ref<ManagementCapabilities>({})
  const serverInfo = ref<ManagementServerInfo>({})
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let capabilitiesRequest: Promise<void> | null = null
  let generation = 0

  const refreshCapabilities = async (force = false) => {
    if (capabilitiesRequest) return capabilitiesRequest
    if (loaded.value && !force) return

    const requestGeneration = generation
    const request = (async () => {
      loading.value = true
      error.value = null
      try {
        const response = await fetchAPI<CapabilitiesResponse>('/capabilities')
        if (requestGeneration !== generation) return
        capabilities.value = response?.capabilities || {}
        serverInfo.value = response?.server_info || {}
        loaded.value = true
      } catch (cause: any) {
        if (requestGeneration !== generation) return
        loaded.value = false
        error.value = cause?.message || 'Unable to load server capabilities'
        throw cause
      } finally {
        if (requestGeneration === generation) {
          loading.value = false
          capabilitiesRequest = null
        }
      }
    })()

    capabilitiesRequest = request
    return request
  }

  const supports = (name: string, fallback = true) => {
    const value = capabilities.value[name]
    return typeof value === 'boolean' ? value : fallback
  }

  const resetCapabilities = () => {
    generation++
    capabilitiesRequest = null
    loading.value = false
    capabilities.value = {}
    serverInfo.value = {}
    loaded.value = false
    error.value = null
  }

  watch(token, resetCapabilities, { flush: 'sync' })

  return {
    capabilities,
    serverInfo,
    loaded,
    loading,
    error,
    supports,
    refreshCapabilities,
    resetCapabilities
  }
})
