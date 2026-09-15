import { apiClient } from "@/lib/api"

export type Membership = {
  tenantId: string
  tenantName: string
  tenantSlug: string | null
  role: string
}

export type Me = {
  id: string
  email: string
  name: string
  /**
   * `Tenant` ou `Influencer`. Distingue duas contas que parecem idênticas — as duas com
   * zero memberships: o criador convidado, que nunca terá workspace, e quem ainda não
   * criou o seu. Sem isso o criador seria mandado para o onboarding de workspace.
   */
  userType: string
  memberships: Membership[]
}

/** Preferências de aviso do próprio usuário no workspace ativo. */
export type NotificationPreferences = {
  /** Recebe por e-mail os avisos do Operations (revisões, assinatura, prazos, reserva, convite aceito). */
  operationsEmail: boolean
}

export type TenantInfo = {
  id: string
  name: string
  slug: string | null
  status: string
  /** CNPJ já com máscara. Nulo enquanto ninguém informar. */
  taxId: string | null
}

export type MeTenant = {
  tenant: TenantInfo
  role: string
  features: string[]
}

export const meApi = {
  /** Lazy-provisiona o User no backend e devolve memberships. Não requer X-Tenant-Id. */
  get: () => apiClient.get<Me>("/api/me", { noTenant: true }),
  /** Contexto do tenant ativo. Requer X-Tenant-Id (injetado pelo client). */
  getTenant: (tenantId?: string) =>
    apiClient.get<MeTenant>("/api/me/tenant", tenantId ? { tenantId } : undefined),

  /** CNPJ do contratante. Aceita com ou sem máscara; o backend normaliza e valida. */
  setTaxId: (tenantId: string, taxId: string) =>
    apiClient.put<{ taxId: string; formatted: string }>(
      `/api/tenants/${tenantId}/tax-id`, { taxId }),

  /** Preferências de aviso no workspace ativo (X-Tenant-Id injetado pelo client). */
  getNotifications: () => apiClient.get<NotificationPreferences>("/api/me/tenant/notifications"),
  setNotifications: (prefs: NotificationPreferences) =>
    apiClient.put<NotificationPreferences>("/api/me/tenant/notifications", prefs),
}
