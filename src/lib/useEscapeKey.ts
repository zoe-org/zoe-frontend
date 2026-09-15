import { useEffect, useRef } from "react"

/**
 * Esc fecha. Os modais do Operations são feitos à mão (div fixa), e só Marcas tratava a
 * tecla — nos outros a pessoa precisava achar o X ou clicar fora.
 *
 * <p>O callback fica numa ref para o listener não ser recriado a cada render de quem chama.</p>
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const callback = useRef(onEscape)

  useEffect(() => {
    callback.current = onEscape
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) callback.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled])
}
