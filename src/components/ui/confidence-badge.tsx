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
}

const FALLBACK: BadgeConfig = { label: "", className: "text-[#6B7280] bg-[#F3F4F6]" }

export function ConfidenceBadge({
  pipelinePath,
  confidence,
  className,
}: {
  pipelinePath: string | null | undefined
  confidence?: number | null
  className?: string
}) {
  if (!pipelinePath) return null

  const cfg = BY_PATH[pipelinePath] ?? { ...FALLBACK, label: pipelinePath }

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
