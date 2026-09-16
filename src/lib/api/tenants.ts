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
/**
 * Resultado do envio do e-mail de convite. `Failed`/`Disabled` não invalidam o
 * convite — só significam que o link copiável deixa de ser redundante.
 */
export type EmailDeliveryStatus = "Sent" | "Failed" | "Disabled"

export type CreateInviteResponse = {
  id: string
  tenantId: string
  email: string
  role: TenantRole
  token: string
  expiresAt: string
  emailDelivery: EmailDeliveryStatus
}

/** Reenvio rotaciona o token — o `token` aqui é novo e o anterior morreu. */
export type ResendInviteResponse = {
  id: string
  email: string
  token: string
  expiresAt: string
  emailDelivery: EmailDeliveryStatus
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

  changeMemberRole: (tenantId: string, userId: string, role: TenantRole) =>
    apiClient.patch(`/api/tenants/${tenantId}/members/${userId}/role`, { role }, { tenantId }),

  listInvites: (tenantId: string) =>
    apiClient.get<PendingInvite[]>(`/api/tenants/${tenantId}/invites`, { tenantId }),

  createInvite: (tenantId: string, input: CreateInviteInput) =>
    apiClient.post<CreateInviteResponse>(`/api/tenants/${tenantId}/invites`, input, { tenantId }),

  resendInvite: (tenantId: string, inviteId: string) =>
    apiClient.post<ResendInviteResponse>(
      `/api/tenants/${tenantId}/invites/${inviteId}/resend`, undefined, { tenantId }),

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
    changeMemberRole: useMutation({
      mutationFn: (v: { userId: string; role: TenantRole }) =>
        tenantsApi.changeMemberRole(activeTenantId!, v.userId, v.role),
      onSuccess: invalidateMembers,
    }),
    createInvite: useMutation({
      mutationFn: (input: CreateInviteInput) => tenantsApi.createInvite(activeTenantId!, input),
      onSuccess: invalidateInvites,
    }),
    resendInvite: useMutation({
      mutationFn: (inviteId: string) => tenantsApi.resendInvite(activeTenantId!, inviteId),
      // Invalida porque o reenvio renova a validade — a flag `expired` da lista muda.
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
