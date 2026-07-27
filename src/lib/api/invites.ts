import { apiClient } from "@/lib/api"

export type AcceptInviteResponse = {
  tenantId: string
  tenantName: string
  role: string
}

export type InvitePreview = {
  email: string
  tenantName: string
  inviterName: string
  expired: boolean
  accepted: boolean
}

export const invitesApi = {
  /** Prévia pública do convite pelo token (anônima — não exige login). */
  preview: (token: string) =>
    apiClient.get<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`, { noTenant: true }),

  accept: (token: string) =>
    apiClient.post<AcceptInviteResponse>("/api/invites/accept", { token }, { noTenant: true }),
}
