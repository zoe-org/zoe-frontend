export type Platform = "YT" | "TT" | "IG" | "Podcast"

export type Mention = {
  id: string
  title: string
  creator: string
  handle: string
  platform: Platform
  sentiment: "positive" | "negative" | "neutral"
  sentimentScore: number
  views: string
  timeAgo: string
  hasLogo: boolean
  transcript: { timestamp: string; text: string; highlightedBrand: string }[]
  logoFrames: string[]
  logoExposure: string
  logoAvgSize: string
}

export const mentions: Mention[] = [
  {
    id: "mn1", title: "Review COMPLETA do cartão Nubank 2026", creator: "Me Poupe!", handle: "@mepoupenathalia", platform: "YT", sentiment: "positive", sentimentScore: 0.78, views: "1.2M", timeAgo: "2h atrás", hasLogo: true,
    transcript: [
      { timestamp: "02:14", text: "O cartão da Nubank continua sendo minha principal recomendação...", highlightedBrand: "Nubank" },
      { timestamp: "05:30", text: "A experiência no app da Nubank é imbatível, olha só...", highlightedBrand: "Nubank" },
    ],
    logoFrames: ["00:12", "02:14", "05:31", "08:45"], logoExposure: "47s", logoAvgSize: "12% do frame",
  },
  {
    id: "mn2", title: "Qual o MELHOR banco digital? Ranking 2026", creator: "Primo Rico", handle: "@primorico", platform: "YT", sentiment: "neutral", sentimentScore: 0.12, views: "890K", timeAgo: "5h atrás", hasLogo: true,
    transcript: [{ timestamp: "03:45", text: "Em terceiro lugar temos a Nubank, que apesar de popular...", highlightedBrand: "Nubank" }],
    logoFrames: ["03:46"], logoExposure: "8s", logoAvgSize: "6% do frame",
  },
  {
    id: "mn3", title: "CUIDADO com esse cartão de crédito", creator: "Consumidor Real", handle: "@consumidor_real", platform: "YT", sentiment: "negative", sentimentScore: -0.65, views: "450K", timeAgo: "8h atrás", hasLogo: false,
    transcript: [
      { timestamp: "01:20", text: "Tentei resolver com a Nubank pelo chat e ninguém resolveu...", highlightedBrand: "Nubank" },
      { timestamp: "04:10", text: "A Nubank precisa melhorar urgentemente o atendimento...", highlightedBrand: "Nubank" },
    ],
    logoFrames: [], logoExposure: "0s", logoAvgSize: "—",
  },
  {
    id: "mn4", title: "Investindo com pouco dinheiro", creator: "Nath Finanças", handle: "@nfrancaa", platform: "IG", sentiment: "positive", sentimentScore: 0.55, views: "320K", timeAgo: "12h atrás", hasLogo: false,
    transcript: [{ timestamp: "00:45", text: "Uso a Nubank pra guardar minha reserva de emergência...", highlightedBrand: "Nubank" }],
    logoFrames: [], logoExposure: "0s", logoAvgSize: "—",
  },
  {
    id: "mn5", title: "PIX no TikTok?! Testei o novo recurso", creator: "Dinheiro com Você", handle: "@dinheirocomvc", platform: "TT", sentiment: "positive", sentimentScore: 0.82, views: "1.5M", timeAgo: "1d atrás", hasLogo: true,
    transcript: [{ timestamp: "00:08", text: "Gente, a Nubank liberou PIX por aproximação!", highlightedBrand: "Nubank" }],
    logoFrames: ["00:03", "00:08", "00:15"], logoExposure: "12s", logoAvgSize: "18% do frame",
  },
  {
    id: "mn6", title: "Nubank vs Inter vs C6 — Qual escolher?", creator: "Tech Review BR", handle: "@techreviewbr", platform: "YT", sentiment: "neutral", sentimentScore: 0.05, views: "670K", timeAgo: "1d atrás", hasLogo: true,
    transcript: [{ timestamp: "04:20", text: "A Nubank tem a melhor interface mas fica atrás no cashback...", highlightedBrand: "Nubank" }],
    logoFrames: ["04:21", "07:10"], logoExposure: "15s", logoAvgSize: "9% do frame",
  },
  {
    id: "mn7", title: "Podcast: O futuro dos bancos digitais", creator: "Fincast", handle: "@fincastpod", platform: "Podcast", sentiment: "positive", sentimentScore: 0.45, views: "85K", timeAgo: "2d atrás", hasLogo: false,
    transcript: [
      { timestamp: "12:30", text: "A Nubank revolucionou o mercado, isso é inegável...", highlightedBrand: "Nubank" },
      { timestamp: "15:45", text: "O modelo da Nubank influenciou todos os concorrentes...", highlightedBrand: "Nubank" },
    ],
    logoFrames: [], logoExposure: "0s", logoAvgSize: "—",
  },
  {
    id: "mn8", title: "RECLAMAÇÃO: Cartão bloqueado sem aviso", creator: "Maria Finanças", handle: "@mariafinancas", platform: "IG", sentiment: "negative", sentimentScore: -0.88, views: "210K", timeAgo: "2d atrás", hasLogo: false,
    transcript: [{ timestamp: "00:15", text: "Meu cartão Nubank foi bloqueado do nada, sem nenhum aviso...", highlightedBrand: "Nubank" }],
    logoFrames: [], logoExposure: "0s", logoAvgSize: "—",
  },
  {
    id: "mn9", title: "Dica: Como aumentar limite no Nubank", creator: "Finanças Práticas", handle: "@financaspraticas", platform: "TT", sentiment: "positive", sentimentScore: 0.6, views: "2.1M", timeAgo: "3d atrás", hasLogo: true,
    transcript: [{ timestamp: "00:05", text: "Quer aumentar seu limite na Nubank? Segue essas 3 dicas...", highlightedBrand: "Nubank" }],
    logoFrames: ["00:02", "00:05"], logoExposure: "5s", logoAvgSize: "15% do frame",
  },
  {
    id: "mn10", title: "Tag #publi ausente — Nubank e influenciadores", creator: "Direito Digital", handle: "@direitodigital", platform: "YT", sentiment: "negative", sentimentScore: -0.42, views: "180K", timeAgo: "3d atrás", hasLogo: true,
    transcript: [{ timestamp: "06:00", text: "Vários influenciadores estão promovendo a Nubank sem a tag #publi...", highlightedBrand: "Nubank" }],
    logoFrames: ["06:01", "06:30", "08:12"], logoExposure: "22s", logoAvgSize: "10% do frame",
  },
]

export const sentimentCounts = {
  all: mentions.length,
  positive: mentions.filter(m => m.sentiment === "positive").length,
  neutral: mentions.filter(m => m.sentiment === "neutral").length,
  negative: mentions.filter(m => m.sentiment === "negative").length,
}
