import { useState } from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * "O que é isso?" ao lado de um número. É um botão, não um ícone solto: sem foco de
 * teclado a definição fica inalcançável para quem não usa mouse.
 *
 * Controlado para abrir também no toque: o tooltip do Radix ignora toque de
 * propósito, e no celular nenhuma definição da plataforma abria. O clique alterna;
 * hover e foco seguem funcionando como antes, e tocar fora fecha.
 */
export function InfoHint({ text, label = "O que é isso?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
            // A área de toque cresce sem mexer no desenho: o ícone tem 14px.
            className="relative inline-flex align-middle text-ink-muted-2 hover:text-ink-muted focus-visible:text-ink-muted transition-colors cursor-help before:absolute before:-inset-2 before:content-['']"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent collisionPadding={12} className="block max-w-72 text-[12px] leading-relaxed font-normal normal-case tracking-normal">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
