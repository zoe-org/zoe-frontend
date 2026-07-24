import { useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { useAuth } from "@/features/auth/context"
import { invitesApi } from "@/lib/api/invites"
import { ApiError, setActiveTenantId } from "@/lib/api"
import { Button } from "@/components/ui/button"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

type Status = "loading" | "needs_login" | "accepting" | "success" | "error"

export default function AcceptInvitePage() {
  const { token = "" } = useParams<{ token: string }>()
  const nav = useNavigate()
  const { isAuthenticated, isLoading, refresh } = useAuth()
  const [status, setStatus] = useState<Status>("loading")
  const [error, setError] = useState("")
  const [tenantName, setTenantName] = useState("")

  // Deriva o status inicial (needs_login/accepting) durante o render, comparando
  // com o último valor visto — evita setState síncrono dentro de um useEffect.
  const authKey = isLoading ? "loading" : isAuthenticated ? "authed" : "anon"
  const [lastAuthKey, setLastAuthKey] = useState(authKey)
  if (authKey !== lastAuthKey) {
    setLastAuthKey(authKey)
    if (authKey === "anon") setStatus("needs_login")
    if (authKey === "authed") setStatus("accepting")
  }

  useEffect(() => {
    if (authKey !== "authed") return

    let cancelled = false
    invitesApi.accept(token)
      .then(async (res) => {
        if (cancelled) return
        setTenantName(res.tenantName)
        setActiveTenantId(res.tenantId)
        await refresh()
        setStatus("success")
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : "Falha ao aceitar convite."
        setError(message)
        setStatus("error")
      })
    return () => { cancelled = true }
  }, [authKey, token, refresh])

  return (
    <div className="min-h-screen grid place-items-center bg-[#F9FAFB] p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm text-center">
        <ZoeLogo className="w-12 h-auto text-teal-500 mb-6 mx-auto" />

        {(status === "loading" || status === "accepting") && (
          <>
            <h1 className="text-xl font-bold mb-1">Validando convite...</h1>
            <p className="text-sm text-[#6B7280]">Só um momento.</p>
            <div className="mt-6 animate-spin rounded-full h-8 w-8 mx-auto border-2 border-teal-500 border-t-transparent" />
          </>
        )}

        {status === "needs_login" && (
          <>
            <h1 className="text-xl font-bold mb-1">Entre para aceitar o convite</h1>
            <p className="text-sm text-[#6B7280] mb-6">
              Use a conta com o e-mail que recebeu o convite.
            </p>
            <Button
              onClick={() => nav(`/login`, { state: { from: `/invite/${token}` } })}
              className="w-full bg-teal-500 hover:bg-teal-500/90 text-white"
            >
              Entrar
            </Button>
            <p className="text-xs text-[#6B7280] mt-4">
              Não tem conta? <Link to="/register" className="text-teal-500 font-semibold">Comece grátis</Link>
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-xl font-bold mb-1">Você entrou em <span className="text-teal-500">{tenantName}</span></h1>
            <p className="text-sm text-[#6B7280] mb-6">Bem-vindo(a) ao workspace.</p>
            <Button onClick={() => nav("/dashboard", { replace: true })} className="w-full bg-teal-500 hover:bg-teal-500/90 text-white">
              Ir para o dashboard
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-bold mb-1">Não foi possível aceitar o convite</h1>
            <p className="text-sm text-destructive mb-6">{error}</p>
            <Button onClick={() => nav("/dashboard", { replace: true })} variant="outline" className="w-full">
              Voltar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
