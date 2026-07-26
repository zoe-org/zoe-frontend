import type { Me, Membership, MeTenant } from "@/lib/api/me"

export type AuthState = {
  isLoading: boolean
  isAuthenticated: boolean
  user: Me | null
  memberships: Membership[]
  activeTenantId: string | null
  activeTenant: MeTenant | null
  role: string | null
  features: string[]
  /** True quando o user logou mas ainda não tem nenhum tenant — onboarding pendente. */
  needsOnboarding: boolean
  /**
   * Admin da Zoe (grupo `zoe-admin` em `cognito:groups`) — espelha a policy
   * `ZoeAdmin` do backend. É só pra ESCONDER navegação: a autoridade continua
   * sendo o backend, que devolve 403 em `/api/admin/*` sem o grupo.
   */
  isZoeAdmin: boolean
  error: string | null
}

export type AuthActions = {
  /** Re-hidrata a partir do Cognito + /api/me. Chamar após signIn/confirmSignUp. */
  refresh: () => Promise<void>
  /** Troca o tenant ativo (persiste em localStorage e recarrega /api/me/tenant). */
  switchTenant: (tenantId: string) => Promise<void>
  signOut: () => Promise<void>
  /** Atalho para login mockado em ambiente sem Cognito. */
  devLogin: () => void
  hasFeature: (code: string) => boolean
}
