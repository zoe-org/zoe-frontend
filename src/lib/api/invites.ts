import { apiClient } from "@/lib/api"

export type AcceptInviteResponse = {
  tenantId: string
  tenantName: string
  role: string
}

export const invitesApi = {
  accept: (token: string) =>
    apiClient.post<AcceptInviteResponse>("/api/invites/accept", { token }, { noTenant: true }),
}
