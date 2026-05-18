import { apiClient } from "@/lib/api"

export type TenantRole = "Owner" | "Admin" | "Manager" | "Viewer"

export type CreateTenantInput = {
  name: string
  slug: string
  /** Códigos de feature do catálogo a ativar imediatamente. */
  features?: string[]
}
export type CreateTenantResponse = {
  id: string
  name: string
  slug: string
  role: TenantRole
  features: string[]
}

export type TenantMember = {
  membershipId: string
  userId: string
  email: string
  name: string
  role: TenantRole
  joinedAt: string
}

export type CreateInviteInput = { email: string; role: TenantRole }
export type CreateInviteResponse = {
  id: string
  tenantId: string
  email: string
  role: TenantRole
  token: string
  expiresAt: string
}

export const tenantsApi = {
  /** Cria tenant + membership Owner para o user logado. Não requer tenant ativo. */
  create: (input: CreateTenantInput) =>
    apiClient.post<CreateTenantResponse>("/api/tenants", input, { noTenant: true }),

  listMembers: (tenantId: string) =>
    apiClient.get<TenantMember[]>(`/api/tenants/${tenantId}/members`, { tenantId }),

  removeMember: (tenantId: string, userId: string) =>
    apiClient.delete(`/api/tenants/${tenantId}/members/${userId}`, { tenantId }),

  createInvite: (tenantId: string, input: CreateInviteInput) =>
    apiClient.post<CreateInviteResponse>(`/api/tenants/${tenantId}/invites`, input, { tenantId }),
}
