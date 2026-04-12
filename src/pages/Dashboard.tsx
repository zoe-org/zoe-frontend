import { Link } from "react-router-dom"
import { KpiCard } from "@/components/ui/kpi-card"
import { SentimentBadge } from "@/components/ui/sentiment-badge"
import {
  kpiData, sentimentChart, recentAlerts, recentMentions, topInfluencers, hotTopics,
} from "@/lib/mock/dashboard"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useAuth } from "@/features/auth/AuthContext"

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

const alertDotColors = { critical: "bg-[#DC2626]", warning: "bg-[#D97706]", info: "bg-[#00A799]" }
const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus }
const platformColors = { YT: "bg-red-100 text-red-700", TT: "bg-slate-100 text-slate-700", IG: "bg-pink-100 text-pink-700" }

export default function DashboardPage() {
  const { user } = useAuth()
  const maxBar = Math.max(...sentimentChart.map(d => d.positive + d.negative))
  const displayName = user?.name ?? user?.email?.split("@")[0] ?? ""

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[--color-midnight]">{getGreeting()}, {displayName}! 👋</h1>
        <p className="text-sm text-[#6B7280] mt-1">Acompanhe de perto o desempenho do seu marketing</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map(kpi => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Main row: Sentiment chart + Alerts/Mentions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sentiment chart */}
        <div className="lg:col-span-2 bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[--color-midnight]">Sentimento — 30 dias</h2>
            <button className="text-[#6B7280] hover:text-[--color-midnight]">•••</button>
          </div>
          <div className="flex items-end gap-3 h-48">
            {sentimentChart.map(day => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: "160px" }}>
                  <div
                    className="w-full bg-[#00A799] rounded-t"
                    style={{ height: `${(day.positive / maxBar) * 160}px` }}
                  />
                  <div
                    className="w-full bg-[#FDA4A4] rounded-b"
                    style={{ height: `${(day.negative / maxBar) * 160}px` }}
                  />
                </div>
                <span className="text-[10px] text-[#6B7280]">{day.date}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00A799]" /> Positivo</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FDA4A4]" /> Negativo</span>
          </div>
        </div>

        {/* Right stack: Alerts + Mentions */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-[--color-midnight] mb-3">Alertas recentes</h2>
            <div className="space-y-3">
              {recentAlerts.map(a => (
                <div key={a.id} className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${alertDotColors[a.type]}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-[--color-midnight] leading-snug">{a.text}</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">{a.timeAgo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-[--color-midnight] mb-3">Menções recentes</h2>
            <div className="space-y-3">
              {recentMentions.map(m => (
                <div key={m.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[--color-midnight] leading-snug truncate">{m.snippet}</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">{m.creator} · {m.timeAgo}</p>
                  </div>
                  <SentimentBadge sentiment={m.sentiment} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Influencers + Hot topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Top Influenciadores por Menções</h2>
          <div className="space-y-3">
            {topInfluencers.map((inf, i) => (
              <div key={inf.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#6B7280] w-4">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-[#00A799]/10 text-[#00A799] flex items-center justify-center text-xs font-bold shrink-0">
                  {inf.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[--color-midnight] truncate">{inf.name}</p>
                  <p className="text-[10px] text-[#6B7280]">{inf.handle}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${platformColors[inf.platform]}`}>
                  {inf.platform}
                </span>
                <span className="text-xs font-bold text-[--color-midnight] w-6 text-right">{inf.mentions}</span>
                <SentimentBadge sentiment={inf.sentiment} />
              </div>
            ))}
          </div>
          <Link to="/intelligence/influencers" className="inline-block mt-4 text-xs text-[#00A799] hover:underline font-medium">
            Ver todos →
          </Link>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Tópicos em Alta</h2>
          <div className="space-y-3">
            {hotTopics.map(topic => {
              const TrendIcon = trendIcons[topic.trend]
              const borderColor = topic.sentimentSplit.positive > 50 ? "border-l-[#00A799]" : topic.sentimentSplit.negative > 40 ? "border-l-[#DC2626]" : "border-l-[#D97706]"
              return (
                <div key={topic.id} className={`border-l-2 pl-3 ${borderColor}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[--color-midnight]">{topic.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#6B7280]">{topic.mentions} menções</span>
                      <TrendIcon className={`w-3 h-3 ${topic.trend === "up" ? "text-[#16A34A]" : topic.trend === "down" ? "text-[#DC2626]" : "text-[#6B7280]"}`} />
                    </div>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div className="bg-[#16A34A]" style={{ width: `${topic.sentimentSplit.positive}%` }} />
                    <div className="bg-[#D1D5DB]" style={{ width: `${topic.sentimentSplit.neutral}%` }} />
                    <div className="bg-[#DC2626]" style={{ width: `${topic.sentimentSplit.negative}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
