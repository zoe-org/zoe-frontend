import { useState, useMemo } from "react"
import {
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
} from "lucide-react"
import { influencers, categoryBreakdown } from "@/lib/mock/influencers"

const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus }

const platformLabel = { YT: "YouTube", TT: "TikTok", IG: "Instagram" } as const
const platformColor = {
  YT: "#FF0000",
  TT: "#0B0D18",
  IG: "#E1306C",
} as const

type SortKey = "mentions" | "reach" | "subscribers" | "sentiment"
type Tier = "all" | "mega" | "macro" | "micro"

function parseNumeric(val: string): number {
  const num = parseFloat(val.replace(/[^0-9.]/g, ""))
  if (val.includes("M")) return num * 1_000_000
  if (val.includes("K")) return num * 1_000
  return num
}

function tierOf(subs: string): Exclude<Tier, "all"> {
  const n = parseNumeric(subs)
  if (n >= 1_000_000) return "mega"
  if (n >= 500_000) return "macro"
  return "micro"
}

const tierLabel: Record<Exclude<Tier, "all">, string> = {
  mega: "Mega",
  macro: "Macro",
  micro: "Micro",
}

export default function InfluencersPage() {
  const [sortKey, setSortKey] = useState<SortKey>("mentions")
  const [sortAsc, setSortAsc] = useState(false)
  const [tier, setTier] = useState<Tier>("all")

  const filtered = useMemo(() => {
    const base = tier === "all"
      ? influencers
      : influencers.filter((i) => tierOf(i.subscribers) === tier)
    const arr = [...base]
    arr.sort((a, b) => {
      let aVal = 0
      let bVal = 0
      if (sortKey === "mentions") { aVal = a.mentions; bVal = b.mentions }
      else if (sortKey === "reach") { aVal = parseNumeric(a.reach); bVal = parseNumeric(b.reach) }
      else if (sortKey === "subscribers") { aVal = parseNumeric(a.subscribers); bVal = parseNumeric(b.subscribers) }
      else { aVal = a.sentimentScore; bVal = b.sentimentScore }
      return sortAsc ? aVal - bVal : bVal - aVal
    })
    return arr
  }, [sortKey, sortAsc, tier])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const advocates = [...influencers]
    .filter((i) => i.sentimentScore > 0.4)
    .sort((a, b) => b.sentimentScore - a.sentimentScore)
    .slice(0, 3)

  const attention = [...influencers]
    .filter((i) => i.sentimentScore < 0 || i.trend === "down")
    .sort((a, b) => a.sentimentScore - b.sentimentScore)
    .slice(0, 3)

  const totalReach = influencers.reduce(
    (a, i) => a + parseNumeric(i.reach),
    0
  )
  const totalMentions = influencers.reduce((a, i) => a + i.mentions, 0)
  const totalSubs = influencers.reduce(
    (a, i) => a + parseNumeric(i.subscribers),
    0
  )
  const avgSentiment = (
    influencers.reduce((a, i) => a + i.sentimentScore, 0) / influencers.length
  ).toFixed(2)

  const fmtLargeNumber = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`
    return `${n}`
  }

  const tiers: { key: Tier; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: influencers.length },
    { key: "mega", label: "Mega", count: influencers.filter((i) => tierOf(i.subscribers) === "mega").length },
    { key: "macro", label: "Macro", count: influencers.filter((i) => tierOf(i.subscribers) === "macro").length },
    { key: "micro", label: "Micro", count: influencers.filter((i) => tierOf(i.subscribers) === "micro").length },
  ]

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
          <div className="flex-1 max-w-[680px] min-w-[280px]">
            <div className="eyebrow mb-3">Influenciadores · rede de menções</div>
            <h1
              className="font-display m-0"
              style={{ fontSize: 36, lineHeight: 1.1, color: "var(--ink)" }}
            >
              <span style={{ color: "var(--color-teal-500)" }}>
                {advocates.length} advogados
              </span>{" "}
              da marca
              <span style={{ color: "var(--ink-muted-2)" }}>
                {" "}e {attention.length} nomes pedindo atenção esta semana.
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="chip">Último mês</span>
              <span className="chip">Todas plataformas</span>
              <span className="chip">
                <span className="font-mono-zoe">{influencers.length}</span> criadores
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 border-b border-border-soft">
        <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow">Advogados · top sentimento</div>
            <span className="chip chip-pos text-[10px]">+ positivo</span>
          </div>
          <div className="flex flex-col">
            {advocates.map((inf, i) => (
              <div
                key={inf.id}
                className={`flex items-center gap-3 py-2.5 ${
                  i === 0 ? "" : "border-t border-border-soft"
                }`}
              >
                <span className="font-mono-zoe text-[11px] text-muted-2 w-[18px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[13px]"
                  style={{ background: `hsl(${i * 67 + 160}, 40%, 55%)` }}
                >
                  {inf.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {inf.name}
                  </div>
                  <div className="font-mono-zoe text-[10.5px] text-muted truncate">
                    {inf.handle}
                  </div>
                </div>
                <span className="chip chip-pos text-[11px]">
                  +{inf.sentimentScore.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow">Atenção · risco ou queda</div>
            <span className="chip chip-neg text-[10px]">monitorar</span>
          </div>
          {attention.length === 0 ? (
            <div className="text-[13px] text-muted py-6">
              Nenhum influenciador em risco neste período.
            </div>
          ) : (
            <div className="flex flex-col">
              {attention.map((inf, i) => {
                const TrendIcon = trendIcons[inf.trend]
                return (
                  <div
                    key={inf.id}
                    className={`flex items-center gap-3 py-2.5 ${
                      i === 0 ? "" : "border-t border-border-soft"
                    }`}
                  >
                    <span className="font-mono-zoe text-[11px] text-muted-2 w-[18px]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div
                      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[13px]"
                      style={{ background: `hsl(${i * 47 + 10}, 45%, 55%)` }}
                    >
                      {inf.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {inf.name}
                      </div>
                      <div className="flex items-center gap-1 font-mono-zoe text-[10.5px] text-muted">
                        <span className="truncate">{inf.handle}</span>
                        <TrendIcon
                          className="w-3 h-3"
                          style={{
                            color:
                              inf.trend === "down"
                                ? "var(--color-neg)"
                                : "var(--ink-muted)",
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className={`chip text-[11px] ${
                        inf.sentimentScore < 0 ? "chip-neg" : ""
                      }`}
                    >
                      {inf.sentimentScore > 0 ? "+" : ""}
                      {inf.sentimentScore.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-7">
          <div className="eyebrow mb-4">Visão geral · 30d</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-5">
            <div>
              <div
                className="font-display leading-none"
                style={{ fontSize: 32, color: "var(--ink)" }}
              >
                {fmtLargeNumber(totalReach)}
              </div>
              <div className="text-[11.5px] text-muted mt-1.5">
                Alcance combinado
              </div>
            </div>
            <div>
              <div
                className="font-display leading-none"
                style={{ fontSize: 32, color: "var(--ink)" }}
              >
                {totalMentions}
              </div>
              <div className="text-[11.5px] text-muted mt-1.5">
                Menções totais
              </div>
            </div>
            <div>
              <div
                className="font-display leading-none"
                style={{ fontSize: 32, color: "var(--ink)" }}
              >
                {fmtLargeNumber(totalSubs)}
              </div>
              <div className="text-[11.5px] text-muted mt-1.5">
                Audiência agregada
              </div>
            </div>
            <div>
              <div
                className="font-display leading-none"
                style={{
                  fontSize: 32,
                  color:
                    parseFloat(avgSentiment) > 0.2
                      ? "var(--color-pos)"
                      : parseFloat(avgSentiment) < -0.2
                        ? "var(--color-neg)"
                        : "var(--ink)",
                }}
              >
                {parseFloat(avgSentiment) >= 0 ? "+" : ""}
                {avgSentiment}
              </div>
              <div className="text-[11.5px] text-muted mt-1.5">
                Sentimento médio
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category distribution */}
      <section className="px-8 py-6 border-b border-border-soft">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="eyebrow">Distribuição por categoria</div>
            <div className="text-[12px] text-muted mt-1">
              Em que temas seus influenciadores atuam
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
          {categoryBreakdown.map((c) => (
            <div key={c.name}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[13px] text-ink-2">{c.name}</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono-zoe text-[11px] text-muted">
                    {c.count}
                  </span>
                  <span
                    className="font-display"
                    style={{ fontSize: 16, color: "var(--ink)" }}
                  >
                    {c.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-1 bg-[#F3F4F6] dark:bg-[#1C1F2E] rounded-sm overflow-hidden">
                <div
                  style={{
                    width: `${c.percentage}%`,
                    height: "100%",
                    background: "var(--color-teal-500)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tier tabs + sort + table */}
      <section
        className="px-8 border-b border-border-soft flex items-center justify-between gap-4 sticky top-13 z-10"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex gap-1">
          {tiers.map((t) => {
            const active = tier === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTier(t.key)}
                aria-pressed={active}
                className={`px-3 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-[1px] ${
                  active
                    ? "border-teal-500 text-[--color-teal-600] dark:text-teal-300"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}{" "}
                <span className="font-mono-zoe text-[11px] text-muted-2 ml-0.5">
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-transparent outline-none text-[12.5px] text-ink-2 cursor-pointer"
            >
              <option value="mentions">Menções</option>
              <option value="reach">Alcance</option>
              <option value="subscribers">Audiência</option>
              <option value="sentiment">Sentimento</option>
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr
              className="border-b border-border-soft"
              style={{ background: "transparent" }}
            >
              <th className="text-left px-8 py-3 eyebrow font-semibold">#</th>
              <th className="text-left py-3 eyebrow font-semibold">
                Influenciador
              </th>
              <th className="text-left py-3 eyebrow font-semibold">
                Plataforma
              </th>
              <th className="text-left py-3 eyebrow font-semibold">
                Categoria
              </th>
              <SortableHeader
                label="Audiência"
                sortKey="subscribers"
                currentKey={sortKey}
                asc={sortAsc}
                onToggle={toggleSort}
              />
              <SortableHeader
                label="Alcance"
                sortKey="reach"
                currentKey={sortKey}
                asc={sortAsc}
                onToggle={toggleSort}
              />
              <SortableHeader
                label="Menções"
                sortKey="mentions"
                currentKey={sortKey}
                asc={sortAsc}
                onToggle={toggleSort}
              />
              <SortableHeader
                label="Sentimento"
                sortKey="sentiment"
                currentKey={sortKey}
                asc={sortAsc}
                onToggle={toggleSort}
              />
              <th className="text-left px-4 py-3 eyebrow font-semibold">
                Tend.
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inf, idx) => {
              const TrendIcon = trendIcons[inf.trend]
              const trendColor =
                inf.trend === "up"
                  ? "var(--color-pos)"
                  : inf.trend === "down"
                    ? "var(--color-neg)"
                    : "var(--ink-muted)"
              const sentimentChip =
                inf.sentimentScore > 0.2
                  ? "chip-pos"
                  : inf.sentimentScore < -0.1
                    ? "chip-neg"
                    : ""
              const tierName = tierLabel[tierOf(inf.subscribers)]
              return (
                <tr
                  key={inf.id}
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
                        style={{
                          background: `hsl(${idx * 53}, 40%, 55%)`,
                        }}
                      >
                        {inf.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-medium truncate"
                            style={{ color: "var(--ink)" }}
                          >
                            {inf.name}
                          </span>
                          <span className="chip text-[9.5px] px-1.5 py-[1px]">
                            {tierName}
                          </span>
                        </div>
                        <div className="font-mono-zoe text-[10.5px] text-muted truncate">
                          {inf.handle}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: platformColor[inf.platform] }}
                      />
                      <span className="text-[12.5px] text-ink-2">
                        {platformLabel[inf.platform]}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 text-ink-2">{inf.category}</td>
                  <td className="py-3.5 font-mono-zoe">{inf.subscribers}</td>
                  <td className="py-3.5 font-mono-zoe">{inf.reach}</td>
                  <td className="py-3.5">
                    <span
                      className="font-display"
                      style={{ fontSize: 18, color: "var(--ink)" }}
                    >
                      {inf.mentions}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span className={`chip text-[11px] ${sentimentChip}`}>
                      {inf.sentimentScore > 0 ? "+" : ""}
                      {inf.sentimentScore.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <TrendIcon
                      className="w-4 h-4"
                      style={{ color: trendColor }}
                    />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-8 py-16 text-center text-muted text-sm"
                >
                  Nenhum influenciador neste tier.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  currentKey,
  asc,
  onToggle,
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
        className={`flex items-center gap-1 eyebrow font-semibold transition-colors ${
          active ? "text-ink dark:text-[#E6E8EF]" : ""
        }`}
      >
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${active ? "text-teal-500" : ""}`}
        />
        {active && (
          <span className="text-[9px] text-teal-500">{asc ? "↑" : "↓"}</span>
        )}
      </button>
    </th>
  )
}
