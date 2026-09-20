/**
 * Controle segmentado das barras de trabalho: recorte de uma lista longa,
 * denso e dentro de um trilho.
 *
 * Diferente de `TabPill`, que é navegação entre telas/seções e por isso é
 * maior e solto. Este aqui é filtro: mora grudado na lista que governa.
 * Monitoramento e Influenciadores desenhavam esta mesma peça à mão — duas
 * cópias que já começavam a divergir em altura e tamanho de fonte.
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
