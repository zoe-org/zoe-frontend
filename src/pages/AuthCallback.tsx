import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { fetchAuthSession } from "aws-amplify/auth"
import { Hub } from "aws-amplify/utils"
import { useAuth } from "@/features/auth/context"
import { getPendingInviteToken } from "@/features/auth/pendingInvite"
import {
  clearSocialAttempt, federatedErrorMessage, isLinkedOnFirstLogin, readSocialAttempt, retrySocialLogin,
} from "@/features/auth/socialLogin"
import { meApi } from "@/lib/api/me"
import { ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

// 409 do /api/me: o e-mail já é de outra conta e o Pre Sign-up não vinculou.
const EMAIL_CONFLICT = "Já existe uma conta com esse e-mail usando outra forma de entrar. Entre com e-mail e senha."

/**
 * Retorno do Hosted UI do Cognito (login com Google/Microsoft, ADR-064). Quem troca o
 * `code` por tokens é o listener do Amplify (lib/cognito.ts); aqui só se espera o desfecho.
 */
export default function AuthCallbackPage() {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const [returned] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return { error: params.get("error_description") ?? params.get("error") ?? "", hasCode: params.has("code") }
  })
  const [error, setError] = useState("")
  const settled = useRef(false)

  useEffect(() => {
    const succeed = async () => {
      if (settled.current) return
      settled.current = true
      try {
        await meApi.get()
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          clearSocialAttempt()
          setError(EMAIL_CONFLICT)
          return
        }
      }
      await refresh()
      const returnTo = readSocialAttempt()?.returnTo ?? "/dashboard"
      clearSocialAttempt()
      // Convite pendente: a própria página do convite aceita e mostra o resultado.
      const invite = getPendingInviteToken()
      nav(invite ? `/invite/${invite}` : returnTo, { replace: true })
    }

    const fail = async (message: string) => {
      if (settled.current) return
      settled.current = true
      if (isLinkedOnFirstLogin(message) && await retrySocialLogin()) return
      clearSocialAttempt()
      setError(federatedErrorMessage(message))
    }

    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") void succeed()
      if (payload.event === "signInWithRedirect_failure") void fail(payload.data.error?.message ?? "")
    })

    // O evento do Hub pode ter saído antes do mount: a URL e a sessão cobrem esse caso.
    if (returned.error) {
      if (!settled.current) {
        settled.current = true
        if (isLinkedOnFirstLogin(returned.error)) {
          void retrySocialLogin().then((retried) => {
            if (!retried) setError(federatedErrorMessage(returned.error))
          })
        } else {
          clearSocialAttempt()
        }
      }
    } else {
      fetchAuthSession()
        .then((session) => {
          if (session.tokens?.idToken) return succeed()
          if (!returned.hasCode) nav("/login", { replace: true })
        })
        .catch(() => { /* a falha chega pelo Hub */ })
    }

    return stop
  }, [nav, refresh, returned])

  const message = error
    || (returned.error && !isLinkedOnFirstLogin(returned.error) ? federatedErrorMessage(returned.error) : "")

  return (
    <div className="min-h-screen grid place-items-center bg-[#F9FAFB] p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm text-center">
        <ZoeLogo className="w-12 h-auto text-teal-500 mb-6 mx-auto" />

        {message ? (
          <>
            <h1 className="text-xl font-bold mb-1">Não foi possível entrar</h1>
            <p className="text-sm text-destructive mb-6">{message}</p>
            <Button onClick={() => nav("/login", { replace: true })} className="w-full bg-teal-500 hover:bg-teal-500/90 text-white">
              Voltar para o login
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1">Entrando...</h1>
            <p className="text-sm text-[#6B7280]">Só um momento.</p>
            <div className="mt-6 animate-spin rounded-full h-8 w-8 mx-auto border-2 border-teal-500 border-t-transparent" />
          </>
        )}
      </div>
    </div>
  )
}
