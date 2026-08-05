import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

/** Slug da feature que gateia o módulo inteiro no backend (`[RequiresFeature]`). */
export const OPERATIONS_FEATURE = "operations"

// Espelha ListRosterResponse do zoe-api (GET /api/operations/influencers).
// camelCase porque a API serializa assim — mesma convenção de brands.ts.
export type RosterItem = {
  /** Id do VÍNCULO com este workspace. É o que se edita/remove. */
  tenantInfluencerId: string
  /** Id da PESSOA, global na plataforma. Compartilhado entre tenants. */
  influencerId: string
  email: string
  fullName: string
  displayName: string | null
  countryCode: string | null
  /** InfluencerKycStatus: NotStarted | Pending | Verified | Rejected. */
  kycStatus: string
  hasStripeAccount: boolean
  /** TenantInfluencerStatus: Active | Paused | Archived. */
  status: string
  addedAt: string
  contractCount: number
}

export type ListRosterResponse = { items: RosterItem[] }

export type AddInfluencerBody = {
  email: string
  fullName: string
  countryCode?: string
  displayName?: string
}

export type AddInfluencerResponse = {
  influencerId: string
  tenantInfluencerId: string
  email: string
  fullName: string
  kycStatus: string
  /** false = a pessoa já existia na plataforma e só o vínculo foi criado. */
  created: boolean
}

/**
 * O KYC é gate de RECEBIMENTO, não de entrada (RN-O-012): o criador pode assinar
 * contrato e produzir sem KYC aprovado — só não recebe. Por isso a tela mostra o
 * estado sem bloquear nada, e esta função responde só a pergunta do pagamento.
 */
export function canReceivePayout(item: Pick<RosterItem, "kycStatus" | "hasStripeAccount">): boolean {
  return item.kycStatus === "Verified" && item.hasStripeAccount
}

/** Por que o criador ainda não pode receber. `null` = pode. */
export function payoutBlockReason(
  item: Pick<RosterItem, "kycStatus" | "hasStripeAccount">,
): string | null {
  if (canReceivePayout(item)) return null
  if (item.kycStatus === "Rejected") return "KYC recusado"
  if (item.kycStatus !== "Verified") return "KYC pendente"
  return "sem conta de recebimento"
}

// ————————————————————————————— Campanhas —————————————————————————————

/** Formata centavos em BRL. Dinheiro chega inteiro da API e só vira texto aqui. */
export function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  })
}

export type CampaignSummary = {
  campaignId: string
  name: string
  modality: string
  /** CampaignStatus: Draft | Active | Completed | Cancelled. */
  status: string
  supportsEscrow: boolean
  tenantBrandId: string | null
  /** Nome da marca vinculada, ou o texto livre de quem não tem Intelligence. */
  brandName: string | null
  startsAt: string | null
  endsAt: string | null
  budgetCents: number
  contractCount: number
  influencerCount: number
  deliveryCount: number
  escrowGmvCents: number
  createdAt: string
}

export type ListCampaignsResponse = { items: CampaignSummary[] }

export type CampaignContract = {
  contractId: string
  influencerId: string
  influencerName: string
  status: string
  usesEscrow: boolean
  escrowAmountCents: number | null
  escrowState: string | null
  signedAt: string | null
}

export type CampaignDelivery = {
  deliveryId: string
  contractId: string
  influencerName: string
  submittedUrl: string
  status: string
  submissionAttempt: number
  submittedAt: string
  reviewDueAt: string | null
  isReviewOverdue: boolean
}

export type CampaignDetail = Omit<CampaignSummary, "contractCount"> & {
  notes: string | null
  contracts: CampaignContract[]
  deliveries: CampaignDelivery[]
}

export type CreateCampaignBody = {
  name: string
  modality: string
  tenantBrandId?: string
  brandLabel?: string
  startsAt?: string
  endsAt?: string
  budgetCents?: number
  notes?: string
}

export type CampaignTransition = "Activate" | "Complete" | "Cancel"

export type UpdateCampaignBody = {
  name?: string
  tenantBrandId?: string
  brandLabel?: string
  startsAt?: string
  endsAt?: string
  budgetCents?: number
  notes?: string
  transition?: CampaignTransition
}

// ————————————————————————————— Contratos —————————————————————————————

/**
 * Modalidades na ordem de `ContractModality` do domínio. Espelho, não fonte:
 * a autoridade é o backend, que revalida tudo e recusa explicitamente. Isto existe
 * só para a tela conseguir EXPLICAR antes de mandar — sem isso o usuário escolheria
 * Afiliado, ligaria custódia e levaria um 400 sem entender o motivo.
 */
export const CONTRACT_MODALITIES = [
  "Publipost", "Ambassador", "Barter", "Affiliate", "License",
  "Ugc", "Events", "Cocreation", "SocialManagement", "Exclusivity",
] as const

export type ContractModality = (typeof CONTRACT_MODALITIES)[number]

export type EscrowSupport = "Supported" | "NoFinancialFlow" | "RequiresMilestoneEscrow"

/** Espelha `ContractModalityRules.Support` (RN-O-039). */
export const MODALITY_ESCROW: Record<ContractModality, EscrowSupport> = {
  // Pagamento único, entrega discreta — o modelo que o MVP implementa.
  Publipost: "Supported",
  Ugc: "Supported",
  Events: "Supported",
  // Produtos por divulgação: sem dinheiro, logo sem custódia.
  Barter: "NoFinancialFlow",
  // Comissão recorrente, fee mensal, royalties, vigência longa.
  Affiliate: "RequiresMilestoneEscrow",
  Ambassador: "RequiresMilestoneEscrow",
  Cocreation: "RequiresMilestoneEscrow",
  License: "RequiresMilestoneEscrow",
  SocialManagement: "RequiresMilestoneEscrow",
  Exclusivity: "RequiresMilestoneEscrow",
}

export function supportsEscrow(modality: string): boolean {
  return MODALITY_ESCROW[modality as ContractModality] === "Supported"
}

/**
 * Modalidades que uma campanha aceita: as que têm custódia e a permuta, que não tem
 * fluxo financeiro. As que exigem custódia por etapas ficam fora do seletor inteiro —
 * oferecer e recusar depois seria teatro, e o backend também as recusa.
 */
export const CAMPAIGN_MODALITIES = CONTRACT_MODALITIES.filter(
  (m) => MODALITY_ESCROW[m] !== "RequiresMilestoneEscrow",
)

/**
 * Por que esta modalidade não aceita custódia. `null` = aceita.
 *
 * Os dois motivos são diferentes e a tela precisa distingui-los: permuta nunca
 * vai ter custódia porque não há dinheiro; as outras vão ter quando o escrow por
 * milestone existir. Tratar as duas como "não dá" esconderia um roadmap.
 */
export function escrowRejectionReason(modality: string): string | null {
  switch (MODALITY_ESCROW[modality as ContractModality]) {
    case "Supported":
      return null
    case "NoFinancialFlow":
      return "Permuta não tem fluxo financeiro: o contrato e o fluxo de entrega existem, mas não há valor a custodiar."
    default:
      return "Esta modalidade exige custódia por etapas ou recorrente, que ainda não existe. O contrato pode ser criado sem custódia."
  }
}

// Espelha ListContractsResponse (GET /api/operations/contracts).
export type ContractSummary = {
  contractId: string
  influencerId: string
  influencerName: string
  modality: string
  /** Código do híbrido (H01–H11) quando o contrato combina modalidades. */
  hybridCode: string | null
  /** ContractStatus: Draft | SentForSignature | Signed | Cancelled. */
  status: string
  usesEscrow: boolean
  templateVersion: number
  /** false = nenhum contrato desta modalidade sai para assinatura. */
  templateLegalReviewed: boolean
  signedAt: string | null
  escrowAccountId: string | null
  /** EscrowState, ou null quando o contrato ainda não tem custódia aberta. */
  escrowState: string | null
  createdAt: string
}

export type ListContractsResponse = { items: ContractSummary[] }

export type CreateContractBody = {
  /** Contrato não existe fora de campanha; a modalidade vem dela. */
  campaignId: string
  influencerId: string
  usesEscrow: boolean
  reviewSlaDays?: number
  maxResubmissions?: number
  autoReleaseOnTimeout?: boolean
}

export type CreateContractResponse = {
  contractId: string
  campaignId: string
  modality: string
  status: string
  templateId: string
  templateVersion: number
  usesEscrow: boolean
  escrowSupport: EscrowSupport
  reviewSlaDays: number
  maxResubmissions: number
}

/** Campo do banco central, já resolvido para este contrato. */
export type ContractField = {
  placeholder: string
  label: string
  /** FreeText | Date | Currency | Percentage | Boolean | Enum | Document | Attachment. */
  dataType: string
  /** Legal (só compõe o texto) | MachineActionable (alimenta o sistema). */
  kind: string
  isRequired: boolean
  helpText: string | null
  value: string | null
}

export type ContractClause = { order: number; title: string; isSystem: boolean }

export type ContractDetail = {
  contractId: string
  influencerId: string
  influencerName: string
  modality: string | null
  hybridCode: string | null
  status: string
  usesEscrow: boolean
  escrowSupport: EscrowSupport
  templateId: string
  templateVersion: number
  templateLegalReviewed: boolean
  reviewSlaDays: number
  maxResubmissions: number
  autoReleaseOnTimeout: boolean
  signedAt: string | null
  signatureProviderRef: string | null
  fields: ContractField[]
  /** Calculado pelo servidor — a tela não recomputa o que o domínio já decidiu. */
  missingRequiredFields: string[]
  clauses: ContractClause[]
}

export type UpdateFieldsResponse = {
  contractId: string
  filledFieldCount: number
  missingRequiredFields: string[]
}

export type SendForSignatureResponse = {
  contractId: string
  status: string
  signatureProviderRef: string | null
}

export type MarkSignedResponse = {
  contractId: string
  status: string
  signedAt: string
}

/**
 * Traduz o tipo do domínio no primitivo de input que o navegador entende.
 *
 * `Enum` cai em texto de propósito: a API ainda não expõe a lista de opções do
 * campo, e um select vazio seria pior que um texto livre com dica. `Attachment`
 * também — não existe upload em lugar nenhum do fluxo ainda.
 */
export function fieldInputKind(dataType: string): "text" | "date" | "number" | "checkbox" {
  switch (dataType) {
    case "Date": return "date"
    case "Currency":
    case "Percentage": return "number"
    case "Boolean": return "checkbox"
    default: return "text"
  }
}

/** Quantos obrigatórios já estão preenchidos. Alimenta a barra de progresso. */
export function contractProgress(fields: ContractField[]): { required: number; filled: number } {
  const required = fields.filter((f) => f.isRequired)
  return {
    required: required.length,
    filled: required.filter((f) => (f.value ?? "").trim() !== "").length,
  }
}

export const operationsApi = {
  listRoster: (status?: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListRosterResponse>(
      `/api/operations/influencers${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { signal: opts?.signal },
    ),

  addInfluencer: (body: AddInfluencerBody) =>
    apiClient.post<AddInfluencerResponse>("/api/operations/influencers", body),

  listContracts: (status?: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListContractsResponse>(
      `/api/operations/contracts${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { signal: opts?.signal },
    ),

  listCampaigns: (status?: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListCampaignsResponse>(
      `/api/operations/campaigns${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { signal: opts?.signal },
    ),

  getCampaign: (campaignId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<CampaignDetail>(`/api/operations/campaigns/${campaignId}`, { signal: opts?.signal }),

  createCampaign: (body: CreateCampaignBody) =>
    apiClient.post<{ campaignId: string; name: string; modality: string; status: string }>(
      "/api/operations/campaigns", body),

  updateCampaign: (campaignId: string, body: UpdateCampaignBody) =>
    apiClient.patch(`/api/operations/campaigns/${campaignId}`, body),

  createContract: (body: CreateContractBody) =>
    apiClient.post<CreateContractResponse>("/api/operations/contracts", body),

  getContract: (contractId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ContractDetail>(`/api/operations/contracts/${contractId}`, { signal: opts?.signal }),

  updateContractFields: (contractId: string, fieldValues: Record<string, string>) =>
    apiClient.patch<UpdateFieldsResponse>(
      `/api/operations/contracts/${contractId}/fields`, { fieldValues },
    ),

  sendForSignature: (contractId: string) =>
    apiClient.post<SendForSignatureResponse>(
      `/api/operations/contracts/${contractId}/send-for-signature`,
    ),

  markContractSigned: (contractId: string) =>
    apiClient.post<MarkSignedResponse>(`/api/operations/contracts/${contractId}/mark-signed`),
}

/** Elenco do tenant ativo. `activeTenantId` na key isola o cache por workspace. */
export function useRoster(status?: string) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-roster", activeTenantId, status ?? null],
    queryFn: ({ signal }) => operationsApi.listRoster(status, { signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 60_000,
  })
}

export function useCampaigns(status?: string) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-campaigns", activeTenantId, status ?? null],
    queryFn: ({ signal }) => operationsApi.listCampaigns(status, { signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 60_000,
  })
}

export function useCampaign(campaignId: string | undefined) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-campaign", activeTenantId, campaignId],
    queryFn: ({ signal }) => operationsApi.getCampaign(campaignId!, { signal }),
    enabled: Boolean(activeTenantId && campaignId),
  })
}

export function useCampaignMutations(campaignId?: string) {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["operations-campaigns", activeTenantId] })
    if (campaignId)
      qc.invalidateQueries({ queryKey: ["operations-campaign", activeTenantId, campaignId] })
  }

  return {
    create: useMutation({
      mutationFn: (body: CreateCampaignBody) => operationsApi.createCampaign(body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (body: UpdateCampaignBody) => operationsApi.updateCampaign(campaignId!, body),
      onSuccess: refresh,
    }),
  }
}

export function useContracts(status?: string) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-contracts", activeTenantId, status ?? null],
    queryFn: ({ signal }) => operationsApi.listContracts(status, { signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 60_000,
  })
}

export function useContractMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return {
    create: useMutation({
      mutationFn: (body: CreateContractBody) => operationsApi.createContract(body),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["operations-contracts", activeTenantId] })
        // O contador de contratos do elenco muda junto.
        qc.invalidateQueries({ queryKey: ["operations-roster", activeTenantId] })
      },
    }),
  }
}

export function useContract(contractId: string | undefined) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-contract", activeTenantId, contractId],
    queryFn: ({ signal }) => operationsApi.getContract(contractId!, { signal }),
    enabled: Boolean(activeTenantId && contractId),
  })
}

export function useContractDetailMutations(contractId: string | undefined) {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  // Toda mutação aqui muda o estado do contrato — a lista precisa acompanhar,
  // senão o status na tabela fica velho depois de assinar.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["operations-contract", activeTenantId, contractId] })
    qc.invalidateQueries({ queryKey: ["operations-contracts", activeTenantId] })
  }

  return {
    saveFields: useMutation({
      mutationFn: (fieldValues: Record<string, string>) =>
        operationsApi.updateContractFields(contractId!, fieldValues),
      onSuccess: refresh,
    }),
    sendForSignature: useMutation({
      mutationFn: () => operationsApi.sendForSignature(contractId!),
      onSuccess: refresh,
    }),
    markSigned: useMutation({
      mutationFn: () => operationsApi.markContractSigned(contractId!),
      onSuccess: refresh,
    }),
  }
}

export function useRosterMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return {
    add: useMutation({
      mutationFn: (body: AddInfluencerBody) => operationsApi.addInfluencer(body),
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: ["operations-roster", activeTenantId] }),
    }),
  }
}
