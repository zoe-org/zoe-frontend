/** Paleta do design — a mesma de `pages/Brands.tsx`, que deriva cor do slug. */
const PALETTE = ["#00A799", "#FF5B35", "#7C3AED", "#0EA5E9", "#F59E0B", "#EC4899", "#16A34A", "#6366F1"]

function derivedColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/**
 * Quadrado com a inicial da marca, do design (`src-admin/curadoria.jsx`,
 * `marcas-globais.jsx`). Serve de âncora visual nas listas: sem ele, uma fila de
 * marcas vira um bloco de texto onde nada se distingue de relance.
 *
 * A cor vem do slug quando o tenant não escolheu uma — determinística, então a
 * mesma marca tem sempre a mesma cor em todas as telas.
 */
export function BrandAvatar({
  name, seed, color = null, size = 34, radius = 8,
}: {
  name: string
  /** Slug ou id — o que der estabilidade à cor derivada. */
  seed: string
  color?: string | null
  size?: number
  radius?: number
}) {
  return (
    <div
      className="flex items-center justify-center text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color ?? derivedColor(seed),
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
