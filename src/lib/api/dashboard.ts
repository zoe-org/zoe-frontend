import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

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
  /** Variação em pontos percentuais vs. o período anterior. */
  deltaPp: number
  /** Cor escolhida pelo tenant (hex) ou null → o front deriva do id. */
  color: string | null
}
export type ShareOfVoice = { brands: SovBrand[] }

export type SovTrendSeries = {
  brandId: string
  brandName: string
  isYou: boolean
  color: string | null
  /** % de participação em cada semana. */
  data: number[]
}
export type SovTrend = { weeks: string[]; series: SovTrendSeries[] }

export type SovTopicShare = {
  brandId: string
  brandName: string
  isYou: boolean
  color: string | null
  sharePct: number
}
export type SovTopic = { topic: string; volume: number; shares: SovTopicShare[] }
export type SovByTopic = { topics: SovTopic[] }

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
// days == null → backend usa o padrão (30). Cuidado: 0 (todo o período) é válido
// e falsy, então testa `!= null`, nunca `if (days)`.
const daysParam = (days?: number) => (days != null ? `&days=${days}` : "")

export const dashboardApi = {
  summary: (brandId: string, opts?: Opts): Promise<DashboardSummary> =>
    apiClient.get(`/api/dashboard/summary?${qs(brandId)}`, { signal: opts?.signal }),
  sentiment: (brandId: string, days?: number, opts?: Opts): Promise<SentimentEvolution> =>
    apiClient.get(`/api/dashboard/sentiment?${qs(brandId)}${daysParam(days)}`, { signal: opts?.signal }),
  topVideos: (brandId: string, opts?: Opts): Promise<TopVideos> =>
    apiClient.get(`/api/dashboard/top-videos?${qs(brandId)}`, { signal: opts?.signal }),
  topKeywords: (brandId: string, days?: number, opts?: Opts): Promise<TopKeywords> =>
    apiClient.get(`/api/dashboard/keywords?${qs(brandId)}${daysParam(days)}`, { signal: opts?.signal }),
  impactEvents: (brandId: string, days?: number, opts?: Opts): Promise<ImpactEvents> =>
    apiClient.get(`/api/dashboard/impact?${qs(brandId)}${daysParam(days)}`, { signal: opts?.signal }),
  topicSentiments: (brandId: string, days?: number, opts?: Opts): Promise<TopicSentiments> =>
    apiClient.get(`/api/dashboard/topics?${qs(brandId)}${daysParam(days)}`, { signal: opts?.signal }),
  influencers: (brandId: string, opts?: Opts): Promise<Influencers> =>
    apiClient.get(`/api/dashboard/influencers?${qs(brandId)}`, { signal: opts?.signal }),
  // SoV é tenant-level (sem brandId) e gated pela feature `sov`: sem ela o
  // backend devolve 403 e a página mostra o upsell. `_tenantId` fica só pra
  // isolar a cache key no hook.
  sov: (_tenantId: string, days?: number, opts?: Opts): Promise<ShareOfVoice> =>
    apiClient.get(`/api/dashboard/sov?${days != null ? `days=${days}` : ""}`, { signal: opts?.signal }),
  sovTrend: (_tenantId: string, weeks: number, opts?: Opts): Promise<SovTrend> =>
    apiClient.get(`/api/dashboard/sov/trend?weeks=${weeks}`, { signal: opts?.signal }),
  sovTopics: (_tenantId: string, days?: number, opts?: Opts): Promise<SovByTopic> =>
    apiClient.get(`/api/dashboard/sov/topics?${days != null ? `days=${days}` : ""}`, { signal: opts?.signal }),
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

export function useSentimentEvolution(brandId: string | null, days?: number) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-sentiment", activeTenantId, brandId, days ?? null],
    queryFn: ({ signal }) => dashboardApi.sentiment(brandId!, days, { signal }),
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

export function useTopKeywords(brandId: string | null, days?: number) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-top-keywords", activeTenantId, brandId, days ?? null],
    queryFn: ({ signal }) => dashboardApi.topKeywords(brandId!, days, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

export function useImpactEvents(brandId: string | null, days?: number) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-impact", activeTenantId, brandId, days ?? null],
    queryFn: ({ signal }) => dashboardApi.impactEvents(brandId!, days, { signal }),
    enabled: Boolean(activeTenantId && brandId),
    staleTime: 60_000,
  })
}

export function useTopicSentiments(brandId: string | null, days?: number) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-topics", activeTenantId, brandId, days ?? null],
    queryFn: ({ signal }) => dashboardApi.topicSentiments(brandId!, days, { signal }),
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
export function useShareOfVoice(enabled: boolean, days?: number) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-sov", activeTenantId, days ?? null],
    queryFn: ({ signal }) => dashboardApi.sov(activeTenantId!, days, { signal }),
    enabled: Boolean(activeTenantId && enabled),
    staleTime: 60_000,
  })
}

export function useSovTrend(enabled: boolean, weeks = 12) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-sov-trend", activeTenantId, weeks],
    queryFn: ({ signal }) => dashboardApi.sovTrend(activeTenantId!, weeks, { signal }),
    enabled: Boolean(activeTenantId && enabled),
    staleTime: 60_000,
  })
}

export function useSovByTopic(enabled: boolean, days?: number) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["dashboard-sov-topics", activeTenantId, days ?? null],
    queryFn: ({ signal }) => dashboardApi.sovTopics(activeTenantId!, days, { signal }),
    enabled: Boolean(activeTenantId && enabled),
    staleTime: 60_000,
  })
}
