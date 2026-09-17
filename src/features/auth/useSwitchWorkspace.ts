import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/features/auth/context"

/**
 * Troca de workspace e cai no Dashboard.
 *
 * A tela anterior podia ser o detalhe de um contrato ou de uma marca que não
 * existe no workspace novo. `replace` porque voltar levaria a esse mesmo id órfão.
 *
 * O navigate vem ANTES do switch: a recarga da sessão liga o `isLoading`, o
 * ProtectedRoute troca o shell pelo spinner e um navigate no fim rodaria depois
 * do desmonte.
 */
export function useSwitchWorkspace() {
  const { switchTenant } = useAuth()
  const navigate = useNavigate()

  return useCallback(
    (tenantId: string) => {
      navigate("/dashboard", { replace: true })
      void switchTenant(tenantId)
    },
    [navigate, switchTenant],
  )
}
