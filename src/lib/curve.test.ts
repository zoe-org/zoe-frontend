import { describe, expect, it } from "vitest"
import { monotonePath, monotoneSegments, type Point } from "@/lib/curve"

const serie = (ys: number[]): Point[] => ys.map((y, i) => [i * 10, y] as const)

/** Os pontos de controle de cada trecho ficam dentro da faixa entre as duas pontas. */
function semUltrapassar(pts: Point[]) {
  return monotoneSegments(pts).every((s, i) => {
    const lo = Math.min(pts[i][1], pts[i + 1][1]) - 1e-9
    const hi = Math.max(pts[i][1], pts[i + 1][1]) + 1e-9
    return [s.c1[1], s.c2[1]].every((y) => y >= lo && y <= hi)
  })
}

describe("monotoneSegments", () => {
  it("um pico depois de semanas zeradas não desenha vale abaixo de zero", () => {
    // O caso do print: share 0 por onze semanas e 48% na última.
    expect(semUltrapassar(serie([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48]))).toBe(true)
  })

  it("série que sobe e desce também não passa do ponto", () => {
    expect(semUltrapassar(serie([5, 30, 2, 40, 40, 1, 18]))).toBe(true)
  })

  it("trecho plano continua plano", () => {
    const [s] = monotoneSegments(serie([12, 12]))
    expect([s.c1[1], s.c2[1]]).toEqual([12, 12])
  })

  it("passa por todos os pontos", () => {
    const pts = serie([3, 9, 4])
    expect(monotoneSegments(pts).map((s) => s.end)).toEqual(pts.slice(1))
  })
})

describe("monotonePath", () => {
  it("começa no primeiro ponto", () => {
    expect(monotonePath(serie([1, 2, 3]))).toMatch(/^M 0 1 C /)
  })

  it("menos de dois pontos não é linha", () => {
    expect(monotonePath(serie([7]))).toBe("")
    expect(monotonePath([])).toBe("")
  })
})
