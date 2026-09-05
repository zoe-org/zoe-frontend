import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { coverageConfig } from "@/components/ui/coverage-labels"
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

  const cfg = coverageConfig(pipelinePath, selfMeasured)

  const badge = (
    <span
      className={cn(cfg.className, className)}
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
