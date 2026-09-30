import { useCookie, useRuntimeConfig, useState } from '#imports'

export type UserApiQueryValue = string | number | boolean | null | undefined
export type UserApiQuery = Record<string, UserApiQueryValue>

export interface UserApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: UserApiQuery
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  auth?: boolean
}

export interface UserEmailStatus {
  configured: boolean
  verified: boolean
  masked: string
  recovery_ready: boolean
}

export interface UserPasskey {
  id: string
  name?: string
  created_at?: string
  updated_at?: string
}

export interface UserAccount {
  id: number
  username: string
  credits: number
  totp_enabled: boolean
  passkey_count: number
  email_status: UserEmailStatus
  passkeys?: UserPasskey[]
  created_at?: string
  updated_at?: string
}

export interface UserSessionResponse {
  token: string
  expires_at: string
  user: UserAccount
}

export interface UserCapabilities {
  email_registration?: boolean
  email_verification?: boolean
  password_recovery?: boolean
  model_catalog?: boolean
}

export interface UserServerInfo {
  home_version?: string
  home_commit?: string
  home_build_date?: string
}

export interface UserApiKey {
  id?: number
  display_name?: string | null
  api_key: string
  channels: number[]
  model_groups: number[]
  created_at?: string
  updated_at?: string
}

export interface BillingTopItem {
  id: string
  label: string
  amount: number
  request_count: number
}

export interface BillingOverview {
  current_balance: number
  today_spend: number
  month_spend: number
  top_models: BillingTopItem[]
}

export interface BillingCharge {
  id: number
  created_at: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  amount: number
  balance_after: number
  request_id: string
}

export interface UserModel {
  id: string
  display_name?: string
  description?: string
  version?: string
  owned_by?: string
  type?: string
  providers?: string[]
  context_length?: number
  max_output_tokens?: number
  modalities?: {
    status: string
    input?: string[]
    output?: string[]
  }
  capabilities?: {
    reasoning?: { status: string; levels?: string[]; budget?: Record<string, unknown> }
    tool_calling?: { status: string }
    structured_output?: { status: string }
    parameters?: string[]
    generation_methods?: string[]
  }
  pricing?: {
    status: string
    providers?: Array<{
      provider: string
      tiers: Array<{
        service_tier: string
        is_default?: boolean
        rungs: Array<{
          min_input_tokens: number
          input_price_per_million: number
          output_price_per_million: number
          cache_read_price_per_million: number
          cache_write_price_per_million: number
          request_price: number
        }>
      }>
    }>
  }
  availability?: {
    status: string
    sample_count: number
    availability_rate?: number
    avg_latency_ms?: number
    avg_ttft_ms?: number
    last_observed_at?: string
  }
}

export class UserApiError extends Error {
  statusCode?: number
  code?: string
  data?: unknown

  constructor(message: string, statusCode?: number, code?: string, data?: unknown) {
    super(message)
    this.name = 'UserApiError'
    this.statusCode = statusCode
    this.code = code
    this.data = data
  }
}

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '')
const persistentSessionKey = 'home-management-center.userSession'
const temporarySessionKey = 'home-management-center.temporaryUserSession'

type StoredUserSession = UserSessionResponse & { baseUrl?: string; rememberSession?: boolean }

const normalizeUser = (value: any): UserAccount => ({
  id: Number(value?.id) || 0,
  username: String(value?.username || ''),
  credits: Number(value?.credits) || 0,
  totp_enabled: Boolean(value?.totp_enabled ?? value?.totpEnabled),
  passkey_count: Number(value?.passkey_count ?? value?.passkeyCount ?? value?.passkeys?.length) || 0,
  email_status: {
    configured: Boolean(value?.email_status?.configured ?? value?.emailStatus?.configured),
    verified: Boolean(value?.email_status?.verified ?? value?.emailStatus?.verified),
    masked: String(value?.email_status?.masked ?? value?.emailStatus?.masked ?? ''),
    recovery_ready: Boolean(value?.email_status?.recovery_ready ?? value?.emailStatus?.recoveryReady)
  },
  passkeys: Array.isArray(value?.passkeys) ? value.passkeys.map((item: any) => ({ id: String(item.id || ''), name: item.name || undefined, created_at: item.created_at ?? item.createdAt, updated_at: item.updated_at ?? item.updatedAt })) : [],
  created_at: value?.created_at ?? value?.createdAt,
  updated_at: value?.updated_at ?? value?.updatedAt
})

const normalizeSession = (value: any): UserSessionResponse => ({ token: String(value?.token || ''), expires_at: String(value?.expires_at ?? value?.expiresAt ?? ''), user: normalizeUser(value?.user) })

const apiErrorDetails = (error: any) => {
  const data = error?.data
  const nested = data?.error && typeof data.error === 'object' ? data.error : null
  const message = data?.message || nested?.message || (typeof data?.error === 'string' ? data.error : '') || error?.statusMessage || error?.message || 'User API request failed'
  const code = data?.code || nested?.code || (typeof data?.error === 'string' ? data.error : undefined)
  return { message: String(message), code: code ? String(code) : undefined }
}

const base64URLToBytes = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

const bytesToBase64URL = (value: ArrayBuffer) => {
  const bytes = new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const creationOptions = (value: any): PublicKeyCredentialCreationOptions => ({
  ...value,
  challenge: base64URLToBytes(value.challenge),
  user: { ...value.user, id: base64URLToBytes(value.user.id) },
  excludeCredentials: Array.isArray(value.excludeCredentials)
    ? value.excludeCredentials.map((item: any) => ({ ...item, id: base64URLToBytes(item.id) }))
    : undefined
})

const requestOptions = (value: any): PublicKeyCredentialRequestOptions => ({
  ...value,
  challenge: base64URLToBytes(value.challenge),
  allowCredentials: Array.isArray(value.allowCredentials)
    ? value.allowCredentials.map((item: any) => ({ ...item, id: base64URLToBytes(item.id) }))
    : undefined
})

const credentialJSON = (credential: PublicKeyCredential) => {
  const response = credential.response
  const payload: Record<string, unknown> = {
    id: credential.id,
    rawId: bytesToBase64URL(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults()
  }
  if (response instanceof AuthenticatorAttestationResponse) {
    payload.response = {
      attestationObject: bytesToBase64URL(response.attestationObject),
      clientDataJSON: bytesToBase64URL(response.clientDataJSON),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : undefined
    }
  } else if (response instanceof AuthenticatorAssertionResponse) {
    payload.response = {
      authenticatorData: bytesToBase64URL(response.authenticatorData),
      clientDataJSON: bytesToBase64URL(response.clientDataJSON),
      signature: bytesToBase64URL(response.signature),
      userHandle: response.userHandle ? bytesToBase64URL(response.userHandle) : null
    }
  }
  return payload
}

export const useUserApi = () => {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('user_token', {
    sameSite: 'strict',
    secure: import.meta.client && window.location.protocol === 'https:'
  })
  const tokenExpiresAt = useCookie<string | null>('user_token_expires_at', {
    sameSite: 'strict',
    secure: import.meta.client && window.location.protocol === 'https:'
  })
  const rememberSession = useCookie<boolean>('user_remember_session', {
    sameSite: 'strict',
    secure: import.meta.client && window.location.protocol === 'https:',
    default: () => false
  })
  const currentUser = useState<UserAccount | null>('user-account', () => null)
  const sessionHydrated = useState<boolean>('user-session-hydrated', () => false)
  const capabilities = useState<UserCapabilities>('user-capabilities', () => ({}))
  const serverInfo = useState<UserServerInfo>('user-server-info', () => ({}))

  const configuredURL = String(config.public.apiUrl || '').trim().replace(/\/+$/, '')
  const managementBase = `/${trimSlashes(String(config.public.apiBase || '/v0/management'))}`
  const normalizedURL = configuredURL.replace(/^(https?:\/\/)localhost(?=:\d+|\/|$)/i, (_, scheme: string) => `${scheme}127.0.0.1`)
  const origin = normalizedURL.endsWith(managementBase)
    ? normalizedURL.slice(0, -managementBase.length)
    : normalizedURL.replace(/\/v0\/management$/i, '')
  const apiBase = origin.endsWith('/user') ? origin : `${origin}/user`

  const resolveUrl = (path: string) => {
    if (/^https?:\/\//i.test(path)) return path
    const cleanPath = trimSlashes(path)
    return cleanPath ? `${apiBase}/${cleanPath}` : apiBase
  }

  const clearSession = () => {
    if (import.meta.client) { localStorage.removeItem(persistentSessionKey); sessionStorage.removeItem(temporarySessionKey) }
    token.value = null
    tokenExpiresAt.value = null
    rememberSession.value = false
    currentUser.value = null
  }

  const saveSession = (sessionValue: UserSessionResponse) => {
    const session = normalizeSession(sessionValue)
    const expiresAt = new Date(session.expires_at)
    const cookieOptions = {
      sameSite: 'strict' as const,
      secure: import.meta.client && window.location.protocol === 'https:',
      ...(Number.isFinite(expiresAt.getTime()) ? { expires: expiresAt } : {})
    }
    useCookie<string | null>('user_token', cookieOptions).value = session.token
    useCookie<string | null>('user_token_expires_at', cookieOptions).value = session.expires_at
    useCookie<boolean>('user_remember_session', cookieOptions).value = true
    token.value = session.token
    tokenExpiresAt.value = session.expires_at
    rememberSession.value = true
    currentUser.value = session.user
    if (import.meta.client) {
      const stored: StoredUserSession = { ...session, baseUrl: apiBase, rememberSession: true }
      localStorage.setItem(persistentSessionKey, JSON.stringify(stored))
      sessionStorage.removeItem(temporarySessionKey)
    }
  }

  const hydrateSession = () => {
    if (!import.meta.client || sessionHydrated.value) return
    sessionHydrated.value = true
    for (const [storage, key, remembered] of [[localStorage, persistentSessionKey, true], [sessionStorage, temporarySessionKey, false]] as const) {
      try {
        const raw = storage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        const normalized = normalizeSession(parsed)
        const expiry = new Date(normalized.expires_at)
        if (!normalized.token || !Number.isFinite(expiry.getTime()) || expiry <= new Date()) { storage.removeItem(key); continue }
        token.value = normalized.token; tokenExpiresAt.value = normalized.expires_at; rememberSession.value = true; currentUser.value = normalized.user
        if (!remembered) {
          localStorage.setItem(persistentSessionKey, JSON.stringify({ ...normalized, baseUrl: apiBase, rememberSession: true }))
          sessionStorage.removeItem(temporarySessionKey)
        }
        break
      } catch { storage.removeItem(key) }
    }
  }

  const fetchAPI = async <T = unknown>(path: string, options: UserApiRequestOptions = {}): Promise<T> => {
    const headers = new Headers(options.headers || {})
    const requiresAuth = options.auth !== false
    if (requiresAuth) {
      const activeToken = String(token.value || '').trim()
      if (!activeToken) throw new UserApiError('Please sign in to continue.', 401, 'bearer_token_required')
      headers.set('Authorization', `Bearer ${activeToken}`)
    }
    if (options.body !== undefined && options.body !== null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

    try {
      return await $fetch<T>(resolveUrl(path), {
        method: options.method || (options.body === undefined ? 'GET' : 'POST'),
        query: options.query,
        body: options.body as any,
        headers,
        signal: options.signal
      })
    } catch (error: any) {
      const details = apiErrorDetails(error)
      const statusCode = error?.statusCode || error?.status
      if (requiresAuth && statusCode === 401 && !['totp_required', 'passkey_required', 'invalid_totp'].includes(details.code || '')) clearSession()
      throw new UserApiError(details.message, statusCode, details.code, error?.data)
    }
  }

  const loadCapabilities = async () => {
    const response = await fetchAPI<{ capabilities?: UserCapabilities; server_info?: UserServerInfo }>('/capabilities', { auth: false })
    capabilities.value = response.capabilities || {}
    serverInfo.value = response.server_info || {}
    return response
  }

  const loadCurrentUser = async () => {
    const response = await fetchAPI<{ user: UserAccount }>('/me')
    currentUser.value = normalizeUser(response.user)
    return currentUser.value
  }

  const login = async (username: string, password: string, totpCode?: string) => {
    const response = await fetchAPI<UserSessionResponse>(totpCode ? '/login/totp' : '/login', {
      method: 'POST',
      auth: false,
      body: { username, password, ...(totpCode ? { totp_code: totpCode } : {}) }
    })
    saveSession(response)
    return response
  }

  const loginWithPasskey = async (username: string) => {
    if (!import.meta.client || !window.PublicKeyCredential) throw new UserApiError('Passkeys are not supported by this browser.')
    const begin = await fetchAPI<{ challenge_id: string; publicKey: any }>('/login/passkey/begin', {
      method: 'POST', auth: false, body: { username }
    })
    const credential = await navigator.credentials.get({ publicKey: requestOptions(begin.publicKey) }) as PublicKeyCredential | null
    if (!credential) throw new UserApiError('Passkey authentication was cancelled.')
    const response = await fetchAPI<UserSessionResponse>('/login/passkey', {
      method: 'POST', auth: false, body: { username, challenge_id: begin.challenge_id, credential: credentialJSON(credential) }
    })
    saveSession(response)
    return response
  }

  const registerPasskey = async (name = '') => {
    if (!import.meta.client || !window.PublicKeyCredential) throw new UserApiError('Passkeys are not supported by this browser.')
    const begin = await fetchAPI<{ challenge_id: string; publicKey: any }>('/passkeys/begin', { method: 'POST', body: {} })
    const credential = await navigator.credentials.create({ publicKey: creationOptions(begin.publicKey) }) as PublicKeyCredential | null
    if (!credential) throw new UserApiError('Passkey registration was cancelled.')
    const response = await fetchAPI<{ passkey: UserPasskey }>('/passkeys', {
      method: 'POST', body: { ...(name.trim() ? { name: name.trim() } : {}), challenge_id: begin.challenge_id, credential: credentialJSON(credential) }
    })
    await loadCurrentUser()
    return response.passkey
  }

  return {
    apiBase,
    token,
    tokenExpiresAt,
    rememberSession,
    currentUser,
    capabilities,
    serverInfo,
    resolveUrl,
    fetchAPI,
    clearSession,
    saveSession,
    hydrateSession,
    loadCapabilities,
    loadCurrentUser,
    login,
    loginWithPasskey,
    registerPasskey
  }
}
