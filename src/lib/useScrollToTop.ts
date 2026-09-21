import { useEffect, type RefObject } from "react"
import { useLocation } from "react-router-dom"

/**
 * Toda troca de tela começa do topo.
 *
 * Reage só ao pathname: `?settings=`, filtros e abas abrem por cima da tela atual
 * e mexer no scroll ali tiraria a pessoa do lugar em que ela estava.
 */
export function useScrollToTop(container?: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()

  useEffect(() => {
    // O documento é quem rola hoje; o container entra de graça se o shell virar
    // altura fixa com a área de conteúdo rolando por dentro.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    container?.current?.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname, container])
}
