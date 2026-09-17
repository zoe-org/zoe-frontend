import { useEffect, useSyncExternalStore } from "react"

/** Largura a partir da qual lista e detalhe da fila cabem lado a lado. */
const WIDE = "(min-width: 1024px)"

export function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(WIDE)
      m.addEventListener("change", onChange)
      return () => m.removeEventListener("change", onChange)
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  )
}

/** Há quanto tempo o item espera — é o que ordena a fila e o que a pessoa quer saber de relance. */
export function waitingLabel(iso: string, now: number = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  if (min < 2) return "agora"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? "há 1 dia" : `há ${d} dias`
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable
}

/**
 * Atalhos da fila: ↑/↓ ou J/K andam entre os itens, C leva ao campo de observações e Esc fecha
 * o detalhe no celular.
 *
 * <p><b>Nenhuma tecla aprova.</b> Aprovar a entrega publicada pede o pagamento; uma tecla solta
 * no lugar errado não pode fazer isso. Decidir continua sendo um clique no botão que diz o que
 * acontece.</p>
 */
export function useQueueKeys({
  ids, selected, onSelect, onClose, notesId,
}: {
  ids: string[]
  selected: string | null
  onSelect: (id: string) => void
  onClose?: () => void
  notesId?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e.target)) {
        // Esc no campo só tira o foco: fechar a gaveta levaria junto o que foi digitado.
        if (e.key === "Escape") (e.target as HTMLElement).blur()
        return
      }
      if (e.key === "Escape") {
        onClose?.()
        return
      }
      if (ids.length === 0) return

      const idx = selected ? ids.indexOf(selected) : -1
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        onSelect(ids[Math.min(idx + 1, ids.length - 1)])
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        onSelect(ids[Math.max(idx - 1, 0)])
      } else if (e.key === "c" && notesId) {
        const el = document.getElementById(notesId)
        if (el) {
          e.preventDefault()
          el.focus()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ids, selected, onSelect, onClose, notesId])
}
