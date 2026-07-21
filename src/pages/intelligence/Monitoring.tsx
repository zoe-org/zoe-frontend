import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Search, AlertCircle, List, LayoutGrid, Download } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MentionDrawer } from "@/components/features/MentionDrawer"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { VideoThumb } from "@/components/ui/video-thumb"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useActiveBrand } from "@/features/brands/BrandContext"
import { toCsv, downloadCsv } from "@/lib/csv"
import { useVideosFeed, useVideosSummary, type VideoFilters, type VideoListItem } from "@/lib/api/videos"
import { tEnum } from "@/i18n/enums"

/** 1234 → "1,2 mil"; 1_234_567 → "1,2 mi". Compacto pt-BR para views. */
function compactNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

// Tabs pill preenchidas (design). A cor do ativo é a do próprio sentimento —
// é o que dá leitura imediata de "estou olhando o quê".
const SENT_TABS = [
  // teal-500 explícito: `--color-primary` é o quase-preto do shadcn, NÃO a cor
  // da marca — usá-lo aqui daria uma pill preta no lugar da teal.
  { key: "", label: "Todos", color: "var(--color-teal-500)" },
  { key: "Positive", label: "Positivo", color: "var(--color-pos)" },
  { key: "Neutral", label: "Neutro", color: "#6B7280" },
  { key: "Negative", label: "Negativo", color: "var(--color-neg)" },
  { key: "Inconclusive", label: "Indeterminado", color: "#6B7280" },
] as const

const PERIODS = [
  { key: "", label: "Todo o período" },
  { key: "7", label: "Últimos 7 dias" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "90", label: "Últimos 90 dias" },
] as const

const MIN_SCORES = [
  { key: "", label: "Qualquer score" },
  { key: "0.5", label: "Score ≥ 0,50" },
  { key: "0.7", label: "Score ≥ 0,70" },
] as const

function classificationClass(cls: string | null): string {
  if (cls === "Positive") return "text-[#16A34A] bg-[#F0FDF4]"
  if (cls === "Negative") return "text-[#DC2626] bg-[#FEF2F2]"
  return "text-[#6B7280] bg-[#F3F4F6]"
}

/**
 * Filtro em forma de pill (design). Envolve um `Select` do Radix em vez de um
 * botão decorativo: o mock só mostra o chevron, mas aqui ele precisa abrir de
 * verdade. Ativo = tem valor diferente do padrão.
 */
function FilterChip({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly { key: string; label: string }[]
  placeholder: string
}) {
  const active = value !== ""
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger
        aria-label={placeholder}
        className={`h-8 rounded-full px-3.5 text-[13px] font-medium border transition-colors ${
          active
            ? "border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/25"
            : "border-border-soft text-ink-2 bg-transparent"
        }`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key || "__all"} value={o.key || "__all"}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function MonitoringPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Marca ativa é GLOBAL (seletor no header); só os filtros ficam na URL.
  const brand = useActiveBrand()

  const setParam = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  const brandList = brand.brands
  const brandId = brand.brandId

  const sent = params.get("sent") ?? ""
  const period = params.get("period") ?? ""
  const min = params.get("min") ?? ""
  const q = params.get("q") ?? ""
  // Na URL junto com os filtros: a preferência de visualização sobrevive ao
  // refresh e viaja no link compartilhado.
  const view = params.get("view") === "grid" ? "grid" : "list"

  // Busca com debounce local → URL (deep-link + não refetch a cada tecla).
  const [searchInput, setSearchInput] = useState(q)
  useEffect(() => { setSearchInput(q) }, [q])
  useEffect(() => {
    const id = setTimeout(() => { if (searchInput !== q) setParam("q", searchInput) }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const filters: VideoFilters | null = useMemo(() => {
    if (!brandId) return null
    const from = period ? new Date(Date.now() - Number(period) * 86_400_000).toISOString() : undefined
    return {
      brandId,
      classificacao: sent || undefined,
      search: q || undefined,
      from,
      minScore: min ? Number(min) : undefined,
    }
  }, [brandId, sent, q, period, min])

  const feed = useVideosFeed(filters)
  const summary = useVideosSummary(filters)
  const items = feed.data?.pages.flatMap((p) => p.items) ?? []

  // Contagem por aba. Enquanto a summary não chega, undefined → não renderiza
  // número (melhor do que mostrar 0 e piscar pro valor real).
  const tabCount = (key: string): number | undefined => {
    const s = summary.data
    if (!s) return undefined
    switch (key) {
      case "": return s.total
      case "Positive": return s.positive
      case "Neutral": return s.neutral
      case "Negative": return s.negative
      case "Inconclusive": return s.inconclusive
      default: return undefined
    }
  }

  const [selected, setSelected] = useState<VideoListItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const openDrawer = (item: VideoListItem) => { setSelected(item); setDrawerOpen(true) }

  /**
   * Export CSV das menções carregadas (respeita os filtros ativos). Título e
   * canal vêm do YouTube — input hostil — então TODO valor passa pelo
   * `toCsv`, que desarma formula injection (RN-I-070).
   *
   * Escopo: exporta o que já foi carregado no feed (paginação por cursor), não
   * dispara refetch de todas as páginas — por isso o `title` do botão avisa.
   */
  const exportCsv = () => {
    if (items.length === 0) return
    const csv = toCsv(items, [
      { header: "Título", value: (m) => m.title },
      { header: "Canal", value: (m) => m.channelName },
      { header: "Publicado em", value: (m) => new Date(m.publishedAt).toLocaleDateString("pt-BR") },
      { header: "Views", value: (m) => m.views ?? "" },
      { header: "Classificação", value: (m) => (m.classificacao ? tEnum("classification", m.classificacao) : "") },
      { header: "Score", value: (m) => (m.score != null ? m.score.toFixed(2) : "") },
      { header: "Confiança", value: (m) => (m.confidence != null ? m.confidence.toFixed(2) : "") },
      { header: "Cobertura", value: (m) => tEnum("pipelinePath", m.pipelinePath) },
      { header: "URL", value: (m) => `https://www.youtube.com/watch?v=${m.youtubeVideoId}` },
    ])
    const brandSlug = brand.active?.brandSlug ?? "marca"
    downloadCsv(`zoe-mencoes-${brandSlug}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  // ── Estados de topo: sem marca / carregando marcas ────────────────────
  if (brand.isLoading) return <PageSkeleton />
  if (brand.isError) return <ErrorState onRetry={() => brand.refetch()} />
  if (brandList.length === 0) {
    return (
      <EmptyState
        title="Nenhuma marca assinada ainda"
        description="Assine uma marca para começar a monitorar as menções em vídeo, áudio e comentários."
        actionLabel="Assinar uma marca"
        onAction={() => navigate("/brands")}
      />
    )
  }

  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      {/* Hero */}
      <section className="px-8 pt-7  " style={{ background: "var(--surface)" }}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex-1 max-w-[640px] min-w-[280px]">
            <div className="eyebrow mb-3">Intelligence · Feed</div>
            <h1 className="font-display m-0" style={{ fontSize: 36, lineHeight: 1.1, color: "var(--ink)" }}>
              Monitoramento
            </h1>
            {summary.data && (
              <div className="text-[14px] text-ink-muted mt-3">
                Feed completo de menções detectadas em vídeo. {" "}
                <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{summary.data.total}</span>{" "}
                {summary.data.total === 1 ? "vídeo analisado" : "vídeos analisados"}
                {period && ` nos últimos ${period} dias`}.
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Seletor de marca vive no header agora (BrandSwitcher). */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar título..."
                className="w-56 h-8 pl-8 pr-3 text-[12.5px] rounded-md border border-border-soft bg-transparent outline-none focus:border-teal-500"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={items.length === 0}
              title="Exporta as menções já carregadas, com os filtros atuais"
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        </div>
      </section>

      {/* Filtros em pill (design) */}
      <section className="px-8 py-3 border-b border-border-soft flex flex-wrap items-center gap-2">
        <FilterChip
          value={period} onChange={(v) => setParam("period", v)}
          options={PERIODS} placeholder="Todo o período"
        />
        <FilterChip
          value={min} onChange={(v) => setParam("min", v)}
          options={MIN_SCORES} placeholder="Qualquer score"
        />
      </section>

      {/* Tabs de classificação (filtro server-side) + toggle de visualização */}
      <section
        className="px-8 py-3 border-b border-border-soft flex items-center justify-between gap-4 sticky top-13 z-10"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center gap-1 flex-wrap">
          {SENT_TABS.map((tab) => {
            const active = sent === tab.key
            const count = tabCount(tab.key)
            return (
              <button
                key={tab.key || "all"}
                onClick={() => setParam("sent", tab.key)}
                aria-pressed={active}
                className={`px-4 py-2 text-[13.5px] font-semibold rounded-lg transition-colors ${
                  active ? "text-white" : "text-ink-muted hover:text-ink"
                }`}
                style={active ? { background: tab.color } : undefined}
              >
                {tab.label}
                {count !== undefined && (
                  <span className="ml-1.5 font-medium" style={{ opacity: active ? 0.85 : 0.6 }}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Lista ↔ grade: com thumbnail, a grade vira uma leitura visual rápida. */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border-soft shrink-0">
          {([
            { key: "list", label: "Lista", Icon: List },
            { key: "grid", label: "Grade", Icon: LayoutGrid },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setParam("view", key === "list" ? "" : key)}
              aria-pressed={view === key}
              title={label}
              aria-label={label}
              className={`p-1.5 rounded-md transition-colors ${
                view === key
                  ? "bg-[#F3F4F6] dark:bg-[#1A1D2D] text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </section>

      {/* Feed */}
      {feed.isLoading ? (
        <FeedSkeleton />
      ) : feed.isError ? (
        <ErrorState onRetry={() => feed.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum vídeo encontrado"
          description={q || sent || period || min
            ? "Nenhum resultado para os filtros atuais. Tente ampliar o período ou limpar os filtros."
            : "Ainda não há vídeos analisados para esta marca. Assim que o pipeline processar, eles aparecem aqui."}
        />
      ) : (
        <section>
          {view === "grid" ? (
            <div className="grid gap-4 px-8 py-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {items.map((m) => (
                <button
                  key={m.analysisId}
                  onClick={() => openDrawer(m)}
                  className="rounded-lg border border-border-soft overflow-hidden text-left cursor-pointer hover:border-teal-500 transition-colors"
                >
                  <div className="relative">
                    <VideoThumb
                      youtubeVideoId={m.youtubeVideoId}
                      durationSeconds={m.durationSeconds}
                      className="w-full aspect-video rounded-none"
                      playSize={34}
                    />
                    {m.classificacao && (
                      <span className={`absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classificationClass(m.classificacao)}`}>
                        {tEnum("classification", m.classificacao)}
                      </span>
                    )}
                  </div>
                  <div className="p-3.5">
                    <div className="text-[13.5px] font-medium leading-snug line-clamp-2 mb-1.5" style={{ color: "var(--ink)" }}>
                      {m.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-ink-muted mb-2">
                      <span className="truncate">{m.channelName}</span>
                      {m.views != null && (
                        <>
                          <span>·</span>
                          <span className="font-mono-zoe shrink-0">{compactNumber(m.views)} views</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="shrink-0">
                        {formatDistanceToNow(new Date(m.publishedAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <ConfidenceBadge pipelinePath={m.pipelinePath} confidence={m.confidence} />
                      <span className="font-mono-zoe text-[12px] shrink-0" style={{ color: "var(--ink)" }}>
                        {m.score != null ? m.score.toFixed(2) : "—"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            items.map((m) => (
              <button
                key={m.analysisId}
                onClick={() => openDrawer(m)}
                className="grid items-center gap-4 px-8 py-3.5 border-b border-border-soft w-full text-left cursor-pointer hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
                style={{ gridTemplateColumns: "110px 1fr 200px 150px 90px" }}
              >
                <VideoThumb
                  youtubeVideoId={m.youtubeVideoId}
                  durationSeconds={m.durationSeconds}
                  className="w-27.5 h-15.5"
                />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium truncate mb-0.5" style={{ color: "var(--ink)" }}>
                    {m.title}
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px] text-ink-muted flex-wrap">
                    <span className="truncate font-medium text-ink-2">{m.channelName}</span>
                    {m.views != null && (
                      <>
                        <span>·</span>
                        <span className="font-mono-zoe">{compactNumber(m.views)} views</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(m.publishedAt), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                </div>
                <div><ConfidenceBadge pipelinePath={m.pipelinePath} confidence={m.confidence} /></div>
                <div>
                  {m.classificacao && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classificationClass(m.classificacao)}`}>
                      {tEnum("classification", m.classificacao)}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono-zoe text-[13px]" style={{ color: "var(--ink)" }}>
                    {m.score != null ? m.score.toFixed(2) : "—"}
                  </div>
                  <div className="text-[10px] text-ink-muted-2">score</div>
                </div>
              </button>
            ))
          )}

          {feed.hasNextPage && (
            <div className="px-8 py-6 text-center">
              <button
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                className="inline-flex items-center h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
              >
                {feed.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
              </button>
            </div>
          )}
        </section>
      )}

      <MentionDrawer item={selected} brandId={brandId} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

// ── Estados ────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="-m-6 animate-pulse">
      <div className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="h-9 w-96 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      </div>
      <FeedSkeleton />
    </div>
  )
}

function FeedSkeleton() {
  return (
    <section className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-8 py-3.5 border-b border-border-soft">
          {/* Mesma caixa 110×62 da thumbnail real — sem isso a linha "pula" ao carregar. */}
          <div className="w-27.5 h-15.5 shrink-0 rounded-md bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
            <div className="h-3 w-1/3 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          </div>
          <div className="h-5 w-28 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          <div className="h-5 w-16 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        </div>
      ))}
    </section>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
