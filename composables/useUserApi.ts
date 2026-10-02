import { storeToRefs } from 'pinia'
import { useUserSessionStore } from '~/stores/userSession'

export type {
  UserApiQueryValue,
  UserApiQuery,
  UserApiRequestOptions,
  UserEmailStatus,
  UserPasskey,
  UserAccount,
  UserSessionResponse,
  UserCapabilities,
  UserServerInfo,
  UserApiKey,
  BillingTopItem,
  BillingOverview,
  BillingBalanceRecord,
  BillingCharge,
  UserModel
} from '~/stores/userSession'
export { UserApiError } from '~/stores/userSession'

export const useUserApi = () => {
  const store = useUserSessionStore()
  const { token, tokenExpiresAt, rememberSession, currentUser, capabilities, serverInfo } = storeToRefs(store)

  return {
    apiBase: store.apiBase,
    token,
    tokenExpiresAt,
    rememberSession,
    currentUser,
    capabilities,
    serverInfo,
    resolveUrl: store.resolveUrl,
    fetchAPI: store.fetchAPI,
    clearSession: store.clearSession,
    saveSession: store.saveSession,
    hydrateSession: store.hydrateSession,
    loadCapabilities: store.loadCapabilities,
    loadCurrentUser: store.loadCurrentUser,
    login: store.login,
    loginWithPasskey: store.loginWithPasskey,
    registerPasskey: store.registerPasskey
  }
}
