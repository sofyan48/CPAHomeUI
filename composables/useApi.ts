import { useCookie, useRuntimeConfig } from '#imports'

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

const configCache = new Map<string, { value: any, cachedAt: number }>()
const configRequests = new Map<string, Promise<any>>()
let configGeneration = 0

const invalidateConfigCache = () => {
  configGeneration++
  configCache.clear()
  configRequests.clear()
}

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
  const token = useCookie<string | null>('management_token', {
    sameSite: 'strict',
    secure: import.meta.client && window.location.protocol === 'https:'
  })

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
    const cached = configCache.get(cacheKey)
    const now = Date.now()
    if (cached && now - cached.cachedAt < 1000) return Promise.resolve(cached.value)

    const pendingRequest = configRequests.get(cacheKey)
    if (pendingRequest) return pendingRequest

    const generation = configGeneration
    const request = $fetch<any>(resolveUrl('/config'), {
      method: 'GET',
      headers: requestHeaders(options, activeToken),
      responseType: 'json',
      signal: options.signal
    }).then((configRoot) => {
      if (generation === configGeneration) configCache.set(cacheKey, { value: configRoot, cachedAt: Date.now() })
      return configRoot
    }).finally(() => {
      if (configRequests.get(cacheKey) === request) configRequests.delete(cacheKey)
    })
    configRequests.set(cacheKey, request)
    return request
  }

  const providerGroupsFromConfig = (configRoot: any, path: string) => {
    const family = path.slice(providerPathPrefix.length).split('?', 1)[0] || ''
    const groups = configRoot?.['api-keys']?.[family]
    return Array.isArray(groups) ? groups : []
  }

  const fetchAPI = async <T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const activeToken = requireToken(options.token)
    const method = options.method || (options.body === undefined ? 'GET' : 'POST')
    const pathWithoutQuery = path.split('?', 1)[0]
    const providerPath = pathWithoutQuery && providerPaths.has(pathWithoutQuery) ? pathWithoutQuery : ''

    try {
      if (method === 'GET' && providerPath) {
        const configRoot = await fetchConfig(options, activeToken)
        return providerGroupsFromConfig(configRoot, providerPath) as T
      }

      if (method !== 'GET') invalidateConfigCache()
      const response = await $fetch<T>(resolveUrl(path), {
        method,
        query: options.query,
        body: options.body as any,
        headers: requestHeaders(options, activeToken),
        responseType: options.responseType || 'json',
        signal: options.signal
      })
      if (method !== 'GET') invalidateConfigCache()
      return response
    } catch (error: any) {
      throw new ManagementApiError(errorMessage(error), error?.statusCode || error?.status, error?.data)
    }
  }

  const fetchRaw = async <T = unknown>(path: string, options: ApiRequestOptions = {}) => {
    const activeToken = requireToken(options.token)
    const url = resolveUrl(path)

    try {
      return await $fetch.raw<T>(url, {
        method: options.method || (options.body === undefined ? 'GET' : 'POST'),
        query: options.query,
        body: options.body as any,
        headers: requestHeaders(options, activeToken),
        responseType: options.responseType || 'json',
        signal: options.signal
      })
    } catch (error: any) {
      throw new ManagementApiError(errorMessage(error), error?.statusCode || error?.status, error?.data)
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
