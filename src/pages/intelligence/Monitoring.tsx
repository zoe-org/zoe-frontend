import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Search, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MentionDrawer } from "@/components/features/MentionDrawer"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useTenantBrands } from "@/lib/api/brands"
import { useVideosFeed, type VideoFilters, type VideoListItem } from "@/lib/api/videos"
import { tEnum } from "@/i18n/enums"

const SENT_TABS = [
  { key: "", label: "Todos" },
  { key: "Positive", label: "Positivo" },
  { key: "Neutral", label: "Neutro" },
  { key: "Negative", label: "Negativo" },
  { key: "Inconclusive", label: "Indeterminado" },
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

export default function MonitoringPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const brands = useTenantBrands()

  const setParam = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  // Marca ativa: da URL, senão a primeira assinada. Filtros vêm da URL (deep-link).
  const brandList = brands.data?.items ?? []
  const urlBrand = params.get("brand")
  const brandId = urlBrand && brandList.some((b) => b.brandId === urlBrand)
    ? urlBrand
    : brandList[0]?.brandId ?? null

  const sent = params.get("sent") ?? ""
  const period = params.get("period") ?? ""
  const min = params.get("min") ?? ""
  const q = params.get("q") ?? ""

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
  const items = feed.data?.pages.flatMap((p) => p.items) ?? []

  const [selected, setSelected] = useState<VideoListItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const openDrawer = (item: VideoListItem) => { setSelected(item); setDrawerOpen(true) }

  // ── Estados de topo: sem marca / carregando marcas ────────────────────
  if (brands.isLoading) return <PageSkeleton />
  if (brands.isError) return <ErrorState onRetry={() => brands.refetch()} />
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
      <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex-1 max-w-[640px] min-w-[280px]">
            <div className="eyebrow mb-3">Monitoramento · Feed</div>
            <h1 className="font-display m-0" style={{ fontSize: 36, lineHeight: 1.1, color: "var(--ink)" }}>
              Menções analisadas{" "}
              <span style={{ color: "var(--ink-muted-2)" }}>em vídeo, áudio e comentários.</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Seletor de marca (só quando há mais de uma assinada) */}
            {brandList.length > 1 && (
              <Select value={brandId ?? undefined} onValueChange={(v) => setParam("brand", v)}>
                <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {brandList.map((b) => (
                    <SelectItem key={b.brandId} value={b.brandId}>
                      {b.displayName ?? b.brandName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
          </div>
        </div>
      </section>

      {/* Filtros: período + score mínimo */}
      <section className="px-8 py-3 border-b border-border-soft flex flex-wrap items-center gap-3">
        <Select value={period || "all"} onValueChange={(v) => setParam("period", v === "all" ? "" : v)}>
          <SelectTrigger className="h-7 text-[12px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.key || "all"} value={p.key || "all"}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={min || "any"} onValueChange={(v) => setParam("min", v === "any" ? "" : v)}>
          <SelectTrigger className="h-7 text-[12px]"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            {MIN_SCORES.map((m) => (
              <SelectItem key={m.key || "any"} value={m.key || "any"}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Tabs de classificação (filtro server-side) */}
      <section className="px-8 border-b border-border-soft flex items-center gap-1 sticky top-13 z-10" style={{ background: "var(--surface)" }}>
        {SENT_TABS.map((tab) => {
          const active = sent === tab.key
          return (
            <button
              key={tab.key || "all"}
              onClick={() => setParam("sent", tab.key)}
              aria-pressed={active}
              className={`px-3 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-[1px] ${
                active ? "border-teal-500 text-teal-600 dark:text-teal-300" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
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
          {items.map((m) => (
            <button
              key={m.analysisId}
              onClick={() => openDrawer(m)}
              className="grid items-center gap-4 px-8 py-4 border-b border-border-soft w-full text-left cursor-pointer hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
              style={{ gridTemplateColumns: "1fr 200px 150px 90px" }}
            >
              <div className="min-w-0">
                <div className="text-[14px] font-medium truncate mb-0.5" style={{ color: "var(--ink)" }}>
                  {m.title}
                </div>
                <div className="flex items-center gap-2 text-[11.5px] text-ink-muted flex-wrap">
                  <span className="truncate">{m.channelName}</span>
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
          ))}

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

      <MentionDrawer item={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
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
        <div key={i} className="flex items-center gap-4 px-8 py-4 border-b border-border-soft">
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
