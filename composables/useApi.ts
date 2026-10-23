import { useRuntimeConfig } from '#imports'
import { storeToRefs } from 'pinia'
import { useManagementConfigStore } from '~/stores/managementConfig'
import { useCredentialModelsStore } from '~/stores/credentialModels'
import { useManagementSessionStore } from '~/stores/managementSession'

export type ApiQueryValue = string | number | boolean | null | undefined | Array<string | number | boolean>
export type ApiQuery = Record<string, ApiQueryValue>
export type ApiResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer'

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: ApiQuery
  body?: unknown
  headers?: HeadersInit
  responseType?: ApiResponseType
  signal?: AbortSignal
  /** Replace cached and in-flight credential models with a fresh request. */
  refresh?: boolean
  token?: string | null
}

export class ManagementApiError extends Error {
  statusCode?: number
  data?: unknown

  constructor(message: string, statusCode?: number, data?: unknown) {
    super(message)
    this.name = 'ManagementApiError'
    this.statusCode = statusCode
    this.data = data
  }
}

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '')
const managementSuffixPattern = /\/v(?:0|8)\/management$/i
const managementBase = '/v8/management'
const providerPathPrefix = '/config/api-keys/'
const providerPaths = new Set([
  '/config/api-keys/gemini',
  '/config/api-keys/interactions',
  '/config/api-keys/claude',
  '/config/api-keys/codex',
  '/config/api-keys/xai',
  '/config/api-keys/meta',
  '/config/api-keys/vertex',
  '/config/api-keys/openai-compatibility'
])

const errorMessage = (error: any) => {
  const data = error?.data
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) return data.message
    if (typeof data.error === 'string' && data.error.trim()) return data.error
    if (data.error && typeof data.error.message === 'string') return data.error.message
  }
  return error?.statusMessage || error?.message || 'Management API request failed'
}

export const useApi = () => {
  const config = useRuntimeConfig()
  const { token } = storeToRefs(useManagementSessionStore())
  const managementConfig = useManagementConfigStore()
  const credentialModels = useCredentialModelsStore()

  // Home often listens on IPv4 only; localhost may resolve to ::1 in browsers.
  const configuredURL = String(config.public.apiUrl || '').trim().replace(/\/+$/, '').replace(/^(https?:\/\/)localhost(?=:\d+|\/|$)/i, (_, scheme: string) => `${scheme}127.0.0.1`)
  const configuredOrigin = configuredURL.replace(managementSuffixPattern, '')
  const apiBase = configuredOrigin ? `${configuredOrigin}${managementBase}` : managementBase

  const resolveUrl = (path: string) => {
    if (/^https?:\/\//i.test(path)) {
      const requested = new URL(path)
      const allowed = new URL(apiBase, import.meta.client ? window.location.origin : 'http://localhost')
      if (requested.origin !== allowed.origin || !requested.pathname.startsWith(`${allowed.pathname.replace(/\/$/, '')}/`)) {
        throw new ManagementApiError('Refusing to send the management key outside the Management API', 400)
      }
      return path
    }
    let cleanPath = path.trim()
    if (!cleanPath || cleanPath === '/') return apiBase
    if (cleanPath.startsWith(managementBase)) cleanPath = cleanPath.slice(managementBase.length)
    return `${apiBase}/${trimSlashes(cleanPath)}`
  }

  const requestHeaders = (options: ApiRequestOptions, activeToken: string) => {
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', `Bearer ${activeToken}`)

    const body = options.body
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    const isBinary = typeof Blob !== 'undefined' && body instanceof Blob
    if (body !== undefined && body !== null && !isFormData && !isBinary && !headers.has('Content-Type')) {
      headers.set('Content-Type', typeof body === 'string' ? 'text/plain;charset=UTF-8' : 'application/json')
    }
    return headers
  }

  const requireToken = (override?: string | null) => {
    const activeToken = String(override || token.value || config.public.secretKey || '').trim()
    if (!activeToken) throw new ManagementApiError('Management key is missing', 401)
    return activeToken
  }

  const fetchConfig = (options: ApiRequestOptions, activeToken: string) => {
    const cacheKey = `${apiBase}\n${activeToken}`
    return managementConfig.fetchConfig(cacheKey, () => $fetch<any>(resolveUrl('/config'), {
      method: 'GET',
      headers: requestHeaders(options, activeToken),
      responseType: 'json',
      signal: options.signal
    }))
  }

  const providerGroupsFromConfig = (configRoot: any, path: string) => {
    const family = path.slice(providerPathPrefix.length).split('?', 1)[0] || ''
    const groups = configRoot?.['api-keys']?.[family]
    return Array.isArray(groups) ? groups : []
  }

  const credentialModelsId = (url: string, options: ApiRequestOptions) => {
    if (options.signal || options.headers || options.body !== undefined || (options.responseType && options.responseType !== 'json')) return ''
    const baseOrigin = import.meta.client ? window.location.origin : 'http://localhost'
    const requested = new URL(url, baseOrigin)
    const endpoint = new URL(resolveUrl('/credentials/models'), baseOrigin)
    if (requested.origin !== endpoint.origin || requested.pathname !== endpoint.pathname || requested.hash) return ''

    // Only the documented name query is cacheable; leave other request variants untouched.
    const params = requested.searchParams
    for (const [key, value] of Object.entries(options.query || {})) {
      if (key !== 'name' || typeof value !== 'string' || params.has(key)) return ''
      params.set(key, value)
    }
    if ([...params.keys()].some(key => key !== 'name') || params.getAll('name').length !== 1) return ''
    return (params.get('name') || '').trim()
  }

  const fetchAPI = async <T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const activeToken = requireToken(options.token)
    const method = options.method || (options.body === undefined ? 'GET' : 'POST')
    const pathWithoutQuery = path.split('?', 1)[0]
    const providerPath = pathWithoutQuery && providerPaths.has(pathWithoutQuery) ? pathWithoutQuery : ''

    try {
      credentialModels.setScope(apiBase, activeToken)
      if (method === 'GET' && providerPath) {
        const configRoot = await fetchConfig(options, activeToken)
        return providerGroupsFromConfig(configRoot, providerPath) as T
      }

      const url = resolveUrl(path)
      if (method !== 'GET') {
        managementConfig.invalidate()
        credentialModels.invalidate()
      }
      const fetchResponse = () => $fetch<T>(url, {
        method,
        query: options.query,
        body: options.body as any,
        headers: requestHeaders(options, activeToken),
        responseType: options.responseType || 'json',
        signal: options.signal
      })
      const credentialId = method === 'GET' ? credentialModelsId(url, options) : ''
      return await (credentialId
        ? credentialModels.fetchModels(credentialId, fetchResponse, options.refresh)
        : fetchResponse())
    } catch (error: any) {
      throw new ManagementApiError(errorMessage(error), error?.statusCode || error?.status, error?.data)
    } finally {
      if (method !== 'GET') {
        managementConfig.invalidate()
        credentialModels.invalidate()
      }
    }
  }

  const fetchRaw = async <T = unknown>(path: string, options: ApiRequestOptions = {}) => {
    const activeToken = requireToken(options.token)
    const url = resolveUrl(path)
    const method = options.method || (options.body === undefined ? 'GET' : 'POST')

    try {
      credentialModels.setScope(apiBase, activeToken)
      if (method !== 'GET') {
        managementConfig.invalidate()
        credentialModels.invalidate()
      }
      return await $fetch.raw<T>(url, {
        method,
        query: options.query,
        body: options.body as any,
        headers: requestHeaders(options, activeToken),
        responseType: options.responseType || 'json',
        signal: options.signal
      })
    } catch (error: any) {
      throw new ManagementApiError(errorMessage(error), error?.statusCode || error?.status, error?.data)
    } finally {
      if (method !== 'GET') {
        managementConfig.invalidate()
        credentialModels.invalidate()
      }
    }
  }

  const fetchBlob = (path: string, options: Omit<ApiRequestOptions, 'responseType'> = {}) =>
    fetchAPI<Blob>(path, { ...options, responseType: 'blob' })

  return {
    apiBase,
    token,
    fetchAPI,
    fetchRaw,
    fetchBlob,
    resolveUrl
  }
}
