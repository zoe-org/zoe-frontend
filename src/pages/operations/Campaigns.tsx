import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, X, Loader2, Megaphone } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { useFeature } from "@/features/auth/useFeature"
import { useTenantBrands } from "@/lib/api/brands"
import { tEnum } from "@/i18n/enums"
import { fmtDate } from "@/pages/operations/format"
import { Field, Select, TableSkeleton, ErrorState } from "@/pages/operations/shared"
import {
  useCampaigns, useCampaign, useCampaignMutations,
  CAMPAIGN_MODALITIES, escrowRejectionReason, supportsEscrow, fmtCents,
  type CreateCampaignBody,
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

  const items = useMemo(() => campaigns.data?.items ?? [], [campaigns.data])

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
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{items.length}</span>
              {items.length === 1 ? " campanha" : " campanhas"} ·{" "}
              <span className="font-mono-zoe">{items.filter((c) => c.status === "Active").length}</span>{" "}
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
      ) : items.length === 0 ? (
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
  const d = campaign.data

  if (campaign.isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
      </div>
    )
  }
  if (campaign.isError || !d) return <EmptyBlock message="Não foi possível carregar a campanha" />

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
        <p className="text-[11.5px] text-ink-muted mt-4">
          O briefing auditável — hashtags obrigatórias, exigência de logo, tom esperado e
          disclosures — entra junto com a auditoria automática, que é quem vai consumi-lo.
        </p>
      </div>

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
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : "Não foi possível criar a campanha."),
    })
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
            <p className="text-[11.5px] text-[#D97706]">{escrowRejectionReason(modality)}</p>
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

