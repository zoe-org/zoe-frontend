import { Navigate, useSearchParams } from "react-router-dom"
import { SETTINGS_PARAM, type SectionKey } from "./SettingsDialog"

/**
 * Rota antiga (`/plan`, `/usage`, `/settings`) → dashboard com a seção já aberta.
 *
 * Preserva a query que veio: é por ela que chega o `?checkout=success` do provedor,
 * e é ele que dispara a sincronização no retorno do pagamento. Um `Navigate` com
 * caminho fixo descartaria o parâmetro e deixaria quem acabou de pagar sem projeção.
 */
export function LegacyRedirect({ section }: { section: SectionKey }) {
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  next.set(SETTINGS_PARAM, section)
  return <Navigate to={`/dashboard?${next.toString()}`} replace />
}
