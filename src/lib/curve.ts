// Curva suave que passa por todos os pontos sem ultrapassá-los (monotone cubic,
// Fritsch–Carlson — a mesma ideia do curveMonotoneX do d3).
//
// Os gráficos usavam Catmull-Rom, que "embala" antes de uma subida: uma série
// [0, 0, 0, 48] desenhava um vale abaixo de zero antes do pico. Menção e share
// nunca são negativos, e a curva afirmava que foram.

export type Point = readonly [number, number]

export type Segment = { c1: Point; c2: Point; end: Point }

export function monotoneSegments(pts: readonly Point[]): Segment[] {
  const n = pts.length
  if (n < 2) return []

  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0]
    slope[i] = dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i]
  }

  // Tangente em cada ponto: média das inclinações vizinhas, ou zero onde a série
  // muda de direção (é ali que a Catmull-Rom passava do ponto).
  const m: number[] = new Array(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }

  // Limite de Fritsch–Carlson: sem ele, tangente grande demais ainda cria calombo
  // dentro de um trecho monotônico.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / slope[i]
    const b = m[i + 1] / slope[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * slope[i]
      m[i + 1] = t * b * slope[i]
    }
  }

  return pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1]
    const h = dx[i] / 3
    return {
      c1: [p[0] + h, p[1] + m[i] * h] as const,
      c2: [q[0] - h, q[1] - m[i + 1] * h] as const,
      end: q,
    }
  })
}

/** Path SVG ("M … C …") da curva. Menos de dois pontos não é linha. */
export function monotonePath(pts: readonly Point[]): string {
  if (pts.length < 2) return ""
  return monotoneSegments(pts).reduce(
    (d, s) => `${d} C ${s.c1[0]} ${s.c1[1]}, ${s.c2[0]} ${s.c2[1]}, ${s.end[0]} ${s.end[1]}`,
    `M ${pts[0][0]} ${pts[0][1]}`,
  )
}
