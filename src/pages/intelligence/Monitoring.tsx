import { useState, useMemo } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { FilterChip } from "@/components/ui/filter-chip"
import { SentimentBadge } from "@/components/ui/sentiment-badge"
import { MentionDrawer } from "@/components/features/MentionDrawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { mentions, sentimentCounts, type Mention } from "@/lib/mock/monitoring"
import { Search } from "lucide-react"

const platformColors = {
  YT: "bg-red-100 text-red-700",
  TT: "bg-slate-100 text-slate-700",
  IG: "bg-pink-100 text-pink-700",
  Podcast: "bg-purple-100 text-purple-700",
}

type SentimentFilter = "all" | "positive" | "neutral" | "negative"

export default function MonitoringPage() {
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all")
  const [selectedMention, setSelectedMention] = useState<Mention | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filtered = useMemo(() => {
    if (sentimentFilter === "all") return mentions
    return mentions.filter(m => m.sentiment === sentimentFilter)
  }, [sentimentFilter])

  const openDrawer = (mention: Mention) => {
    setSelectedMention(mention)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Monitoramento" subtitle="Feed completo de menções detectadas em vídeo.">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
          <Input placeholder="Buscar transcrição..." className="pl-8 w-56 h-8 text-xs" readOnly />
        </div>
        <Button className="bg-ember hover:bg-ember/90 text-white text-xs h-8 px-4">
          Exportar
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="Últimos 7 dias" />
        <FilterChip label="Todas plataformas" />
        <FilterChip label="Todos sentimentos" />
        <FilterChip label="Todas marcas" />
        <FilterChip label="Com logo" />
      </div>

      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {([
          { key: "all", label: "Todos", count: sentimentCounts.all },
          { key: "positive", label: "Positivo", count: sentimentCounts.positive },
          { key: "neutral", label: "Neutro", count: sentimentCounts.neutral },
          { key: "negative", label: "Negativo", count: sentimentCounts.negative },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSentimentFilter(tab.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              sentimentFilter === tab.key
                ? "border-teal-500 text-teal-500"
                : "border-transparent text-[#6B7280] hover:text-[--color-midnight]"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(mention => (
          <button
            key={mention.id}
            onClick={() => openDrawer(mention)}
            className="w-full text-left bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow flex items-center gap-4"
          >
            <div className="w-20 h-12.5 bg-[#F3F4F6] rounded flex items-center justify-center shrink-0">
              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-10 border-l-[#6B7280]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[--color-midnight] truncate">{mention.title}</span>
                {mention.hasLogo && (
                  <span className="text-[10px] font-medium bg-[#F0FDFA] text-teal-500 px-1.5 py-0.5 rounded shrink-0">LOGO</span>
                )}
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {mention.creator} · {mention.handle} · {mention.views} views · {mention.timeAgo}
              </p>
            </div>

            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${platformColors[mention.platform]}`}>
              {mention.platform}
            </span>
            <SentimentBadge sentiment={mention.sentiment} score={mention.sentimentScore} />
          </button>
        ))}
      </div>

      <MentionDrawer
        mention={selectedMention}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
