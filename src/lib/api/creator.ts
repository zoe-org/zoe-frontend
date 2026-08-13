import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient, apiBlob } from "@/lib/api"
import { useAuth } from "@/features/auth/context"
import type { DeliveryStatus, EscrowState } from "@/lib/api/operations"

/**
 * Área do criador. Módulo separado de `operations.ts` de propósito: aqui **nada** leva
 * tenant. O criador não pertence a workspace nenhum, e o escopo de cada request é a
 * identidade dele — por isso todas as chamadas usam `noTenant`.
 */

export type CreatorDelivery = {
  deliveryId: string
  submittedUrl: string
  youtubeVideoId: string
  status: DeliveryStatus
  submissionAttempt: number
  submittedAt: string
  decisionNotes: string | null
}

export type CreatorEngagement = {
  contractId: string
  campaignId: string
  campaignName: string
  brandName: string
  modality: string
  contractStatus: string
  amountCents: number | null
  netToInfluencerCents: number | null
  escrowState: EscrowState | null
  canSubmitDelivery: boolean
  /** Já em português, vindo do backend — é a mesma regra do domínio, traduzida lá. */
  blockedReason: string | null
  deliveries: CreatorDelivery[]
}

export type CreatorWorkspace = {
  influencerId: string
  fullName: string
  email: string
  kycStatus: string
  canReceivePayout: boolean
  payoutBlockedReason: string | null
  engagements: CreatorEngagement[]
}

/**
 * O contrato como o criador o vê. As cláusulas chegam com os valores já substituídos — o
 * mesmo texto que a marca vê e que vai para o PDF, para que ele não leia um documento
 * diferente do que assina.
 */
export type CreatorContract = {
  contractId: string
  campaignId: string
  campaignName: string
  brandName: string
  modalityLabel: string
  status: string
  signedAt: string | null
  amountCents: number | null
  takeRateCents: number | null
  netToInfluencerCents: number | null
  takeRateBps: number | null
  escrowState: EscrowState | null
  clauses: CreatorContractClause[]
  fields: CreatorContractField[]
}

export type CreatorContractClause = {
  order: number
  title: string
  body: string
  /** Cláusula de sistema: imutável em qualquer nível de personalização (RN-O-038). */
  isSystem: boolean
}

export type CreatorContractField = {
  placeholder: string
  label: string
  value: string | null
}

export const creatorApi = {
  workspace: (opts?: { signal?: AbortSignal }) =>
    apiClient.get<CreatorWorkspace>("/api/creator/workspace", {
      noTenant: true,
      signal: opts?.signal,
    }),

  contract: (contractId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<CreatorContract>(`/api/creator/contracts/${contractId}`, {
      noTenant: true,
      signal: opts?.signal,
    }),

  /**
   * PDF do contrato. Buscado como blob e não por link direto: `<a href>` não carrega o
   * cabeçalho de autorização, e o endpoint é protegido.
   */
  contractDocument: (contractId: string) =>
    apiBlob(`/api/creator/contracts/${contractId}/document`, { noTenant: true }),

  submitDelivery: (body: { contractId: string; submittedUrl: string }) =>
    apiClient.post<{
      deliveryId: string
      status: DeliveryStatus
      escrowState: EscrowState | null
    }>("/api/creator/deliveries", body, { noTenant: true }),
}

export function useCreatorWorkspace() {
  const { isAuthenticated, isCreator } = useAuth()
  return useQuery({
    // A key não leva tenant porque não existe tenant nesta área.
    queryKey: ["creator-workspace"],
    queryFn: ({ signal }) => creatorApi.workspace({ signal }),
    enabled: isAuthenticated && isCreator,
    staleTime: 30_000,
    retry: false,
  })
}

export function useCreatorContract(contractId: string | null) {
  const { isAuthenticated, isCreator } = useAuth()
  return useQuery({
    queryKey: ["creator-contract", contractId],
    queryFn: ({ signal }) => creatorApi.contract(contractId!, { signal }),
    enabled: isAuthenticated && isCreator && Boolean(contractId),
    staleTime: 60_000,
    retry: false,
  })
}

export function useCreatorMutations() {
  const qc = useQueryClient()
  return {
    submit: useMutation({
      mutationFn: (body: { contractId: string; submittedUrl: string }) =>
        creatorApi.submitDelivery(body),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-workspace"] }),
    }),
  }
}
