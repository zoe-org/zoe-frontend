/**
 * Controle segmentado das barras de trabalho: denso, dentro de um trilho.
 *
 * A regra contra `TabPill`: se o conteúdo é OUTRO, é navegação e usa `TabPill`
 * (maior, solto, perto do título) — Alertas trocando Histórico por Regras. Se o
 * conteúdo é o MESMO e muda só o recorte ou a leitura dele, é este aqui, e mora
 * na barra grudado no que governa: o sentimento em Monitoramento, o tier em
 * Influenciadores, as três leituras do Share of Voice.
 *
 * As três telas desenhavam esta peça à mão, e as cópias já divergiam em altura
 * e tamanho de fonte.
 */
export function Segmented<T extends string>({
  items, value, onChange, ariaLabel,
}: {
  items: readonly { key: T; label: string; count?: number; color?: string }[]
  value: T
  onChange: (key: T) => void
  ariaLabel?: string
}) {
  // p-0.5 + h-7 = 32px, a mesma altura dos outros controles da barra. O raio
  // interno também fecha: 8px do trilho menos 2px de folga = 6px (rounded-md).
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border-soft bg-inset"
    >
      {items.map((item) => {
        const active = value === item.key
        return (
          <button
            key={item.key || "all"}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[12.5px] font-medium transition-colors ${
              active ? "text-white" : "text-ink-muted hover:text-ink"
            }`}
            style={active ? { background: item.color ?? "var(--color-teal-500)" } : undefined}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="font-mono-zoe text-[11px]" style={{ opacity: active ? 0.85 : 0.65 }}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
