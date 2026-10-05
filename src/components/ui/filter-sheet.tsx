import { SlidersHorizontal, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

export type FilterSheetGroup = {
  label: string
  value: string
  options: readonly { key: string; label: string }[]
  onChange: (key: string) => void
}

/**
 * Botão "Filtros" do celular. Na barra de uma tela larga os filtros são chips com
 * dropdown, lado a lado; no telefone quatro chips quebravam em três linhas acima
 * da lista. Aqui eles cabem num botão só, com a contagem do que está ligado, e
 * abrem numa folha de baixo onde cada opção é uma pílula — um toque escolhe, sem
 * dropdown dentro de dropdown.
 *
 * A escolha vale na hora (os filtros moram na URL, como no desktop); o botão do
 * rodapé só fecha, e diz quanto ficou.
 */
export function FilterSheetButton({
  open, onOpenChange, groups, activeCount, onClear, resultLabel, className = "",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: FilterSheetGroup[]
  /** Quantos filtros de recorte estão ligados — ordem e exibição não contam. */
  activeCount: number
  onClear?: () => void
  /** Rótulo do botão de fechar: "Ver 128 menções". */
  resultLabel: string
  className?: string
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium transition-colors shrink-0 ${
          activeCount > 0
            ? "border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/25"
            : "border-border-soft text-ink-2"
        } ${className}`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtros
        {activeCount > 0 && (
          <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-teal-500 text-white text-[10.5px] font-semibold inline-flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="p-0 gap-0 max-h-[88dvh] rounded-t-[20px] border-border-soft bg-surface text-ink"
        >
          <div className="flex items-start gap-4 px-5 pt-3 pb-4 border-b border-border-soft shrink-0">
            <div className="flex-1 min-w-0">
              {/* Alça: diz "isto é uma folha" antes de qualquer texto. */}
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border-soft" aria-hidden />
              <SheetTitle className="font-display font-normal m-0 text-[22px] leading-tight text-ink">Filtros</SheetTitle>
              <SheetDescription className="text-[12.5px] text-ink-muted mt-1">
                Cada escolha já vale para a lista.
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
              className="mt-4 w-7.5 h-7.5 rounded-full border border-border-soft flex items-center justify-center text-ink-muted hover:text-ink hover:bg-tint transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-5 py-4 overflow-y-auto flex flex-col gap-5">
            {groups.map((g) => (
              <fieldset key={g.label} className="m-0 p-0 border-0">
                <legend className="eyebrow mb-2.5">{g.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const active = g.value === o.key
                    return (
                      <button
                        key={o.key || "__all"}
                        type="button"
                        aria-pressed={active}
                        onClick={() => g.onChange(o.key)}
                        className={`h-9 px-3.5 rounded-lg border text-[13px] font-medium transition-colors ${
                          active
                            ? "border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/25"
                            : "border-border-soft text-ink-2 hover:bg-hover"
                        }`}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="flex items-center gap-2.5 px-5 py-4 border-t border-border-soft bg-inset shrink-0">
            {onClear && activeCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="h-10 px-3 rounded-lg text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                Limpar filtros
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="ml-auto h-10 px-5 rounded-lg text-[13.5px] font-semibold text-white bg-teal-500 hover:bg-teal-600 transition-colors"
            >
              {resultLabel}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
