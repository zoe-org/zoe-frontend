import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Search, AlertCircle, List, LayoutGrid, Download } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MentionDrawer } from "@/components/features/MentionDrawer"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { coverageSaysOwnedContent } from "@/components/ui/coverage-labels"
import { VideoThumb } from "@/components/ui/video-thumb"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import { useActiveBrand } from "@/features/brands/context"
import { toCsv, downloadCsv } from "@/lib/csv"
import { startOfToday, windowFrom } from "@/lib/date-window"
import {
  useVideosFeed,
  useVideosSummary,
  hasSelfMeasuredScore,
  parseChannelRelation,
  type VideoFilters,
  type VideoListItem,
  type VideoSort,
} from "@/lib/api/videos"
import { tEnum } from "@/i18n/enums"
import { classificationChip } from "@/lib/chip"

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

// ADR-035, D4. Filtro de VIEW: vive na URL como os demais, some quando o usuário
// sai. NÃO existe equivalente em /configuracoes de propósito — flag persistida
// faria a mesma marca ter dois SoVs dependendo de quem olha, quebraria a série
// temporal no dia em que alguém virasse a chave, e tornaria incomparáveis
// relatórios exportados em datas diferentes.
const CHANNEL_RELATIONS = [
  { key: "", label: "Terceiros" },
  { key: "owned", label: "Meu conteúdo" },
  { key: "all", label: "Tudo" },
] as const

const MIN_SCORES = [
  { key: "", label: "Qualquer score" },
  { key: "0.5", label: "Score ≥ 0,50" },
  { key: "0.7", label: "Score ≥ 0,70" },
] as const

// Ordenação do feed (keyset-safe no backend). "Mais vistos" fica de fora por ora
// — views vem de subquery e paginar keyset sobre ela é frágil.
const SORT_OPTIONS = [
  { key: "", label: "Mais recentes" },
  { key: "oldest", label: "Mais antigos" },
  { key: "score", label: "Maior score" },
] as const

/**
 * Score exibido na listagem. Em vídeo owned pelo path pesado o número existe mas
 * não é leitura de audiência (doc 05 §4.1) — exibi-lo ao lado dos earned convida
 * a comparação que a ADR-035 existe pra impedir. O badge ao lado explica.
 */
function scoreLabel(m: VideoListItem): string {
  if (hasSelfMeasuredScore(m)) return "—"
  return m.score != null ? m.score.toFixed(2) : "—"
}

/** Marca visual do conteúdo próprio na listagem (doc 05 §2). */
function OwnedTag() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ color: "var(--teal-fg)", background: "var(--teal-bg)" }}
    >
      Conteúdo próprio
    </span>
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
  const sort = (params.get("sort") ?? "") as VideoSort
  // "" na URL = earned (o default). Manter o default fora da URL deixa o link
  // limpo no caso comum e explícito quando o usuário mudou de propósito.
  const rel = params.get("rel") ?? ""
  // Fallback em earned pra qualquer coisa que não seja "owned"/"all" — ver
  // parseChannelRelation. URL é compartilhável; valor inválido não pode virar "all".
  const channelRelation = parseChannelRelation(rel)
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

  // Mesma âncora de dia das telas owned: janela estável e igual entre usuários.
  const [anchor] = useState(startOfToday)

  const filters: VideoFilters | null = useMemo(() => {
    if (!brandId) return null
    const from = windowFrom(period, anchor)
    return {
      brandId,
      classificacao: sent || undefined,
      search: q || undefined,
      from,
      minScore: min ? Number(min) : undefined,
      sort: sort || undefined,
      channelRelation,
    }
  }, [brandId, sent, q, period, min, sort, channelRelation, anchor])

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
      { header: "Comentários analisados", value: (m) => m.commentsCount ?? "" },
      { header: "Classificação", value: (m) => (m.classificacao ? tEnum("classification", m.classificacao) : "") },
      // Score vazio em owned pelo path pesado, pelo mesmo motivo da tela: o número
      // não mede audiência, e numa planilha ele perde o badge que explicava isso.
      { header: "Score", value: (m) => (hasSelfMeasuredScore(m) || m.score == null ? "" : m.score.toFixed(2)) },
      { header: "Confiança", value: (m) => (m.confidence != null ? m.confidence.toFixed(2) : "") },
      { header: "Cobertura", value: (m) => tEnum("pipelinePath", m.pipelinePath) },
      // Coluna explícita: exportação que mistura owned e earned sem declarar qual
      // é qual é a forma mais fácil de a distinção se perder fora do produto.
      { header: "Origem", value: (m) => tEnum("channelRelation", m.channelRelation) },
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
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Monitoramento
            </h1>
            {summary.data && (
              <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
                Feed completo de menções detectadas em vídeo.{" "}
                <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                  {summary.data.total} {summary.data.total === 1 ? "item" : "itens"}
                </span>
                {period ? ` nos últimos ${period} dias` : " no período"}.
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
        <SelectFilterChip
          value={period} onChange={(v) => setParam("period", v)}
          options={PERIODS} placeholder="Todo o período"
        />
        <SelectFilterChip
          value={min} onChange={(v) => setParam("min", v)}
          options={MIN_SCORES} placeholder="Qualquer score"
        />
        <SelectFilterChip
          value={rel} onChange={(v) => setParam("rel", v)}
          options={CHANNEL_RELATIONS} placeholder="Terceiros"
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

        <div className="flex items-center gap-3 shrink-0">
          {/* Ordenar (design: "Ordenar: Mais recentes ▾") */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-muted">Ordenar:</span>
            <SelectFilterChip
              value={sort}
              onChange={(v) => setParam("sort", v)}
              options={SORT_OPTIONS}
              placeholder="Mais recentes"
            />
          </div>

          {/* Lista ↔ grade: com thumbnail, a grade vira uma leitura visual rápida. */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border-soft">
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
                      <span className={`absolute top-2 left-2 ${classificationChip(m.classificacao)}`}>
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
                      {/* Comentários ANALISADOS. Sem agregado (ou zero) não mostra
                          nada: "0 comentários" é ruído, não informação. */}
                      {m.commentsCount != null && m.commentsCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="font-mono-zoe shrink-0">{compactNumber(m.commentsCount)} coment.</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="shrink-0">
                        {formatDistanceToNow(new Date(m.publishedAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <ConfidenceBadge
                        pipelinePath={m.pipelinePath}
                        confidence={m.confidence}
                        selfMeasured={hasSelfMeasuredScore(m)}
                      />
                      <span className="font-mono-zoe text-[12px] shrink-0" style={{ color: "var(--ink)" }}>
                        {scoreLabel(m)}
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
                    {m.commentsCount != null && m.commentsCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="font-mono-zoe">
                          {compactNumber(m.commentsCount)} {m.commentsCount === 1 ? "comentário" : "comentários"}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(m.publishedAt), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ConfidenceBadge
                    pipelinePath={m.pipelinePath}
                    confidence={m.confidence}
                    selfMeasured={hasSelfMeasuredScore(m)}
                  />
                  {/* Dois selos, duas perguntas: cobertura ("como foi analisado") e
                      origem ("de quem é o canal"). Em vídeo owned os dois caíam no
                      mesmo texto e a etiqueta aparecia repetida — quem cede é a
                      origem, porque o de cobertura carrega o tooltip. */}
                  {m.channelRelation === "Owned"
                    && !coverageSaysOwnedContent(m.pipelinePath, hasSelfMeasuredScore(m))
                    && <OwnedTag />}
                </div>
                <div>
                  {m.classificacao && (
                    <span className={classificationChip(m.classificacao)}>
                      {tEnum("classification", m.classificacao)}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono-zoe text-[13px]" style={{ color: "var(--ink)" }}>
                    {scoreLabel(m)}
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
                {feed.isFetchingNextPage ? "Carregando..." : "Carregar mais menções"}
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
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
