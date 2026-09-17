import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Loader2, UserPlus, Pencil, Play, CheckCircle2, Ban,
} from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { CAMPAIGN_STATUS_COLOR } from "@/lib/status-colors"
import { campaignFunnel, type FunnelTone } from "@/lib/campaign-funnel"
import { fmtDate } from "@/lib/operations-format"
import { InviteCreatorModal } from "@/components/operations/InviteCreatorModal"
import { EditCampaignModal } from "@/components/operations/CampaignModals"
import {
  useCampaign, useCampaignMutations, escrowRejectionReason, fmtCents,
  allowedCampaignTransitions, CAMPAIGN_TRANSITION_LABEL,
  type CampaignTransition, type CampaignDetail, type CampaignBriefing,
  useRoster, canReceivePayout,
} from "@/lib/api/operations"

/** Detalhe da campanha: ações, números, briefing, funil por criador, contratos e entregas. */

const STATUS_COLOR = CAMPAIGN_STATUS_COLOR

export const CampaignChip = (p: { status: string; small?: boolean }) => (
  <StatusChip {...p} kind="campaignStatus" colors={STATUS_COLOR} />
)

/** Campanha ativa com prazo no passado: não conclui sozinha, mas avisa. */
function isPastEndDate(d: { status: string; endsAt: string | null }): boolean {
  if (d.status !== "Active" || !d.endsAt) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(d.endsAt) < today
}

/** Zero só é "Permuta" quando a modalidade é permuta; nas outras é orçamento não definido. */
function budgetLabel(budgetCents: number, modality: string): string {
  if (budgetCents > 0) return fmtCents(budgetCents)
  return modality === "Barter" ? "Permuta" : "Não definido"
}

export function CampaignDetailPanel({ campaignId }: { campaignId: string }) {
  const campaign = useCampaign(campaignId)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const d = campaign.data

  if (campaign.isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
      </div>
    )
  }
  if (campaign.isError || !d) return <EmptyBlock message="Não foi possível carregar a campanha" />

  // Encerrada é encerrada: o domínio recusa editar campanha concluída ou cancelada,
  // porque isso reescreveria o contexto de contratos já assinados.
  const ended = d.status === "Completed" || d.status === "Cancelled"

  const kpis = [
    { label: "Criadores", value: String(d.influencerCount) },
    { label: "Entregas", value: String(d.deliveryCount) },
    { label: "Orçamento", value: budgetLabel(d.budgetCents, d.modality) },
    { label: "GMV em custódia", value: d.escrowGmvCents > 0 ? fmtCents(d.escrowGmvCents) : "—" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="font-display m-0" style={{ fontSize: 26, color: "var(--ink)" }}>{d.name}</h2>
            <CampaignChip status={d.status} />
            {isPastEndDate(d) && (
              <span
                className="chip text-[10.5px]"
                style={{ color: "#B45309", background: "#D9770615" }}
                title="O prazo da campanha já passou e ela segue ativa. Concluir fecha para novos contratos e convites."
              >
                prazo encerrado
              </span>
            )}
          </div>
          <div className="text-[13px] text-ink-muted">
            {d.brandName ?? "sem marca"} · modalidade {tEnum("contractModality", d.modality)}
            {d.endsAt && ` · prazo ${fmtDate(d.endsAt)}`}
            {!d.supportsEscrow && " · sem custódia"}
          </div>
        </div>

        <RoleGate minRole="Admin">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] border border-border-soft disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={ended}
              title={ended ? "Campanha encerrada — os dados ficam como registro" : undefined}
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>

            <CampaignTransitions campaign={d} />

            {/* Convidar é ação da campanha, não do elenco: o convite nasce amarrado a
                ela, e é isso que dá contexto ao criador quando ele abre o link. */}
            <button
              onClick={() => setInviteOpen(true)}
              disabled={ended}
              title={ended ? "Campanha encerrada — não aceita novos criadores" : undefined}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--color-teal-500)" }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Convidar criador
            </button>
          </div>
        </RoleGate>
      </div>

      {/* KPIs */}
      <div className="rounded-xl border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {kpis.map((k, i) => (
            <div
              key={k.label}
              className="px-5 py-4"
              style={{ borderRight: i < 3 ? "1px solid var(--border-soft)" : undefined }}
            >
              <div className="eyebrow">{k.label}</div>
              <div className="font-display mt-1.5" style={{ fontSize: 26, lineHeight: 1, color: "var(--ink)" }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Briefing — só o que já existe. O resto chega com a auditoria. */}
      <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
        <div className="eyebrow mb-3.5">Briefing</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Marca", value: d.brandName ?? "—" },
            { label: "Modalidade", value: tEnum("contractModality", d.modality) },
            { label: "Período", value: d.startsAt ? `${fmtDate(d.startsAt)} → ${d.endsAt ? fmtDate(d.endsAt) : "aberto"}` : "—" },
            { label: "Orçamento", value: budgetLabel(d.budgetCents, d.modality) },
          ].map((f) => (
            <div key={f.label}>
              <div className="text-[11px] text-ink-muted mb-0.5">{f.label}</div>
              <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{f.value}</div>
            </div>
          ))}
        </div>
        {d.notes && <p className="text-[12.5px] text-ink-muted mt-4">{d.notes}</p>}

        {/* O aviso não pode viver só no momento da criação: quem abre a campanha
            depois precisa saber que não há dinheiro reservado por trás dela. */}
        {!d.supportsEscrow && (
          <div
            className="rounded-lg p-3 text-[11.5px] mt-4"
            style={{ background: "#D9770615", color: "#D97706" }}
          >
            <span className="font-semibold">Sem custódia.</span>{" "}
            {escrowRejectionReason(d.modality)}
          </div>
        )}

      </div>

      <BriefingCard briefing={d.briefing} />

      <CampaignFunnel d={d} />

      {/* Contratos */}
      <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="eyebrow">Contratos ({d.contracts.length})</div>
          <Link
            to={`/operations/contracts?campaign=${campaignId}`}
            className="text-[12.5px]"
            style={{ color: "var(--color-teal-500)" }}
          >
            Ver todos →
          </Link>
        </div>
        {d.contracts.length === 0 ? (
          <div className="text-[12.5px] text-ink-muted">Nenhum contrato ainda.</div>
        ) : (
          d.contracts.map((c, i) => (
            <Link
              key={c.contractId}
              to={`/operations/contracts/${c.contractId}`}
              className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity"
              style={{ borderTop: i === 0 ? undefined : "1px solid var(--border-soft)" }}
            >
              <span className="flex-1 text-[13px] truncate" style={{ color: "var(--ink)" }}>
                {c.influencerName}
              </span>
              <span className="font-mono-zoe text-[12px] text-ink-muted">
                {c.escrowAmountCents != null ? fmtCents(c.escrowAmountCents) : (c.usesEscrow ? "—" : "Permuta")}
              </span>
              <span className="chip text-[10.5px]">{tEnum("contractStatus", c.status)}</span>
            </Link>
          ))
        )}
      </div>

      {/* Entregas */}
      <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="eyebrow">Entregas ({d.deliveries.length})</div>
          <Link
            to={`/operations/deliveries?campaign=${campaignId}`}
            className="text-[12.5px]"
            style={{ color: "var(--color-teal-500)" }}
          >
            Ver todas →
          </Link>
        </div>
        {d.deliveries.length === 0 ? (
          <div className="text-[12.5px] text-ink-muted">Nenhuma entrega ainda.</div>
        ) : (
          d.deliveries.map((dl, i) => (
            // Cada linha abre a fila já no contrato dela, como a linha de contrato abre o contrato.
            <Link
              key={dl.deliveryId}
              to={`/operations/deliveries?campaign=${campaignId}&contract=${dl.contractId}`}
              className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity"
              style={{ borderTop: i === 0 ? undefined : "1px solid var(--border-soft)" }}
            >
              <span className="flex-1 text-[13px] truncate" style={{ color: "var(--ink)" }}>
                {dl.influencerName}
              </span>
              {dl.isReviewOverdue && (
                <span className="text-[11px]" style={{ color: "#D97706" }}>prazo vencido</span>
              )}
              <span className="chip text-[10.5px]">{tEnum("deliveryStatus", dl.status)}</span>
            </Link>
          ))
        )}
      </div>

      {inviteOpen && (
        <InviteCreatorModal
          initialCampaignId={campaignId}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {editOpen && <EditCampaignModal campaign={d} onClose={() => setEditOpen(false)} />}
    </div>
  )
}

/** Briefing auditável como está configurado; <code>isAuditable</code> vem do backend. */
function BriefingCard({ briefing: b }: { briefing: CampaignBriefing }) {
  const rows: [string, string][] = [
    ["Menções esperadas", b.keywords.length > 0 ? b.keywords.join(", ") : "não verificar"],
    ["Hashtags obrigatórias", b.requiredHashtags.length > 0 ? b.requiredHashtags.join(" ") : "nenhuma"],
    ["Logo", b.requiresLogo
      ? (b.minLogoSeconds ? `obrigatório, visível ≥ ${b.minLogoSeconds}s` : "obrigatório")
      : "não exigido"],
    ["Tom esperado", tEnum("briefingSentiment", b.minSentiment)],
    ["Disclosure CONAR", b.requiresConarDisclosure ? "#publi obrigatório" : "não exigido"],
    ["SLA de entrega", b.deliverySlaDays ? `${b.deliverySlaDays} dias corridos` : "—"],
    // O threshold aparece aqui porque é o que a marca configura, mas o rótulo diz
    // "padrão": o valor que vale é o do contrato, que pode divergir (RN-O-057).
    ["Nota mínima da auditoria", `${b.defaultAuditThreshold} pontos (padrão dos contratos)`],
  ]

  return (
    <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
      <div className="flex items-center justify-between mb-3.5 gap-3 flex-wrap">
        <div className="eyebrow">Briefing auditável</div>
        {!b.isAuditable && (
          <span className="text-[11px]" style={{ color: "#D97706" }}>
            sem critério verificável
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="text-[11px] text-ink-muted mb-0.5">{label}</div>
            <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Nota discreta: a revisão manual é o funcionamento normal, não pendência. */}
      <p className="text-[11.5px] text-ink-muted mt-4 mb-0">
        {b.isAuditable
          ? "Estes critérios ficam prontos para a conferência automática, quando ela entrar. "
            + "A liberação do pagamento é um clique seu de qualquer forma."
          : "A revisão da entrega é feita por você. Preencher menções, hashtags ou exigência "
            + "de logo deixa os critérios prontos para a conferência automática no futuro."}
      </p>
    </div>
  )
}

/** Ações de ciclo de vida permitidas pelo domínio. Só cancelar, que é terminal, pede confirmação. */
function CampaignTransitions({ campaign }: { campaign: CampaignDetail }) {
  const { update } = useCampaignMutations(campaign.campaignId)
  const [confirming, setConfirming] = useState(false)

  const allowed = allowedCampaignTransitions(campaign.status)
  if (allowed.length === 0) return null

  const run = (transition: CampaignTransition) => {
    update.mutate({ transition }, {
      onSuccess: (res) => {
        notifySuccess(`Campanha agora está ${tEnum("campaignStatus", res.status).toLowerCase()}.`)
        setConfirming(false)
      },
      onError: (e) =>
        notifyError(e, "Não foi possível mudar o status."),
    })
  }

  return (
    <>
      {allowed.filter((t) => t !== "Cancel").map((t) => (
        <button
          key={t}
          onClick={() => run(t)}
          disabled={update.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] border border-border-soft disabled:opacity-50"
        >
          {update.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {t === "Activate" ? <Play className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {CAMPAIGN_TRANSITION_LABEL[t].replace(" campanha", "")}
        </button>
      ))}

      {allowed.includes("Cancel") && (
        <button
          onClick={() => setConfirming(true)}
          disabled={update.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] border border-border-soft disabled:opacity-50"
          style={{ color: "#DC2626" }}
        >
          <Ban className="w-3.5 h-3.5" /> Cancelar
        </button>
      )}

      {confirming && (
        <ConfirmCancel
          campaignName={campaign.name}
          contractCount={campaign.contracts.length}
          busy={update.isPending}
          onConfirm={() => run("Cancel")}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  )
}

function ConfirmCancel({
  campaignName, contractCount, busy, onConfirm, onClose,
}: {
  campaignName: string
  contractCount: number
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl p-6"
        style={{ background: "var(--surface)" }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cancelar campanha"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display m-0 mb-2" style={{ fontSize: 20, color: "var(--ink)" }}>
          Cancelar “{campaignName}”?
        </h2>
        <p className="text-[13.5px] text-ink-muted mb-2">
          É definitivo: campanha cancelada não volta a rascunho, não aceita novo contrato
          nem novo criador, e deixa de poder ser editada.
        </p>
        {/* O que já foi assinado não desaparece — e o dinheiro tem vida própria. */}
        {contractCount > 0 && (
          <div
            className="rounded-lg p-3 text-[12.5px] mb-4"
            style={{ background: "#D9770615", color: "#D97706" }}
          >
            {contractCount === 1
              ? "O contrato já criado nesta campanha continua existindo"
              : `Os ${contractCount} contratos já criados nesta campanha continuam existindo`}
            {" "}e não é o cancelamento que resolve o dinheiro deles — custódia em aberto
            precisa ser devolvida na tela de custódia.
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[13.5px] border border-border-soft">
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-50"
            style={{ background: "#DC2626" }}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Cancelar campanha
          </button>
        </div>
      </div>
    </div>
  )
}

const TONE_COLOR: Record<FunnelTone, string> = {
  alert: "#DC2626",
  attention: "#B45309",
  neutral: "var(--ink-muted)",
  ok: "#00A799",
}

/** Funil da campanha: uma linha por criador, com a ação da marca quando for a vez dela. */
function CampaignFunnel({ d }: { d: CampaignDetail }) {
  // A situação da conta vem do elenco: o detalhe da campanha não a traz, e sem ela custódia
  // liberável de quem ainda não pode receber virava pendência da marca.
  const roster = useRoster()
  const payoutNotReady = new Set(
    (roster.data?.items ?? []).filter((r) => !canReceivePayout(r)).map((r) => r.influencerId))
  const rows = campaignFunnel(d, payoutNotReady)
  if (rows.length === 0) return null
  const needsBrand = rows.filter((l) => l.tone === "alert" || l.tone === "attention").length

  return (
    <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
      <div className="flex items-center justify-between mb-3.5 gap-2 flex-wrap">
        <div className="eyebrow">Funil por criador ({rows.length})</div>
        {needsBrand > 0 && (
          <span className="text-[11.5px] font-medium" style={{ color: "#B45309" }}>
            {needsBrand} {needsBrand === 1 ? "precisa" : "precisam"} de você
          </span>
        )}
      </div>
      {rows.map((l, i) => (
        <div
          key={l.influencerId}
          className="flex items-center gap-x-3 gap-y-1 py-2.5 flex-wrap"
          style={{ borderTop: i === 0 ? undefined : "1px solid var(--border-soft)" }}
        >
          <Link
            to={`/operations/influencers?creator=${l.influencerId}`}
            className="flex-1 min-w-[130px] text-[13px] truncate hover:underline"
            style={{ color: "var(--ink)" }}
          >
            {l.creatorName}
          </Link>
          {l.otherContracts > 0 && (
            <Link
              to={`/operations/contracts?campaign=${d.campaignId}`}
              className="text-[11px] text-ink-muted hover:underline whitespace-nowrap"
              title="A linha mostra o contrato que mais precisa de você; os outros estão na lista de contratos."
            >
              +{l.otherContracts} {l.otherContracts === 1 ? "contrato" : "contratos"}
            </Link>
          )}
          <span className="text-[12px] inline-flex items-center gap-1.5" style={{ color: TONE_COLOR[l.tone] }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TONE_COLOR[l.tone] }} />
            {l.stage}
          </span>
          {l.action && (
            <Link
              to={l.action.to}
              className="text-[12px] font-medium px-2.5 py-1 rounded-md border border-border-soft whitespace-nowrap"
              style={{ color: "var(--color-teal-500)" }}
            >
              {l.action.label} →
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
