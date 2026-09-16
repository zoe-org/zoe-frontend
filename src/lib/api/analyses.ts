import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

// Espelha GetAnalysisDetailResponse e filhos do zoe-api (GET /api/analyses/{id}).
export type ScoreComponent = {
  source: string
  weight: number
  value: number
  sentiment: string | null
  totalComments: number | null
}

export type CommentAggregate = {
  totalComments: number
  positivesCount: number
  neutralsCount: number
  negativesCount: number
  sentiment: string
}

export type AnalysisMention = { id: string; mentionText: string; isCanonical: boolean }

export type AnalysisKeywordScore = {
  keyword: string
  source: string
  score: number
  sentiment: string
  origin: "base" | "custom"
}

export type AnalysisDetail = {
  analysisId: string
  brandId: string
  videoId: string
  videoTitle: string
  youtubeVideoId: string
  pipelinePath: string
  triageScore: number
  nerMode: string
  status: string
  score: number | null
  classificacao: string | null
  confidence: number | null
  processedAt: string | null
  s3ResultKey: string | null
  errorMessage: string | null
  scoreComponents: ScoreComponent[]
  commentAggregate: CommentAggregate | null
  mentions: AnalysisMention[]
  keywordScores: AnalysisKeywordScore[]
}

export type CommentItem = {
  commentId: string
  youtubeCommentId: string
  author: string
  text: string
  publishedAt: string
  likesCount: number
  sentiment: string
  score: number
}
export type ListCommentsResponse = { items: CommentItem[] }

export const analysesApi = {
  detail: (analysisId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<AnalysisDetail>(`/api/analyses/${analysisId}`, { signal: opts?.signal }),
  comments: (
    analysisId: string,
    opts?: { sentiment?: string; limit?: number; signal?: AbortSignal },
  ) => {
    const p = new URLSearchParams()
    if (opts?.sentiment) p.set("sentiment", opts.sentiment)
    if (opts?.limit) p.set("limit", String(opts.limit))
    const qs = p.toString()
    return apiClient.get<ListCommentsResponse>(
      `/api/analyses/${analysisId}/comments${qs ? `?${qs}` : ""}`,
      { signal: opts?.signal },
    )
  },
}

/** Detalhe da análise (componentes, mentions, keyword scores). Desabilitado sem id. */
export function useAnalysisDetail(analysisId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["analysis", activeTenantId, analysisId],
    queryFn: ({ signal }) => analysesApi.detail(analysisId!, { signal }),
    enabled: Boolean(activeTenantId && analysisId),
    staleTime: 60_000,
  })
}

/**
 * Comentários notáveis da análise (top-N por likes), com filtro opcional de
 * sentiment. `limit` entra na key: o drawer pede o default (50) e o modal "ver
 * todos" pede o teto (200) — sem isso o segundo receberia o cache do primeiro e
 * mostraria 50 dizendo que são todos.
 */
export function useAnalysisComments(
  analysisId: string | null,
  opts?: { sentiment?: string; limit?: number },
) {
  const { activeTenantId } = useAuth()
  const { sentiment, limit } = opts ?? {}
  return useQuery({
    queryKey: ["analysis-comments", activeTenantId, analysisId, sentiment ?? null, limit ?? null],
    queryFn: ({ signal }) => analysesApi.comments(analysisId!, { sentiment, limit, signal }),
    enabled: Boolean(activeTenantId && analysisId),
    staleTime: 60_000,
  })
}
