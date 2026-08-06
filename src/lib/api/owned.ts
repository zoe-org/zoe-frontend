import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

/**
 * Superfícies OWNED (ADR-035): reação da audiência em canal oficial e drill-down
 * competitivo. São os dois únicos lugares do produto que agregam conteúdo owned
 * de propósito — em todo o resto, owned está fora por definição de métrica.
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
 * A API resolve não devolvendo `score_360` nem `pipeline_path` nestes endpoints.
 * O que vem é `audienceSentiment`: o componente de comentários, path-invariante.
 * **Não tente reconstruir o ConfidenceBadge aqui** — a ausência é a decisão.
 */

/** Sentimento da audiência: 0..1, mesma escala do score_360 e dos componentes. */
export type AudienceScore = number

export type OwnedReactionSummary = {
  videoCount: number
  totalComments: number
  positives: number
  neutrals: number
  negatives: number
  /**
   * LEITURA PRINCIPAL: ponderada por volume de comentários — a unidade é quem
   * comentou, não o vídeo. null quando ninguém comentou (nunca zero).
   */
  audienceSentiment: AudienceScore | null
  /** Rótulo pronto do servidor. Não derivar limiar no frontend. */
  audienceSentimentLabel: string | null
  /**
   * Média SIMPLES entre vídeos com sinal — cada vídeo pesa igual. Outra pergunta:
   * "como o catálogo performa em média". Deve aparecer JUNTO da ponderada: a
   * distância entre as duas é que revela concentração de audiência num vídeo.
   */
  audienceSentimentPerVideo: AudienceScore | null
  /**
   * Reação concentrada em poucos vídeos. Vem RESOLVIDO do servidor — limiar e piso
   * de amostra vivem lá (AudienceSentiment), porque "está concentrada" é afirmação
   * sobre o dado e um alerta ou relatório precisaria do mesmo sinal.
   */
  audienceIsConcentrated: boolean
  videosWithAudienceSignal: number
  /**
   * A marca DESATIVOU os comentários. Conteúdo, não erro — ação editorial
   * deliberada, e no canal de um concorrente é dos sinais mais valiosos da tela.
   * Não renderizar com a mesma estética de "faltou dado".
   */
  videosWithCommentsDisabled: number
  /** Sem audiência por outros motivos (zero comentários ou lacuna de coleta). */
  videosWithoutAudienceSignal: number
}

export type OwnedVideoItem = {
  analysisId: string
  videoId: string
  youtubeVideoId: string
  title: string
  publishedAt: string
  url: string
  views: number | null
  /** Comentários de audiência (exclui o dono do canal). É o peso na média. */
  commentCount: number
  audienceSentiment: AudienceScore | null
  audienceSentimentLabel: string | null
  hasAudienceSignal: boolean
  /** Comentários desativados pela marca. Eixo separado de `hasAudienceSignal`. */
  commentsDisabled: boolean
}

export type OwnedReactionResponse = {
  brandId: string
  brandName: string
  relationship: string
  summary: OwnedReactionSummary
  videos: OwnedVideoItem[]
  recurringThemes: string[]
  page: number
  pageSize: number
  totalVideos: number
}

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

export type OwnedReactionParams = {
  brandId: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

function buildOwnedQuery(p: OwnedReactionParams): string {
  const q = new URLSearchParams()
  if (p.from) q.set("from", p.from)
  if (p.to) q.set("to", p.to)
  if (p.page) q.set("page", String(p.page))
  if (p.pageSize) q.set("pageSize", String(p.pageSize))
  return q.toString()
}

export const ownedApi = {
  reaction: (p: OwnedReactionParams, opts?: { signal?: AbortSignal }) =>
    apiClient.get<OwnedReactionResponse>(
      `/api/brands/${encodeURIComponent(p.brandId)}/owned-reaction?${buildOwnedQuery(p)}`,
      { signal: opts?.signal },
    ),
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

/** Reação da audiência no canal oficial da marca. `tenantId` na key isola o cache (RN-I-066). */
export function useOwnedReaction(params: OwnedReactionParams | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["owned-reaction", activeTenantId, params],
    queryFn: ({ signal }) => ownedApi.reaction(params!, { signal }),
    enabled: Boolean(activeTenantId && params?.brandId),
    staleTime: 60_000,
  })
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
