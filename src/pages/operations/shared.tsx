import { AlertCircle } from "lucide-react"

/**
 * Componentes repetidos pelas telas de Operations. Estavam copiados em quatro
 * páginas — a cópia seguinte (entregas e custódia) seria a quinta.
 *
 * Só componentes aqui: as funções de formatação vivem em `format.ts`, senão o
 * Fast Refresh para de funcionar no módulo inteiro.
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
