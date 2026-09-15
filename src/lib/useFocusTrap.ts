import { useEffect, useRef, useState } from "react"

const FOCAVEIS = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

const focadoAgora = () =>
  typeof document !== "undefined" && document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null

/**
 * Prende o foco dentro do modal ou da gaveta enquanto está aberto, e devolve ao elemento de antes
 * ao fechar.
 *
 * <p>Os modais do Operations são feitos à mão. Com Esc já fechando, faltava o resto do básico: o
 * Tab saía do modal e ia parar na página por trás, e ao fechar o foco se perdia no topo — quem
 * navega por teclado ou leitor de tela ficava sem saber onde estava.</p>
 *
 * <p>Ao abrir, o foco vai para o primeiro campo, pulando o botão de fechar — abrir um formulário
 * e cair no "×" obrigava a um Tab a mais sempre.</p>
 */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null)

  // Capturado já no primeiro render: campo com autoFocus puxa o foco para dentro do modal antes de
  // qualquer efeito rodar, e aí "o que estava focado" já seria o próprio campo — que some ao fechar.
  const [focoAoMontar] = useState(focadoAgora)

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    // Gaveta que abre e fecha com o componente montado (a fila de revisão no celular): vale o que
    // estava focado agora, fora dela. Modal com autoFocus: vale o capturado na montagem.
    const agora = focadoAgora()
    const anterior = agora && !el.contains(agora) ? agora : focoAoMontar

    const focaveis = () => [...el.querySelectorAll<HTMLElement>(FOCAVEIS)]
      .filter((f) => f.getClientRects().length > 0)

    if (!el.contains(document.activeElement)) {
      const lista = focaveis()
      const inicial = lista.find((f) => !(f.getAttribute("aria-label") ?? "").startsWith("Fechar")) ?? lista[0]
      if (inicial) {
        inicial.focus({ preventScroll: true })
      } else {
        el.tabIndex = -1
        el.focus({ preventScroll: true })
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const lista = focaveis()
      if (lista.length === 0) return

      const primeiro = lista[0]
      const ultimo = lista[lista.length - 1]
      const dentro = el.contains(document.activeElement)

      if (e.shiftKey && (!dentro || document.activeElement === primeiro)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (!dentro || document.activeElement === ultimo)) {
        e.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (anterior?.isConnected) anterior.focus({ preventScroll: true })
    }
  }, [active, focoAoMontar])

  return ref
}
