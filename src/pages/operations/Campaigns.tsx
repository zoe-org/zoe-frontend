import { useMemo, useState } from "react"
import { Plus, Megaphone } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { matches } from "@/lib/operations-format"
import { stagger } from "@/lib/motion"
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
    <div className="-m-6" style={{ color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 max-w-190 min-w-70">
            <div className="eyebrow mb-3">Operations · Gestão de campanhas</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Campanhas
            </h1>
            {/* As contagens saíram daqui: elas vivem no topo da lista, onde o
                recorte da busca as muda. */}
            <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-150">
              A campanha é a porta de entrada: os contratos nascem dentro dela e herdam
              sua modalidade.
            </p>
          </div>
          <RoleGate minRole="Admin">
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-medium text-white transition-colors shrink-0 cursor-pointer"
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
            {/* Barra da coluna: gruda no topo porque a lista rola sozinha. */}
            <div
              className="px-4 py-3 border-b border-border-soft sticky top-0 z-10"
              style={{ background: "var(--surface)" }}
            >
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Buscar campanha…"
                className="w-full"
              />
              <div className="flex items-center gap-1.5 mt-2 text-[11.5px] text-ink-muted">
                <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{items.length}</span>
                <span>{items.length === 1 ? "campanha" : "campanhas"}</span>
                <span>·</span>
                <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                  {items.filter((c) => c.status === "Active").length}
                </span>
                <span>ativas</span>
              </div>
            </div>
            {items.length === 0 && (
              <NoResults query={search} onClear={() => setSearch("")} />
            )}
            {items.map((c, i) => (
              <button
                key={c.campaignId}
                onClick={() => setSelectedId(c.campaignId)}
                className="block w-full text-left px-4 py-4 border-b border-border-soft transition-colors hover:bg-hover cursor-pointer z-rise"
                style={{
                  // `--teal-bg` e não `#F0FDFB`: o hex fixo era claro e ficava
                  // branco no modo escuro.
                  background: effectiveId === c.campaignId ? "var(--teal-bg)" : "transparent",
                  borderLeft: `3px solid ${effectiveId === c.campaignId ? "var(--color-teal-500)" : "transparent"}`,
                  ...stagger(Math.min(i, 12)),
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
