import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * "O que é isso?" ao lado de um número. É um botão, não um ícone solto: sem foco de
 * teclado a definição fica inalcançável para quem não usa mouse.
 */
export function InfoHint({ text, label = "O que é isso?" }: { text: string; label?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex align-middle text-ink-muted-2 hover:text-ink-muted focus-visible:text-ink-muted transition-colors cursor-help"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="block max-w-72 text-[12px] leading-relaxed font-normal normal-case tracking-normal">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
