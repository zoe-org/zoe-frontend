import type { CSSProperties, ReactNode } from "react"
import { ChevronLeft } from "lucide-react"

/**
 * Lista + detalhe lado a lado (Marcas, Campanhas, Curadoria).
 *
 * A partir de lg as duas colunas convivem. Abaixo disso não cabem: a lista
 * ocupa a tela e o detalhe entra no lugar dela, com um "voltar" no topo.
 *
 * `showDetail` é a escolha EXPLÍCITA da pessoa, não o item selecionado. No
 * desktop o primeiro da lista já abre por padrão — se isso valesse aqui, o
 * celular nunca mostraria a lista.
 */
export function MasterDetail({
  list, detail, showDetail, onBack, backLabel, listWidth = 340, className = "", style, listClassName = "", listStyle,
}: {
  list: ReactNode
  detail: ReactNode
  showDetail: boolean
  onBack: () => void
  backLabel: string
  listWidth?: number
  className?: string
  style?: CSSProperties
  listClassName?: string
  listStyle?: CSSProperties
}) {
  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-[var(--list-w)_minmax(0,1fr)] ${className}`}
      style={{ "--list-w": `${listWidth}px`, ...style } as CSSProperties}
    >
      <div className={`lg:border-r border-border-soft ${showDetail ? "hidden lg:block" : ""} ${listClassName}`} style={listStyle}>
        {list}
      </div>
      <div className={`min-w-0 ${showDetail ? "" : "hidden lg:block"}`}>
        <button
          type="button"
          onClick={onBack}
          className="lg:hidden w-full flex items-center gap-1 px-4 h-11 border-b border-border-soft text-[13px] font-medium text-ink hover:bg-hover transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-ink-muted" /> {backLabel}
        </button>
        {detail}
      </div>
    </div>
  )
}
