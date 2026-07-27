import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "@/features/auth/context"
import { invitesApi, type InvitePreview } from "@/lib/api/invites"
import { setPendingInviteToken, clearPendingInviteToken } from "@/features/auth/pendingInvite"
import { ApiError, setActiveTenantId } from "@/lib/api"
import { Button } from "@/components/ui/button"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

// Resultado terminal de uma operação assíncrona (prévia inválida ou aceite). O
// estado "em andamento" (loading/needs_login/accepting) é derivado do render, pra
// não chamar setState síncrono dentro de um effect.
type Result =
  | { kind: "error"; message: string }
  | { kind: "success"; tenantName: string }

export default function AcceptInvitePage() {
  const { token = "" } = useParams<{ token: string }>()
  const nav = useNavigate()
  const { isAuthenticated, isLoading, refresh } = useAuth()
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  // Convite utilizável = prévia carregada e sem bloqueio (aceito/expirado).
  const usable = preview !== null && !preview.accepted && !preview.expired

  // 1. Prévia pública do convite (não exige login) — valida token/expiração/aceite
  //    antes de qualquer coisa e alimenta a tela de "criar conta".
  useEffect(() => {
    let cancelled = false
    invitesApi.preview(token)
      .then((p) => {
        if (cancelled) return
        setPreview(p)
        if (p.accepted) {
          clearPendingInviteToken()
          setResult({ kind: "error", message: "Este convite já foi aceito." })
        } else if (p.expired) {
          clearPendingInviteToken()
          setResult({ kind: "error", message: "Este convite expirou. Peça um novo ao administrador do workspace." })
        }
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof ApiError && err.status === 404
          ? "Convite não encontrado. O link pode estar incorreto ou ter sido revogado."
          : err instanceof ApiError ? err.message : "Falha ao carregar o convite."
        setResult({ kind: "error", message })
      })
    return () => { cancelled = true }
  }, [token])

  // 2. Com a prévia OK e usuário logado: aceita automaticamente. Anônimo vê os CTAs.
  useEffect(() => {
    if (!usable || isLoading || !isAuthenticated || result) return

    let cancelled = false
    invitesApi.accept(token)
      .then(async (res) => {
        if (cancelled) return
        setActiveTenantId(res.tenantId)
        clearPendingInviteToken()
        await refresh()
        setResult({ kind: "success", tenantName: res.tenantName })
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : "Falha ao aceitar convite."
        setResult({ kind: "error", message })
      })
    return () => { cancelled = true }
  }, [usable, isLoading, isAuthenticated, result, token, refresh])

  // View derivada — nenhum setState síncrono em effect.
  const status: "loading" | "needs_login" | "accepting" | "success" | "error" =
    result?.kind === "error" ? "error"
    : result?.kind === "success" ? "success"
    : !preview || isLoading ? "loading"
    : !isAuthenticated ? "needs_login"
    : "accepting"

  const error = result?.kind === "error" ? result.message : ""
  const tenantName = result?.kind === "success" ? result.tenantName : (preview?.tenantName ?? "")

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

        {status === "needs_login" && preview && (
          <>
            <h1 className="text-xl font-bold mb-1">
              Você foi convidado(a) para <span className="text-teal-500">{preview.tenantName}</span>
            </h1>
            <p className="text-sm text-[#6B7280] mb-6">
              {preview.inviterName} convidou <strong className="text-midnight dark:text-[#E6E8EF]">{preview.email}</strong>.
              Entre ou crie sua conta com esse e-mail para aceitar.
            </p>
            <Button
              onClick={() => nav(`/login`, { state: { from: `/invite/${token}` } })}
              className="w-full bg-teal-500 hover:bg-teal-500/90 text-white"
            >
              Já tenho conta — Entrar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPendingInviteToken(token)
                nav("/register", { state: { email: preview.email, step: 2, invite: true } })
              }}
              className="w-full mt-3"
            >
              Criar conta
            </Button>
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
