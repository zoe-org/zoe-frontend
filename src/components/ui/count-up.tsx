import { useEffect, useRef, useState } from "react"

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

/**
 * Número que conta até o valor ao aparecer e quando muda. O leitor de tela lê só o
 * valor final: a contagem é visual.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  duration = 900,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
}) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const fromRef = useRef(shown)

  useEffect(() => {
    const from = fromRef.current
    const total = prefersReducedMotion() ? 0 : duration
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = total === 0 ? 1 : Math.min(1, (now - start) / total)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (value - from) * eased
      fromRef.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <>
      <span aria-hidden className="tabular-nums">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  )
}
