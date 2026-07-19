import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/features/auth/AuthContext"

// Endpoints /api/dashboard/* ainda NÃO existem (Júlia está batched na 3.A). Os
// tipos abaixo são o shape combinado esperado; cada método do dashboardApi
// devolve MOCK atrás da mesma assinatura da versão real — trocar mock→real vira
// 1 linha (o `apiClient.get(...)` comentado). Shapes provisórios: alinhar com o
// zoe-api quando os endpoints saírem.

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

// ── mock determinístico (só até os endpoints existirem) ────────────────────

function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h += 0x6d2b79f5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function mockSummary(brandId: string): DashboardSummary {
  const r = seeded(brandId + "summary")
  return { totalMentions: Math.floor(80 + r() * 120), avgScore: 0.45 + r() * 0.35, deltaPct30d: Math.round((r() * 30 - 10) * 10) / 10 }
}

function mockSentiment(brandId: string): SentimentEvolution {
  const r = seeded(brandId + "sent")
  const points: SentimentPoint[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i))
    const pos = Math.floor(2 + r() * 8), neu = Math.floor(1 + r() * 5), neg = Math.floor(r() * 4)
    const total = pos + neu + neg || 1
    return { date: d.toISOString().slice(0, 10), positive: pos, neutral: neu, negative: neg, avgScore: (pos - neg) / total / 2 + 0.5 }
  })
  return { brandId, points }
}

function mockSov(tenantId: string): ShareOfVoice {
  const r = seeded(tenantId + "sov")
  const names = ["Sua marca", "Concorrente A", "Concorrente B", "Concorrente C", "Concorrente D"]
  const raw = names.map((n, i) => ({ name: n, isYou: i === 0, weight: 10 + r() * 40 }))
  const total = raw.reduce((a, b) => a + b.weight, 0)
  return {
    brands: raw
      .map((b, i) => ({
        brandId: `sov-${tenantId}-${i}`,
        brandName: b.name,
        mentions: Math.floor(b.weight * 3),
        sharePct: Math.round((b.weight / total) * 100),
        isYou: b.isYou,
      }))
      .sort((a, b) => b.sharePct - a.sharePct),
  }
}

function mockTopKeywords(brandId: string): TopKeywords {
  const r = seeded(brandId + "kw")
  const words = ["atendimento", "app", "pix", "cashback", "limite", "taxas", "investimentos", "cartão", "seguro", "conta"]
  const sents = ["Positive", "Neutral", "Negative"]
  return {
    items: words.map((w) => ({
      keyword: w,
      volume: Math.floor(5 + r() * 45),
      sentiment: sents[Math.floor(r() * sents.length)],
    })).sort((a, b) => b.volume - a.volume),
  }
}

function mockTopVideos(brandId: string): TopVideos {
  const r = seeded(brandId + "top")
  const paths = ["Full", "CommentsOnly", "CaptionFallback", "Full"]
  const cls = ["Positive", "Neutral", "Negative", "Positive"]
  return {
    items: Array.from({ length: 5 }, (_, i) => ({
      analysisId: `mock-${brandId}-${i}`,
      youtubeVideoId: `vid${i}`,
      title: `Vídeo em alta #${i + 1}`,
      channelName: "Canal exemplo",
      score: Math.round((0.4 + r() * 0.5) * 100) / 100,
      classificacao: cls[i % cls.length],
      confidence: Math.round((0.6 + r() * 0.35) * 100) / 100,
      pipelinePath: paths[i % paths.length],
    })),
  }
}

type Opts = { signal?: AbortSignal }

// Resolve respeitando abort (espelha o comportamento cancelável da versão real).
function mockResolve<T>(value: T, opts?: Opts): Promise<T> {
  return opts?.signal?.aborted
    ? Promise.reject(new DOMException("Aborted", "AbortError"))
    : Promise.resolve(value)
}

export const dashboardApi = {
  summary: (brandId: string, opts?: Opts): Promise<DashboardSummary> =>
    // TODO(3.A): apiClient.get(`/api/dashboard/summary?brandId=${brandId}`, { signal: opts?.signal })
    mockResolve(mockSummary(brandId), opts),
  sentiment: (brandId: string, opts?: Opts): Promise<SentimentEvolution> =>
    // TODO(3.A): apiClient.get(`/api/dashboard/sentiment?brandId=${brandId}`, { signal: opts?.signal })
    mockResolve(mockSentiment(brandId), opts),
  topVideos: (brandId: string, opts?: Opts): Promise<TopVideos> =>
    // TODO(3.A): apiClient.get(`/api/dashboard/top-videos?brandId=${brandId}`, { signal: opts?.signal })
    mockResolve(mockTopVideos(brandId), opts),
  topKeywords: (brandId: string, opts?: Opts): Promise<TopKeywords> =>
    // TODO(3.A): apiClient.get(`/api/dashboard/keywords?brandId=${brandId}`, { signal: opts?.signal })
    mockResolve(mockTopKeywords(brandId), opts),
  // SoV é gated por feature `sov`; o backend também retorna 403 sem a feature.
  sov: (tenantId: string, opts?: Opts): Promise<ShareOfVoice> =>
    // TODO(3.A): apiClient.get(`/api/dashboard/sov`, { signal: opts?.signal })
    mockResolve(mockSov(tenantId), opts),
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
