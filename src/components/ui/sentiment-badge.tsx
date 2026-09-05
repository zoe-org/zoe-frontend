import { cn } from "@/lib/utils"

type Sentiment = "positive" | "negative" | "neutral"

// Hex fixo não tem modo escuro. As classes `.chip-*` saem de `--pos-bg`/`--neg-bg`,
// que o bloco `.dark` redefine — é o mesmo vocabulário do resto do produto.
const styles: Record<Sentiment, string> = {
  positive: "chip chip-pos",
  negative: "chip chip-neg",
  neutral: "chip",
}

const labels: Record<Sentiment, string> = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
}

export function SentimentBadge({ sentiment, score }: { sentiment: Sentiment; score?: number }) {
  return (
    <span className={cn(styles[sentiment])}>
      {labels[sentiment]}
      {score !== undefined && <span>({score > 0 ? "+" : ""}{score.toFixed(2)})</span>}
    </span>
  )
}
