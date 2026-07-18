import { useInfiniteQuery } from "@tanstack/react-query"
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
}

export type ListVideosResponse = { items: VideoListItem[]; nextCursor: string | null }

export type VideoFilters = {
  brandId: string
  from?: string
  to?: string
  classificacao?: string
  minScore?: number
  search?: string
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
  if (f.limit) p.set("limit", String(f.limit))
  if (cursor) p.set("cursor", cursor)
  return p.toString()
}

export const videosApi = {
  list: (f: VideoFilters, cursor?: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListVideosResponse>(`/api/videos?${buildQuery(f, cursor)}`, { signal: opts?.signal }),
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
