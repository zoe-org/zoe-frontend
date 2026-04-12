import { useState, useMemo } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { FilterChip } from "@/components/ui/filter-chip"
import { SentimentBadge } from "@/components/ui/sentiment-badge"
import { influencers, categoryBreakdown } from "@/lib/mock/influencers"
import { TrendingUp, TrendingDown, Minus, ArrowUpDown } from "lucide-react"

const platformColors = { YT: "bg-red-100 text-red-700", TT: "bg-slate-100 text-slate-700", IG: "bg-pink-100 text-pink-700" }
const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus }
const bubbleSizes = [0, 16, 24, 32, 40, 48]

type SortKey = "subscribers" | "mentions" | "reach"

function parseNumeric(val: string): number {
  const num = parseFloat(val.replace(/[^0-9.]/g, ""))
  if (val.includes("M")) return num * 1000000
  if (val.includes("K")) return num * 1000
  return num
}

export default function InfluencersPage() {
  const [sortKey, setSortKey] = useState<SortKey>("mentions")
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    const arr = [...influencers]
    arr.sort((a, b) => {
      let aVal: number, bVal: number
      if (sortKey === "mentions") { aVal = a.mentions; bVal = b.mentions }
      else if (sortKey === "subscribers") { aVal = parseNumeric(a.subscribers); bVal = parseNumeric(b.subscribers) }
      else { aVal = parseNumeric(a.reach); bVal = parseNumeric(b.reach) }
      return sortAsc ? aVal - bVal : bVal - aVal
    })
    return arr
  }, [sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Influenciadores" subtitle="Mapeamento e análise de influenciadores que mencionam sua marca." />

      <div className="flex flex-wrap gap-2">
        <FilterChip label="Último mês" />
        <FilterChip label="Todas plataformas" />
        <FilterChip label="Ordenar: Relevância" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Mapa de bolhas (Alcance × Sentimento)</h2>
          <div className="relative h-64 border border-[#E5E7EB] rounded bg-[#FAFAFA]">
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#6B7280]">Sentimento →</span>
            <span className="absolute -left-5 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-[#6B7280]">Alcance →</span>
            {influencers.map(inf => (
              <div
                key={inf.id}
                className="absolute flex items-center justify-center rounded-full transition-all"
                style={{
                  left: `${inf.bubbleX * 90 + 5}%`,
                  bottom: `${inf.bubbleY * 85 + 5}%`,
                  width: `${bubbleSizes[inf.bubbleSize]}px`,
                  height: `${bubbleSizes[inf.bubbleSize]}px`,
                  backgroundColor: inf.sentiment === "negative" ? "rgba(220,38,38,0.2)" : "rgba(0,167,153,0.2)",
                  border: `2px solid ${inf.sentiment === "negative" ? "#DC2626" : "#00A799"}`,
                  transform: "translate(-50%, 50%)",
                }}
                title={`${inf.name}: ${inf.sentimentScore}`}
              >
                <span className="text-[8px] font-semibold text-[--color-midnight] whitespace-nowrap">{inf.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Distribuição por categoria</h2>
          <div className="space-y-4">
            {categoryBreakdown.map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[--color-midnight]">{cat.name}</span>
                  <span className="text-[#6B7280]">{cat.count} · {cat.percentage}%</span>
                </div>
                <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${cat.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[#F9FAFB]">
              <th className="text-left px-4 py-3 font-semibold text-[#6B7280] uppercase tracking-wide">Influenciador</th>
              <th className="text-left px-4 py-3 font-semibold text-[#6B7280] uppercase tracking-wide">Plataforma</th>
              <SortableHeader label="Inscritos" sortKey="subscribers" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <SortableHeader label="Menções" sortKey="mentions" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <th className="text-left px-4 py-3 font-semibold text-[#6B7280] uppercase tracking-wide">Sentimento</th>
              <SortableHeader label="Alcance" sortKey="reach" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <th className="text-left px-4 py-3 font-semibold text-[#6B7280] uppercase tracking-wide">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(inf => {
              const TrendIcon = trendIcons[inf.trend]
              return (
                <tr key={inf.id} className="border-b last:border-b-0 hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center text-xs font-bold shrink-0">
                        {inf.name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-[--color-midnight]">{inf.name}</div>
                        <div className="text-[#6B7280]">{inf.handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${platformColors[inf.platform]}`}>{inf.platform}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{inf.subscribers}</td>
                  <td className="px-4 py-3 font-bold">{inf.mentions}</td>
                  <td className="px-4 py-3"><SentimentBadge sentiment={inf.sentiment} score={inf.sentimentScore} /></td>
                  <td className="px-4 py-3">{inf.reach}</td>
                  <td className="px-4 py-3">
                    <TrendIcon className={`w-4 h-4 ${inf.trend === "up" ? "text-[#16A34A]" : inf.trend === "down" ? "text-[#DC2626]" : "text-[#6B7280]"}`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortableHeader({ label, sortKey, currentKey, asc, onToggle }: {
  label: string; sortKey: SortKey; currentKey: SortKey; asc: boolean; onToggle: (k: SortKey) => void
}) {
  return (
    <th className="text-left px-4 py-3">
      <button onClick={() => onToggle(sortKey)} className="flex items-center gap-1 font-semibold text-[#6B7280] uppercase tracking-wide hover:text-[--color-midnight]">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${currentKey === sortKey ? "text-teal-500" : ""}`} />
        {currentKey === sortKey && <span className="text-[8px]">{asc ? "↑" : "↓"}</span>}
      </button>
    </th>
  )
}
