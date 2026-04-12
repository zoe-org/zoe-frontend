import { PageHeader } from "@/components/ui/page-header"
import { FilterChip } from "@/components/ui/filter-chip"
import { KpiCard } from "@/components/ui/kpi-card"
import { weeklyTrend, impactEvents, topicBreakdown, topicTags } from "@/lib/mock/sentiment"

const tagColors = {
  positive: "bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/20",
  negative: "bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20",
  mixed: "bg-[#FFFBEB] text-[#D97706] border-[#D97706]/20",
}

export default function SentimentPage() {
  const maxY = Math.max(...weeklyTrend.map(w => Math.max(w.positive, w.neutral, w.negative)))

  return (
    <div className="space-y-6">
      <PageHeader title="Sentimento" subtitle="Análise de sentimento das menções detectadas." />

      <div className="flex flex-wrap gap-2">
        <FilterChip label="Último mês" />
        <FilterChip label="Todas marcas" />
        <FilterChip label="Semanal" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Positivo" value="67%" barColor="teal" progress={67} />
        <KpiCard label="Neutro" value="13%" barColor="amber" progress={13} />
        <KpiCard label="Negativo" value="20%" barColor="red" progress={20} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Evolução de sentimento</h2>
          <div className="flex gap-4 mb-3 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Positivo</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9CA3AF]" /> Neutro</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#DC2626]" /> Negativo</span>
          </div>
          <div className="flex items-end gap-6 h-40">
            {weeklyTrend.map(week => (
              <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-1 justify-center" style={{ height: "130px", alignItems: "flex-end" }}>
                  <div className="w-2 bg-[#16A34A] rounded-t" style={{ height: `${(week.positive / maxY) * 130}px` }} />
                  <div className="w-2 bg-[#9CA3AF] rounded-t" style={{ height: `${(week.neutral / maxY) * 130}px` }} />
                  <div className="w-2 bg-[#DC2626] rounded-t" style={{ height: `${(week.negative / maxY) * 130}px` }} />
                </div>
                <span className="text-[10px] text-[#6B7280]">{week.week}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-[--color-midnight] mb-1">Eventos de impacto</h2>
          <p className="text-xs text-[#6B7280] mb-4">Menções que mais influenciaram a curva de sentimento.</p>
          <div className="space-y-4">
            {impactEvents.map(event => (
              <div key={event.id} className="flex items-start gap-3">
                <span className="text-xs text-[#6B7280] shrink-0 pt-0.5 w-20">{event.date.slice(5)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[--color-midnight]">{event.title}</p>
                  <span className={`text-xs font-semibold ${event.delta > 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                    {event.delta > 0 ? "+" : ""}{event.delta.toFixed(2)} no score
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Sentimento por tópico</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topicBreakdown.map(topic => (
            <div key={topic.id} className="border rounded-lg p-4">
              <h3 className="text-sm font-medium text-[--color-midnight] mb-3">{topic.name}</h3>
              <div className="flex h-2 rounded-full overflow-hidden mb-2">
                <div className="bg-[#16A34A]" style={{ width: `${topic.positive}%` }} />
                <div className="bg-[#D1D5DB]" style={{ width: `${topic.neutral}%` }} />
                <div className="bg-[#DC2626]" style={{ width: `${topic.negative}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#6B7280]">
                <span>{topic.positive}%</span>
                <span>{topic.neutral}%</span>
                <span>{topic.negative}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-sm font-semibold text-[--color-midnight] mb-4">Tópicos mais citados</h2>
        <div className="flex flex-wrap gap-2">
          {topicTags.map(tag => (
            <span key={tag.name} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tagColors[tag.sentiment]}`}>
              {tag.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
