export type WeeklyTrend = { week: string; positive: number; neutral: number; negative: number }

export const weeklyTrend: WeeklyTrend[] = [
  { week: "Sem 1", positive: 65, neutral: 15, negative: 20 },
  { week: "Sem 2", positive: 70, neutral: 12, negative: 18 },
  { week: "Sem 3", positive: 58, neutral: 17, negative: 25 },
  { week: "Sem 4", positive: 67, neutral: 13, negative: 20 },
]

export type ImpactEvent = { id: string; date: string; title: string; delta: number }

export const impactEvents: ImpactEvent[] = [
  { id: "ie1", date: "2026-03-08", title: "Vídeo viral 'Review Nubank 2026' — Me Poupe!", delta: 0.22 },
  { id: "ie2", date: "2026-03-15", title: "Thread no Twitter sobre atendimento ruim", delta: -0.15 },
  { id: "ie3", date: "2026-03-21", title: "Lançamento PIX por aproximação", delta: 0.18 },
  { id: "ie4", date: "2026-03-28", title: "Reclamação viral — cartão bloqueado", delta: -0.12 },
]

export type TopicBreakdown = { id: string; name: string; positive: number; neutral: number; negative: number }

export const topicBreakdown: TopicBreakdown[] = [
  { id: "tb1", name: "App/UX", positive: 72, neutral: 18, negative: 10 },
  { id: "tb2", name: "Cartão de crédito", positive: 58, neutral: 22, negative: 20 },
  { id: "tb3", name: "Atendimento", positive: 30, neutral: 25, negative: 45 },
  { id: "tb4", name: "Investimentos", positive: 65, neutral: 20, negative: 15 },
]

export type TopicTag = { name: string; sentiment: "positive" | "negative" | "mixed" }

export const topicTags: TopicTag[] = [
  { name: "App/UX", sentiment: "positive" },
  { name: "PIX", sentiment: "positive" },
  { name: "Cashback", sentiment: "mixed" },
  { name: "Atendimento", sentiment: "negative" },
  { name: "Limite", sentiment: "mixed" },
  { name: "Investimentos", sentiment: "positive" },
  { name: "Taxas", sentiment: "negative" },
  { name: "Cartão virtual", sentiment: "positive" },
  { name: "Seguros", sentiment: "mixed" },
  { name: "Conta PJ", sentiment: "positive" },
]
