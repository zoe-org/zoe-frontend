import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

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

/** Marca atribuída a um membro. Lista vazia no membro = todas as marcas. */
export type MemberBrand = { brandId: string; name: string }

export type TenantMember = {
  membershipId: string
  userId: string
  email: string
  name: string
  role: TenantRole
  joinedAt: string
  brands: MemberBrand[]
}

export type CreateInviteInput = {
  email: string
  role: TenantRole
  /** Marcas a atribuir no aceite. Vazio/ausente = todas. */
  brandIds?: string[]
  message?: string
}
export type CreateInviteResponse = {
  id: string
  tenantId: string
  email: string
  role: TenantRole
  token: string
  expiresAt: string
}

// Convite pendente (aba "Convites"). Espelha PendingInviteDto do backend.
export type PendingInvite = {
  id: string
  email: string
  role: TenantRole
  invitedByName: string
  createdAt: string
  expiresAt: string
  expired: boolean
}

export const tenantsApi = {
  /** Cria tenant + membership Owner para o user logado. Não requer tenant ativo. */
  create: (input: CreateTenantInput) =>
    apiClient.post<CreateTenantResponse>("/api/tenants", input, { noTenant: true }),

  listMembers: (tenantId: string) =>
    apiClient.get<TenantMember[]>(`/api/tenants/${tenantId}/members`, { tenantId }),

  removeMember: (tenantId: string, userId: string) =>
    apiClient.delete(`/api/tenants/${tenantId}/members/${userId}`, { tenantId }),

  listInvites: (tenantId: string) =>
    apiClient.get<PendingInvite[]>(`/api/tenants/${tenantId}/invites`, { tenantId }),

  createInvite: (tenantId: string, input: CreateInviteInput) =>
    apiClient.post<CreateInviteResponse>(`/api/tenants/${tenantId}/invites`, input, { tenantId }),

  revokeInvite: (tenantId: string, inviteId: string) =>
    apiClient.delete(`/api/tenants/${tenantId}/invites/${inviteId}`, { tenantId }),

  // Lista vazia limpa o escopo (membro volta a "todas as marcas").
  setMemberBrands: (tenantId: string, userId: string, brandIds: string[]) =>
    apiClient.put(`/api/tenants/${tenantId}/members/${userId}/brands`, { brandIds }, { tenantId }),
}

// ── hooks (tenantId na key = isolamento por tenant) ────────────────────────

export function useMembers() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["members", activeTenantId],
    queryFn: () => tenantsApi.listMembers(activeTenantId!),
    enabled: Boolean(activeTenantId),
    staleTime: 30_000,
  })
}

/** Convites são admin-only (403 sem permissão) — só busca quando `enabled`. */
export function useInvites(enabled: boolean) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["invites", activeTenantId],
    queryFn: () => tenantsApi.listInvites(activeTenantId!),
    enabled: Boolean(activeTenantId && enabled),
    staleTime: 30_000,
  })
}

export function useTeamMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  const invalidateMembers = () => qc.invalidateQueries({ queryKey: ["members", activeTenantId] })
  const invalidateInvites = () => qc.invalidateQueries({ queryKey: ["invites", activeTenantId] })
  return {
    removeMember: useMutation({
      mutationFn: (userId: string) => tenantsApi.removeMember(activeTenantId!, userId),
      onSuccess: invalidateMembers,
    }),
    createInvite: useMutation({
      mutationFn: (input: CreateInviteInput) => tenantsApi.createInvite(activeTenantId!, input),
      onSuccess: invalidateInvites,
    }),
    revokeInvite: useMutation({
      mutationFn: (inviteId: string) => tenantsApi.revokeInvite(activeTenantId!, inviteId),
      onSuccess: invalidateInvites,
    }),
    setMemberBrands: useMutation({
      mutationFn: (v: { userId: string; brandIds: string[] }) =>
        tenantsApi.setMemberBrands(activeTenantId!, v.userId, v.brandIds),
      onSuccess: invalidateMembers,
    }),
  }
}
