import { useMemo, useState } from "react"
import { Plus, Megaphone } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { matches } from "@/lib/operations-format"
import {
  TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/components/operations/shared"
import { CampaignChip, CampaignDetailPanel } from "@/pages/operations/CampaignDetail"
import { CreateCampaignModal } from "@/components/operations/CampaignModals"
import { useCampaigns } from "@/lib/api/operations"

export default function OperationsCampaignsPage() {
  const campaigns = useCampaigns()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const [search, setSearch] = useState("")

  const allCampaigns = useMemo(() => campaigns.data?.items ?? [], [campaigns.data])

  const items = useMemo(
    () => allCampaigns.filter((c) => matches(
      search, c.name, c.brandName, tEnum("contractModality", c.modality),
      tEnum("campaignStatus", c.status))),
    [allCampaigns, search],
  )

  // Primeira campanha selecionada por padrão, derivada no render e não em efeito.
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
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{allCampaigns.length}</span>
              {allCampaigns.length === 1 ? " campanha" : " campanhas"} ·{" "}
              <span className="font-mono-zoe">{allCampaigns.filter((c) => c.status === "Active").length}</span>{" "}
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
      ) : allCampaigns.length === 0 ? (
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
                value={search}
                onChange={setSearch}
                placeholder="Buscar campanha…"
                className="w-full"
              />
            </div>
            {items.length === 0 && (
              <NoResults query={search} onClear={() => setSearch("")} />
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
