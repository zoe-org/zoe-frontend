import { AlertCircle, Search, X } from "lucide-react"

/**
 * Componentes compartilhados das telas de Operations. Formatação mora em <code>operations-format.ts</code> por causa do Fast Refresh.
 */

/** Rótulo + campo + dica, o formato dos formulários do módulo. */
export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-muted">{hint}</span>}
    </label>
  )
}

/** Select nativo com o visual do módulo. */
export function Select({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-[13px] outline-none transition-colors focus-visible:border-ring"
      style={{ color: "var(--ink)" }}
    >
      {children}
    </select>
  )
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="px-8 py-6 space-y-3 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-11 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      ))}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">
        Não foi possível carregar
      </h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button
        onClick={onRetry}
        className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  )
}

/** Busca das listagens, filtrada no cliente: as listas do módulo chegam inteiras, sem paginação. */
export function SearchBox({
  value, onChange, placeholder, className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
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
        aria-label={placeholder}
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

/** Vazio por causa do filtro — diferente de vazio porque não há dado. */
export function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="text-center py-10">
      <p className="text-[13px] text-ink-muted m-0">
        Nada encontrado para <span style={{ color: "var(--ink)" }}>“{query}”</span>.
      </p>
      <button
        onClick={onClear}
        className="text-[12.5px] underline mt-1.5"
        style={{ color: "var(--color-teal-500)" }}
      >
        Limpar busca
      </button>
    </div>
  )
}

/** Capa de entrega sem miniatura, com o nome da plataforma. */
export function PlatformCover({ platform, compact = false }: { platform: string; compact?: boolean }) {
  const background = platform === "Instagram"
    ? "linear-gradient(135deg, #F58529, #DD2A7B 55%, #8134AF)"
    : "linear-gradient(135deg, #0B0F1A, #1F2937 60%, #0E7490)"

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background }}>
      <span
        className={`font-semibold text-white ${compact ? "text-[10px]" : "text-[13px]"}`}
        style={{ textShadow: "0 1px 3px rgba(0,0,0,.45)" }}
      >
        {platform}
      </span>
    </div>
  )
}

/** O que a marca paga: contrato inteiro ao criador, com taxa e processamento por cima. */
export function ChargeBreakdown({
  contractValueCents, takeRateCents, processingFeeCents, totalCents, takeRateBps, format,
}: {
  contractValueCents: number
  takeRateCents: number
  processingFeeCents: number
  totalCents: number
  takeRateBps?: number | null
  format: (cents: number) => string
}) {
  const rows: [string, number][] = [
    ["Ao criador", contractValueCents],
    [`Taxa da plataforma${takeRateBps ? ` (${(takeRateBps / 100).toLocaleString("pt-BR")}%)` : ""}`, takeRateCents],
  ]
  // Custódia anterior à cobrança por cima não repassou processamento: a linha zerada só
  // confundiria.
  if (processingFeeCents > 0) rows.push(["Processamento do pagamento", processingFeeCents])

  return (
    <div className="rounded-lg border border-border-soft overflow-hidden text-[12.5px]">
      {rows.map(([label, cents]) => (
        <div key={label} className="flex items-center justify-between px-3 py-1.5 border-b border-border-soft">
          <span className="text-ink-muted">{label}</span>
          <span className="font-mono-zoe tabular-nums" style={{ color: "var(--ink)" }}>{format(cents)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: "var(--bg, #FAFBFC)" }}>
        <span className="font-medium" style={{ color: "var(--ink)" }}>A marca paga</span>
        <span className="font-mono-zoe tabular-nums font-semibold" style={{ color: "var(--ink)" }}>{format(totalCents)}</span>
      </div>
    </div>
  )
}
