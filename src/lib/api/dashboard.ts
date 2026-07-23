import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/AuthContext"

// Endpoints /api/dashboard/* brand-scoped agora são REAIS (agregam das análises
// no Postgres): summary, sentiment, top-videos, keywords, impact, topics. Marca
// sem análise devolve vazio/zeros — nada fabricado. Só o Share of Voice segue
// mock (é tenant-level e feature-gated; entra num próximo passo).

export type DashboardSummary = {
  totalMentions: number
  avgScore: number
  deltaPct30d: number
}

export type SentimentPoint = {
  date: string
  positive: number
  neutral: number
  negative: number
  avgScore: number
}
export type SentimentEvolution = { brandId: string; points: SentimentPoint[] }

export type SovBrand = {
  brandId: string
  brandName: string
  mentions: number
  sharePct: number
  isYou: boolean
}
export type ShareOfVoice = { brands: SovBrand[] }

export type TopVideo = {
  analysisId: string
  youtubeVideoId: string
  title: string
  channelName: string
  score: number | null
  classificacao: string | null
  confidence: number | null
  pipelinePath: string
}
export type TopVideos = { items: TopVideo[] }

export type TopKeyword = { keyword: string; volume: number; sentiment: string }
export type TopKeywords = { items: TopKeyword[] }

// Menção que mais moveu o net score no período (design: "Eventos de impacto").
export type ImpactEvent = {
  analysisId: string
  date: string
  title: string
  channelName: string
  /** Contribuição no net score: + puxou pra cima, − pra baixo. */
  delta: number
  sentiment: "Positive" | "Neutral" | "Negative"
}
export type ImpactEvents = { items: ImpactEvent[] }

// Sentimento agregado por tópico extraído (design: "Sentimento por tópico").
export type TopicSentiment = {
  label: string
  volume: number
  /** pos+neu+neg somam 100. */
  pos: number
  neu: number
  neg: number
}
export type TopicSentiments = { items: TopicSentiment[] }

// Influenciadores: canais que mencionaram a marca, agregados por canal (Etapa 4.5).
// `subscribers` vem de channel_snapshots (collector) — null até o pipeline popular,
// e a tela degrada para tier-por-alcance nesse caso.
export type Influencer = {
  channelId: string
  name: string
  mentions: number
  reach: number
  avgScore: number
  subscribers: number | null
  platform: string
  trend: "up" | "down" | "stable"
}
export type InfluencerTotals = {
  totalMentions: number
  totalReach: number
  totalSubscribers: number
  avgScore: number
  count: number
}
export type Influencers = { items: Influencer[]; totals: InfluencerTotals }

type Opts = { signal?: AbortSignal }

const qs = (brandId: string) => `brandId=${encodeURIComponent(brandId)}`

export const dashboardApi = {
  summary: (brandId: string, opts?: Opts): Promise<DashboardSummary> =>
    apiClient.get(`/api/dashboard/summary?${qs(brandId)}`, { signal: opts?.signal }),
  sentiment: (brandId: string, opts?: Opts): Promise<SentimentEvolution> =>
    apiClient.get(`/api/dashboard/sentiment?${qs(brandId)}`, { signal: opts?.signal }),
  topVideos: (brandId: string, opts?: Opts): Promise<TopVideos> =>
    apiClient.get(`/api/dashboard/top-videos?${qs(brandId)}`, { signal: opts?.signal }),
  topKeywords: (brandId: string, opts?: Opts): Promise<TopKeywords> =>
    apiClient.get(`/api/dashboard/keywords?${qs(brandId)}`, { signal: opts?.signal }),
  impactEvents: (brandId: string, opts?: Opts): Promise<ImpactEvents> =>
    apiClient.get(`/api/dashboard/impact?${qs(brandId)}`, { signal: opts?.signal }),
  topicSentiments: (brandId: string, opts?: Opts): Promise<TopicSentiments> =>
    apiClient.get(`/api/dashboard/topics?${qs(brandId)}`, { signal: opts?.signal }),
  influencers: (brandId: string, opts?: Opts): Promise<Influencers> =>
    apiClient.get(`/api/dashboard/influencers?${qs(brandId)}`, { signal: opts?.signal }),
  // SoV é tenant-level (sem brandId) e gated pela feature `sov`: sem ela o
  // backend devolve 403 e a página mostra o upsell. `_tenantId` fica só pra
  // isolar a cache key no hook.
  sov: (_tenantId: string, opts?: Opts): Promise<ShareOfVoice> =>
    apiClient.get(`/api/dashboard/sov`, { signal: opts?.signal }),
}

// ── hooks (tenantId na key = isolamento por tenant) ────────────────────────

export function useDashboardSummary(brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-summary", activeTenantId, brandId],
    queryFn: ({ signal }) => dashboardApi.summary(brandId!, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

export function useSentimentEvolution(brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-sentiment", activeTenantId, brandId],
    queryFn: ({ signal }) => dashboardApi.sentiment(brandId!, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

export function useTopVideos(brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-top-videos", activeTenantId, brandId],
    queryFn: ({ signal }) => dashboardApi.topVideos(brandId!, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

export function useTopKeywords(brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-top-keywords", activeTenantId, brandId],
    queryFn: ({ signal }) => dashboardApi.topKeywords(brandId!, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

export function useImpactEvents(brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-impact", activeTenantId, brandId],
    queryFn: ({ signal }) => dashboardApi.impactEvents(brandId!, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

export function useTopicSentiments(brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-topics", activeTenantId, brandId],
    queryFn: ({ signal }) => dashboardApi.topicSentiments(brandId!, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

export function useInfluencers(brandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-influencers", activeTenantId, brandId],
    queryFn: ({ signal }) => dashboardApi.influencers(brandId!, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

/**
 * Share of Voice (tenant-level). `enabled` deve refletir a feature `sov` — a
 * página não deve nem chamar quando gated; o backend também retorna 403, tratado
 * como upsell na página (a UI não depende só de si).
 */
export function useShareOfVoice(enabled: boolean) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-sov", activeTenantId],
    queryFn: ({ signal }) => dashboardApi.sov(activeTenantId!, { signal }),
    enabled: Boolean(activeTenantId && enabled),
    staleTime: 60_000,
  })
}
