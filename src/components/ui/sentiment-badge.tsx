import { cn } from "@/lib/utils"

type Sentiment = "positive" | "negative" | "neutral"

const styles: Record<Sentiment, string> = {
  positive: "text-[#16A34A] bg-[#F0FDF4]",
  negative: "text-[#DC2626] bg-[#FEF2F2]",
  neutral: "text-[#6B7280] bg-[#F3F4F6]",
}

const labels: Record<Sentiment, string> = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
}

export function SentimentBadge({ sentiment, score }: { sentiment: Sentiment; score?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", styles[sentiment])}>
      {labels[sentiment]}
      {score !== undefined && <span>({score > 0 ? "+" : ""}{score.toFixed(2)})</span>}
    </span>
  )
}
