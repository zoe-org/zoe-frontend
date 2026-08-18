/**
 * Faixa de números do topo da página (o `StatRow` do design). Full-bleed, uma
 * coluna por métrica, número em display grande — o mesmo bloco que a tela de
 * Alertas já usava inline e que a Curadoria repetia como chips soltos.
 *
 * Regra que vale mais que o layout: **toda coluna aqui é um número que a API
 * sustenta.** O design propõe métricas que não existem no domínio ("tempo médio
 * de verificação", "taxa de falso positivo") — elas ficam de fora em vez de
 * virarem placeholder, porque número inventado em faixa de destaque é o tipo de
 * coisa que alguém repassa numa reunião.
 */
export type Stat = {
  label: string
  value: string | number
  /** Sufixo pequeno ao lado do número (min, %, …). */
  suffix?: string
  /** Linha de contexto abaixo — o que o número significa. */
  hint?: string
  tone?: "accent" | "warn" | "neg"
}

const TONE_COLOR: Record<NonNullable<Stat["tone"]>, string> = {
  accent: "var(--color-teal-500)",
  warn: "var(--color-warn)",
  neg: "var(--color-neg)",
}

export function StatBand({ items }: { items: Stat[] }) {
  return (
    <section
      className="grid border-b border-border-soft"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((k, i) => (
        <div key={k.label} className={`px-6 py-5 ${i < items.length - 1 ? "border-r border-border-soft" : ""}`}>
          <div className="eyebrow">{k.label}</div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span
              className="font-display"
              style={{ fontSize: 40, lineHeight: 1, color: k.tone ? TONE_COLOR[k.tone] : "var(--ink)" }}
            >
              {k.value}
            </span>
            {k.suffix && <span className="text-[14px] text-ink-muted">{k.suffix}</span>}
          </div>
          {k.hint && <div className="text-[11.5px] text-ink-muted mt-2">{k.hint}</div>}
        </div>
      ))}
    </section>
  )
}
