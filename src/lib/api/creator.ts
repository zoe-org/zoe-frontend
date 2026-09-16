import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient, apiBlob } from "@/lib/api"
import {
  enviarEmPartes, guardaEmLocalStorage, type MultipartApi, type PutParte,
} from "@/lib/upload/multipartUpload"
import { useAuth } from "@/features/auth/context"
import {
  useRemoteDeliveryThumb, type DeliveryStatus, type DeliveryThumbnail, type EscrowState,
} from "@/lib/api/operations"

/**
 * Área do criador. Módulo separado de `operations.ts` de propósito: aqui **nada** leva
 * tenant. O criador não pertence a workspace nenhum, e o escopo de cada request é a
 * identidade dele — por isso todas as chamadas usam `noTenant`.
 */

export type CreatorDelivery = {
  deliveryId: string
  submittedUrl: string
  youtubeVideoId: string | null
  platform: string
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
  campaignId: string | null
  campaignName: string | null
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
  /** Contrato com custódia — distingue permuta de custódia que ainda não abriu. */
  usesEscrow: boolean
}

export type CreatorWorkspace = {
  influencerId: string
  fullName: string
  email: string
  kycStatus: string
  canReceivePayout: boolean
  payoutBlockedReason: string | null
  /** Já com máscara, vindo do backend. Nulo enquanto ele não informar. */
  taxId: string | null
  profile: CreatorProfile
  engagements: CreatorEngagement[]
}

/** O cadastro declarado pelo criador — o que a marca lê para decidir o convite. */
export type CreatorProfile = {
  /**
   * Se ele já concluiu o cadastro. Distingue "não preencheu" de "preencheu e deixou os
   * opcionais em branco" — sem isso o segundo caso voltaria ao formulário para sempre.
   */
  complete: boolean
  primaryArea: string | null
  audienceSize: AudienceSize | null
  topics: string[]
  bio: string | null
  portfolioUrl: string | null
  countryCode: string | null
  /** Arroba por plataforma: YouTube | Instagram | TikTok. */
  handles: Partial<Record<ChannelPlatform, string>>
}

export type ChannelPlatform = "YouTube" | "Instagram" | "TikTok"

export const CHANNEL_PLATFORMS: ChannelPlatform[] = ["YouTube", "TikTok", "Instagram"]

export type AudienceSize =
  | "Under10k" | "From10kTo50k" | "From50kTo200k" | "From200kTo1m" | "Over1m"

/**
 * Faixas, não número exato. O número muda toda semana e ficaria errado no dia seguinte ao
 * cadastro; a faixa é o que a marca usa para filtrar e continua verdadeira por meses.
 */
export const AUDIENCE_SIZES: { value: AudienceSize; label: string }[] = [
  { value: "Under10k", label: "Até 10 mil" },
  { value: "From10kTo50k", label: "10 mil a 50 mil" },
  { value: "From50kTo200k", label: "50 mil a 200 mil" },
  { value: "From200kTo1m", label: "200 mil a 1 milhão" },
  { value: "Over1m", label: "Mais de 1 milhão" },
]

/**
 * Áreas oferecidas na tela. Curadas aqui e não no domínio: vertical de conteúdo nasce e
 * morre com o mercado, e cada uma nova não deve custar uma migration.
 */
export const CREATOR_AREAS = [
  "Finanças", "Tecnologia", "Games", "Beleza", "Moda", "Saúde e bem-estar",
  "Gastronomia", "Viagem", "Educação", "Esportes", "Casa e decoração",
  "Maternidade", "Humor e entretenimento", "Negócios", "Outra",
] as const

/**
 * Temas sugeridos por área. São sugestão, não catálogo fechado — o criador escreve o
 * próprio se o dele não estiver ali, e é isso que impede a lista de envelhecer.
 */
export const TOPICS_BY_AREA: Record<string, string[]> = {
  "Finanças": [
    "Bancos digitais", "Cartões", "Investimentos", "Cripto",
    "Empreendedorismo", "Economia doméstica", "Reviews de produto",
  ],
  "Tecnologia": [
    "Smartphones", "Notebooks", "Inteligência artificial", "Apps e serviços",
    "Setup e periféricos", "Programação", "Reviews de produto",
  ],
  "Games": [
    "Gameplay", "Reviews de jogos", "eSports", "Hardware gamer",
    "Lives", "Speedrun", "Mobile games",
  ],
  "Beleza": [
    "Skincare", "Maquiagem", "Cabelo", "Perfumaria",
    "Unhas", "Rotina", "Reviews de produto",
  ],
  "Moda": [
    "Looks do dia", "Moda sustentável", "Achados", "Alfaiataria",
    "Streetwear", "Acessórios", "Reviews de produto",
  ],
  "Saúde e bem-estar": [
    "Treino", "Nutrição", "Saúde mental", "Suplementação",
    "Rotina saudável", "Yoga e meditação", "Reviews de produto",
  ],
  "Gastronomia": [
    "Receitas", "Restaurantes", "Confeitaria", "Bebidas",
    "Comida saudável", "Utensílios", "Reviews de produto",
  ],
  "Viagem": [
    "Roteiros", "Hotéis", "Viagem econômica", "Destinos internacionais",
    "Aventura", "Milhas e passagens", "Reviews de produto",
  ],
  "Educação": [
    "Idiomas", "Concursos", "Vestibular", "Produtividade",
    "Carreira", "Cursos online", "Reviews de produto",
  ],
  "Esportes": [
    "Futebol", "Corrida", "Ciclismo", "Musculação",
    "Lutas", "Esportes radicais", "Reviews de produto",
  ],
  "Casa e decoração": [
    "Reforma", "Organização", "Jardinagem", "Móveis",
    "Eletrodomésticos", "DIY", "Reviews de produto",
  ],
  "Maternidade": [
    "Gestação", "Primeira infância", "Rotina com filhos", "Enxoval",
    "Educação parental", "Reviews de produto",
  ],
  "Humor e entretenimento": [
    "Esquetes", "Comentário de cultura pop", "Reação", "Podcast",
    "Música", "Cinema e séries",
  ],
  "Negócios": [
    "Empreendedorismo", "Marketing", "Vendas", "Gestão",
    "Startups", "Carreira", "Reviews de produto",
  ],
}

/** Teto de temas: quem marca tudo não está dizendo nada. Espelha `Influencer.MaxTopics`. */
export const MAX_TOPICS = 8

export type UpdateCreatorProfileBody = {
  fullName?: string
  taxId?: string
  countryCode?: string
  primaryArea?: string
  audienceSize?: AudienceSize
  topics?: string[]
  bio?: string
  portfolioUrl?: string
  /** Arroba vazio remove o canal declarado — é como ele corrige o que digitou errado. */
  handles?: Partial<Record<ChannelPlatform, string>>
}

/**
 * O contrato como o criador o vê. As cláusulas chegam com os valores já substituídos — o
 * mesmo texto que a marca vê e que vai para o PDF, para que ele não leia um documento
 * diferente do que assina.
 */
export type CreatorContract = {
  contractId: string
  campaignId: string | null
  campaignName: string | null
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
/**
 * Para onde o provedor devolve a pessoa depois do cadastro. Nome de destino, nunca URL —
 * o caminho é resolvido no backend a partir de uma lista fechada.
 */
export type PayoutReturnTo = "cadastro" | "recebimento"

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

export type DataDeletionResult = {
  requestedAt: string
  erased: string[]
  retained: string[]
}

export const creatorApi = {
  /** Passo 1 do envio: autoriza a subida e devolve para onde mandar o arquivo. */
  requestDraftUpload: (body: { contractId: string; fileName: string; contentType: string }) =>
    apiClient.post<{ uploadUrl: string; mediaKey: string; expiresAt: string }>(
      "/api/creator/deliveries/draft-upload", body, { noTenant: true }),

  /**
   * Envio em partes, para arquivo grande: abrir, assinar as próximas partes e juntar no fim. A
   * confirmação continua sendo a mesma do PUT único, com a mesma chave.
   */
  startDraftMultipart: (body: {
    contractId: string; fileName: string; contentType: string; sizeBytes: number
  }) =>
    apiClient.post<{ mediaKey: string; uploadId: string; partSizeBytes: number; partCount: number }>(
      "/api/creator/deliveries/draft-upload/multipart", body, { noTenant: true }),

  signDraftParts: (body: {
    contractId: string; mediaKey: string; uploadId: string; partNumbers: number[]
  }) =>
    apiClient.post<{ parts: { partNumber: number; url: string }[]; expiresAt: string }>(
      "/api/creator/deliveries/draft-upload/multipart/parts", body, { noTenant: true }),

  completeDraftMultipart: (body: {
    contractId: string; mediaKey: string; uploadId: string
    parts: { partNumber: number; eTag: string }[]
  }) =>
    apiClient.post<{ mediaKey: string }>(
      "/api/creator/deliveries/draft-upload/multipart/complete", body, { noTenant: true }),

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

  setTaxId: (taxId: string) =>
    apiClient.put<{ taxId: string; formatted: string }>(
      "/api/creator/tax-id", { taxId }, { noTenant: true }),

  updateProfile: (body: UpdateCreatorProfileBody) =>
    apiClient.put<{ influencerId: string; profileComplete: boolean }>(
      "/api/creator/profile", body, { noTenant: true }),

  startPayoutOnboarding: (returnTo?: PayoutReturnTo) =>
    apiClient.post<StartPayoutOnboarding>(
      "/api/creator/payout-account", returnTo ? { returnTo } : {}, { noTenant: true }),

  // POST apesar de parecer leitura: ele escreve. A verificação acontece do lado do
  // provedor sem avisar ninguém, então alguém precisa perguntar.
  syncPayoutStatus: () =>
    apiClient.post<PayoutStatus>("/api/creator/payout-account/sync", {}, { noTenant: true }),

  /** Tudo o que a Zoe guarda sobre o criador (LGPD, art. 18, II e V). */
  exportMyData: () =>
    apiClient.get<unknown>("/api/creator/my-data", { noTenant: true }),

  /** Pedido de exclusão (art. 18, VI). A resposta diz o que saiu e o que ficou, e por quê. */
  requestDataDeletion: () =>
    apiClient.post<DataDeletionResult>("/api/creator/data-deletion", {}, { noTenant: true }),

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

  deliveryThumbnail: (deliveryId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<DeliveryThumbnail>(`/api/creator/deliveries/${deliveryId}/thumbnail`, {
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

/** Miniatura de uma entrega do criador — a mesma regra da fila da marca, pela rota sem tenant. */
export function useCreatorDeliveryThumb(dl: CreatorDelivery) {
  const { isAuthenticated, isCreator } = useAuth()
  return useRemoteDeliveryThumb(
    dl,
    ["creator"],
    (id, signal) => creatorApi.deliveryThumbnail(id, { signal }),
    isAuthenticated && isCreator,
  )
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
 * Acima disto o corte sobe em partes; abaixo, num PUT só.
 *
 * Um arquivo pequeno termina rápido o bastante para a queda de conexão ser rara, e cada parte tem
 * custo próprio — uma ida à API para assinar e uma requisição para subir.
 */
export const LIMITE_PUT_UNICO = 16 * 1024 * 1024

const FALHA_DE_REDE =
  "O arquivo não subiu. Verifique sua conexão e tente de novo — o que já subiu fica guardado."

/**
 * Sobe um corpo por PUT com progresso.
 *
 * XMLHttpRequest em vez de fetch por UM motivo: progresso. Vídeo de campanha sobe por minutos numa
 * conexão doméstica, e um botão parado em "enviando…" durante cinco minutos é indistinguível de
 * travado — a pessoa cancela e tenta de novo, que é o pior desfecho possível para um upload grande.
 */
function subirComProgresso(
  url: string,
  corpo: Blob,
  onProgress: (bytes: number) => void,
  contentType?: string,
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)

    // O Content-Type tem de bater com o que foi assinado: o storage recusa a escrita se divergir, e
    // a mensagem dele não diria que o problema é esse. Na parte de um envio múltiplo ele NÃO é
    // assinado — mandá-lo ali só arriscaria barrar no CORS.
    if (contentType) xhr.setRequestHeader("Content-Type", contentType)

    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress(ev.loaded) }

    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve(xhr) : reject(new Error(FALHA_DE_REDE))

    xhr.onerror = () => reject(new Error(FALHA_DE_REDE))

    xhr.send(corpo)
  })
}

/** Sobe uma parte e devolve o ETag — é ele que identifica a parte na hora de juntar tudo. */
const putParte: PutParte = async (url, corpo, onProgress) => {
  const xhr = await subirComProgresso(url, corpo, onProgress)
  const etag = xhr.getResponseHeader("ETag")
  if (!etag) {
    // Sem `ExposeHeaders: ETag` no CORS do bucket o navegador esconde o cabeçalho, e sem ele não há
    // como concluir o envio. Falha explícita: em silêncio viraria "subiu tudo e sumiu".
    throw new Error("O storage não identificou a parte enviada. Avise o suporte.")
  }
  return etag
}

const multipartApi: MultipartApi = {
  start: (v) => creatorApi.startDraftMultipart(v),
  signParts: (v) => creatorApi.signDraftParts(v),
  complete: (v) => creatorApi.completeDraftMultipart(v),
}

async function enviarEmPutUnico(
  contractId: string,
  file: File,
  contentType: string,
  onProgress?: (fracao: number) => void,
): Promise<string> {
  const auth = await creatorApi.requestDraftUpload({ contractId, fileName: file.name, contentType })
  await subirComProgresso(
    auth.uploadUrl, file, (bytes) => onProgress?.(bytes / (file.size || 1)), contentType)
  return auth.mediaKey
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
    mutationFn: async (v: {
      contractId: string
      file: File
      notes?: string
      /** 0 a 1. Chamado durante a subida do arquivo. */
      onProgress?: (fraction: number) => void
    }) => {
      const contentType = v.file.type || "video/mp4"

      // Arquivo grande vai em partes: a queda de conexão custa só a parte em curso, e escolher o
      // mesmo arquivo de novo continua de onde parou em vez de recomeçar do zero.
      const mediaKey = v.file.size > LIMITE_PUT_UNICO
        ? await enviarEmPartes({
          contractId: v.contractId,
          file: v.file,
          contentType,
          api: multipartApi,
          putParte,
          storage: guardaEmLocalStorage(),
          onProgress: v.onProgress,
        })
        : await enviarEmPutUnico(v.contractId, v.file, contentType, v.onProgress)

      return creatorApi.submitDraft({
        contractId: v.contractId,
        mediaKey,
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

/**
 * Grava o cadastro inteiro de uma vez.
 *
 * <p>Invalida o workspace porque quase tudo na área do criador deriva dele: o nome no
 * cabeçalho, o card de documento, o gate que manda para o formulário.</p>
 */
export function useUpdateCreatorProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateCreatorProfileBody) => creatorApi.updateProfile(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-workspace"] }),
  })
}

export function useSetCreatorTaxId() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taxId: string) => creatorApi.setTaxId(taxId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-workspace"] }),
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
      mutationFn: (returnTo: PayoutReturnTo | void) =>
        creatorApi.startPayoutOnboarding(returnTo || undefined),
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

/**
 * Como o trabalho se chama na tela do criador.
 *
 * <p>"Sem campanha" é palavra de sistema: para quem foi contratado, o que existe é um
 * trabalho, com ou sem uma campanha por trás. O rótulo do avulso diz isso, em vez de
 * anunciar a ausência de um agrupamento que não é problema dele.</p>
 */
export function trabalhoLabel(campaignName: string | null | undefined): string {
  return campaignName?.trim() ? campaignName : "Trabalho avulso"
}
