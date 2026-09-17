import { useEffect, useRef } from "react"

/** Esc fecha os modais feitos à mão; o callback fica numa ref. */
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
