import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  AlertCircle,
  Users,
} from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { EmptyBlock } from "@/components/ui/empty-block"
import { useActiveBrand } from "@/features/brands/BrandContext"
import { useInfluencers, type Influencer } from "@/lib/api/dashboard"
import { toCsv, downloadCsv } from "@/lib/csv"

const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus }

const platformLabel: Record<string, string> = { YT: "YouTube", TT: "TikTok", IG: "Instagram" }
const platformColor: Record<string, string> = { YT: "#FF0000", TT: "#0B0D18", IG: "#E1306C" }

type SortKey = "mentions" | "reach" | "subscribers" | "sentiment"
type Tier = "all" | "mega" | "macro" | "micro"

// Tier por audiência (subscribers). null = canal sem captura de audiência ainda
// (collector não populou channel_snapshots) — não entra em nenhum tier.
function tierOf(subs: number | null): Exclude<Tier, "all"> | null {
  if (subs == null) return null
  if (subs >= 1_000_000) return "mega"
  if (subs >= 500_000) return "macro"
  return "micro"
}

const tierLabel: Record<Exclude<Tier, "all">, string> = {
  mega: "Mega",
  macro: "Macro",
  micro: "Micro",
}

// Cores por tier vindas do design (Mega laranja, Macro azul, Micro teal).
const tierChipStyle: Record<Exclude<Tier, "all">, { bg: string; fg: string }> = {
  mega: { bg: "#FFF7ED", fg: "#C2410C" },
  macro: { bg: "#EFF6FF", fg: "#1D4ED8" },
  micro: { bg: "#F0FDFB", fg: "#006B60" },
}

function TierChip({ tier }: { tier: Exclude<Tier, "all"> }) {
  const c = tierChipStyle[tier]
  return (
    <span
      className="font-semibold"
      style={{
        fontSize: 10.5, padding: "1px 7px", borderRadius: 4,
        background: c.bg, color: c.fg, letterSpacing: "0.04em",
      }}
    >
      {tierLabel[tier].toUpperCase()}
    </span>
  )
}

function fmtLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return `${n}`
}

// Score do backend está em [0,1] (0.5 ≈ neutro). >=0.6 positivo, <0.4 negativo.
function scoreChipClass(score: number): string {
  if (score >= 0.6) return "chip-pos"
  if (score < 0.4) return "chip-neg"
  return ""
}

// Ordenação do segmented control — na ordem do design (Alcance é o padrão).
const SORTS: { key: SortKey; label: string }[] = [
  { key: "reach", label: "Alcance" },
  { key: "sentiment", label: "Sentimento" },
  { key: "mentions", label: "Menções" },
]

export default function InfluencersPage() {
  const navigate = useNavigate()
  const brand = useActiveBrand()
  const inf = useInfluencers(brand.brandId)

  const [sortKey, setSortKey] = useState<SortKey>("reach")
  const [sortAsc, setSortAsc] = useState(false)
  const [tier, setTier] = useState<Tier>("all")

  const influencers = useMemo(() => inf.data?.items ?? [], [inf.data])
  const totals = inf.data?.totals

  // Só faz sentido mostrar as abas de tier quando há audiência capturada.
  const hasSubs = useMemo(() => influencers.some((i) => i.subscribers != null), [influencers])

  const filtered = useMemo(() => {
    const base = tier === "all"
      ? influencers
      : influencers.filter((i) => tierOf(i.subscribers) === tier)
    const arr = [...base]
    const val = (i: Influencer): number => {
      if (sortKey === "mentions") return i.mentions
      if (sortKey === "reach") return i.reach
      if (sortKey === "subscribers") return i.subscribers ?? -1
      return i.avgScore
    }
    arr.sort((a, b) => (sortAsc ? val(a) - val(b) : val(b) - val(a)))
    return arr
  }, [influencers, sortKey, sortAsc, tier])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const advocates = useMemo(
    () => [...influencers].filter((i) => i.avgScore >= 0.6).sort((a, b) => b.avgScore - a.avgScore).slice(0, 3),
    [influencers],
  )
  const attention = useMemo(
    () => [...influencers]
      .filter((i) => i.avgScore < 0.4 || i.trend === "down")
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 3),
    [influencers],
  )

  const tiers: { key: Tier; label: string; count: number }[] = useMemo(() => [
    { key: "all", label: "Todos", count: influencers.length },
    { key: "mega", label: "Mega", count: influencers.filter((i) => tierOf(i.subscribers) === "mega").length },
    { key: "macro", label: "Macro", count: influencers.filter((i) => tierOf(i.subscribers) === "macro").length },
    { key: "micro", label: "Micro", count: influencers.filter((i) => tierOf(i.subscribers) === "micro").length },
  ], [influencers])

  const handleExport = () => {
    const csv = toCsv(filtered, [
      { header: "Influenciador", value: (i) => i.name },
      { header: "Canal", value: (i) => i.channelId },
      { header: "Plataforma", value: (i) => platformLabel[i.platform] ?? i.platform },
      { header: "Audiência", value: (i) => i.subscribers ?? "" },
      { header: "Alcance", value: (i) => i.reach },
      { header: "Menções", value: (i) => i.mentions },
      { header: "Sentimento", value: (i) => i.avgScore.toFixed(2) },
      { header: "Tendência", value: (i) => i.trend },
    ])
    downloadCsv(`influenciadores-${brand.active?.brandId ?? "marca"}.csv`, csv)
  }

  // ── Estados de topo ───────────────────────────────────────────────────
  if (brand.isLoading) return <PageSkeleton />
  if (brand.isError) return <ErrorState onRetry={() => brand.refetch()} />
  if (brand.brands.length === 0) {
    return (
      <EmptyState
        title="Nenhuma marca assinada ainda"
        description="Assine uma marca para ver a rede de influenciadores."
        actionLabel="Assinar uma marca"
        onAction={() => navigate("/brands")}
      />
    )
  }

  return (
    <div
      className="-m-6 border-t border-border-soft"
      style={{ background: "var(--surface)", color: "var(--ink)" }}
    >
      {/* Hero */}
      <section
        className="px-8 pt-7 pb-6 border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex-1 max-w-140 min-w-70">
            <div className="eyebrow mb-2.5">Intelligence · Pessoas</div>
            <h1
              className="font-display m-0"
              style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}
            >
              Influenciadores
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              Criadores que mencionaram sua marca nos últimos 30 dias.{" "}
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                {influencers.length} {influencers.length === 1 ? "perfil" : "perfis"}
              </span>{" "}
              {influencers.length === 1 ? "identificado" : "identificados"}.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        </div>
      </section>

      {inf.isError ? (
        <ErrorState onRetry={() => inf.refetch()} />
      ) : inf.isLoading ? (
        <TableSkeleton />
      ) : influencers.length === 0 ? (
        <EmptyBlock
          className="py-20"
          icon={<Users className="w-9 h-9" strokeWidth={1.5} />}
          message="Nenhum influenciador no período"
          hint="Assim que o pipeline analisar vídeos que mencionam esta marca, os criadores aparecem aqui — com alcance, sentimento e tendência."
        />
      ) : (
        <>
          {/* Highlights */}
          <section className="grid grid-cols-1 md:grid-cols-3 border-b border-border-soft">
            <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="eyebrow">Advogados da marca</div>
                <span className="chip chip-pos text-[10px]">+ positivo</span>
              </div>
              {advocates.length === 0 ? (
                <div className="text-[13px] text-muted py-6">
                  Nenhum advogado forte neste período.
                </div>
              ) : (
                <div className="flex flex-col">
                  {advocates.map((c, i) => (
                    <HighlightRow key={c.channelId} inf={c} index={i} hue={i * 67 + 160} />
                  ))}
                </div>
              )}
            </div>

            <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="eyebrow">Requerem atenção</div>
                <span className="chip chip-neg text-[10px]">monitorar</span>
              </div>
              {attention.length === 0 ? (
                <div className="text-[13px] text-muted py-6">
                  Nenhum influenciador em risco neste período.
                </div>
              ) : (
                <div className="flex flex-col">
                  {attention.map((c, i) => (
                    <HighlightRow key={c.channelId} inf={c} index={i} hue={i * 47 + 10} showTrend />
                  ))}
                </div>
              )}
            </div>

            <div className="p-7">
              <div className="eyebrow mb-4">Visão geral</div>
              {/* Ordem e cores do design. O 4º slot do design é "novos este mês",
                  que exige saber quando cada canal apareceu pela 1ª vez — o
                  endpoint ainda não devolve isso, então fica "menções totais". */}
              <div className="grid grid-cols-2 gap-x-5 gap-y-5">
                <OverviewStat value={`${totals?.count ?? 0}`} label="perfis · 30d" />
                <OverviewStat
                  value={fmtLargeNumber(totals?.totalReach ?? 0)}
                  label="alcance combinado"
                  color="var(--color-teal-500)"
                />
                <OverviewStat
                  value={(totals?.avgScore ?? 0).toFixed(2)}
                  label="sentimento médio"
                  color={
                    (totals?.avgScore ?? 0) >= 0.6
                      ? "var(--color-pos)"
                      : (totals?.avgScore ?? 0) < 0.4
                        ? "var(--color-neg)"
                        : "var(--ink)"
                  }
                />
                <OverviewStat value={`${totals?.totalMentions ?? 0}`} label="menções totais" />
              </div>
            </div>
          </section>

          {/* Filtro de tier (pills preenchidas) + ordenação (segmented control) */}
          <section
            className="px-8 py-3 border-b border-border-soft flex items-center justify-between gap-4 flex-wrap sticky top-13 z-10"
            style={{ background: "var(--surface)" }}
          >
            {hasSubs ? (
              <div className="flex items-center gap-1">
                {tiers.map((t) => {
                  const active = tier === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTier(t.key)}
                      aria-pressed={active}
                      className={`px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        active ? "text-white" : "text-ink-muted hover:text-ink"
                      }`}
                      style={active ? { background: "var(--color-teal-500)" } : undefined}
                    >
                      {t.label}
                      <span className="ml-1.5 font-mono-zoe text-[11px]" style={{ opacity: active ? 0.85 : 0.6 }}>
                        {t.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              // Sem inscritos capturados não dá pra separar por tier — melhor dizer
              // isso do que mostrar abas vazias (o collector ainda não popula).
              <span className="text-[12px] text-ink-muted-2">
                Tiers por audiência aparecem quando o pipeline capturar os inscritos dos canais.
              </span>
            )}

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-[12px] text-ink-muted">Ordenar:</span>
              <div className="inline-flex p-0.5 rounded-lg bg-[#F3F4F6] dark:bg-[#1A1D2D]">
                {SORTS.map((s) => {
                  const active = sortKey === s.key
                  return (
                    <button
                      key={s.key}
                      onClick={() => { setSortKey(s.key); setSortAsc(false) }}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors ${
                        active
                          ? "text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "text-ink-muted hover:text-ink"
                      }`}
                      style={active ? { background: "var(--surface)" } : undefined}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th className="text-left px-8 py-3 eyebrow font-semibold">#</th>
                  <th className="text-left py-3 eyebrow font-semibold">Influenciador</th>
                  <th className="text-left py-3 eyebrow font-semibold">Plataforma</th>
                  <SortableHeader label="Audiência" sortKey="subscribers" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortableHeader label="Alcance" sortKey="reach" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortableHeader label="Menções" sortKey="mentions" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortableHeader label="Sentimento" sortKey="sentiment" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <th className="text-left px-4 py-3 eyebrow font-semibold">Tend.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const TrendIcon = trendIcons[c.trend]
                  const trendColor =
                    c.trend === "up" ? "var(--color-pos)"
                      : c.trend === "down" ? "var(--color-neg)"
                        : "var(--ink-muted)"
                  const tierName = tierOf(c.subscribers)
                  return (
                    <tr
                      key={c.channelId}
                      className="border-b border-border-soft hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
                    >
                      <td className="px-8 py-3.5">
                        <span className="font-mono-zoe text-[11.5px] text-muted-2">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[13px]"
                            style={{ background: `hsl(${idx * 53}, 40%, 55%)` }}
                          >
                            {c.name[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate" style={{ color: "var(--ink)" }}>
                                {c.name || "Canal sem nome"}
                              </span>
                              {tierName && <TierChip tier={tierName} />}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ background: platformColor[c.platform] ?? "#9AA1AE" }}
                          />
                          <span className="text-[12.5px] text-ink-2">
                            {platformLabel[c.platform] ?? c.platform}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 font-mono-zoe">
                        {c.subscribers == null ? "—" : fmtLargeNumber(c.subscribers)}
                      </td>
                      <td className="py-3.5 font-mono-zoe">{fmtLargeNumber(c.reach)}</td>
                      <td className="py-3.5">
                        <span className="font-display" style={{ fontSize: 18, color: "var(--ink)" }}>
                          {c.mentions}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className={`chip text-[11px] ${scoreChipClass(c.avgScore)}`}>
                          {c.avgScore.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <TrendIcon className="w-4 h-4" style={{ color: trendColor }} />
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-8 py-16 text-center text-muted text-sm">
                      Nenhum influenciador neste tier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}

function HighlightRow({
  inf, index, hue, showTrend,
}: { inf: Influencer; index: number; hue: number; showTrend?: boolean }) {
  const TrendIcon = trendIcons[inf.trend]
  return (
    <div className={`flex items-center gap-3 py-2.5 ${index === 0 ? "" : "border-t border-border-soft"}`}>
      <span className="font-mono-zoe text-[11px] text-muted-2 w-[18px]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[13px]"
        style={{ background: `hsl(${hue}, 42%, 55%)` }}
      >
        {inf.name[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{inf.name || "Canal sem nome"}</div>
        <div className="flex items-center gap-1 font-mono-zoe text-[10.5px] text-muted truncate">
          <span>{inf.mentions} {inf.mentions === 1 ? "menção" : "menções"}</span>
          {showTrend && (
            <TrendIcon
              className="w-3 h-3"
              style={{ color: inf.trend === "down" ? "var(--color-neg)" : "var(--ink-muted)" }}
            />
          )}
        </div>
      </div>
      <span className={`chip text-[11px] ${scoreChipClass(inf.avgScore)}`}>
        {inf.avgScore.toFixed(2)}
      </span>
    </div>
  )
}

function OverviewStat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <div className="font-display leading-none" style={{ fontSize: 32, color: color ?? "var(--ink)" }}>
        {value}
      </div>
      <div className="text-[11.5px] text-muted mt-1.5">{label}</div>
    </div>
  )
}

function SortableHeader({
  label, sortKey, currentKey, asc, onToggle,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  asc: boolean
  onToggle: (k: SortKey) => void
}) {
  const active = currentKey === sortKey
  return (
    <th className="text-left py-3">
      <button
        onClick={() => onToggle(sortKey)}
        className={`flex items-center gap-1 eyebrow font-semibold transition-colors ${active ? "text-ink dark:text-[#E6E8EF]" : ""}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? "text-teal-500" : ""}`} />
        {active && <span className="text-[9px] text-teal-500">{asc ? "↑" : "↓"}</span>}
      </button>
    </th>
  )
}

function PageSkeleton() {
  return (
    <div className="-m-6 animate-pulse">
      <div className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="h-9 w-96 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-border-soft">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-7 border-r border-border-soft">
            <div className="h-12 w-32 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          </div>
        ))}
      </div>
      <TableSkeleton />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="px-8 py-6 space-y-3 animate-pulse">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button
        onClick={onRetry}
        className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  )
}
