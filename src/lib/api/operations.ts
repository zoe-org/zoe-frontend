import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query"
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
  /**
   * Estado do relacionamento, derivado no backend: Contratado | Aceito | Convidado |
   * ConviteExpirado, ou o status no elenco (Active/Paused/Archived) quando não houve
   * convite. Não existe "Recusou" — o convite não tem recusa explícita.
   */
  relationshipStatus: string
  // Cadastro declarado pelo criador — opcionais porque a API antiga não os mandava.
  primaryArea?: string | null
  audienceSize?: string | null
  topics?: string[]
  /** Arroba por plataforma: YouTube | Instagram | TikTok. */
  handles?: Record<string, string>
  bio?: string | null
  portfolioUrl?: string | null
  profileComplete?: boolean
  /** Campanha do contrato mais recente com este workspace. */
  lastCampaignName?: string | null
  lastContractAt?: string | null
  /** Custódias deste workspace já liberáveis para ele — parado se a conta não estiver pronta. */
  releasableCents?: number
}

export type ListRosterResponse = { items: RosterItem[] }

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
    // Sempre duas casas: arredondar escondia taxa de R$ 0,20 como "R$ 0" num contrato de R$ 5.
    style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2,
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
  /** AwaitingReview | Approved | ChangesRequested — nulo enquanto nenhum corte foi enviado. */
  draftStatus?: string | null
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

/**
 * Briefing auditável (RN-O-030/031). É a régua contra a qual a auditoria automática vai
 * medir a entrega — por isso tudo aqui é tipado e verificável, não texto livre.
 */
export type CampaignBriefing = {
  keywords: string[]
  requiredHashtags: string[]
  requiresLogo: boolean
  minLogoSeconds: number | null
  minSentiment: BriefingSentiment
  requiresConarDisclosure: boolean
  deliverySlaDays: number | null
  /** Herdado pelos contratos da campanha. O threshold segue sendo por contrato. */
  defaultAuditThreshold: number
  /**
   * Se há alguma verificação concreta configurada. Falso quando não há menção, hashtag
   * nem logo — a tela usa isto para não prometer auditoria sobre um briefing vazio.
   */
  isAuditable: boolean
}

export type BriefingSentiment = "Any" | "Neutral" | "Positive"

export const BRIEFING_SENTIMENTS: BriefingSentiment[] = ["Any", "Neutral", "Positive"]

export type CampaignBriefingInput = Partial<{
  keywords: string[]
  requiredHashtags: string[]
  requiresLogo: boolean
  minLogoSeconds: number | null
  minSentiment: BriefingSentiment
  requiresConarDisclosure: boolean
  deliverySlaDays: number | null
  defaultAuditThreshold: number
}>

/** Convite da campanha, com a proposta — é o que o novo contrato herda. */
export type CampaignInvite = {
  inviteId: string
  influencerId: string
  influencerName: string
  email: string
  accepted: boolean
  expired: boolean
  createdAt: string
  feeCents: number | null
  expectedDeliverables: string | null
  deliveryDeadline: string | null
}

export type CampaignDetail = Omit<CampaignSummary, "contractCount"> & {
  notes: string | null
  briefing: CampaignBriefing
  contracts: CampaignContract[]
  deliveries: CampaignDelivery[]
  /** Do mais novo ao mais antigo. */
  invites?: CampaignInvite[]
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
  briefing?: CampaignBriefingInput
}

export type CampaignTransition = "Activate" | "Complete" | "Cancel"

/**
 * Transições possíveis a partir de cada status, espelhando `Campaign.Activate/Complete/
 * Cancel` no domínio: rascunho ativa ou cancela, ativa conclui ou cancela, e encerrada é
 * encerrada. A autoridade é o domínio — isto existe para a tela não oferecer um botão que
 * já se sabe que vai falhar.
 */
export function allowedCampaignTransitions(status: string): CampaignTransition[] {
  switch (status) {
    case "Draft": return ["Activate", "Cancel"]
    case "Active": return ["Complete", "Cancel"]
    default: return []
  }
}

export const CAMPAIGN_TRANSITION_LABEL: Record<CampaignTransition, string> = {
  Activate: "Ativar campanha",
  Complete: "Concluir campanha",
  Cancel: "Cancelar campanha",
}

export type UpdateCampaignBody = {
  name?: string
  tenantBrandId?: string
  brandLabel?: string
  startsAt?: string
  endsAt?: string
  budgetCents?: number
  notes?: string
  transition?: CampaignTransition
  briefing?: CampaignBriefingInput
}

export type UpdateCampaignResponse = {
  campaignId: string
  name: string
  status: string
  budgetCents: number
}


// ————————————————————— Convite de criador —————————————————————

export type InviteInfluencerBody = {
  email: string
  fullName: string
  countryCode?: string
  displayName?: string
  message?: string
  /** Proposta de trabalho. Só o endpoint de campanha aceita — o de elenco ignora. */
  expectedDeliverables?: string
  /** Centavos. A API recusa em campanha de permuta: GMV zero não comporta cachê. */
  feeCents?: number
  deliveryDeadline?: string
}

/** `emailDelivery`: Sent | Failed | Disabled — decide se o link copiável é o caminho. */
export type InviteInfluencerResponse = {
  inviteId: string
  campaignId: string | null
  influencerId: string
  email: string
  token: string
  expiresAt: string
  influencerCreated: boolean
  emailDelivery: string
  /** Ecoados do que FICOU gravado, não do que foi pedido. */
  expectedDeliverables: string | null
  feeCents: number | null
  deliveryDeadline: string | null
}

export type InfluencerInvitePreview = {
  email: string
  influencerName: string
  /** Nulo em convite de elenco: a marca chamou a pessoa sem ação específica. */
  campaignName: string | null
  modality: string | null
  tenantName: string
  inviterName: string
  message: string | null
  expiresAt: string
  expired: boolean
  accepted: boolean
  expectedDeliverables: string | null
  feeCents: number | null
  deliveryDeadline: string | null
  /** Deriva da modalidade da campanha. A tela mostra "permuta" no lugar do valor. */
  isBarter: boolean
  /** Os critérios contra os quais a entrega vai ser medida. Nulo se a campanha ainda não tem briefing. */
  briefing: InviteBriefing | null
}

export type InviteBriefing = {
  keywords: string[]
  requiredHashtags: string[]
  requiresLogo: boolean
  minLogoSeconds: number | null
  minSentiment: string
  requiresConarDisclosure: boolean
  deliverySlaDays: number | null
  auditThreshold: number
}

export type AcceptInfluencerInviteResponse = {
  inviteId: string
  influencerId: string
  campaignId: string
  campaignName: string
  tenantName: string
  kycStatus: string
}

/** Rota da tela de aceite. Espelha o LinkPath que o backend põe no e-mail. */
export const INFLUENCER_INVITE_PATH = "convite-criador"

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
 * Toda modalidade cria campanha. O que a RN-O-039 proíbe é o contrato **com
 * custódia** em modalidade não suportada — e a Permuta prova que contrato sem
 * dinheiro é legítimo. Nas seis deferidas o pagamento corre fora da plataforma,
 * e a tela precisa dizer isso: o que a regra teme é o silêncio, não a ausência
 * de custódia.
 */
export const CAMPAIGN_MODALITIES = CONTRACT_MODALITIES

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
      return "Esta modalidade depende de custódia por etapas, que a plataforma ainda não faz. "
        + "O contrato e a entrega funcionam normalmente, mas o pagamento acontece fora da Zoe — "
        + "sem o dinheiro reservado antes da produção."
  }
}

// Espelha ListContractsResponse (GET /api/operations/contracts).
export type ContractSummary = {
  contractId: string
  influencerId: string
  influencerName: string
  /**
   * O que distingue dois contratos do mesmo criador. Nulo no contrato avulso — o
   * trabalho pontual que não pertence a campanha nenhuma.
   */
  campaignId: string | null
  campaignName: string | null
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
  /**
   * Campanha do contrato. Nula cria o contrato avulso — e aí `modality` é obrigatória,
   * porque é ela que resolve o template.
   */
  campaignId: string | null
  influencerId: string
  usesEscrow: boolean
  /** Só no avulso. Com campanha, a modalidade vem dela e este campo é ignorado. */
  modality?: string
  reviewSlaDays?: number
  maxResubmissions?: number
  autoReleaseOnTimeout?: boolean
  /**
   * Fluxo financeiro encadeado: assinado abre a custódia e pede a reserva, fundos liberam a
   * produção, aprovar a entrega pede o pagamento. Ignorado em contrato sem custódia.
   */
  autoAdvanceEscrow?: boolean
}

export type CreateContractResponse = {
  contractId: string
  campaignId: string | null
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
  /**
   * Valor de que o sistema é dono — id do contrato, nome da campanha. Vem preenchido e a
   * tela mostra sem permitir edição: é identidade do registro, não texto a digitar.
   */
  isSystemManaged: boolean
  /**
   * De onde veio o valor: TenantDefault | Campaign | Invite | Record | Manual. Nulo em
   * contrato criado antes de a origem existir.
   */
  source: ContractFieldSource | null
  /** Se o valor pode virar padrão da marca — identidade e termos da negociação não podem. */
  defaultable: boolean
}

export type ContractFieldSource = "TenantDefault" | "Campaign" | "Invite" | "Record" | "Manual"

/** Rótulo curto da origem. `Manual` não tem: o que alguém digitou dispensa etiqueta. */
export const FIELD_SOURCE_LABEL: Record<ContractFieldSource, string | null> = {
  TenantDefault: "padrão da marca",
  Campaign: "da campanha",
  Invite: "da proposta",
  Record: "do cadastro",
  Manual: null,
}

/** Resultado da consulta ao provedor de assinatura. `changed` = virou assinado agora. */
export type RefreshSignatureResponse = {
  contractId: string
  status: string
  changed: boolean
  message: string
}

export type ContractClause = { order: number; title: string; isSystem: boolean; body: string }

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
  /** Fluxo financeiro encadeado — ver `CreateContractBody.autoAdvanceEscrow`. */
  autoAdvanceEscrow: boolean
  /**
   * Provedor de assinatura real configurado. Com ele o atalho "marcar como assinado" é
   * recusado pela API — a confirmação vem do provedor.
   */
  signatureProviderLive?: boolean
  /** Valor total declarado no contrato, em centavos, quando legível — o que a custódia reserva. */
  declaredTotalCents?: number | null
  /** Rascunho que ficou sem a proposta do convite porque outro contrato a levou — é este. */
  proposalUsedByContractId?: string | null
  /** Custódia já aberta. Nulo com usesEscrow = a tela oferece abrir. */
  escrowAccountId: string | null
  escrowState: string | null
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
  // Campo que o sistema preenche fica de fora dos dois lados da conta: contá-lo como
  // exigido e preenchido inflaria o progresso com trabalho que ninguém fez.
  const required = fields.filter((f) => f.isRequired && !f.isSystemManaged)
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

  updateCustomClauses: (contractId: string, clauses: { title: string; body: string }[]) =>
    apiClient.put<{ contractId: string; clauseCount: number }>(
      `/api/operations/contracts/${contractId}/custom-clauses`, { clauses }),

  listEscrow: (state?: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListEscrowResponse>(
      `/api/operations/escrow${state ? `?state=${encodeURIComponent(state)}` : ""}`,
      { signal: opts?.signal },
    ),

  /**
   * Dispara o gatilho. Fund/Release/Refund **enfileiram** e devolvem `to: null` com
   * `queued: true` — nenhuma operação financeira roda dentro do request (RN-O-044).
   * StartProduction transiciona na hora porque não move dinheiro.
   */
  /** Abre a custódia de um contrato assinado. A taxa NÃO vai aqui — vem do contrato. */
  // Sem amountCents a API usa o valor total declarado no contrato.
  openEscrow: (body: { contractId: string; amountCents?: number; currency?: string }) =>
    apiClient.post<{
      escrowAccountId: string
      contractId: string
      state: EscrowState
      amountCents: number
      takeRateCents: number
      netToInfluencerCents: number
    }>("/api/operations/escrow", body),

  applyEscrowAction: (escrowAccountId: string, action: EscrowAction) =>
    apiClient.post<{
      escrowAccountId: string
      from: string
      to: string | null
      queued: boolean
      message: string | null
    }>(`/api/operations/escrow/${escrowAccountId}/${action}`),

  listDeliveries: (status?: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListDeliveriesResponse>(
      `/api/operations/deliveries${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { signal: opts?.signal },
    ),

  submitDelivery: (body: { contractId: string; submittedUrl: string }) =>
    apiClient.post<{ deliveryId: string; status: DeliveryStatus }>(
      "/api/operations/deliveries", body),

  startDeliveryReview: (deliveryId: string) =>
    apiClient.post<{ deliveryId: string; status: DeliveryStatus; reviewDueAt: string }>(
      `/api/operations/deliveries/${deliveryId}/start-review`),

  decideDelivery: (deliveryId: string, decision: DeliveryDecision, notes?: string, scope?: ReworkScope) =>
    apiClient.post<DecideDeliveryResponse>(
      `/api/operations/deliveries/${deliveryId}/decision`, { decision, notes, scope }),

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
    apiClient.patch<UpdateCampaignResponse>(
      `/api/operations/campaigns/${campaignId}`, body),

  /** Convite de elenco, sem campanha: a marca monta time antes de existir ação. */
  inviteToRoster: (body: InviteInfluencerBody) =>
    apiClient.post<InviteInfluencerResponse>("/api/operations/influencers/invites", body),

  // Reenvio do convite pendente: o mesmo convite com link novo. A proposta enviada não muda.
  resendInfluencerInvite: (email: string, campaignId?: string) =>
    apiClient.post<InviteInfluencerResponse>(
      campaignId
        ? `/api/operations/campaigns/${campaignId}/invites/resend`
        : "/api/operations/influencers/invites/resend",
      { email }),

  // Lembrete ao criador de conectar ou concluir a conta de recebimento. Limitado no servidor.
  remindPayoutAccount: (influencerId: string) =>
    apiClient.post<{ influencerId: string; emailDelivery: string }>(
      `/api/operations/influencers/${influencerId}/payout-reminder`),

  inviteInfluencer: (campaignId: string, body: InviteInfluencerBody) =>
    apiClient.post<InviteInfluencerResponse>(
      `/api/operations/campaigns/${campaignId}/invites`, body),

  // Prévia pública: `noTenant` porque quem abre o link ainda não pertence a workspace
  // nenhum — e não vai pertencer, já que criador não é membro do contratante.
  previewInfluencerInvite: (token: string) =>
    apiClient.get<InfluencerInvitePreview>(
      `/api/influencer-invites/${encodeURIComponent(token)}`, { noTenant: true }),

  acceptInfluencerInvite: (token: string) =>
    apiClient.post<AcceptInfluencerInviteResponse>(
      "/api/influencer-invites/accept", { token }, { noTenant: true }),

  createContract: (body: CreateContractBody) =>
    apiClient.post<CreateContractResponse>("/api/operations/contracts", body),

  getContract: (contractId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ContractDetail>(`/api/operations/contracts/${contractId}`, { signal: opts?.signal }),

  getContractTimeline: (contractId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<{ items: ContractTimelineItem[] }>(
      `/api/operations/contracts/${contractId}/timeline`, { signal: opts?.signal }),

  updateContractFields: (contractId: string, fieldValues: Record<string, string>) =>
    apiClient.patch<UpdateFieldsResponse>(
      `/api/operations/contracts/${contractId}/fields`, { fieldValues },
    ),

  sendForSignature: (contractId: string) =>
    apiClient.post<SendForSignatureResponse>(
      `/api/operations/contracts/${contractId}/send-for-signature`,
    ),

  /** Só rascunho — o backend recusa o resto com motivo legível. */
  deleteContract: (contractId: string) =>
    apiClient.delete<void>(`/api/operations/contracts/${contractId}`),

  markContractSigned: (contractId: string) =>
    apiClient.post<MarkSignedResponse>(`/api/operations/contracts/${contractId}/mark-signed`),
  refreshSignature: (contractId: string) =>
    apiClient.post<RefreshSignatureResponse>(`/api/operations/contracts/${contractId}/refresh-signature`),
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
    invite: useMutation({
      mutationFn: (body: InviteInfluencerBody) =>
        operationsApi.inviteInfluencer(campaignId!, body),
      onSuccess: () => {
        refresh()
        // O convite entra no elenco: o contador da tela de criadores muda junto.
        qc.invalidateQueries({ queryKey: ["operations-roster", activeTenantId] })
      },
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

    remove: useMutation({
      mutationFn: (contractId: string) => operationsApi.deleteContract(contractId),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["operations-contracts", activeTenantId] })
        qc.invalidateQueries({ queryKey: ["operations-roster", activeTenantId] })
        // A campanha conta contratos no cabeçalho dela.
        qc.invalidateQueries({ queryKey: ["operations-campaign", activeTenantId] })
      },
    }),
  }
}

/**
 * De quanto em quanto tempo o detalhe do contrato se atualiza sozinho, ou `false`.
 *
 * <p>Enquanto a tela espera um passo que acontece fora dela — a assinatura (webhook ou consulta
 * periódica) e, com pagamento automático, a custódia abrindo e reservando — ela vai buscar.
 * Antes dizia "atualize em instantes" e dependia de F5.</p>
 */
export function intervaloDeEspera(d: ContractDetail | undefined, now: number = Date.now()): number | false {
  if (!d) return false
  if (d.status === "SentForSignature") return 30_000

  const abrindoCustodia = d.status === "Signed" && d.usesEscrow && Boolean(d.autoAdvanceEscrow)
    && (!d.escrowAccountId || d.escrowState === "PendingDeposit")
  // Janela curta: passado isso, algo impediu a abertura e a tela já oferece fazer à mão.
  if (abrindoCustodia && d.signedAt && now - Date.parse(d.signedAt) < 10 * 60_000) return 4_000

  return false
}

export function useContract(contractId: string | undefined) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-contract", activeTenantId, contractId],
    queryFn: ({ signal }) => operationsApi.getContract(contractId!, { signal }),
    enabled: Boolean(activeTenantId && contractId),
    refetchInterval: (query) => intervaloDeEspera(query.state.data),
  })
}

/** Um acontecimento do contrato. `kind` escolhe a cor: contract, draft, delivery ou escrow. */
export type ContractTimelineItem = {
  at: string
  kind: "contract" | "draft" | "delivery" | "escrow" | string
  title: string
  detail: string | null
}

export function useContractTimeline(contractId: string | undefined) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-contract-timeline", activeTenantId, contractId],
    queryFn: ({ signal }) => operationsApi.getContractTimeline(contractId!, { signal }),
    enabled: Boolean(activeTenantId && contractId),
    staleTime: 10_000,
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
    // Pergunta ao provedor. Com pagamento automático a custódia abre logo depois de
    // confirmar, então o quadro de custódia sai do cache junto.
    refreshSignature: useMutation({
      mutationFn: () => operationsApi.refreshSignature(contractId!),
      onSuccess: () => {
        refresh()
        qc.invalidateQueries({ queryKey: ["operations-escrow", activeTenantId] })
      },
    }),
  }
}

/**
 * Máquina de estados da custódia — **nove**, na ordem em que o domínio transiciona.
 * O protótipo desenha seis; faltam nele `Delivered` (entregue mas revisão não aberta),
 * `Disputed` e `Refunded`. Onde diverge, vale a máquina, que é a implementada e testada.
 */
export const ESCROW_STATES = [
  "PendingDeposit", "Funded", "InProduction", "Delivered", "UnderReview",
  "Releasable", "Released", "Disputed", "Refunded",
] as const

export type EscrowState = (typeof ESCROW_STATES)[number]

/**
 * Fila de entregas. Os estados vêm de `DeliveryStatus` no domínio — cinco, e nenhum
 * deles é financeiro: o que acontece com o dinheiro é `escrowState`, que vem junto
 * só para a tela poder dizer "aprovada mas ainda não paga" sem inventar estado.
 */
export const DELIVERY_STATUSES = [
  "Submitted", "UnderReview", "Approved", "ReworkRequested", "Rejected",
] as const

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export type DeliverySummary = {
  deliveryId: string
  contractId: string
  campaignId: string | null
  campaignName: string | null
  influencerName: string
  submittedUrl: string
  /** Só no YouTube. Reel e TikTok não têm id de vídeo do YouTube nem miniatura pública. */
  youtubeVideoId: string | null
  platform: DeliveryPlatform
  status: DeliveryStatus
  submissionAttempt: number
  submittedAt: string
  reviewDueAt: string | null
  isReviewOverdue: boolean
  decidedByUserId: string | null
  decisionNotes: string | null
  /** `AiAudit` na 8.6; hoje sempre a aprovação manual. */
  auditType: string | null
  escrowState: EscrowState | null
  escrowAmountCents: number | null
  /** Parecer da máquina. Nulo em revisão manual — a ausência é informação. */
  audit: DeliveryAudit | null
  /** Aprovar já pede o pagamento: o contrato combinou o fluxo encadeado. */
  paymentFollowsApproval: boolean
  /** Conta de recebimento do criador existe e está verificada — sem ela o pagamento espera. */
  creatorPayoutReady: boolean
}

/**
 * Resultado da auditoria automática (RN-O-056 a 061). `isApprovable` diz que a nota
 * alcançou o mínimo — **não** que a entrega está aprovada: o clique continua sendo humano,
 * e o botão de aprovar existe mesmo abaixo do threshold.
 */
export type DeliveryAudit = {
  score: number
  appliedThreshold: number
  isApprovable: boolean
  /** Auditoria sobre dado degradado: a nota vale menos e a tela precisa dizer isso. */
  isDegraded: boolean
  pipelinePath: string | null
  auditedAt: string
  checklist: DeliveryAuditItem[]
}

export type DeliveryAuditItem = {
  criterion: string
  passed: boolean
  detail: string | null
}

export type ListDeliveriesResponse = { items: DeliverySummary[] }

export type DeliveryDecision = "Approve" | "RequestRework" | "Reject"

/**
 * O que a correção pede: ajustar a publicação (legenda, #publi, link — o vídeo aprovado segue
 * valendo) ou refazer o vídeo (o corte reabre e volta pela aprovação).
 */
export type ReworkScope = "Publication" | "Content"

export type DecideDeliveryResponse = {
  deliveryId: string
  status: DeliveryStatus
  auditReportId: string
  decidedByUserId: string
  escrowState: EscrowState | null
  canResubmit: boolean
}

/** Miniatura do próprio YouTube — a entrega é um vídeo publicado, então ela existe. */
export const youtubeThumb = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

export const youtubeWatch = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`

/** Onde a entrega foi publicada. A conferência é sempre sobre o link público (RN-O-050). */
export type DeliveryPlatform = "YouTube" | "Instagram" | "TikTok"

export const PLATFORM_LABEL: Record<string, string> = {
  YouTube: "YouTube",
  Instagram: "Instagram",
  TikTok: "TikTok",
}

type DeliveryLinkish = { platform?: string | null; youtubeVideoId: string | null; submittedUrl: string }

/**
 * Miniatura da entrega. Só o YouTube expõe imagem pública pelo id do vídeo; nas outras a
 * tela mostra uma capa com o nome da plataforma.
 */
export const deliveryThumb = (d: Omit<DeliveryLinkish, "submittedUrl">): string | null =>
  (d.platform ?? "YouTube") === "YouTube" && d.youtubeVideoId ? youtubeThumb(d.youtubeVideoId) : null

/** Onde abrir a entrega: a URL canônica no YouTube, e o próprio link enviado nas outras. */
export const deliveryLink = (d: DeliveryLinkish): string =>
  (d.platform ?? "YouTube") === "YouTube" && d.youtubeVideoId ? youtubeWatch(d.youtubeVideoId) : d.submittedUrl

export function useDeliveries(status?: string) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-deliveries", activeTenantId, status ?? null],
    queryFn: ({ signal }) => operationsApi.listDeliveries(status, { signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 30_000,
    // Segura o conteudo anterior enquanto revalida. Sem isto a tela esvazia a cada
    // volta ao modulo e a pessoa ve um vazio que nao e' verdade — parece que nao ha'
    // entregas quando so' esta' buscando de novo.
    placeholderData: keepPreviousData,
  })
}

export function useDeliveryMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  // A decisão mexe na custódia (aprovar torna liberável, rejeitar leva a disputa),
  // então campanhas e custódia saem do cache junto com a fila.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["operations-deliveries", activeTenantId] })
    qc.invalidateQueries({ queryKey: ["operations-campaign", activeTenantId] })
    qc.invalidateQueries({ queryKey: ["operations-escrow", activeTenantId] })
  }

  return {
    submit: useMutation({
      mutationFn: (body: { contractId: string; submittedUrl: string }) =>
        operationsApi.submitDelivery(body),
      onSuccess: refresh,
    }),
    startReview: useMutation({
      mutationFn: (deliveryId: string) => operationsApi.startDeliveryReview(deliveryId),
      onSuccess: refresh,
    }),
    decide: useMutation({
      mutationFn: (v: { deliveryId: string; decision: DeliveryDecision; notes?: string; scope?: ReworkScope }) =>
        operationsApi.decideDelivery(v.deliveryId, v.decision, v.notes, v.scope),
      onSuccess: refresh,
    }),
  }
}

export type EscrowSummary = {
  escrowAccountId: string
  contractId: string
  campaignId: string | null
  campaignName: string | null
  influencerId: string
  influencerName: string
  state: EscrowState
  isTerminal: boolean
  /** O que a máquina de estados permite daqui. A tela não adivinha. */
  allowedTriggers: string[]
  amountCents: number
  currency: string
  takeRateBps: number
  takeRateCents: number
  netToInfluencerCents: number
  authorizationExpiresAt: string | null
  isAuthorizationExpired: boolean
  /**
   * Quando a reserva caducou sem renovação (RN-O-046). Preenchido = o dinheiro NÃO está
   * mais separado, e a liberação vai recusar.
   */
  authorizationLapsedAt: string | null
  disputeReason: string | null
  payoutAccountMissing: boolean
  /** Operação financeira já enfileirada e ainda não processada (RN-O-044). */
  hasPendingCommand: boolean
  createdAt: string
  /** Reserva e pagamento são pedidos sozinhos; os botões ficam como recurso. */
  autoAdvance: boolean
  /** Conta criada mas ainda em verificação: custódia liberável fica parada esperando. */
  payoutAccountUnverified: boolean
}

export type EscrowTotals = {
  heldCents: number
  releasedCents: number
  refundedCents: number
  activeCount: number
}

export type ListEscrowResponse = { items: EscrowSummary[]; totals: EscrowTotals }

export type EscrowAction = "fund" | "start-production" | "release" | "refund"

/** Gatilho do domínio que cada ação dispara — é o que aparece em `allowedTriggers`. */
export const ESCROW_ACTION_TRIGGER: Record<EscrowAction, string> = {
  "fund": "Fund",
  "start-production": "StartProduction",
  "release": "Release",
  "refund": "Refund",
}

/** Corte esperando decisão da marca — primeiro dos dois portões. */
export type DeliveryDraftItem = {
  draftId: string
  contractId: string
  campaignId: string | null
  campaignName: string | null
  influencerName: string
  /** AwaitingReview | Approved | ChangesRequested */
  status: string
  revision: number
  fileName: string | null
  sizeBytes: number | null
  creatorNotes: string | null
  decisionNotes: string | null
  submittedAt: string
  /** Assinada a cada consulta e de curta duração — não guardar. */
  previewUrl: string | null
}

export function useDeliveryDrafts(status?: string) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-drafts", activeTenantId, status ?? null],
    queryFn: ({ signal }) =>
      apiClient.get<{ items: DeliveryDraftItem[] }>(
        `/api/operations/deliveries/drafts${status ? `?status=${status}` : ""}`,
        { signal },
      ),
    enabled: Boolean(activeTenantId),
    // Curto: o previewUrl assinado vence, e servir um vencido do cache mostraria um
    // player quebrado sem explicação. Pelo mesmo motivo esta consulta NAO guarda o
    // conteudo anterior enquanto revalida — melhor um vazio breve que um video morto.
    staleTime: 10_000,
  })
}

export function useDeliveryDraftMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()

  return {
    decide: useMutation({
      mutationFn: (v: {
        draftId: string
        decision: "Approve" | "RequestChanges"
        notes?: string
      }) =>
        apiClient.post<{ draftId: string; status: string; publicationReleased: boolean }>(
          `/api/operations/deliveries/drafts/${v.draftId}/decision`,
          { decision: v.decision, notes: v.notes },
        ),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["operations-drafts", activeTenantId] })
        qc.invalidateQueries({ queryKey: ["operations-deliveries", activeTenantId] })
      },
    }),
  }
}

export function useEscrowAccounts(state?: string) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-escrow", activeTenantId, state ?? null],
    queryFn: ({ signal }) => operationsApi.listEscrow(state, { signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  })
}

/** Código que o backend devolve quando falta o add-on — a tela abre upgrade, não erro. */
export const CUSTOM_CONTRACTS_UPGRADE_CODE = "custom_contracts_required"

export function useCustomClauseMutations(contractId: string) {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (clauses: { title: string; body: string }[]) =>
      operationsApi.updateCustomClauses(contractId, clauses),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations-contract", activeTenantId, contractId] })
    },
  })
}

export function useEscrowMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return {
    open: useMutation({
      mutationFn: (v: { contractId: string; amountCents?: number }) =>
        operationsApi.openEscrow(v),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["operations-escrow", activeTenantId] })
        qc.invalidateQueries({ queryKey: ["operations-contract", activeTenantId] })
        qc.invalidateQueries({ queryKey: ["operations-contracts", activeTenantId] })
      },
    }),
    apply: useMutation({
      mutationFn: (v: { escrowAccountId: string; action: EscrowAction }) =>
        operationsApi.applyEscrowAction(v.escrowAccountId, v.action),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["operations-escrow", activeTenantId] })
        qc.invalidateQueries({ queryKey: ["operations-deliveries", activeTenantId] })
        qc.invalidateQueries({ queryKey: ["operations-campaign", activeTenantId] })
      },
    }),
  }
}

export function useRosterMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return {
    invite: useMutation({
      // Um convite, dois destinos. Com campanha ele é proposta de trabalho e vai para o
      // endpoint dela — que é o único que aceita cachê, porque só ali existe modalidade
      // para dizer se permuta o recusa. Sem campanha é convite de elenco.
      mutationFn: ({ campaignId, ...body }: InviteInfluencerBody & { campaignId?: string }) =>
        campaignId
          ? operationsApi.inviteInfluencer(campaignId, body)
          : operationsApi.inviteToRoster(body),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["operations-roster", activeTenantId] })
        qc.invalidateQueries({ queryKey: ["operations-campaigns", activeTenantId] })
        // O detalhe da campanha conta criadores: aberto atrás do modal, ficaria desatualizado.
        qc.invalidateQueries({ queryKey: ["operations-campaign", activeTenantId] })
      },
    }),
    // Nada a invalidar: reenviar não muda elenco, contagem nem proposta — só o link.
    resendInvite: useMutation({
      mutationFn: (v: { email: string; campaignId?: string }) =>
        operationsApi.resendInfluencerInvite(v.email, v.campaignId),
    }),
    remindPayout: useMutation({
      mutationFn: (influencerId: string) => operationsApi.remindPayoutAccount(influencerId),
    }),
  }
}

// ————————————————————————————— Painel —————————————————————————————

/**
 * Espelha OperationsDashboardResponse do zoe-api.
 *
 * <p>Os números são somados no servidor de propósito: somar dinheiro no cliente seria
 * uma segunda resposta para a mesma pergunta, e a que diverge é sempre descoberta tarde.</p>
 */
export type OperationsDashboard = {
  money: {
    pendingDepositCents: number
    inCustodyCents: number
    releasedCents: number
    refundedCents: number
    disputedCents: number
    platformFeeOnReleasedCents: number
    netReleasedToCreatorsCents: number
  }
  pending: {
    contractDrafts: number
    contractsAwaitingSignature: number
    escrowsAwaitingDeposit: number
    draftsAwaitingReview: number
    deliveriesAwaitingReview: number
    escrowsReleasable: number
  }
  volume: {
    activeCampaigns: number
    totalCampaigns: number
    creators: number
    signedContracts: number
    approvedDeliveries: number
  }
  risks: {
    stuckFinancialCommands: number
    creatorsWithoutPayoutAccount: number
    contractsBlockedByLegalReview: number
  }
  escrowByState: { state: EscrowState; count: number; amountCents: number }[]
}

export function useOperationsDashboard() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-dashboard", activeTenantId],
    queryFn: ({ signal }) =>
      apiClient.get<OperationsDashboard>("/api/operations/dashboard", { signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  })
}

// ————————————————————————— Padrões de contrato —————————————————————————

/**
 * Padrão da marca para um campo de contrato (RN-O-024, Nível 1). Todo contrato novo nasce
 * com esse valor, e quem preenche pode trocar.
 */
export type ContractDefaultField = {
  placeholder: string
  label: string
  dataType: string
  kind: string
  helpText: string | null
  value: string | null
  /** Modalidades cujos templates usam o campo. */
  modalities?: string[]
}

export type ContractDefaults = { fields: ContractDefaultField[] }

/**
 * Os que quase toda marca repete em todo contrato. A tela mostra estes primeiro; o resto do
 * catálogo fica numa lista com busca, porque ninguém quer rolar cem campos para achar o foro.
 */
export const ESSENTIAL_CONTRACT_DEFAULTS = [
  "contract_object", "jurisdiction", "applicable_law", "digital_signature",
  "company_rep_name", "payment_terms", "image_rights", "copyright_assignment",
  "nda", "morality_clause", "early_termination", "termination_penalty",
  "late_penalty_company", "late_penalty_influencer", "approval_flow", "min_uptime",
] as const

export const contractDefaultsApi = {
  get: (opts?: { signal?: AbortSignal }) =>
    apiClient.get<ContractDefaults>("/api/operations/contract-defaults", { signal: opts?.signal }),

  /** Merge por campo. Valor vazio remove o padrão. */
  update: (values: Record<string, string>) =>
    apiClient.put<ContractDefaults>("/api/operations/contract-defaults", { values }),
}

export function useContractDefaults() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["operations-contract-defaults", activeTenantId],
    queryFn: ({ signal }) => contractDefaultsApi.get({ signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 60_000,
  })
}

export function useUpdateContractDefaults() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: Record<string, string>) => contractDefaultsApi.update(values),
    onSuccess: (data) => {
      qc.setQueryData(["operations-contract-defaults", activeTenantId], data)
    },
  })
}
