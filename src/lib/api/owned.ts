import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

/**
 * Superfície OWNED (ADR-035): o bloco de canal do concorrente no drill-down
 * competitivo — único lugar do produto que agrega conteúdo owned de propósito.
 * Em todo o resto, owned está fora por definição de métrica.
 *
 * ## Por que não existe `score` aqui
 *
 * O corpus owned é permanentemente heterogêneo: as análises do backfill foram
 * classificadas mas não reprocessadas, e enquanto o `zoe-ai-engine` não rotear
 * owned, vídeo do canal oficial continua chegando pelo path `full` — onde
 * `score_360` é 30% roteiro escrito pela própria marca + 20% logo em quadro.
 * Misturar isso com `owned_comments` (100% comentários) numa média dá um número
 * sem significado.
 *
 * A API resolve não devolvendo `score_360` nem `pipeline_path` neste endpoint.
 * O que vem é `audienceSentiment`: o componente de comentários, path-invariante.
 * **Não tente reconstruir o ConfidenceBadge aqui** — a ausência é a decisão.
 */

/** Sentimento da audiência: 0..1, mesma escala do score_360 e dos componentes. */
export type AudienceScore = number

export type SentimentBreakdown = {
  positives: number
  neutrals: number
  negatives: number
}

/** O que TERCEIROS falam do concorrente. Comparável ao próprio earned do cliente. */
export type CompetitorEarnedBlock = {
  videoCount: number
  sentiment: SentimentBreakdown
  averageScore: number | null
  topChannels: { channelId: string; channelName: string; videoCount: number }[]
  /** Fatia no total de menções earned do período, 0..1. */
  sovShare: number
}

/** Como a audiência reage nos canais DELE. NÃO comparável com o bloco earned. */
export type CompetitorOwnedBlock = {
  videoCount: number
  commentSentiment: SentimentBreakdown
  totalComments: number
  audienceSentiment: AudienceScore | null
  audienceSentimentLabel: string | null
  audienceSentimentPerVideo: AudienceScore | null
  audienceIsConcentrated: boolean
  videosWithAudienceSignal: number
  videosWithCommentsDisabled: number
  videosWithoutAudienceSignal: number
  recentVideos: {
    youtubeVideoId: string
    title: string
    publishedAt: string
    views: number | null
    commentCount: number
    audienceSentiment: AudienceScore | null
  }[]
}

export type CompetitorDetailResponse = {
  brand: { id: string; name: string; slug: string }
  earned: CompetitorEarnedBlock
  owned: CompetitorOwnedBlock
}

export const ownedApi = {
  competitorDetail: (
    brandId: string,
    range?: { from?: string; to?: string },
    opts?: { signal?: AbortSignal },
  ) => {
    const q = new URLSearchParams()
    if (range?.from) q.set("from", range.from)
    if (range?.to) q.set("to", range.to)
    return apiClient.get<CompetitorDetailResponse>(
      `/api/competitors/${encodeURIComponent(brandId)}/detail?${q.toString()}`,
      { signal: opts?.signal },
    )
  },
}

/** Drill-down do concorrente. Gated por `sov` no backend — 403 vira upsell na tela. */
export function useCompetitorDetail(
  brandId: string | null,
  range?: { from?: string; to?: string },
) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["competitor-detail", activeTenantId, brandId, range],
    queryFn: ({ signal }) => ownedApi.competitorDetail(brandId!, range, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}
