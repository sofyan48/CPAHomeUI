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

let capabilitiesRequest: Promise<void> | null = null

export const useCapabilities = () => {
  const { fetchAPI } = useApi()
  const capabilities = useState<ManagementCapabilities>('management-capabilities', () => ({}))
  const serverInfo = useState<ManagementServerInfo>('management-server-info', () => ({}))
  const loaded = useState<boolean>('management-capabilities-loaded', () => false)
  const loading = useState<boolean>('management-capabilities-loading', () => false)
  const error = useState<string | null>('management-capabilities-error', () => null)

  const refreshCapabilities = async (force = false) => {
    if (capabilitiesRequest) return capabilitiesRequest
    if (loaded.value && !force) return

    capabilitiesRequest = (async () => {
      loading.value = true
      error.value = null
      try {
        const response = await fetchAPI<CapabilitiesResponse>('/capabilities')
        capabilities.value = response?.capabilities || {}
        serverInfo.value = response?.server_info || {}
        loaded.value = true
      } catch (cause: any) {
        loaded.value = false
        error.value = cause?.message || 'Unable to load server capabilities'
        throw cause
      } finally {
        loading.value = false
        capabilitiesRequest = null
      }
    })()

    return capabilitiesRequest
  }

  const supports = (name: string, fallback = true) => {
    const value = capabilities.value[name]
    return typeof value === 'boolean' ? value : fallback
  }

  const resetCapabilities = () => {
    capabilities.value = {}
    serverInfo.value = {}
    loaded.value = false
    error.value = null
  }

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
}
