import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Loader2, AlertCircle, CheckCircle2, Handshake } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/features/auth/context"
import {
  setPendingInfluencerInviteToken,
  setPendingInviteEmail,
  clearPendingInfluencerInviteToken,
} from "@/features/auth/pendingInvite"
import { tEnum } from "@/i18n/enums"
import { operationsApi } from "@/lib/api/operations"
import { fmtDate } from "@/pages/operations/format"

/**
 * Aceite do convite de criador. Fora do AppShell de propósito: quem abre este link
 * não pertence a workspace nenhum — e não vai pertencer, porque criador não é membro
 * do workspace do contratante.
 *
 * A prévia é pública: a pessoa vê quem a chamou e para qual campanha antes de decidir
 * criar conta. Só o aceite exige estar autenticado.
 */
export default function InfluencerInvitePage() {
  const { token = "" } = useParams<{ token: string }>()
  const { isAuthenticated, isLoading: authLoading, refresh } = useAuth()
  const navigate = useNavigate()
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState<string | null>(null)

  const preview = useQuery({
    queryKey: ["influencer-invite", token],
    queryFn: () => operationsApi.previewInfluencerInvite(token),
    enabled: Boolean(token),
    retry: false,
  })

  // Guarda o token para depois do login: quem chega sem conta passa por
  // cadastro/confirmação de e-mail e precisa voltar exatamente para este convite.
  // Mesma mecânica do convite de membro, chave própria.
  useEffect(() => {
    if (token) setPendingInfluencerInviteToken(token)
  }, [token])

  // O e-mail vai junto: o cadastro trava esse campo em modo convite, e sem tê-lo aqui
  // ele ficava travado E vazio — ninguém conseguia se cadastrar.
  useEffect(() => {
    if (preview.data?.email) setPendingInviteEmail(preview.data.email)
  }, [preview.data?.email])

  // Convite que não tem mais para onde ir (vencido, já aceito, inexistente) precisa
  // sair do armazenamento: senão o ProtectedRoute devolve a pessoa para cá em loop.
  useEffect(() => {
    if (preview.isError || preview.data?.expired || preview.data?.accepted)
      clearPendingInfluencerInviteToken()
  }, [preview.isError, preview.data?.expired, preview.data?.accepted])

  const accept = async () => {
    setAccepting(true)
    try {
      const res = await operationsApi.acceptInfluencerInvite(token)
      clearPendingInfluencerInviteToken()
      // O aceite muda o TIPO da conta no backend — ela vira criadora. Sem recarregar a
      // sessão, o app continuava achando que era uma conta comum sem workspace: o botão
      // seguinte levava a uma rota protegida, e a guarda mandava a pessoa criar um
      // workspace, que o backend recusa para criador. Era o desvio que aparecia logo
      // depois do cadastro.
      await refresh()
      setAccepted(res.campaignName ?? res.tenantName)
      toast.success(res.campaignName
        ? `Você entrou na campanha ${res.campaignName}.`
        : `Você entrou no elenco de ${res.tenantName}.`)
    } catch (e) {
      // O backend recusa por motivos que a pessoa precisa entender: e-mail diferente
      // do convite, ou conta que já pertence a um workspace.
      toast.error(e instanceof ApiError ? e.message : "Não foi possível aceitar o convite.")
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6" style={{ background: "var(--bg, #FAFBFC)" }}>
      <div
        className="w-full max-w-md rounded-xl border border-border-soft p-7"
        style={{ background: "var(--surface)" }}
      >
        {preview.isLoading || authLoading ? (
          <div className="flex items-center gap-2 text-ink-muted text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando convite…
          </div>
        ) : preview.isError ? (
          <Invalid />
        ) : accepted ? (
          <Done campaignName={accepted} onGo={() => navigate("/criador/cadastro", { replace: true })} />
        ) : (
          <Preview
            data={preview.data!}
            isAuthenticated={isAuthenticated}
            accepting={accepting}
            onAccept={accept}
          />
        )}
      </div>
    </div>
  )
}

function Preview({
  data, isAuthenticated, accepting, onAccept,
}: {
  data: import("@/lib/api/operations").InfluencerInvitePreview
  isAuthenticated: boolean
  accepting: boolean
  onAccept: () => void
}) {
  const blocked = data.expired || data.accepted

  return (
    <>
      <div className="flex items-center gap-2 mb-5">
        <Handshake className="w-5 h-5" style={{ color: "var(--color-teal-500)" }} />
        <div className="eyebrow">{data.campaignName ? "Convite de campanha" : "Convite de elenco"}</div>
      </div>

      <h1 className="font-display m-0 mb-2" style={{ fontSize: 26, lineHeight: 1.15, color: "var(--ink)" }}>
        {data.tenantName} convidou você
      </h1>

      {/* Sem campanha o convite é para o elenco: a marca quer a pessoa por perto, e a
          ação específica vem depois — ou nunca. Dizer "campanha" aqui seria prometer
          trabalho que ainda não existe. */}
      <p className="text-[14px] text-ink-muted mb-5">
        {data.campaignName ? (
          <>
            Para a campanha <span style={{ color: "var(--ink)" }}>{data.campaignName}</span>
            {data.modality && <> ({tEnum("contractModality", data.modality)})</>}, no nome de{" "}
            <span style={{ color: "var(--ink)" }}>{data.influencerName}</span>.
          </>
        ) : (
          <>
            Para fazer parte do elenco de criadores, no nome de{" "}
            <span style={{ color: "var(--ink)" }}>{data.influencerName}</span>. As campanhas
            chegam depois, conforme surgirem.
          </>
        )}
      </p>

      {data.message && (
        <div
          className="rounded-lg p-3 text-[13px] mb-5"
          style={{ background: "var(--bg, #F9FAFB)", color: "var(--ink)" }}
        >
          “{data.message}” <span className="text-ink-muted">— {data.inviterName}</span>
        </div>
      )}

      {data.accepted ? (
        <Notice tone="ok" text="Este convite já foi aceito. Entre na sua conta para ver a campanha." />
      ) : data.expired ? (
        <Notice
          tone="warn"
          text={`Este convite venceu em ${fmtDate(data.expiresAt)}. Peça um novo para quem te chamou.`}
        />
      ) : (
        <p className="text-[12.5px] text-ink-muted mb-5">
          Aceitando, você passa a ver as campanhas e contratos em que foi convidado, e envia
          suas entregas por aqui. Você não terá acesso aos dados de {data.tenantName}.
        </p>
      )}

      {!blocked && (isAuthenticated ? (
        <button
          onClick={onAccept}
          disabled={accepting}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[14px] font-medium text-white disabled:opacity-50"
          style={{ background: "var(--color-teal-500)" }}
        >
          {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
          Aceitar convite
        </button>
      ) : (
        <>
          {/* O aceite exige conta: é ela que assume o registro do criador. O e-mail
              precisa ser o mesmo do convite, senão o backend recusa. */}
          <Link
            to="/register"
            className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-[14px] font-medium text-white"
            style={{ background: "var(--color-teal-500)" }}
          >
            Criar minha conta
          </Link>
          <Link
            to="/login"
            className="w-full inline-flex items-center justify-center px-4 py-2.5 mt-2 rounded-lg text-[14px] font-medium border border-border-soft"
          >
            Já tenho conta
          </Link>
          <p className="text-[11.5px] text-ink-muted mt-3 text-center">
            Use o e-mail <span className="font-mono-zoe">{data.email}</span> — o convite é dele.
          </p>
        </>
      ))}
    </>
  )
}

function Notice({ tone, text }: { tone: "ok" | "warn"; text: string }) {
  const color = tone === "ok" ? "#00A799" : "#D97706"
  return (
    <div className="rounded-lg p-3 text-[12.5px] mb-1" style={{ background: `${color}15`, color }}>
      {text}
    </div>
  )
}

function Done({ campaignName, onGo }: { campaignName: string; onGo: () => void }) {
  return (
    <div className="text-center">
      <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-teal-500)" }} />
      <h1 className="font-display m-0 mb-2" style={{ fontSize: 24, color: "var(--ink)" }}>
        Tudo certo
      </h1>
      <p className="text-[13.5px] text-ink-muted mb-5">
        Você entrou em {campaignName}. Falta completar seu cadastro — leva poucos minutos e
        é o que permite à marca montar a proposta.
      </p>
      <button
        onClick={onGo}
        className="w-full px-4 py-2.5 rounded-lg text-[14px] font-medium text-white"
        style={{ background: "var(--color-teal-500)" }}
      >
        Completar cadastro
      </button>
    </div>
  )
}

function Invalid() {
  return (
    <div className="text-center">
      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-[#DC2626]" />
      <h1 className="font-display m-0 mb-2" style={{ fontSize: 24, color: "var(--ink)" }}>
        Convite não encontrado
      </h1>
      <p className="text-[13.5px] text-ink-muted">
        O link pode ter sido digitado errado ou revogado. Peça um novo para quem te chamou.
      </p>
    </div>
  )
}
