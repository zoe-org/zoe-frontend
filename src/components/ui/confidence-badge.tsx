import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Badge de confiança do pipeline (Etapa 4, requisito — não polish). Mostrar um
// score de componente único (comments_only) igual a um `full` engana o cliente e
// vira ticket de suporte. Cores semânticas: amber pra confiança reduzida, NUNCA
// vermelho (não é erro). Deriva do pipeline_path que a API persiste tipado.

type BadgeConfig = { label: string; className: string; tip?: string }

// Chaves em PascalCase = o que o read-API devolve (enum .ToString()).
const BY_PATH: Record<string, BadgeConfig> = {
  Full: { label: "Análise completa", className: "text-[#0F766E] bg-[#F0FDFA]" },
  VideoCaption: { label: "Análise completa", className: "text-[#0F766E] bg-[#F0FDFA]" },
  CaptionFallback: { label: "Legenda + comentários", className: "text-[#6B7280] bg-[#F3F4F6]" },
  CommentsOnly: {
    label: "Apenas comentários",
    className: "text-[#B45309] bg-[#FFFBEB]",
    tip: "Score baseado apenas nos comentários (sem áudio/vídeo) — confiança reduzida.",
  },
  // ADR-035. Mesma confiança numérica do CaptionFallback (0.80) e significado
  // OPOSTO: aquilo é degradação, isto é política. Por isso cor neutra-positiva e
  // não âmbar — âmbar comunica "algo deu errado", e aqui nada deu errado.
  OwnedComments: {
    label: "Conteúdo próprio",
    className: "text-[#0F766E] bg-[#F0FDFA]",
    tip:
      "Vídeo do canal oficial da marca. Medimos a reação da audiência nos " +
      "comentários — o roteiro é da própria marca e não entra no score.",
  },
  OwnedNoSignal: {
    label: "Comentários desativados",
    className: "text-[#6B7280] bg-[#F3F4F6]",
    tip:
      "A marca desativou os comentários deste vídeo. Não é falha de coleta — " +
      "não havia reação de audiência a medir.",
  },
}

// §4.1 do doc 05: vídeo owned analisado pelo path pesado. O score existe mas é
// 30% roteiro da própria marca + 20% logo em quadro — não é leitura de audiência,
// e o badge normal diria "análise completa, alta confiança".
const SELF_MEASURED: BadgeConfig = {
  label: "Conteúdo próprio",
  className: "text-[#B45309] bg-[#FFFBEB]",
  tip:
    "Vídeo do canal oficial analisado pelo pipeline completo: o score inclui o " +
    "roteiro e a marca em quadro, então não mede reação da audiência.",
}

const FALLBACK: BadgeConfig = { label: "", className: "text-[#6B7280] bg-[#F3F4F6]" }

export function ConfidenceBadge({
  pipelinePath,
  confidence,
  selfMeasured = false,
  className,
}: {
  pipelinePath: string | null | undefined
  confidence?: number | null
  /**
   * Vídeo owned analisado pelo pipeline pesado (ver `hasSelfMeasuredScore`).
   * Sobrepõe o rótulo do path: "análise completa" seria verdade sobre o pipeline
   * e mentira sobre o que o número significa.
   */
  selfMeasured?: boolean
  className?: string
}) {
  if (!pipelinePath) return null

  const cfg = selfMeasured
    ? SELF_MEASURED
    : BY_PATH[pipelinePath] ?? { ...FALLBACK, label: pipelinePath }

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
      {cfg.tip && <Info className="w-3 h-3 opacity-70" aria-hidden />}
    </span>
  )

  if (!cfg.tip) return badge

  const tip =
    confidence != null ? `${cfg.tip} (confiança ${confidence.toFixed(2)})` : cfg.tip

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
