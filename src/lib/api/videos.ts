import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/AuthContext"

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
}

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

export const videosApi = {
  list: (f: VideoFilters, cursor?: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListVideosResponse>(`/api/videos?${buildQuery(f, cursor)}`, { signal: opts?.signal }),
  summary: (f: VideoFilters, opts?: { signal?: AbortSignal }) =>
    apiClient.get<VideosSummary>(`/api/videos/summary?${buildSummaryQuery(f)}`, { signal: opts?.signal }),
  detail: (videoId: string, brandId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<VideoDetail>(
      `/api/videos/${videoId}?brandId=${encodeURIComponent(brandId)}`, { signal: opts?.signal }),
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
 * Contadores por sentimento (abas + total do cabeçalho). Separado do feed porque
 * NÃO depende da classificação ativa — trocar de aba não deve refazer a contagem.
 * Por isso a key omite `classificacao`.
 */
export function useVideosSummary(filters: VideoFilters | null) {
  const { activeTenantId } = useAuth()
  const key = filters
    ? { brandId: filters.brandId, from: filters.from, to: filters.to, minScore: filters.minScore, search: filters.search }
    : null
  return useQuery({
    queryKey: ["videos-summary", activeTenantId, key],
    queryFn: ({ signal }) => videosApi.summary(filters!, { signal }),
    enabled: Boolean(activeTenantId && filters?.brandId),
    staleTime: 60_000,
  })
}
