export type KpiItem = {
  label: string
  value: string | number
  meta?: string
  progress?: number
  barColor: "teal" | "amber" | "red"
  sublabel?: string
  valueColor?: string
}

export const kpiData: KpiItem[] = [
  { label: "Menções esta semana", value: 847, meta: "Meta: 1.000 (84%)", progress: 84, barColor: "teal" },
  { label: "Sentimento positivo", value: "67%", meta: "Meta: 70% (95%)", progress: 95, barColor: "teal" },
  { label: "Alcance estimado", value: "4.2M", meta: "Meta: 5M (84%)", progress: 84, barColor: "amber" },
  { label: "Alertas ativos", value: 3, sublabel: "2 críticos · 1 aviso", barColor: "red", valueColor: "text-[#DC2626]" },
]

export type SentimentChartDay = {
  date: string
  positive: number
  negative: number
}

export const sentimentChart: SentimentChartDay[] = [
  { date: "01/03", positive: 42, negative: 8 },
  { date: "05/03", positive: 56, negative: 12 },
  { date: "10/03", positive: 38, negative: 15 },
  { date: "15/03", positive: 61, negative: 9 },
  { date: "20/03", positive: 47, negative: 18 },
  { date: "25/03", positive: 53, negative: 11 },
  { date: "30/03", positive: 65, negative: 7 },
]

export type AlertItem = {
  id: string
  type: "critical" | "warning" | "info"
  text: string
  timeAgo: string
}

export const recentAlerts: AlertItem[] = [
  { id: "a1", type: "critical", text: "Pico de sentimento negativo detectado para Nubank", timeAgo: "2h atrás" },
  { id: "a2", type: "warning", text: "#publi ausente em vídeo de @financeiro_br", timeAgo: "5h atrás" },
  { id: "a3", type: "info", text: "Share of voice subiu para 32%", timeAgo: "1d atrás" },
]

export type MentionItem = {
  id: string
  title: string
  creator: string
  sentiment: "positive" | "negative" | "neutral"
  snippet: string
  timeAgo: string
}

export const recentMentions: MentionItem[] = [
  { id: "m1", title: "Review do cartão Nubank 2026", creator: "@financeiro_br", sentiment: "positive", snippet: "O app continua sendo o melhor do mercado...", timeAgo: "3h" },
  { id: "m2", title: "Problemas com atendimento", creator: "@consumidor_real", sentiment: "negative", snippet: "Tentei resolver pelo chat e não consegui...", timeAgo: "6h" },
  { id: "m3", title: "Comparativo de bancos digitais", creator: "@tech_review", sentiment: "neutral", snippet: "Nubank aparece em terceiro lugar no ranking...", timeAgo: "12h" },
]

export type InfluencerItem = {
  id: string
  name: string
  handle: string
  mentions: number
  sentiment: "positive" | "negative" | "neutral"
  platform: "YT" | "TT" | "IG"
}

export const topInfluencers: InfluencerItem[] = [
  { id: "i1", name: "Me Poupe!", handle: "@mepoupenathalia", mentions: 12, sentiment: "positive", platform: "YT" },
  { id: "i2", name: "Primo Rico", handle: "@primorico", mentions: 9, sentiment: "positive", platform: "YT" },
  { id: "i3", name: "Nath Finanças", handle: "@nfrancaa", mentions: 7, sentiment: "neutral", platform: "IG" },
  { id: "i4", name: "Dinheiro com Você", handle: "@dinheirocomvc", mentions: 5, sentiment: "positive", platform: "TT" },
  { id: "i5", name: "Finclass", handle: "@finaborges", mentions: 4, sentiment: "negative", platform: "YT" },
]

export type HotTopic = {
  id: string
  name: string
  mentions: number
  trend: "up" | "down" | "stable"
  sentimentSplit: { positive: number; neutral: number; negative: number }
}

export const hotTopics: HotTopic[] = [
  { id: "t1", name: "App/UX", mentions: 234, trend: "up", sentimentSplit: { positive: 72, neutral: 18, negative: 10 } },
  { id: "t2", name: "Cartão de crédito", mentions: 189, trend: "stable", sentimentSplit: { positive: 58, neutral: 22, negative: 20 } },
  { id: "t3", name: "Atendimento", mentions: 156, trend: "down", sentimentSplit: { positive: 30, neutral: 25, negative: 45 } },
  { id: "t4", name: "Investimentos", mentions: 134, trend: "up", sentimentSplit: { positive: 65, neutral: 20, negative: 15 } },
  { id: "t5", name: "Taxas e tarifas", mentions: 98, trend: "down", sentimentSplit: { positive: 20, neutral: 35, negative: 45 } },
  { id: "t6", name: "PIX e transferências", mentions: 87, trend: "up", sentimentSplit: { positive: 80, neutral: 15, negative: 5 } },
]
