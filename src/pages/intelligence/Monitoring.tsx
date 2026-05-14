import { useState, useMemo } from "react"
import { Search, Download, Play, LayoutGrid, List, ArrowUpDown } from "lucide-react"
import { MentionDrawer } from "@/components/features/MentionDrawer"
import { mentions, sentimentCounts, type Mention } from "@/lib/mock/monitoring"

const platformLabel: Record<Mention["platform"], string> = {
  YT: "YouTube",
  TT: "TikTok",
  IG: "Instagram",
  Podcast: "Podcast",
}

const platformColor: Record<Mention["platform"], string> = {
  YT: "#FF0000",
  TT: "#0B0D18",
  IG: "#E1306C",
  Podcast: "#8B5CF6",
}

const thumbBgByPlatform: Record<Mention["platform"], string> = {
  YT: "#0B0D18",
  TT: "#1F2937",
  IG: "#374151",
  Podcast: "#1E1B4B",
}

type SentimentFilter = "all" | "positive" | "neutral" | "negative"
type SortKey = "recent" | "views" | "impact"
type ViewMode = "list" | "grid"

export default function MonitoringPage() {
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all")
  const [sort, setSort] = useState<SortKey>("recent")
  const [view, setView] = useState<ViewMode>("list")
  const [selectedMention, setSelectedMention] = useState<Mention | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const filtered = useMemo(() => {
    const base = sentimentFilter === "all"
      ? mentions
      : mentions.filter((m) => m.sentiment === sentimentFilter)

    const parseViews = (v: string): number => {
      const n = parseFloat(v)
      if (v.endsWith("M")) return n * 1_000_000
      if (v.endsWith("K")) return n * 1_000
      return n
    }
    const sorted = [...base]
    if (sort === "views") sorted.sort((a, b) => parseViews(b.views) - parseViews(a.views))
    else if (sort === "impact") sorted.sort((a, b) => Math.abs(b.sentimentScore) - Math.abs(a.sentimentScore))
    return sorted
  }, [sentimentFilter, sort])

  const openDrawer = (mention: Mention) => {
    setSelectedMention(mention)
    setDrawerOpen(true)
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
          <div className="flex-1 max-w-[640px] min-w-[280px]">
            <div className="eyebrow mb-3">Monitoramento · Feed ao vivo</div>
            <h1
              className="font-display m-0"
              style={{ fontSize: 36, lineHeight: 1.1, color: "var(--ink)" }}
            >
              Todas as menções detectadas{" "}
              <span style={{ color: "var(--ink-muted-2)" }}>em vídeo, áudio e imagem.</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="chip chip-primary">
                <span className="live-dot" style={{ width: 6, height: 6 }} /> ao vivo
              </span>
              <span className="chip">
                <span className="font-mono-zoe">{sentimentCounts.all}</span> menções · 7d
              </span>
              <span className="chip chip-pos">
                {sentimentCounts.positive} positivas
              </span>
              <span className="chip chip-neg">
                {sentimentCounts.negative} negativas
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Buscar transcrição..."
                className="w-56 h-8 pl-8 pr-3 text-[12.5px] rounded-md border border-border-soft bg-transparent outline-none focus:border-teal-500"
                readOnly
              />
            </div>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        </div>
      </section>

      {/* Filter chips */}
      <section className="px-8 py-4 border-b border-border-soft flex flex-wrap gap-2">
        {[
          "Últimos 7 dias",
          "Todas plataformas",
          "Todas marcas",
          "Com logo",
          "Criadores verificados",
        ].map((label) => (
          <button
            key={label}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border-soft text-[12px] text-ink-2 hover:border-muted transition-colors"
          >
            {label}
          </button>
        ))}
      </section>

      {/* Sentiment tabs + controls */}
      <section className="px-8 border-b border-border-soft flex items-center justify-between gap-4 sticky top-13 z-10" style={{ background: "var(--surface)" }}>
        <div className="flex gap-1">
          {([
            { key: "all", label: "Todos", count: sentimentCounts.all },
            { key: "positive", label: "Positivo", count: sentimentCounts.positive },
            { key: "neutral", label: "Neutro", count: sentimentCounts.neutral },
            { key: "negative", label: "Negativo", count: sentimentCounts.negative },
          ] as const).map((tab) => {
            const active = sentimentFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setSentimentFilter(tab.key)}
                aria-pressed={active}
                className={`px-3 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-[1px] ${
                  active
                    ? "border-teal-500 text-[--color-teal-600] dark:text-teal-300"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}{" "}
                <span className="font-mono-zoe text-[11px] text-muted-2 ml-0.5">
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-transparent outline-none text-[12.5px] text-ink-2 cursor-pointer"
            >
              <option value="recent">Mais recente</option>
              <option value="views">Mais vistas</option>
              <option value="impact">Maior impacto</option>
            </select>
          </div>
          <div className="inline-flex rounded-md border border-border-soft overflow-hidden">
            <button
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`p-1.5 transition-colors ${
                view === "list"
                  ? "bg-[#F3F4F6] dark:bg-[#1A1D2D] text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={`p-1.5 transition-colors border-l border-border-soft ${
                view === "grid"
                  ? "bg-[#F3F4F6] dark:bg-[#1A1D2D] text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Mention feed */}
      {view === "list" ? (
        <section>
          {filtered.map((m) => {
            const sentimentChip =
              m.sentiment === "positive"
                ? "chip-pos"
                : m.sentiment === "negative"
                  ? "chip-neg"
                  : ""
            const sentimentLabel =
              m.sentiment === "positive"
                ? "Positivo"
                : m.sentiment === "negative"
                  ? "Negativo"
                  : "Neutro"
            return (
              <button
                key={m.id}
                onClick={() => openDrawer(m)}
                className="grid items-center gap-4 px-8 py-4 border-b border-border-soft w-full text-left cursor-pointer hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
                style={{ gridTemplateColumns: "110px 1fr 140px 120px 110px" }}
              >
                <div
                  className="relative w-[110px] h-[62px] rounded-md overflow-hidden flex items-center justify-center"
                  style={{ background: thumbBgByPlatform[m.platform] }}
                >
                  <Play className="w-5 h-5 text-white/90" />
                  {m.hasLogo && (
                    <span className="absolute top-1 left-1 chip chip-primary text-[9px] px-1.5 py-[1px]">
                      LOGO
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[14px] font-medium truncate mb-0.5"
                    style={{ color: "var(--ink)" }}
                  >
                    {m.title}
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px] text-muted flex-wrap">
                    <span>{m.creator}</span>
                    <span>·</span>
                    <span className="font-mono-zoe">{m.handle}</span>
                    <span>·</span>
                    <span className="font-mono-zoe">{m.views} views</span>
                    <span>·</span>
                    <span>{m.timeAgo}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: platformColor[m.platform] }}
                  />
                  <span className="text-[12px] text-ink-2">
                    {platformLabel[m.platform]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`chip ${sentimentChip}`}>{sentimentLabel}</span>
                </div>
                <div className="text-right">
                  <div
                    className="font-mono-zoe text-[13px]"
                    style={{
                      color:
                        m.sentimentScore > 0.2
                          ? "var(--color-pos)"
                          : m.sentimentScore < -0.2
                            ? "var(--color-neg)"
                            : "var(--ink-muted)",
                    }}
                  >
                    {m.sentimentScore > 0 ? "+" : ""}
                    {m.sentimentScore.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-2">score</div>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="px-8 py-16 text-center text-muted text-sm">
              Nenhuma menção encontrada para este filtro.
            </div>
          )}
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m, i) => {
            const sentimentChip =
              m.sentiment === "positive"
                ? "chip-pos"
                : m.sentiment === "negative"
                  ? "chip-neg"
                  : ""
            const sentimentLabel =
              m.sentiment === "positive"
                ? "Positivo"
                : m.sentiment === "negative"
                  ? "Negativo"
                  : "Neutro"
            const col = i % 3
            return (
              <button
                key={m.id}
                onClick={() => openDrawer(m)}
                className={`text-left p-6 border-b border-border-soft hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors ${
                  col !== 2 ? "md:border-r" : ""
                }`}
              >
                <div
                  className="relative w-full aspect-video rounded-md overflow-hidden flex items-center justify-center mb-3"
                  style={{ background: thumbBgByPlatform[m.platform] }}
                >
                  <Play className="w-6 h-6 text-white/90" />
                  {m.hasLogo && (
                    <span className="absolute top-2 left-2 chip chip-primary text-[9.5px] px-1.5 py-[1px]">
                      LOGO
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-black/60 text-white text-[10px]">
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: platformColor[m.platform] }}
                    />
                    {platformLabel[m.platform]}
                  </span>
                </div>
                <div
                  className="text-[14px] font-medium mb-1 line-clamp-2"
                  style={{ color: "var(--ink)" }}
                >
                  {m.title}
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-muted flex-wrap">
                  <span>{m.creator}</span>
                  <span>·</span>
                  <span className="font-mono-zoe">{m.views} views</span>
                  <span>·</span>
                  <span>{m.timeAgo}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`chip ${sentimentChip}`}>{sentimentLabel}</span>
                  <span className="font-mono-zoe text-[11px] text-muted ml-auto">
                    {m.sentimentScore > 0 ? "+" : ""}
                    {m.sentimentScore.toFixed(2)}
                  </span>
                </div>
              </button>
            )
          })}
        </section>
      )}

      <MentionDrawer
        mention={selectedMention}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
