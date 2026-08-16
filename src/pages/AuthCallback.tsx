import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Hub } from "aws-amplify/utils"
import { useAuth } from "@/features/auth/context"

/**
 * Destino do redirect do Cognito Hosted UI após login com Google/Microsoft
 * (`redirectSignIn` em src/lib/cognito.ts). O Amplify troca o `code` da URL
 * por tokens sozinho ao carregar — o Hub emite `signInWithRedirect` (sucesso)
 * ou `signInWithRedirect_failure` (erro) quando essa troca termina.
 *
 * `returnTo` do login por e-mail/senha não sobrevive ao redirect completo pro
 * Hosted UI — federado sempre cai em /dashboard. Aceitável pra essa etapa.
 */
export default function AuthCallbackPage() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const [error, setError] = useState("")

  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signInWithRedirect":
          void refresh().then(() => nav("/dashboard", { replace: true }))
          break
        case "signInWithRedirect_failure":
          setError("Não foi possível concluir o login. Tente novamente.")
          break
      }
    })
    return unsubscribe
  }, [nav, refresh])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-sm text-[#DC2626] mb-3">{error}</p>
            <a href="/login" className="text-sm text-teal-500 hover:underline">Voltar pro login</a>
          </>
        ) : (
          <p className="text-sm text-[#6B7280]">Entrando...</p>
        )}
      </div>
    </div>
  )
}