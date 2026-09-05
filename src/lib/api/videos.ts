import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

// Espelha VideoListItem / ListVideosResponse do zoe-api (GET /api/videos?brandId=).
export type VideoListItem = {
  analysisId: string
  videoId: string
  youtubeVideoId: string
  title: string
  channelName: string
  publishedAt: string
  durationSeconds: number
  status: string
  score: number | null
  classificacao: string | null
  confidence: number | null
  processedAt: string | null
  nerMode: string
  pipelinePath: string
  /** Views do YouTube na captura mais recente. null = ainda não coletado. */
  views: number | null
  /** ADR-035: "Owned" (canal oficial da marca) ou "ThirdParty". */
  channelRelation: ChannelRelation
  /**
   * Comentários ANALISADOS (roll-up da análise), não o contador do YouTube — o
   * snapshot de metadados grava 0 na ingestão. É o mesmo número do drawer.
   * null = análise sem agregado; a lista não mostra nada nesse caso.
   */
  commentsCount: number | null
}

/** Serializado pelo nome do enum C# (PascalCase), como os demais enums do read-API. */
export type ChannelRelation = "Owned" | "ThirdParty"

/**
 * Filtro de view do Monitoramento (ADR-035, D4). É EFÊMERO — vive no estado da
 * sessão, nunca em configuração de tenant: métrica cuja definição muda por
 * configuração deixa de ser comparável entre tenants e ao longo do tempo.
 */
export type ChannelRelationFilter = "earned" | "owned" | "all"

export const DEFAULT_CHANNEL_RELATION: ChannelRelationFilter = "earned"

/**
 * Lê o filtro de um valor de URL, com fallback SEMPRE em earned.
 *
 * O default seguro importa porque a URL é compartilhável e sobrevive em bookmark:
 * link antigo, typo ou param renomeado não podem escorregar para `all` e passar a
 * mostrar conteúdo próprio dentro de uma contagem sem o usuário pedir. Mesmo
 * raciocínio do `ThirdParty = 0` no backend — na dúvida, o bucket que já é o
 * comportamento atual.
 *
 * Deliberadamente estrito: só os três valores conhecidos passam, e o default fica
 * FORA da URL (`""` → earned) pra manter o link limpo no caso comum.
 */
export function parseChannelRelation(raw: string | null | undefined): ChannelRelationFilter {
  return raw === "owned" || raw === "all" ? raw : DEFAULT_CHANNEL_RELATION
}

/**
 * Um vídeo owned analisado pelo path pesado (`Full`/`VideoCaption`) tem score
 * contaminado: 30% roteiro escrito pela própria marca + 20% logo garantido em
 * quadro. São reais e vão continuar aparecendo — as análises do backfill e tudo
 * que chegar antes de o zoe-ai-engine rotear owned.
 *
 * Nesses casos o número NÃO é leitura de audiência e o ConfidenceBadge diria
 * "análise completa, alta confiança" (doc 05 §4.1). A tela usa isto pra não
 * exibir o score como se medisse reação.
 */
export function hasSelfMeasuredScore(item: VideoListItem): boolean {
  return item.channelRelation === "Owned" && !AUDIENCE_ONLY_PATHS.has(item.pipelinePath)
}

/**
 * Paths cujo score é 100% comentários — a única leitura limpa em vídeo owned.
 *
 * Definido por INCLUSÃO e não por exclusão de propósito: listar os contaminados
 * deixaria um path novo passar como limpo por omissão, que é o pior default. Aqui
 * um path desconhecido cai automaticamente em "contaminado" quando o vídeo é owned.
 *
 * `CaptionFallback` NÃO está na lista: é legenda(0.30) + comentários(0.50), e em
 * vídeo owned a legenda é o roteiro da própria marca — mesma contaminação de `Full`,
 * só que com um componente a menos.
 *
 * `CommentsOnly` está: apesar de ser o path DEGRADADO, sua composição é comentário
 * puro. O badge comunica a degradação; o número em si é leitura honesta de audiência.
 */
const AUDIENCE_ONLY_PATHS = new Set(["CommentsOnly", "OwnedComments", "OwnedNoSignal"])

export type ListVideosResponse = { items: VideoListItem[]; nextCursor: string | null }

// Espelha VideosSummaryResponse (GET /api/videos/summary).
export type VideosSummary = {
  total: number
  positive: number
  neutral: number
  negative: number
  inconclusive: number
}

// "" = mais recentes (padrão do backend); os demais mapeiam pra VideoSort.
export type VideoSort = "" | "oldest" | "score"

export type VideoFilters = {
  brandId: string
  from?: string
  to?: string
  classificacao?: string
  minScore?: number
  search?: string
  sort?: VideoSort
  limit?: number
  /** Default earned. Filtro de sessão, nunca persistido (ADR-035, D4). */
  channelRelation?: ChannelRelationFilter
}

function buildQuery(f: VideoFilters, cursor?: string): string {
  const p = new URLSearchParams()
  p.set("brandId", f.brandId)
  if (f.from) p.set("from", f.from)
  if (f.to) p.set("to", f.to)
  if (f.classificacao) p.set("classificacao", f.classificacao)
  if (f.minScore != null) p.set("minScore", String(f.minScore))
  if (f.search) p.set("search", f.search)
  if (f.sort) p.set("sort", f.sort)
  if (f.limit) p.set("limit", String(f.limit))
  if (f.channelRelation) p.set("channelRelation", f.channelRelation)
  if (cursor) p.set("cursor", cursor)
  return p.toString()
}

// A summary ignora paginação e classificação (as abas particionam isso); os
// demais filtros valem, pra contar dentro do período/score/busca atuais.
function buildSummaryQuery(f: VideoFilters): string {
  const p = new URLSearchParams()
  p.set("brandId", f.brandId)
  if (f.from) p.set("from", f.from)
  if (f.to) p.set("to", f.to)
  if (f.minScore != null) p.set("minScore", String(f.minScore))
  if (f.search) p.set("search", f.search)
  // TEM que espelhar o filtro da lista: são os contadores DAQUELE feed. Omitir
  // aqui produz aba dizendo "42" sobre uma lista que mostra 38.
  if (f.channelRelation) p.set("channelRelation", f.channelRelation)
  return p.toString()
}

// Subconjunto de GetVideoResponse que o drawer usa (transcrição + visual). O
// texto já vem truncado do backend (flag `truncated`), então é seguro exibir.
export type TranscriptPreview = {
  source: string
  language: string
  text: string
  truncated: boolean
}
export type VideoDetail = {
  videoId: string
  youtubeVideoId: string
  transcript: TranscriptPreview | null
}

/**
 * Transcrição completa (`GET /api/videos/{id}/transcript`). Vem do S3, não do
 * Postgres: o `transcript` do detalhe é a prévia de 300 caracteres que o pipeline
 * grava no banco. `complete: false` significa que o arquivo não pôde ser lido e o
 * que voltou é a prévia — a UI TEM que dizer isso em vez de chamar de "completa".
 */
export type TranscriptSegment = {
  startSeconds: number
  endSeconds: number
  text: string
}
export type TranscriptFull = {
  source: string
  language: string
  text: string
  truncated: boolean
  complete: boolean
  /** Vazio quando a fonte não tem timestamp por frase (ver o handler). */
  segments: TranscriptSegment[]
}

export const videosApi = {
  list: (f: VideoFilters, cursor?: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListVideosResponse>(`/api/videos?${buildQuery(f, cursor)}`, { signal: opts?.signal }),
  summary: (f: VideoFilters, opts?: { signal?: AbortSignal }) =>
    apiClient.get<VideosSummary>(`/api/videos/summary?${buildSummaryQuery(f)}`, { signal: opts?.signal }),
  detail: (videoId: string, brandId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<VideoDetail>(
      `/api/videos/${videoId}?brandId=${encodeURIComponent(brandId)}`, { signal: opts?.signal }),
  transcript: (videoId: string, brandId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<TranscriptFull>(
      `/api/videos/${videoId}/transcript?brandId=${encodeURIComponent(brandId)}`,
      { signal: opts?.signal }),
}

/**
 * Feed cursor-based de vídeos/análises de uma brand. `tenantId` na key isola o
 * cache (troca de tenant nunca serve dado do anterior); `signal` cancela via
 * TanStack Query. Desabilitado sem tenant/brand.
 */
export function useVideosFeed(filters: VideoFilters | null) {
  const { activeTenantId } = useAuth()
  return useInfiniteQuery({
    queryKey: ["videos", activeTenantId, filters],
    queryFn: ({ pageParam, signal }) =>
      videosApi.list(filters!, pageParam, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(activeTenantId && filters?.brandId),
    staleTime: 60_000,
  })
}

/**
 * Detalhe do vídeo (transcrição) para o drawer. Precisa de brandId porque o
 * endpoint é escopado à análise da brand assinada. Só busca com o drawer aberto.
 */
export function useVideoDetail(videoId: string | null, brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["video-detail", activeTenantId, videoId, brandId],
    queryFn: ({ signal }) => videosApi.detail(videoId!, brandId!, { signal }),
    enabled: Boolean(activeTenantId && videoId && brandId),
    staleTime: 60_000,
  })
}

/**
 * Transcrição completa, só quando o modal abre. Fica FORA do `useVideoDetail` de
 * propósito: é uma leitura de S3 por chamada, e a maioria dos cliques no drawer
 * nunca abre a transcrição.
 */
export function useVideoTranscript(videoId: string | null, brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["video-transcript", activeTenantId, videoId, brandId],
    queryFn: ({ signal }) => videosApi.transcript(videoId!, brandId!, { signal }),
    enabled: Boolean(activeTenantId && videoId && brandId),
    staleTime: 5 * 60_000,
  })
}

/**
 * Contadores por sentimento (abas + total do cabeçalho). Separado do feed porque
 * NÃO depende da classificação ativa — trocar de aba não deve refazer a contagem.
 * Por isso a key omite `classificacao`.
 */
export function useVideosSummary(filters: VideoFilters | null) {
  const { activeTenantId } = useAuth()
  const key = filters
    ? {
        brandId: filters.brandId,
        from: filters.from,
        to: filters.to,
        minScore: filters.minScore,
        search: filters.search,
        // RN-I-066: channelRelation entra na key. Sem isto, trocar o filtro serve
        // a contagem do filtro anterior — o bug de "42 vs 38" pela via do cache.
        channelRelation: filters.channelRelation,
      }
    : null
  return useQuery({
    queryKey: ["videos-summary", activeTenantId, key],
    queryFn: ({ signal }) => videosApi.summary(filters!, { signal }),
    enabled: Boolean(activeTenantId && filters?.brandId),
    staleTime: 60_000,
  })
}
