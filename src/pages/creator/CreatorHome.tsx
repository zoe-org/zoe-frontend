import { useState } from "react"
import {
  Loader2, LogOut, Upload, Wallet, ExternalLink, AlertCircle, Play, FileText, Megaphone,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { StatusChip } from "@/components/ui/status-chip"
import { useAuth } from "@/features/auth/context"
import { tEnum } from "@/i18n/enums"
import { fmtDate, initials } from "@/pages/operations/format"
import { fmtCents, youtubeThumb, youtubeWatch } from "@/lib/api/operations"
import {
  useCreatorWorkspace, useCreatorMutations,
  type CreatorEngagement, type CreatorDelivery,
} from "@/lib/api/creator"
import { CreatorContractPanel } from "@/pages/creator/CreatorContractPanel"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

const DELIVERY_COLOR: Record<string, string> = {
  Submitted: "#6B7280",
  UnderReview: "#D97706",
  Approved: "#00A799",
  ReworkRequested: "#DC2626",
  Rejected: "#DC2626",
}

/**
 * Área do criador. Shell próprio, fora do AppShell da marca: não há workspace para
 * trocar, não há navegação de módulos, e nenhuma tela de lá funcionaria — sem tenant
 * todas voltam 403.
 *
 * O que ele faz aqui é o que o fluxo lhe reserva: ver em que campanhas foi contratado,
 * quanto vai receber, e mandar o link do vídeo quando a produção estiver liberada.
 */
export default function CreatorHomePage() {
  const { user, signOut } = useAuth()
  const workspace = useCreatorWorkspace()
  const [tab, setTab] = useState<"campanhas" | "contratos">("campanhas")

  const d = workspace.data

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg, #FAFBFC)" }}>
      <header
        className="border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="max-w-[880px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ZoeLogo className="h-6 w-auto" />
            <span className="chip text-[10.5px]">Criador</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                {d?.fullName ?? user?.name}
              </div>
              <div className="text-[11px] text-ink-muted">{d?.email ?? user?.email}</div>
            </div>
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
        {workspace.isLoading ? (
          <div className="flex items-center gap-2 text-ink-muted text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : workspace.isError ? (
          <NotACreator error={workspace.error} />
        ) : d ? (
          <>
            <h1 className="font-display m-0 mb-1.5" style={{ fontSize: 28, color: "var(--ink)" }}>
              Olá, {d.fullName.split(" ")[0]}
            </h1>
            <p className="text-[14px] text-ink-muted mb-6">
              {d.engagements.length === 0
                ? "Você ainda não tem contratos. Quando uma marca te contratar, a campanha aparece aqui."
                : `Você tem ${d.engagements.length} ${d.engagements.length === 1 ? "contrato" : "contratos"}.`}
            </p>

            {!d.canReceivePayout && d.payoutBlockedReason && (
              <div
                className="rounded-xl border border-border-soft p-4 mb-6 flex items-start gap-3"
                style={{ background: "#D9770610" }}
              >
                <Wallet className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#D97706" }} />
                <div>
                  <div className="text-[13px] font-medium mb-0.5" style={{ color: "#D97706" }}>
                    Conta de recebimento pendente
                  </div>
                  <p className="text-[12.5px] text-ink-muted m-0">{d.payoutBlockedReason}</p>
                  {/* Sem Stripe Connect não há para onde mandar: prometer um botão de
                      conectar seria prometer integração que não existe (bloqueio do G1). */}
                  <p className="text-[11.5px] text-ink-muted mt-1.5 mb-0">
                    A conexão da conta abre quando a marca concluir a configuração de
                    pagamentos. Você não precisa fazer nada agora.
                  </p>
                </div>
              </div>
            )}

            {/* Duas abas, como o time definiu: acompanhar o trabalho e ler o contrato
                são momentos diferentes, e misturá-los numa lista só faz o contrato
                desaparecer embaixo das entregas. */}
            <div className="flex gap-1 mb-5">
              <TabButton
                active={tab === "campanhas"}
                onClick={() => setTab("campanhas")}
                icon={<Megaphone className="w-3.5 h-3.5" />}
                label="Campanhas"
                count={d.engagements.length}
              />
              <TabButton
                active={tab === "contratos"}
                onClick={() => setTab("contratos")}
                icon={<FileText className="w-3.5 h-3.5" />}
                label="Contratos"
                count={d.engagements.length}
              />
            </div>

            {tab === "campanhas" ? (
              <div className="flex flex-col gap-4">
                {d.engagements.map((e) => (
                  <EngagementCard key={e.contractId} e={e} />
                ))}
              </div>
            ) : (
              <CreatorContractPanel engagements={d.engagements} />
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}

function TabButton({
  active, onClick, icon, label, count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors"
      style={active
        ? { background: "var(--color-teal-500)", color: "#fff" }
        : { color: "var(--ink-muted)" }}
    >
      {icon}
      {label}
      <span className="font-normal" style={{ opacity: 0.75 }}>({count})</span>
    </button>
  )
}

function EngagementCard({ e }: { e: CreatorEngagement }) {
  const { submit } = useCreatorMutations()
  const [url, setUrl] = useState("")

  const send = async () => {
    try {
      await submit.mutateAsync({ contractId: e.contractId, submittedUrl: url.trim() })
      setUrl("")
      toast.success("Entrega enviada. A marca vai revisar o vídeo.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível enviar.")
    }
  }

  return (
    <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="eyebrow mb-1">{e.brandName}</div>
          <h2 className="font-display m-0" style={{ fontSize: 19, color: "var(--ink)" }}>
            {e.campaignName}
          </h2>
          <div className="text-[12.5px] text-ink-muted mt-1">
            {tEnum("contractModality", e.modality)}
            {e.escrowState && ` · ${tEnum("escrowState", e.escrowState)}`}
          </div>
        </div>
        <div className="text-right">
          {/* O que importa para ele é o líquido, não o bruto do contrato — o take rate
              da Zoe sai antes de chegar nele. */}
          <div className="font-mono-zoe text-[18px] font-semibold" style={{ color: "var(--ink)" }}>
            {e.netToInfluencerCents != null ? fmtCents(e.netToInfluencerCents) : "Permuta"}
          </div>
          {e.netToInfluencerCents != null && (
            <div className="text-[11px] text-ink-muted">seu valor líquido</div>
          )}
        </div>
      </div>

      {e.deliveries.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-4">
          {e.deliveries.map((dl) => <DeliveryRow key={dl.deliveryId} dl={dl} />)}
        </div>
      )}

      {e.canSubmitDelivery ? (
        <div>
          <div className="text-[11px] text-ink-muted mb-1.5">
            Link do vídeo já publicado no YouTube
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Input
              value={url}
              onChange={(ev) => setUrl(ev.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="flex-1 min-w-[200px]"
            />
            <button
              onClick={send}
              disabled={submit.isPending || !url.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-50 shrink-0"
              style={{ background: "var(--color-teal-500)" }}
            >
              {submit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Upload className="w-3.5 h-3.5" />}
              Enviar entrega
            </button>
          </div>
          <p className="text-[11.5px] text-ink-muted mt-2 mb-0">
            Publique primeiro e mande o link. A conferência é feita sobre o vídeo público —
            não aceita arquivo nem print.
          </p>
        </div>
      ) : e.blockedReason ? (
        <div
          className="rounded-lg p-3 text-[12.5px]"
          style={{ background: "var(--bg, #F9FAFB)", color: "var(--ink-muted)" }}
        >
          {e.blockedReason}
        </div>
      ) : null}
    </div>
  )
}

function DeliveryRow({ dl }: { dl: CreatorDelivery }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-soft p-2.5">
      <a
        href={youtubeWatch(dl.youtubeVideoId)}
        target="_blank"
        rel="noreferrer noopener"
        className="relative w-[92px] aspect-video rounded overflow-hidden bg-[#111827] shrink-0"
      >
        <img
          src={youtubeThumb(dl.youtubeVideoId)}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(ev) => { ev.currentTarget.style.visibility = "hidden" }}
        />
        <div className="absolute inset-0 grid place-items-center">
          <Play className="w-4 h-4" style={{ color: "rgba(255,255,255,.9)" }} />
        </div>
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <StatusChip status={dl.status} kind="deliveryStatus" colors={DELIVERY_COLOR} small />
          {dl.submissionAttempt > 1 && (
            <span className="text-[10.5px] text-ink-muted">{dl.submissionAttempt}ª tentativa</span>
          )}
          <span className="text-[10.5px] text-ink-muted">{fmtDate(dl.submittedAt)}</span>
        </div>
        <a
          href={youtubeWatch(dl.youtubeVideoId)}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-[11.5px] font-mono-zoe truncate max-w-full"
          style={{ color: "var(--color-teal-500)" }}
        >
          {dl.submittedUrl} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
        </a>
        {/* O motivo da correção é o que ele precisa ler para saber o que refazer. */}
        {dl.decisionNotes && (
          <p className="text-[12px] text-ink-muted mt-1.5 mb-0">{dl.decisionNotes}</p>
        )}
      </div>
    </div>
  )
}

function NotACreator({ error }: { error: unknown }) {
  const notLinked = error instanceof ApiError && error.status === 404
  return (
    <div className="rounded-xl border border-border-soft p-6" style={{ background: "var(--surface)" }}>
      <AlertCircle className="w-8 h-8 mb-3" style={{ color: "#D97706" }} />
      <h1 className="font-display m-0 mb-2" style={{ fontSize: 22, color: "var(--ink)" }}>
        {notLinked ? "Esta conta ainda não é de criador" : "Não foi possível carregar"}
      </h1>
      <p className="text-[13.5px] text-ink-muted m-0">
        {notLinked
          ? "Você entra como criador aceitando o convite que a marca te enviou. Peça o link para quem te chamou."
          : "Tente novamente em instantes."}
      </p>
    </div>
  )
}
