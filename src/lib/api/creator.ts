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

/** O corte enviado antes de publicar — primeiro dos dois portões. */
export type CreatorDraft = {
  draftId: string
  /** AwaitingReview | Approved | ChangesRequested */
  status: string
  revision: number
  fileName: string | null
  submittedAt: string
  /** O que a marca pediu para mudar. É o que o criador lê para refazer. */
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
  /** Nulo enquanto nenhum corte foi enviado — é quando a tela pede o arquivo. */
  draft: CreatorDraft | null
  requiresDraftApproval: boolean
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
  /**
   * Se a tela pode oferecer o reenvio do aviso. A Clicksign não expõe link de assinatura
   * pela API — o caminho até o documento é o e-mail que ela dispara.
   */
  canResendSignature: boolean
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

/**
 * Início do cadastro da conta de recebimento.
 *
 * `onboardingUrl` é do provedor, **de uso único e expira em minutos** — por isso não se
 * guarda: cada clique pede um novo.
 */
export type StartPayoutOnboarding = {
  onboardingUrl: string | null
  expiresAt: string | null
  accountCreated: boolean
  kycStatus: string
  /** Preenchido quando o provedor recusou ou não há provedor no ambiente. */
  message: string | null
}

export type PayoutStatus = {
  hasAccount: boolean
  /** A única pergunta que libera dinheiro. */
  canReceivePayout: boolean
  kycStatus: string
  pendingRequirements: string[]
  disabledReason: string | null
}

export const creatorApi = {
  /** Passo 1 do envio: autoriza a subida e devolve para onde mandar o arquivo. */
  requestDraftUpload: (body: { contractId: string; fileName: string; contentType: string }) =>
    apiClient.post<{ uploadUrl: string; mediaKey: string; expiresAt: string }>(
      "/api/creator/deliveries/draft-upload", body, { noTenant: true }),

  /** Passo 3: confirma que subiu e põe na fila de revisão da marca. */
  submitDraft: (body: {
    contractId: string
    mediaKey: string
    fileName?: string
    sizeBytes?: number
    creatorNotes?: string
  }) =>
    apiClient.post<{ draftId: string; status: string; revision: number }>(
      "/api/creator/deliveries/draft", body, { noTenant: true }),

  resendSignature: (contractId: string) =>
    apiClient.post<{ sent: boolean; message: string | null }>(
      `/api/creator/contracts/${contractId}/resend-signature`, {}, { noTenant: true }),

  startPayoutOnboarding: () =>
    apiClient.post<StartPayoutOnboarding>("/api/creator/payout-account", {}, { noTenant: true }),

  // POST apesar de parecer leitura: ele escreve. A verificação acontece do lado do
  // provedor sem avisar ninguém, então alguém precisa perguntar.
  syncPayoutStatus: () =>
    apiClient.post<PayoutStatus>("/api/creator/payout-account/sync", {}, { noTenant: true }),

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

/**
 * Envio do corte em três passos: autorizar, subir, confirmar.
 *
 * O passo 2 vai DIRETO para o storage, fora da API — vídeo é grande, e passá-lo por
 * dentro do backend prenderia por minutos o mesmo worker que atende todo o resto.
 */
export function useDraftUpload() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (v: { contractId: string; file: File; notes?: string }) => {
      const contentType = v.file.type || "video/mp4"

      const auth = await creatorApi.requestDraftUpload({
        contractId: v.contractId,
        fileName: v.file.name,
        contentType,
      })

      // O Content-Type tem de bater com o que foi assinado: o storage recusa a escrita
      // se divergir, e a mensagem dele não diria que o problema é esse.
      const upload = await fetch(auth.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: v.file,
      })

      if (!upload.ok) {
        throw new Error(
          "O arquivo não subiu. Verifique sua conexão e tente de novo — nada foi perdido.",
        )
      }

      return creatorApi.submitDraft({
        contractId: v.contractId,
        mediaKey: auth.mediaKey,
        fileName: v.file.name,
        sizeBytes: v.file.size,
        creatorNotes: v.notes?.trim() || undefined,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-workspace"] }),
  })
}

export function useResendSignature(contractId: string) {
  return useMutation({
    mutationFn: () => creatorApi.resendSignature(contractId),
  })
}

export function usePayoutMutations() {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["creator-workspace"] })
    qc.invalidateQueries({ queryKey: ["creator-payout"] })
  }

  return {
    start: useMutation({
      mutationFn: () => creatorApi.startPayoutOnboarding(),
      onSuccess: refresh,
    }),
    sync: useMutation({
      mutationFn: () => creatorApi.syncPayoutStatus(),
      onSuccess: refresh,
    }),
  }
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
