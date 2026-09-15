import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Loader2, LogOut, Upload, ExternalLink, AlertCircle, Play, FileText, Megaphone,
  UserRoundPen, ListChecks,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { StatusChip } from "@/components/ui/status-chip"
import { useAuth } from "@/features/auth/context"
import { tEnum } from "@/i18n/enums"
import { fmtDate, initials } from "@/pages/operations/format"
import { fmtCents, deliveryThumb, deliveryLink } from "@/lib/api/operations"
import { PlatformCover } from "@/pages/operations/shared"
import {
  useCreatorWorkspace, useCreatorMutations, useSetCreatorTaxId, trabalhoLabel,
  type CreatorEngagement, type CreatorDelivery,
} from "@/lib/api/creator"
import { CreatorContractPanel } from "@/pages/creator/CreatorContractPanel"
import { CreatorDraftUpload } from "@/pages/creator/CreatorDraftUpload"
import { proximosPassos, type ProximoPasso } from "@/pages/creator/nextSteps"
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
/**
 * CPF ou CNPJ do criador.
 *
 * <p>Não confundir com o cadastro de recebimento: lá os dados fiscais ficam com o provedor
 * de pagamentos de propósito, e continuam ficando. O documento é pedido aqui por outro
 * motivo — um contrato precisa <b>identificar quem assina</b>, e o provedor não devolve
 * esse dado para nós.</p>
 *
 * <p>Some depois de preenchido: é campo que se toca uma vez, e mantê-lo em destaque
 * ocuparia a tela com uma tarefa já concluída.</p>
 */
function TaxIdCard({ current }: { current: string | null }) {
  const [value, setValue] = useState("")
  const save = useSetCreatorTaxId()

  if (current) return null

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    try {
      await save.mutateAsync(value)
      toast.success("Documento registrado.")
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Não foi possível registrar o documento.")
    }
  }

  return (
    <form
      onSubmit={submit}
      id="documento"
      className="rounded-xl border border-border-soft p-5 mb-4 scroll-mt-6"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-start gap-2.5 mb-1">
        <FileText className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#D97706" }} />
        <div>
          <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
            Informe seu CPF ou CNPJ
          </div>
          <p className="text-[12.5px] text-ink-muted m-0 mt-0.5">
            É o que identifica você como parte no contrato. Sem ele o documento sai
            incompleto.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3 flex-wrap">
        <Input
          value={value}
          onChange={(ev) => setValue(ev.target.value)}
          placeholder="000.000.000-00"
          inputMode="numeric"
          className="max-w-[220px]"
          aria-label="CPF ou CNPJ"
        />
        <button
          type="submit"
          disabled={save.isPending || value.trim().length === 0}
          className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft disabled:opacity-50"
        >
          {save.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  )
}

export default function CreatorHomePage() {
  const { user, signOut } = useAuth()
  const workspace = useCreatorWorkspace()
  const [tab, setTab] = useState<"campanhas" | "contratos">("campanhas")
  const navigate = useNavigate()
  /** Contrato que "Assinar o contrato" pediu para abrir na aba de contratos. */
  const [focoContrato, setFocoContrato] = useState<string | null>(null)

  const rolarAte = (id: string) =>
    // Depois da troca de aba: o card de destino só existe no próximo render.
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)

  const irPara = (p: ProximoPasso) => {
    const destino = p.destino
    if ("rota" in destino) {
      navigate(destino.rota)
    } else if ("ancora" in destino) {
      rolarAte(destino.ancora)
    } else if (destino.aba === "contratos") {
      setFocoContrato(destino.contractId)
      setTab("contratos")
    } else {
      setTab("campanhas")
      rolarAte(`trabalho-${destino.contractId}`)
    }
  }

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

            {/* A conta de recebimento vive no card de próximos passos. Existia um banner só
                para ela logo acima, e os dois diziam a mesma coisa um embaixo do outro. */}
            <ProximosPassosCard
              passos={proximosPassos(d)}
              temTrabalho={d.engagements.length > 0}
              onIr={irPara}
            />

            {/* Duas abas, como o time definiu: acompanhar o trabalho e ler o contrato
                são momentos diferentes, e misturá-los numa lista só faz o contrato
                desaparecer embaixo das entregas. */}
            <div className="flex gap-1 mb-5">
              <TabButton
                active={tab === "campanhas"}
                onClick={() => setTab("campanhas")}
                icon={<Megaphone className="w-3.5 h-3.5" />}
                label="Campanhas"
                badge={String(d.engagements.length)}
              />
              {/* As duas abas mostravam o mesmo número — são o mesmo conjunto de trabalhos.
                  Em contratos, o que vale contar é o que espera a assinatura dele. */}
              <TabButton
                active={tab === "contratos"}
                onClick={() => setTab("contratos")}
                icon={<FileText className="w-3.5 h-3.5" />}
                label="Contratos"
                badge={(() => {
                  const n = d.engagements.filter((e) => e.contractStatus === "SentForSignature").length
                  return n > 0 ? `${n} para assinar` : undefined
                })()}
              />
            </div>

            {/* Fica acima das abas porque vale para as duas: sem documento, o contrato
                sai sem identificar a parte contratada. */}
            <TaxIdCard current={d.taxId} />

            {/* Cadastro incompleto não bloqueia a área — ele já pode ver contrato e mandar
                entrega. É a marca que fica sem o que precisa para montar a proposta, e é
                isso que o card diz, em vez de tratar a pessoa como pendência. */}
            {!d.profile.complete && (
              <Link
                to="/criador/cadastro"
                className="rounded-xl border p-4 mb-4 flex items-start gap-3 transition-colors"
                style={{ background: "var(--surface)", borderColor: "var(--color-teal-500)" }}
              >
                <UserRoundPen
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: "var(--color-teal-500)" }}
                />
                <div>
                  <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                    Complete seu cadastro
                  </div>
                  <p className="text-[12.5px] text-ink-muted m-0 mt-0.5">
                    Suas redes, área de atuação e temas. É por eles que as marcas te acham
                    para as propostas certas — leva poucos minutos.
                  </p>
                </div>
              </Link>
            )}

            {tab === "campanhas" ? (
              <div className="flex flex-col gap-4">
                {d.engagements.map((e) => (
                  <EngagementCard key={e.contractId} e={e} />
                ))}
              </div>
            ) : (
              <CreatorContractPanel
                key={focoContrato ?? "inicio"}
                engagements={d.engagements}
                initialContractId={focoContrato}
              />
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}

/**
 * O que depende do criador agora, no topo da área. Pensado para o celular: é a primeira coisa
 * que aparece, e cada linha leva direto ao lugar de fazer.
 */
function ProximosPassosCard({
  passos, temTrabalho, onIr,
}: {
  passos: ProximoPasso[]
  temTrabalho: boolean
  onIr: (p: ProximoPasso) => void
}) {
  if (passos.length === 0) {
    if (!temTrabalho) return null
    return (
      <div
        className="rounded-xl border border-border-soft p-4 mb-4 text-[13px] text-ink-muted"
        style={{ background: "var(--surface)" }}
      >
        Nada pendente com você agora — a próxima etapa é da marca.
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border p-4 mb-4"
      style={{ background: "var(--surface)", borderColor: "var(--color-teal-500)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <ListChecks className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />
        <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
          O que você precisa fazer agora
        </div>
      </div>
      <ol className="m-0 p-0 list-none flex flex-col gap-0.5">
        {passos.map((p, i) => (
          <li key={p.chave}>
            <button
              onClick={() => onIr(p)}
              className="w-full text-left flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
            >
              <span
                className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-semibold text-white shrink-0 mt-0.5"
                style={{ background: "var(--color-teal-500)" }}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium" style={{ color: "var(--ink)" }}>{p.titulo}</span>
                <span className="block text-[12px] text-ink-muted">{p.detalhe}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function TabButton({
  active, onClick, icon, label, badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: string
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
      {badge && <span className="font-normal" style={{ opacity: 0.75 }}>({badge})</span>}
    </button>
  )
}

function EngagementCard({ e }: { e: CreatorEngagement }) {
  const { submit } = useCreatorMutations()
  const [url, setUrl] = useState("")

  // Contrato que não exige corte publica direto — ao vivo, por exemplo.
  const draftApproved = !e.requiresDraftApproval || e.draft?.status === "Approved"

  // A última tentativa decide o recado: com o corte reaberto a marca pediu vídeo novo; com o
  // corte ainda aprovado, só ajuste na postagem.
  const ultimaEntrega = [...e.deliveries].sort((a, b) => b.submissionAttempt - a.submissionAttempt)[0]
  const correcaoPedida = ultimaEntrega?.status === "ReworkRequested"

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
    <div
      id={`trabalho-${e.contractId}`}
      className="rounded-xl border border-border-soft p-5 scroll-mt-6"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="eyebrow mb-1">{e.brandName}</div>
          <h2 className="font-display m-0" style={{ fontSize: 19, color: "var(--ink)" }}>
            {trabalhoLabel(e.campaignName)}
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
            {e.netToInfluencerCents != null ? fmtCents(e.netToInfluencerCents) : e.usesEscrow ? "a reservar" : "Permuta"}
          </div>
          {e.netToInfluencerCents != null && (
            <div className="text-[11px] text-ink-muted">seu valor líquido</div>
          )}
        </div>
      </div>

      {correcaoPedida && (
        <div className="rounded-lg p-3 text-[12.5px] mb-4" style={{ background: "#D9770612", color: "#B45309" }}>
          <div className="font-medium mb-0.5">A marca pediu uma correção</div>
          {e.draft?.status === "ChangesRequested"
            ? "É para refazer o vídeo: envie um novo corte para aprovação antes de publicar de novo."
            : "É um ajuste na publicação: corrija a postagem (legenda, #publi, link ou privacidade) e reenvie o link abaixo."}
        </div>
      )}

      {e.deliveries.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-4">
          {e.deliveries.map((dl) => <DeliveryRow key={dl.deliveryId} dl={dl} />)}
        </div>
      )}

      {/* Primeiro portão. Vem antes do campo do link de propósito: a ordem na tela é a
          ordem do processo, e mostrar o campo do publicado por cima faria o criador
          publicar antes de a marca ver. */}
      {e.canSubmitDelivery && (
        <div className="mb-4">
          <CreatorDraftUpload engagement={e} />
        </div>
      )}

      {e.canSubmitDelivery && draftApproved ? (
        <div>
          <div className="text-[11px] text-ink-muted mb-1.5">
            Link do vídeo já publicado — YouTube, Instagram ou TikTok
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Input
              value={url}
              onChange={(ev) => setUrl(ev.target.value)}
              placeholder="youtube.com/watch?v=…  ·  instagram.com/reel/…  ·  tiktok.com/@…/video/…"
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
        href={deliveryLink(dl)}
        target="_blank"
        rel="noreferrer noopener"
        className="relative w-[92px] aspect-video rounded overflow-hidden bg-[#111827] shrink-0"
      >
        {deliveryThumb(dl) ? (
          <img
            src={deliveryThumb(dl)!}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(ev) => { ev.currentTarget.style.visibility = "hidden" }}
          />
        ) : (
          <PlatformCover platform={dl.platform} compact />
        )}
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
          href={deliveryLink(dl)}
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
