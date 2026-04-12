export type Influencer = {
  id: string; name: string; handle: string; platform: "YT" | "TT" | "IG"
  subscribers: string; mentions: number; sentimentScore: number
  sentiment: "positive" | "negative" | "neutral"; reach: string
  trend: "up" | "down" | "stable"; category: string
  bubbleX: number; bubbleY: number; bubbleSize: number
}

export const influencers: Influencer[] = [
  { id: "inf1", name: "Me Poupe!", handle: "@mepoupenathalia", platform: "YT", subscribers: "7.2M", mentions: 12, sentimentScore: 0.78, sentiment: "positive", reach: "4.1M", trend: "up", category: "Finanças pessoais", bubbleX: 0.89, bubbleY: 0.92, bubbleSize: 5 },
  { id: "inf2", name: "Primo Rico", handle: "@primorico", platform: "YT", subscribers: "6.8M", mentions: 9, sentimentScore: 0.12, sentiment: "neutral", reach: "3.2M", trend: "stable", category: "Finanças pessoais", bubbleX: 0.56, bubbleY: 0.78, bubbleSize: 5 },
  { id: "inf3", name: "Nath Finanças", handle: "@nfrancaa", platform: "IG", subscribers: "1.1M", mentions: 7, sentimentScore: 0.55, sentiment: "positive", reach: "890K", trend: "up", category: "Finanças pessoais", bubbleX: 0.78, bubbleY: 0.45, bubbleSize: 3 },
  { id: "inf4", name: "Dinheiro com Você", handle: "@dinheirocomvc", platform: "TT", subscribers: "2.3M", mentions: 5, sentimentScore: 0.82, sentiment: "positive", reach: "1.5M", trend: "up", category: "Lifestyle", bubbleX: 0.91, bubbleY: 0.6, bubbleSize: 4 },
  { id: "inf5", name: "Tech Review BR", handle: "@techreviewbr", platform: "YT", subscribers: "980K", mentions: 4, sentimentScore: 0.05, sentiment: "neutral", reach: "670K", trend: "stable", category: "Reviews/Tech", bubbleX: 0.52, bubbleY: 0.35, bubbleSize: 2 },
  { id: "inf6", name: "Direito Digital", handle: "@direitodigital", platform: "YT", subscribers: "450K", mentions: 3, sentimentScore: -0.42, sentiment: "negative", reach: "180K", trend: "down", category: "Reviews/Tech", bubbleX: 0.29, bubbleY: 0.15, bubbleSize: 1 },
]

export type CategoryBreakdown = { name: string; count: number; percentage: number }

export const categoryBreakdown: CategoryBreakdown[] = [
  { name: "Finanças pessoais", count: 3, percentage: 48 },
  { name: "Reviews/Tech", count: 2, percentage: 24 },
  { name: "Lifestyle", count: 1, percentage: 17 },
  { name: "Humor", count: 0, percentage: 10 },
]
