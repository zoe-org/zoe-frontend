import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { SETTINGS_PARAM, type SectionKey } from "./SettingsDialog"

/**
 * Abre o diálogo de configurações sem sair da rota atual.
 *
 * Acrescenta o parâmetro em vez de navegar para um caminho: é isso que mantém a tela
 * de trás montada e devolve o usuário onde ele estava ao fechar.
 */
export function useOpenSettings() {
  const [params, setParams] = useSearchParams()

  return useCallback(
    (section: SectionKey = "perfil", extra?: Record<string, string>) => {
      const next = new URLSearchParams(params)
      next.set(SETTINGS_PARAM, section)
      for (const [key, value] of Object.entries(extra ?? {})) next.set(key, value)
      setParams(next)
    },
    [params, setParams],
  )
}
