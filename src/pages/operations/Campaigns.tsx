import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Plus, X, Loader2, Megaphone, UserPlus, Copy, Check, Sparkles,
  Pencil, Play, CheckCircle2, Ban,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { useFeature } from "@/features/auth/useFeature"
import { useTenantBrands } from "@/lib/api/brands"
import { tEnum } from "@/i18n/enums"
import { fmtDate, matches } from "@/pages/operations/format"
import {
  Field, Select, TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/pages/operations/shared"
import {
  useCampaigns, useCampaign, useCampaignMutations,
  CAMPAIGN_MODALITIES, escrowRejectionReason, supportsEscrow, fmtCents,
  INFLUENCER_INVITE_PATH, allowedCampaignTransitions, CAMPAIGN_TRANSITION_LABEL,
  type CreateCampaignBody, type InviteInfluencerResponse,
  type CampaignTransition, type CampaignDetail,
  type CampaignBriefing, type CampaignBriefingInput, type BriefingSentiment,
  BRIEFING_SENTIMENTS,
} from "@/lib/api/operations"

const STATUS_COLOR: Record<string, string> = {
  Draft: "#6B7280",
  Active: "#00A799",
  Completed: "#2563EB",
  Cancelled: "#DC2626",
}

const CampaignChip = (p: { status: string; small?: boolean }) => (
  <StatusChip {...p} kind="campaignStatus" colors={STATUS_COLOR} />
)

export default function OperationsCampaignsPage() {
  const campaigns = useCampaigns()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const [busca, setBusca] = useState("")

  const todas = useMemo(() => campaigns.data?.items ?? [], [campaigns.data])

  const items = useMemo(
    () => todas.filter((c) => matches(
      busca, c.name, c.brandName, tEnum("contractModality", c.modality),
      tEnum("campaignStatus", c.status))),
    [todas, busca],
  )

  // A primeira da lista fica selecionada por padrão, como no protótipo. Derivado no
  // render em vez de setState em efeito — a mesma razão do AppShell: efeito que
  // chama setState provoca um passe de render em cascata.
  const effectiveId = selectedId ?? items[0]?.campaignId ?? null

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="eyebrow mb-2.5">Operations · Gestão de campanhas</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Campanhas
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{todas.length}</span>
              {todas.length === 1 ? " campanha" : " campanhas"} ·{" "}
              <span className="font-mono-zoe">{todas.filter((c) => c.status === "Active").length}</span>{" "}
              ativas agora. A campanha é a porta de entrada: os contratos nascem dentro
              dela e herdam sua modalidade.
            </div>
          </div>
          <RoleGate minRole="Admin">
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Nova campanha
            </button>
          </RoleGate>
        </div>
      </section>

      {campaigns.isLoading ? (
        <div style={{ background: "var(--surface)" }}><TableSkeleton /></div>
      ) : campaigns.isError ? (
        <div style={{ background: "var(--surface)" }}>
          <ErrorState onRetry={() => campaigns.refetch()} />
        </div>
      ) : todas.length === 0 ? (
        <div style={{ background: "var(--surface)" }}>
          <EmptyBlock
            className="py-16"
            icon={<Megaphone className="w-7 h-7" strokeWidth={1.5} />}
            message="Nenhuma campanha ainda"
            hint="Crie a campanha para depois convidar criadores e emitir os contratos dentro dela."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] min-h-[calc(100vh-220px)]">
          {/* Lista */}
          <div className="border-r border-border-soft" style={{ background: "var(--surface)" }}>
            <div className="px-4 py-3 border-b border-border-soft">
              <SearchBox
                value={busca}
                onChange={setBusca}
                placeholder="Buscar campanha…"
                className="w-full"
              />
            </div>
            {items.length === 0 && (
              <NoResults query={busca} onClear={() => setBusca("")} />
            )}
            {items.map((c) => (
              <button
                key={c.campaignId}
                onClick={() => setSelectedId(c.campaignId)}
                className="block w-full text-left px-4 py-4 border-b border-border-soft transition-colors"
                style={{
                  background: effectiveId === c.campaignId ? "var(--color-teal-50, #F0FDFB)" : "transparent",
                  borderLeft: `3px solid ${effectiveId === c.campaignId ? "var(--color-teal-500)" : "transparent"}`,
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                    {c.name}
                  </span>
                  <CampaignChip status={c.status} small />
                </div>
                <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
                  <span className="chip text-[10px]">{tEnum("contractModality", c.modality)}</span>
                  <span>
                    {c.influencerCount} {c.influencerCount === 1 ? "criador" : "criadores"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Detalhe */}
          <div className="p-8">
            {effectiveId
              ? <CampaignDetailPanel campaignId={effectiveId} />
              : <EmptyBlock message="Selecione uma campanha" />}
          </div>
        </div>
      )}

      {createOpen && <CreateCampaignModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

function CampaignDetailPanel({ campaignId }: { campaignId: string }) {
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
    { label: "Orçamento", value: d.budgetCents > 0 ? fmtCents(d.budgetCents) : "Permuta" },
    { label: "GMV em custódia", value: d.escrowGmvCents > 0 ? fmtCents(d.escrowGmvCents) : "—" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="font-display m-0" style={{ fontSize: 26, color: "var(--ink)" }}>{d.name}</h2>
            <CampaignChip status={d.status} />
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
            { label: "Orçamento", value: d.budgetCents > 0 ? fmtCents(d.budgetCents) : "Permuta" },
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

      {/* Contratos */}
      <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="eyebrow">Contratos ({d.contracts.length})</div>
          <Link to="/operations/contracts" className="text-[12.5px]" style={{ color: "var(--color-teal-500)" }}>
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
        <div className="eyebrow mb-3.5">Entregas ({d.deliveries.length})</div>
        {d.deliveries.length === 0 ? (
          <div className="text-[12.5px] text-ink-muted">Nenhuma entrega ainda.</div>
        ) : (
          d.deliveries.map((dl, i) => (
            <div
              key={dl.deliveryId}
              className="flex items-center gap-3 py-2.5"
              style={{ borderTop: i === 0 ? undefined : "1px solid var(--border-soft)" }}
            >
              <span className="flex-1 text-[13px] truncate" style={{ color: "var(--ink)" }}>
                {dl.influencerName}
              </span>
              {dl.isReviewOverdue && (
                <span className="text-[11px]" style={{ color: "#D97706" }}>prazo vencido</span>
              )}
              <span className="chip text-[10.5px]">{dl.status}</span>
            </div>
          ))
        )}
      </div>

      {inviteOpen && (
        <InviteInfluencerModal
          campaignId={campaignId}
          campaignName={d.name}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {editOpen && <EditCampaignModal campaign={d} onClose={() => setEditOpen(false)} />}
    </div>
  )
}

/**
 * Convite de criador. Duas etapas na mesma janela: o formulário e, depois do envio,
 * o link. O link aparece SEMPRE, não só quando o e-mail falha — é ele que permite
 * mandar por WhatsApp, que é como boa parte das agências realmente fala com criador.
 */
function InviteInfluencerModal({
  campaignId, campaignName, onClose,
}: {
  campaignId: string
  campaignName: string
  onClose: () => void
}) {
  const { invite } = useCampaignMutations(campaignId)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState<InviteInfluencerResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const link = sent
    ? `${window.location.origin}/${INFLUENCER_INVITE_PATH}/${sent.token}`
    : ""

  const submit = async () => {
    try {
      const res = await invite.mutateAsync({
        email: email.trim(),
        fullName: fullName.trim(),
        message: message.trim() || undefined,
      })
      setSent(res)
      if (res.emailDelivery === "Sent") toast.success(`Convite enviado para ${res.email}.`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível convidar.")
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Não foi possível copiar — selecione o link manualmente.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(11,15,26,.5)" }}>
      <div className="w-full max-w-md rounded-xl border border-border-soft p-6" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-display m-0" style={{ fontSize: 20, color: "var(--ink)" }}>
              {sent ? "Convite criado" : "Convidar criador"}
            </h3>
            <div className="text-[12px] text-ink-muted mt-0.5">{campaignName}</div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <>
            {sent.emailDelivery !== "Sent" && (
              <div className="rounded-lg p-3 text-[12px] mb-4" style={{ background: "#D9770615", color: "#D97706" }}>
                {sent.emailDelivery === "Disabled"
                  ? "O envio de e-mail não está configurado neste ambiente."
                  : "O e-mail não saiu."}{" "}
                Mande o link abaixo — o convite já existe e é válido.
              </div>
            )}

            <div className="text-[11px] text-ink-muted mb-1.5">Link do convite</div>
            <div className="flex items-center gap-2 mb-4">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-2.5 py-2 rounded-lg border border-border-soft font-mono-zoe text-[11.5px] bg-transparent"
                style={{ color: "var(--ink)" }}
              />
              <button
                onClick={copy}
                className="px-2.5 py-2 rounded-lg border border-border-soft shrink-0"
                aria-label="Copiar link"
              >
                {copied ? <Check className="w-3.5 h-3.5" style={{ color: "var(--color-teal-500)" }} />
                        : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[11.5px] text-ink-muted mb-5">
              Vence em {fmtDate(sent.expiresAt)}. O criador precisa entrar com o e-mail{" "}
              <span className="font-mono-zoe">{sent.email}</span> — o convite é dele.
              {sent.influencerCreated
                ? " Ele já apareceu no elenco como convidado."
                : " Ele já estava no seu elenco."}
            </p>

            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-lg text-[14px] font-medium text-white"
              style={{ background: "var(--color-teal-500)" }}
            >
              Fechar
            </button>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <Field label="E-mail" hint="É por ele que o convite é validado no aceite.">
                <Input value={email} onChange={(e) => setEmail(e.target.value)}
                       type="email" placeholder="criador@email.com" />
              </Field>
              <Field label="Nome">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                       placeholder="Como ele assina o contrato" />
              </Field>
              <Field label="Mensagem" hint="Opcional. Aparece na tela que o criador abre.">
                <Input value={message} onChange={(e) => setMessage(e.target.value)}
                       placeholder="Oi! Queremos você nessa campanha." />
              </Field>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[14px] border border-border-soft">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={invite.isPending || !email.trim() || !fullName.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[14px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-teal-500)" }}
              >
                {invite.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enviar convite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Briefing auditável. É a régua contra a qual a auditoria vai medir a entrega, então a
 * tela mostra o que está de fato configurado — e diz quando **não** está.
 *
 * O `isAuditable` vem do backend em vez de ser deduzido aqui: a regra de "o que basta para
 * auditar" é de negócio, não de apresentação. Sem menção, hashtag nem logo, a IA não tem
 * contra o quê comparar, e prometer auditoria automática nesse estado seria mentira.
 */
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

      {/* Antes isto era um bloco laranja de tres linhas ocupando a largura toda. Laranja
          e' cor de pendencia, e nao ha' pendencia nenhuma: a auditoria automatica foi
          ADIADA pelo time, e a revisao manual e' o funcionamento normal — nao um estado
          degradado que alguem precisa corrigir. Virou uma nota discreta. */}
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

/**
 * Botões de ciclo de vida. Vêm de `allowedCampaignTransitions`, que espelha o domínio —
 * a tela não oferece o que já se sabe que vai ser recusado.
 *
 * Cancelar pede confirmação porque é terminal e afeta o que está em volta: campanha
 * cancelada não aceita novo contrato nem novo criador. Ativar e concluir não pedem, para
 * não transformar o caminho normal em fricção.
 */
function CampaignTransitions({ campaign }: { campaign: CampaignDetail }) {
  const { update } = useCampaignMutations(campaign.campaignId)
  const [confirming, setConfirming] = useState(false)

  const allowed = allowedCampaignTransitions(campaign.status)
  if (allowed.length === 0) return null

  const run = (transition: CampaignTransition) => {
    update.mutate({ transition }, {
      onSuccess: (res) => {
        toast.success(`Campanha agora está ${tEnum("campaignStatus", res.status).toLowerCase()}.`)
        setConfirming(false)
      },
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : "Não foi possível mudar o status."),
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
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl p-6"
        style={{ background: "var(--surface)" }}
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

/**
 * Edição do que ainda faz sentido mudar depois de criada. Modalidade fica fora: os
 * contratos já a herdaram, e trocá-la deixaria contrato e campanha discordando sobre que
 * acordo foi firmado — é a mesma razão pela qual o comando no backend não a aceita.
 */
function EditCampaignModal({
  campaign, onClose,
}: {
  campaign: CampaignDetail
  onClose: () => void
}) {
  const { update } = useCampaignMutations(campaign.campaignId)
  const [name, setName] = useState(campaign.name)
  const [startsAt, setStartsAt] = useState(campaign.startsAt?.slice(0, 10) ?? "")
  const [endsAt, setEndsAt] = useState(campaign.endsAt?.slice(0, 10) ?? "")
  const [budget, setBudget] = useState(
    campaign.budgetCents > 0 ? String(campaign.budgetCents / 100) : "")
  const [notes, setNotes] = useState(campaign.notes ?? "")

  // Briefing: texto separado por vírgula na tela, lista na API. É o formato que as pessoas
  // já usam para listar palavras, e evita um editor de tags só para isto.
  const b = campaign.briefing
  const [keywords, setKeywords] = useState(b.keywords.join(", "))
  const [hashtags, setHashtags] = useState(b.requiredHashtags.join(" "))
  const [requiresLogo, setRequiresLogo] = useState(b.requiresLogo)
  const [logoSeconds, setLogoSeconds] = useState(b.minLogoSeconds?.toString() ?? "")
  const [minSentiment, setMinSentiment] = useState<BriefingSentiment>(b.minSentiment)
  const [conar, setConar] = useState(b.requiresConarDisclosure)
  const [slaDays, setSlaDays] = useState(b.deliverySlaDays?.toString() ?? "")
  const [threshold, setThreshold] = useState(String(b.defaultAuditThreshold))

  const parseList = (raw: string) =>
    raw.split(/[,\s]+/).map((v) => v.trim()).filter((v) => v.length > 0)

  const briefing: CampaignBriefingInput = {
    keywords: parseList(keywords),
    requiredHashtags: parseList(hashtags),
    requiresLogo,
    // Enviar nulo quando logo não é exigido: é o que o domínio faz de qualquer forma, e
    // manter o número aqui deixaria a tela discordando do que foi salvo.
    minLogoSeconds: requiresLogo && logoSeconds ? Number(logoSeconds) : null,
    minSentiment,
    requiresConarDisclosure: conar,
    deliverySlaDays: slaDays ? Number(slaDays) : null,
    defaultAuditThreshold: threshold ? Number(threshold) : undefined,
  }

  const submit = () => {
    update.mutate({
      name: name.trim(),
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      budgetCents: budget ? Math.round(Number(budget) * 100) : 0,
      notes: notes.trim() || undefined,
      briefing,
    }, {
      onSuccess: () => {
        toast.success("Campanha atualizada.")
        onClose()
      },
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar."),
    })
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        /* Rolagem interna: com o briefing o formulário passa da altura da tela, e o
           botão de salvar não pode ficar fora de alcance. */
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Editar campanha"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="eyebrow mb-1">Campanhas</div>
            <h2 className="font-display m-0" style={{ fontSize: 20, color: "var(--ink)" }}>
              Editar campanha
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Fim">
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
          </div>
          <Field label="Orçamento (R$)" hint="Deixe vazio em permuta.">
            <Input
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </Field>
          <Field label="Observações">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="pt-2 border-t border-border-soft">
            <div className="eyebrow mb-1">Briefing auditável</div>
            <p className="text-[11.5px] text-ink-muted mb-3.5 mt-0">
              É a régua da conferência automática. O que ficar vazio não é verificado.
            </p>

            <div className="space-y-4">
              <Field label="Menções esperadas" hint="Separe por vírgula.">
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Nubank, Ultravioleta"
                />
              </Field>

              <Field label="Hashtags obrigatórias" hint="O # é adicionado se faltar.">
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="publi ultravioleta"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Logo obrigatório">
                  <Select
                    value={requiresLogo ? "sim" : "nao"}
                    onChange={(v) => setRequiresLogo(v === "sim")}
                  >
                    <option value="nao">Não exigir</option>
                    <option value="sim">Exigir</option>
                  </Select>
                </Field>
                <Field label="Segundos mínimos" hint={requiresLogo ? undefined : "só com logo exigido"}>
                  <Input
                    type="number"
                    min="1"
                    value={requiresLogo ? logoSeconds : ""}
                    disabled={!requiresLogo}
                    onChange={(e) => setLogoSeconds(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Tom esperado">
                <Select
                  value={minSentiment}
                  onChange={(v) => setMinSentiment(v as BriefingSentiment)}
                >
                  {BRIEFING_SENTIMENTS.map((sv) => (
                    <option key={sv} value={sv}>{tEnum("briefingSentiment", sv)}</option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Disclosure de publicidade"
                hint="Conteúdo pago sem identificação é irregular no Brasil."
              >
                <Select value={conar ? "sim" : "nao"} onChange={(v) => setConar(v === "sim")}>
                  <option value="sim">Exigir #publi</option>
                  <option value="nao">Não exigir</option>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="SLA de entrega (dias)">
                  <Input
                    type="number"
                    min="1"
                    value={slaDays}
                    onChange={(e) => setSlaDays(e.target.value)}
                  />
                </Field>
                {/* O número vive aqui em vez de na tela de entregas: é decisão da marca,
                    e cada contrato pode divergir dele depois (RN-O-057). */}
                <Field label="Nota mínima" hint="1 a 100. Padrão dos contratos.">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11.5px] text-ink-muted mt-4 mb-0">
          A modalidade não muda: os contratos desta campanha já a herdaram.
        </p>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[13.5px] border border-border-soft">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={update.isPending || name.trim().length < 3}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

/** Cota vinda no `details` do Problem Details. Tudo opcional: a tela não pode quebrar
 *  se o formato mudar — o essencial é a mensagem, não o número. */
type Allowance = { limit?: number; used?: number; resetsAt?: string }

function readAllowance(e: ApiError): Allowance {
  const d = e.problem?.details
  if (d && typeof d === "object") {
    const { limit, used, resetsAt } = d as Record<string, unknown>
    return {
      limit: typeof limit === "number" ? limit : undefined,
      used: typeof used === "number" ? used : undefined,
      resetsAt: typeof resetsAt === "string" ? resetsAt : undefined,
    }
  }
  return {}
}

/**
 * Convite de upgrade, não mensagem de erro (RN-O-021). Duas coisas o texto precisa deixar
 * claras, porque são o ponto da regra: a campanha **não foi descartada**, e o limite volta
 * a zerar numa data conhecida — quem não quer pagar agora tem uma saída.
 */
function AllowanceModal({
  allowance, campaignName, onBack, onClose,
}: {
  allowance: Allowance
  campaignName: string
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl p-6"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Limite de campanhas do plano"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />
            <div className="eyebrow">Seu plano</div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 className="font-display m-0 mb-2" style={{ fontSize: 22, color: "var(--ink)" }}>
          Você usou as {allowance.limit ?? 5} campanhas deste mês
        </h2>

        <p className="text-[13.5px] text-ink-muted mb-4">
          {campaignName
            ? <>A campanha <span style={{ color: "var(--ink)" }}>“{campaignName}”</span> não
               foi descartada — ela só não foi criada ainda.</>
            : "Nada do que você preencheu foi descartado."}
          {" "}Com o plano Pro as campanhas passam a ser ilimitadas.
        </p>

        {allowance.resetsAt && (
          <div
            className="rounded-lg p-3 text-[12.5px] mb-5"
            style={{ background: "var(--bg, #F9FAFB)", color: "var(--ink-muted)" }}
          >
            Sem fazer upgrade, sua cota volta a {allowance.limit ?? 5} em{" "}
            <span style={{ color: "var(--ink)" }}>{fmtDate(allowance.resetsAt)}</span>.
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="flex-1 px-4 py-2.5 rounded-lg text-[13.5px] border border-border-soft"
          >
            Voltar ao rascunho
          </button>
          {/* Não existe fluxo de upgrade self-service: mandar para as configurações é o
              caminho honesto, em vez de um botão que não faz nada. */}
          <Link
            to="/settings"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-[13.5px] font-medium text-white"
            style={{ background: "var(--color-teal-500)" }}
          >
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  )
}

function CreateCampaignModal({ onClose }: { onClose: () => void }) {
  const { create } = useCampaignMutations()
  const hasIntelligence = useFeature("intelligence")
  const brands = useTenantBrands()

  const [name, setName] = useState("")
  const [modality, setModality] = useState("Publipost")
  const [tenantBrandId, setTenantBrandId] = useState("")
  const [brandLabel, setBrandLabel] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [budget, setBudget] = useState("")
  const [limit, setLimit] = useState<Allowance | null>(null)

  const brandList = useMemo(() => brands.data?.items ?? [], [brands.data])
  const useBrandPicker = hasIntelligence && brandList.length > 0

  const canSubmit = name.trim().length >= 3 && !create.isPending

  const submit = () => {
    if (!canSubmit) return
    const body: CreateCampaignBody = {
      name: name.trim(),
      modality,
      tenantBrandId: useBrandPicker && tenantBrandId ? tenantBrandId : undefined,
      brandLabel: !useBrandPicker && brandLabel.trim() ? brandLabel.trim() : undefined,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      budgetCents: budget ? Math.round(Number(budget) * 100) : 0,
    }
    create.mutate(body, {
      onSuccess: (res) => {
        toast.success(`Campanha "${res.name}" criada.`)
        onClose()
      },
      onError: (e) => {
        // RN-O-021 é explícita: o limite é soft-block **com modal de upgrade**. Cair no
        // toast genérico transformaria um convite de upgrade em mensagem de erro — e a
        // regra diz que a campanha não foi descartada, o que um toast não consegue dizer.
        if (e instanceof ApiError && e.code === "campaign_monthly_limit_reached") {
          setLimit(readAllowance(e))
          return
        }
        toast.error(e instanceof ApiError ? e.message : "Não foi possível criar a campanha.")
      },
    })
  }

  // A cota estourada substitui o formulário em vez de fechá-lo: o que a pessoa digitou
  // continua ali atrás, e ela volta ao rascunho se decidir não fazer upgrade agora.
  if (limit) {
    return (
      <AllowanceModal
        allowance={limit}
        campaignName={name.trim()}
        onBack={() => setLimit(null)}
        onClose={onClose}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Nova campanha"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <div className="eyebrow mb-1.5">Campanhas</div>
            <h2 className="font-display m-0" style={{ fontSize: 22, color: "var(--ink)" }}>
              Nova campanha
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-2 overflow-y-auto flex-1 flex flex-col gap-3.5">
          <Field label="Nome">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lançamento Verão"
              autoFocus
            />
          </Field>

          <Field label="Marca" hint={useBrandPicker ? "Marcas assinadas no workspace." : "Sem Intelligence, o nome vai como texto."}>
            {useBrandPicker ? (
              <Select value={tenantBrandId} onChange={setTenantBrandId}>
                <option value="">Selecione…</option>
                {brandList.map((b) => (
                  <option key={b.tenantBrandId} value={b.tenantBrandId}>
                    {b.displayName ?? b.brandName}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={brandLabel} onChange={(e) => setBrandLabel(e.target.value)} placeholder="Nome da marca" />
            )}
          </Field>

          <Field label="Modalidade" hint="Todos os contratos da campanha herdam esta escolha.">
            <Select value={modality} onChange={setModality}>
              {CAMPAIGN_MODALITIES.map((m) => (
                <option key={m} value={m}>{tEnum("contractModality", m)}</option>
              ))}
            </Select>
          </Field>

          {!supportsEscrow(modality) && (
            <div
              className="rounded-lg p-3 text-[11.5px]"
              style={{ background: "#D9770615", color: "#D97706" }}
            >
              <span className="font-semibold">Sem custódia nesta modalidade.</span>{" "}
              {escrowRejectionReason(modality)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Prazo">
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
          </div>

          <Field label="Orçamento (R$)" hint="Zero para permuta.">
            <Input type="number" min={0} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0,00" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-soft shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Criar campanha
          </button>
        </div>
      </div>
    </div>
  )
}

