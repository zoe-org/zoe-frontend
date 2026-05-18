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
  memberships: Membership[]
}

export type TenantInfo = {
  id: string
  name: string
  slug: string | null
  status: string
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
}
