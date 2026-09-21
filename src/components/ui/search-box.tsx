import { Search, X } from "lucide-react"

/**
 * Busca das listagens, filtrada no cliente: as listas chegam inteiras, sem paginação.
 *
 * Vive em `ui/` (e não colado num módulo) porque a mesma busca aparece em
 * Operations, Settings e Intelligence — três campos com visuais diferentes
 * leem como três produtos.
 */
export function SearchBox({
  value, onChange, placeholder, className, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
  /** Rótulo acessível quando o placeholder não descreve o recorte sozinho. */
  ariaLabel?: string
}) {
  return (
    <div className={`relative ${className ?? "w-full sm:max-w-[260px]"}`}>
      <Search
        className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "var(--ink-muted)" }}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-7 text-[13px] outline-none transition-colors focus-visible:border-ring"
        style={{ color: "var(--ink)" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 hover:opacity-60"
          style={{ color: "var(--ink-muted)" }}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
