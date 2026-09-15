import { AlertCircle, Search, X } from "lucide-react"

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

/**
 * Busca das listagens do módulo.
 *
 * <p>Filtra no cliente de propósito: as listagens de Operations devolvem o conjunto
 * inteiro do tenant, sem paginação, então o dado a filtrar já está na memória. Mandar a
 * busca para o servidor obrigaria a paginar cinco endpoints para responder mais devagar a
 * mesma pergunta.</p>
 *
 * <p>Quando o filtro esconde tudo, quem chama mostra "nenhum resultado para X" — some da
 * tela é o que faz a pessoa achar que perdeu o dado.</p>
 */
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

/**
 * Capa de entrega sem miniatura — Reel e TikTok não têm imagem pública por id, e uma área
 * preta vazia parecia vídeo quebrado. O nome da plataforma diz onde o conteúdo está.
 */
export function PlatformCover({ platform, compact = false }: { platform: string; compact?: boolean }) {
  const fundo = platform === "Instagram"
    ? "linear-gradient(135deg, #F58529, #DD2A7B 55%, #8134AF)"
    : "linear-gradient(135deg, #0B0F1A, #1F2937 60%, #0E7490)"

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: fundo }}>
      <span
        className={`font-semibold text-white ${compact ? "text-[10px]" : "text-[13px]"}`}
        style={{ textShadow: "0 1px 3px rgba(0,0,0,.45)" }}
      >
        {platform}
      </span>
    </div>
  )
}
