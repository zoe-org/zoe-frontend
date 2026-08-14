import { useEffect, useRef } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Loader2, LogOut, Wallet, ArrowLeft, ExternalLink, Check, AlertCircle, ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/features/auth/context"
import { initials } from "@/pages/operations/format"
import { useCreatorWorkspace, usePayoutMutations } from "@/lib/api/creator"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

/**
 * Conta de recebimento do criador.
 *
 * <p><b>Nada de dado fiscal aqui.</b> Nome civil, CPF e conta bancária o criador preenche
 * no cadastro hospedado do provedor de pagamentos, não nesta tela. Não é economia de
 * formulário: é o que mantém dado sensível fora do nosso banco e deixa a verificação com
 * quem tem obrigação regulatória de fazê-la.</p>
 *
 * <p><b>O que trava é o recebimento, não o trabalho.</b> Sem conta verificada ele assina
 * contrato e produz normalmente — o que não acontece é o dinheiro sair. A tela diz isso
 * com todas as letras, porque a leitura contrária ("estou impedido de trabalhar") é a que
 * faz alguém desistir da campanha.</p>
 */
export default function CreatorPayoutPage() {
  const { user, signOut } = useAuth()
  const workspace = useCreatorWorkspace()
  const { start, sync } = usePayoutMutations()
  const [params, setParams] = useSearchParams()

  const d = workspace.data
  const returned = params.get("status")

  // Ao voltar do provedor, perguntar o estado real. Ele verifica no tempo dele e não
  // avisa ninguém — sem esta chamada a tela mostraria "pendente" para quem acabou de
  // concluir. Uma vez só: o ref evita repetir a cada re-render.
  const syncedOnReturn = useRef(false)
  useEffect(() => {
    if (!returned || syncedOnReturn.current) return
    syncedOnReturn.current = true

    sync.mutate(undefined, {
      onSettled: () => setParams({}, { replace: true }),
    })
  }, [returned, sync, setParams])

  const connect = async () => {
    try {
      const res = await start.mutateAsync()

      if (!res.onboardingUrl) {
        toast.error(res.message ?? "Não foi possível abrir o cadastro agora.")
        return
      }

      // Mesma aba de propósito: o provedor devolve o criador para a returnUrl, e abrir
      // em nova aba deixaria a original parada num estado que já não é verdade.
      window.location.href = res.onboardingUrl
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível abrir o cadastro.")
    }
  }

  const verified = d?.canReceivePayout ?? false
  const busy = start.isPending || sync.isPending

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg, #FAFBFC)" }}>
      <header className="border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="max-w-[880px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ZoeLogo className="h-6 w-auto" />
            <span className="chip text-[10.5px]">Criador</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full grid place-items-center text-[11.5px] font-semibold text-white"
              style={{ background: "var(--color-teal-500)" }}
            >
              {initials(d?.fullName ?? user?.name ?? "", d?.email ?? user?.email ?? "")}
            </div>
            <button
              onClick={() => void signOut()}
              className="text-ink-muted hover:opacity-70"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[880px] mx-auto px-6 py-8">
        <Link
          to="/criador"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:opacity-70 mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Link>

        <h1 className="font-display m-0 mb-1.5" style={{ fontSize: 28, color: "var(--ink)" }}>
          Conta de recebimento
        </h1>
        <p className="text-[14px] text-ink-muted mb-7 max-w-[62ch]">
          É por ela que o dinheiro das campanhas chega até você. O cadastro é feito no
          nosso provedor de pagamentos — a Zoe não guarda seus documentos nem seus dados
          bancários.
        </p>

        {workspace.isLoading ? (
          <div className="flex items-center gap-2 text-ink-muted text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            {sync.isPending && (
              <div className="flex items-center gap-2 text-ink-muted text-[13px] mb-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Conferindo com o provedor…
              </div>
            )}

            <div
              className="rounded-xl border p-5 mb-5"
              style={{
                background: "var(--surface)",
                borderColor: verified ? "var(--color-teal-500)" : "var(--border-soft)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
                  style={{ background: verified ? "#00A79915" : "#D9770615" }}
                >
                  {verified
                    ? <ShieldCheck className="w-4.5 h-4.5" style={{ color: "var(--color-teal-500)" }} />
                    : <Wallet className="w-4.5 h-4.5" style={{ color: "#D97706" }} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="text-[14px] font-medium mb-1"
                    style={{ color: verified ? "var(--color-teal-500)" : "#D97706" }}
                  >
                    {verified ? "Recebimento liberado" : "Cadastro pendente"}
                  </div>

                  <p className="text-[13px] text-ink-2 m-0 leading-relaxed">
                    {verified
                      ? "Sua conta está verificada. Os pagamentos aprovados são transferidos automaticamente."
                      : d?.payoutBlockedReason
                        ?? "Falta concluir o cadastro no provedor para poder receber."}
                  </p>

                  {!verified && (
                    <>
                      {/* A distinção que evita o abandono da campanha. */}
                      <p className="text-[12.5px] text-ink-muted mt-2.5 mb-0">
                        Isso <strong>não impede</strong> você de aceitar contratos nem de
                        enviar entregas — só o pagamento fica retido até a verificação sair.
                      </p>

                      <button
                        onClick={connect}
                        disabled={busy}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-50"
                        style={{ background: "var(--color-teal-500)" }}
                      >
                        {start.isPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <ExternalLink className="w-3.5 h-3.5" />}
                        Continuar cadastro
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {returned === "expirado" && (
              <div
                className="rounded-lg border border-border-soft p-3.5 mb-5 flex items-start gap-2.5"
                style={{ background: "#D9770610" }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#D97706" }} />
                <p className="text-[12.5px] text-ink-2 m-0">
                  O link do cadastro venceu — eles duram poucos minutos por segurança.
                  Clique em <strong>Continuar cadastro</strong> para abrir um novo; o que
                  você já preencheu foi guardado.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
              <div className="eyebrow mb-3">Como funciona</div>
              <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
                {[
                  "Você preenche seus dados direto no provedor de pagamentos, em ambiente dele.",
                  "A verificação leva de alguns minutos a alguns dias, dependendo dos documentos.",
                  "Enquanto isso você segue trabalhando normalmente — só o repasse espera.",
                  "Aprovada a entrega, o valor combinado cai nesta conta com o desconto da taxa da plataforma.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[13px] text-ink-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--color-teal-500)" }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
