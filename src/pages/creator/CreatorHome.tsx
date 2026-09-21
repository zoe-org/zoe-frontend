import { useState } from "react"
import { DELIVERY_STATUS_COLOR } from "@/lib/status-colors"
import { Link, useNavigate } from "react-router-dom"
import {
  Loader2, LogOut, Upload, ExternalLink, AlertCircle, Play, FileText, Megaphone,
  UserRoundPen, ListChecks,
} from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { StatusChip } from "@/components/ui/status-chip"
import { useAuth } from "@/features/auth/context"
import { tEnum } from "@/i18n/enums"
import { fmtDate, initials } from "@/lib/operations-format"
import { fmtCents, deliveryLink } from "@/lib/api/operations"
import { PlatformCover } from "@/components/operations/shared"
import {
  useCreatorWorkspace, useCreatorMutations, useSetCreatorTaxId, useCreatorDeliveryThumb, workLabel,
  type CreatorEngagement, type CreatorDelivery,
} from "@/lib/api/creator"
import { CreatorContractPanel } from "@/components/creator/CreatorContractPanel"
import { CreatorPrivacyCard } from "@/components/creator/CreatorPrivacyCard"
import { CreatorDraftUpload } from "@/components/creator/CreatorDraftUpload"
import { nextSteps, type NextStep } from "@/lib/creator-next-steps"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

const DELIVERY_COLOR = DELIVERY_STATUS_COLOR

/**
 * CPF ou CNPJ do criador, exigido para identificá-lo no contrato; o provedor de pagamentos não devolve esse dado. Some depois de preenchido.
 */
function TaxIdCard({ current }: { current: string | null }) {
  const [value, setValue] = useState("")
  const save = useSetCreatorTaxId()

  if (current) return null

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    try {
      await save.mutateAsync(value)
      notifySuccess("Documento registrado.")
    } catch (e) {
      notifyError(e, "Não foi possível registrar o documento.")
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
        <FileText className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-warn)" }} />
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

/** Área do criador, com shell próprio: sem workspace, as telas da marca responderiam 403. */
export default function CreatorHomePage() {
  const { user, signOut } = useAuth()
  const workspace = useCreatorWorkspace()
  const [tab, setTab] = useState<"campaigns" | "contracts">("campaigns")
  const navigate = useNavigate()
  /** Contrato que "Assinar o contrato" pediu para abrir na aba de contratos. */
  const [focusedContract, setFocusedContract] = useState<string | null>(null)

  const scrollToId = (id: string) =>
    // Depois da troca de aba: o card de destino só existe no próximo render.
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)

  const goToStep = (p: NextStep) => {
    const target = p.target
    if ("route" in target) {
      navigate(target.route)
    } else if ("anchor" in target) {
      scrollToId(target.anchor)
    } else if (target.tab === "contracts") {
      setFocusedContract(target.contractId)
      setTab("contracts")
    } else {
      setTab("campaigns")
      scrollToId(`trabalho-${target.contractId}`)
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
            <NextStepsCard
              steps={nextSteps(d)}
              hasWork={d.engagements.length > 0}
              onGoTo={goToStep}
            />

            {/* Duas abas: acompanhar o trabalho e ler o contrato são momentos diferentes. */}
            <div className="flex gap-1 mb-5">
              <TabButton
                active={tab === "campaigns"}
                onClick={() => setTab("campaigns")}
                icon={<Megaphone className="w-3.5 h-3.5" />}
                label="Campanhas"
                badge={String(d.engagements.length)}
              />
              {/* As duas abas mostravam o mesmo número — são o mesmo conjunto de trabalhos.
                  Em contratos, o que vale contar é o que espera a assinatura dele. */}
              <TabButton
                active={tab === "contracts"}
                onClick={() => setTab("contracts")}
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

            {/* Cadastro incompleto não bloqueia a área; o card diz o que a marca precisa. */}
            {!d.profile.complete && (
              <Link
                to="/creator/onboarding"
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

            {tab === "campaigns" ? (
              <div className="flex flex-col gap-4">
                {d.engagements.map((e) => (
                  <EngagementCard key={e.contractId} e={e} />
                ))}
              </div>
            ) : (
              <CreatorContractPanel
                key={focusedContract ?? "inicio"}
                engagements={d.engagements}
                initialContractId={focusedContract}
              />
            )}

            <CreatorPrivacyCard />
          </>
        ) : null}
      </main>
    </div>
  )
}

/** O que depende do criador agora, no topo da área, com link direto para cada ação. */
function NextStepsCard({
  steps, hasWork, onGoTo,
}: {
  steps: NextStep[]
  hasWork: boolean
  onGoTo: (p: NextStep) => void
}) {
  if (steps.length === 0) {
    if (!hasWork) return null
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
        {steps.map((p, i) => (
          <li key={p.key}>
            <button
              onClick={() => onGoTo(p)}
              className="w-full text-left flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-hover transition-colors"
            >
              <span
                className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-semibold text-white shrink-0 mt-0.5"
                style={{ background: "var(--color-teal-500)" }}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium" style={{ color: "var(--ink)" }}>{p.title}</span>
                <span className="block text-[12px] text-ink-muted">{p.detail}</span>
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
  const latestDelivery = [...e.deliveries].sort((a, b) => b.submissionAttempt - a.submissionAttempt)[0]
  const reworkRequested = latestDelivery?.status === "ReworkRequested"

  const send = async () => {
    try {
      await submit.mutateAsync({ contractId: e.contractId, submittedUrl: url.trim() })
      setUrl("")
      notifySuccess("Entrega enviada. A marca vai revisar o vídeo.")
    } catch (err) {
      notifyError(err, "Não foi possível enviar.")
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
            {workLabel(e.campaignName)}
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

      {reworkRequested && (
        <div className="rounded-lg p-3 text-[12.5px] mb-4" style={{ background: "var(--warn-bg)", color: "var(--color-warn)" }}>
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

      {/* Primeiro portão antes do campo do link: a ordem da tela é a do processo. */}
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
  const thumb = useCreatorDeliveryThumb(dl)
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-soft p-2.5">
      <a
        href={deliveryLink(dl)}
        target="_blank"
        rel="noreferrer noopener"
        className="relative w-[92px] aspect-video rounded overflow-hidden bg-[#111827] shrink-0"
      >
        {thumb ? (
          <img
            src={thumb}
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
      <AlertCircle className="w-8 h-8 mb-3" style={{ color: "var(--color-warn)" }} />
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
