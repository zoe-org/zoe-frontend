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
  tone?: "accent" | "pos" | "warn" | "neg"
}

const TONE_COLOR: Record<NonNullable<Stat["tone"]>, string> = {
  accent: "var(--color-teal-500)",
  pos: "var(--color-pos)",
  warn: "var(--color-warn)",
  neg: "var(--color-neg)",
}

/**
 * Valor longo encolhe. "R$ 1.746.205,00" em 40px passava da coluna e encostava
 * no vizinho — visto na Custódia com a barra lateral aberta, em 15/09. No celular
 * a coluna tem ~150px, então o corte é mais cedo.
 */
function valueClass(value: string | number): string {
  const n = String(value).length
  const desktop = n > 13 ? "md:text-[24px]" : "md:text-[40px]"
  const mobile = n > 10 ? "text-[18px]" : n > 7 ? "text-[22px]" : "text-[30px]"
  return `${mobile} ${desktop}`
}

/**
 * Celular: duas colunas (a última ocupa a linha quando sobra uma). md+: uma
 * coluna por métrica. As réguas são borda direita + inferior em toda célula,
 * e a grade sai 1px para fora do `overflow-hidden` — assim a última coluna e a
 * última linha perdem a régua sem precisar saber quantas colunas há em cada largura.
 */
export function StatBand({ items }: { items: Stat[] }) {
  const odd = items.length % 2 === 1
  return (
    <section className="border-b border-border-soft overflow-hidden">
      <div
        className="grid grid-cols-2 md:grid-cols-[repeat(var(--n),minmax(0,1fr))] -mr-px -mb-px"
        style={{ "--n": items.length } as React.CSSProperties}
      >
        {items.map((k, i) => (
          <div
            key={k.label}
            className={`px-4 py-4 md:px-6 md:py-5 min-w-0 border-r border-b border-border-soft ${odd && i === items.length - 1 ? "col-span-2 md:col-span-1" : ""}`}
          >
            <div className="eyebrow">{k.label}</div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span
                className={`font-display ${valueClass(k.value)}`}
                style={{
                  lineHeight: 1.1,
                  color: k.tone ? TONE_COLOR[k.tone] : "var(--ink)",
                  overflowWrap: "anywhere",
                }}
              >
                {k.value}
              </span>
              {k.suffix && <span className="text-[14px] text-ink-muted">{k.suffix}</span>}
            </div>
            {k.hint && <div className="text-[11.5px] text-ink-muted mt-2">{k.hint}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
