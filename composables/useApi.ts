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
  const configuredOrigin = String(config.public.apiUrl || '').replace(/\/+$/, '').replace(/^(https?:\/\/)localhost(?=:\d+|\/|$)/i, (_, scheme: string) => `${scheme}127.0.0.1`)
  const configuredBase = `/${trimSlashes(String(config.public.apiBase || '/v0/management'))}`

  const apiBase = (() => {
    if (!configuredOrigin) return configuredBase
    if (configuredOrigin.endsWith(configuredBase)) return configuredOrigin
    return `${configuredOrigin}${configuredBase}`
  })()

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
    if (cleanPath.startsWith(configuredBase)) cleanPath = cleanPath.slice(configuredBase.length)
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

  const fetchAPI = async <T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const activeToken = requireToken(options.token)
    const url = resolveUrl(path)

    try {
      return await $fetch<T>(url, {
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
