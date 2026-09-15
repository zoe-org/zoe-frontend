import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

/**
 * Superfície OWNED (ADR-035): como a audiência reage nos vídeos que a PRÓPRIA marca
 * publicou. Desde a ADR-063 aparece como card no Dashboard quando a marca ativa é um
 * concorrente — em todo o resto, owned está fora por definição de métrica.
 *
 * ## Por que não existe `score` aqui
 *
 * O corpus owned é permanentemente heterogêneo: vídeo do canal oficial pode chegar
 * pelo path `full`, onde `score_360` é 30% roteiro escrito pela própria marca + 20%
 * logo em quadro. Misturar isso com `owned_comments` (100% comentários) numa média
 * dá um número sem significado.
 *
 * A API resolve não devolvendo `score_360` nem `pipeline_path` neste endpoint. O que
 * vem é `audienceSentiment`: o componente de comentários, path-invariante.
 * **Não tente reconstruir o ConfidenceBadge aqui** — a ausência é a decisão.
 */

/** Sentimento da audiência: 0..1, mesma escala do score_360 e dos componentes. */
export type AudienceScore = number

/** Agregado do período. Tudo vem de COMENTÁRIOS — o roteiro owned é copy da marca. */
export type OwnedReactionSummary = {
  videoCount: number
  totalComments: number
  positives: number
  neutrals: number
  negatives: number
  /** Leitura principal: ponderada por volume de comentários. Null se ninguém comentou. */
  audienceSentiment: AudienceScore | null
  /** Rótulo pela MESMA regra do writer — a tela não inventa limiar. */
  audienceSentimentLabel: string | null
  /** Média simples entre vídeos com sinal: outra pergunta (o catálogo, não a audiência). */
  audienceSentimentPerVideo: AudienceScore | null
  /** Resolvido no servidor: as duas médias divergem com amostra suficiente. */
  audienceIsConcentrated: boolean
  videosWithAudienceSignal: number
  /** Decisão editorial da marca, não lacuna de coleta. */
  videosWithCommentsDisabled: number
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
  /** Comentários de AUDIÊNCIA (sem o dono do canal) — o peso do vídeo na média. */
  commentCount: number
  audienceSentiment: AudienceScore | null
  audienceSentimentLabel: string | null
  hasAudienceSignal: boolean
  commentsDisabled: boolean
}

export type OwnedReactionResponse = {
  brandId: string
  brandName: string
  /** OwnBrand · Competitor · Other */
  relationship: string
  summary: OwnedReactionSummary
  videos: OwnedVideoItem[]
  recurringThemes: string[]
  page: number
  pageSize: number
  totalVideos: number
}

export const ownedApi = {
  reaction: (
    brandId: string,
    range: { from?: string; to?: string },
    pageSize: number,
    opts?: { signal?: AbortSignal },
  ) => {
    const q = new URLSearchParams({ page: "1", pageSize: String(pageSize) })
    if (range.from) q.set("from", range.from)
    if (range.to) q.set("to", range.to)
    return apiClient.get<OwnedReactionResponse>(
      `/api/brands/${encodeURIComponent(brandId)}/owned-reaction?${q.toString()}`,
      { signal: opts?.signal },
    )
  },
}

/**
 * Reação nos canais oficiais. De concorrente, exige o add-on `sov` — e quem chama
 * passa `enabled` pela feature: o 403 abriria o diálogo de upgrade sozinho
 * (`featureBlocked` escuta todo erro de query, sem exceção).
 */
export function useOwnedReaction(
  brandId: string | null,
  range: { from?: string; to?: string },
  enabled: boolean,
  pageSize = 5,
) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["owned-reaction", activeTenantId, brandId, range, pageSize],
    queryFn: ({ signal }) => ownedApi.reaction(brandId!, range, pageSize, { signal }),
    enabled: Boolean(activeTenantId && brandId && enabled),
    staleTime: 60_000,
  })
}
