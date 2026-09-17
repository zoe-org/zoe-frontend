import { useEffect, useRef, useState } from "react"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

const currentFocus = () =>
  typeof document !== "undefined" && document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null

/** Prende o foco no modal enquanto aberto e o devolve ao fechar. Ao abrir, pula o botão de fechar. */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null)

  // Capturado já no primeiro render: campo com autoFocus puxa o foco para dentro do modal antes de
  // qualquer efeito rodar, e aí "o que estava focado" já seria o próprio campo — que some ao fechar.
  const [focusOnMount] = useState(currentFocus)

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    // Gaveta que abre e fecha com o componente montado (a fila de revisão no celular): vale o que
    // estava focado agora, fora dela. Modal com autoFocus: vale o capturado na montagem.
    const focused = currentFocus()
    const returnTarget = focused && !el.contains(focused) ? focused : focusOnMount

    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      .filter((f) => f.getClientRects().length > 0)

    if (!el.contains(document.activeElement)) {
      const elements = focusables()
      const initialTarget = elements.find((f) => !(f.getAttribute("aria-label") ?? "").startsWith("Fechar")) ?? elements[0]
      if (initialTarget) {
        initialTarget.focus({ preventScroll: true })
      } else {
        el.tabIndex = -1
        el.focus({ preventScroll: true })
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const elements = focusables()
      if (elements.length === 0) return

      const first = elements[0]
      const last = elements[elements.length - 1]
      const inside = el.contains(document.activeElement)

      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true })
    }
  }, [active, focusOnMount])

  return ref
}
