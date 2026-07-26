import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, ArrowUp, ArrowDown } from "lucide-react"
import { MultiLine } from "@/components/ui/charts"
import { EmptyState } from "@/components/ui/empty-state"
import { EmptyBlock } from "@/components/ui/empty-block"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import { useActiveBrand } from "@/features/brands/BrandContext"
import {
  useSentimentEvolution, useTopKeywords, useImpactEvents, useTopicSentiments,
} from "@/lib/api/dashboard"

function keywordColor(sentiment: string): string {
  if (sentiment === "Positive") return "var(--color-pos)"
  if (sentiment === "Negative") return "var(--color-neg)"
  return "var(--color-warn)"
}

// Período do FilterChip. Chave vazia = "todo o período" (days=0 no backend);
// os demais viram o próprio número de dias. Default: 30 dias (o "Último mês" do design).
const PERIOD_OPTIONS = [
  { key: "", label: "Todo o período" },
  { key: "7", label: "Últimos 7 dias" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "90", label: "Últimos 90 dias" },
] as const

export default function SentimentPage() {
  const navigate = useNavigate()
  const brand = useActiveBrand()

  const [period, setPeriod] = useState("30")
  const days = period === "" ? 0 : Number(period)
  const periodLabel = period === "" ? "Todo o período" : `Últimos ${period} dias`

  const evolution = useSentimentEvolution(brand.brandId, days)
  const keywords = useTopKeywords(brand.brandId, days)
  const impact = useImpactEvents(brand.brandId, days)
  const topics = useTopicSentiments(brand.brandId, days)

  const points = useMemo(() => evolution.data?.points ?? [], [evolution.data])
  const stats = useMemo(() => {
    const totalPos = points.reduce((a, p) => a + p.positive, 0)
    const totalNeu = points.reduce((a, p) => a + p.neutral, 0)
    const totalNeg = points.reduce((a, p) => a + p.negative, 0)
    const total = totalPos + totalNeu + totalNeg || 1
    const net = (totalPos - totalNeg) / total

    // Delta "vs período anterior": net da 2ª metade menos net da 1ª metade da
    // janela. Derivado dos próprios pontos — não inventa um comparativo externo.
    const mid = Math.floor(points.length / 2)
    const half = (arr: typeof points) => {
      const p = arr.reduce((a, x) => a + x.positive, 0)
      const n = arr.reduce((a, x) => a + x.negative, 0)
      const t = arr.reduce((a, x) => a + x.positive + x.neutral + x.negative, 0) || 1
      return (p - n) / t
    }
    const delta = points.length >= 4 ? net - half(points.slice(0, mid)) : 0

    return {
      totalPos, totalNeu, totalNeg, total,
      pctPos: Math.round((totalPos / total) * 100),
      pctNeu: Math.round((totalNeu / total) * 100),
      pctNeg: Math.round((totalNeg / total) * 100),
      net,
      netSigned: net >= 0 ? `+${net.toFixed(2)}` : net.toFixed(2),
      delta,
      deltaSigned: delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2),
    }
  }, [points])

  const series = useMemo(() => [
    { name: "Positivo", color: "#16A34A", data: points.map((p) => p.positive) },
    { name: "Neutro", color: "#9AA1AE", data: points.map((p) => p.neutral) },
    { name: "Negativo", color: "#DC2626", data: points.map((p) => p.negative) },
  ], [points])

  const labels = useMemo(
    () => points.map((p, i) => (i % 5 === 0 ? p.date.slice(5).replace("-", "/") : "")),
    [points],
  )

  const maxKw = keywords.data?.items[0]?.volume ?? 1

  // ── Estados de topo ───────────────────────────────────────────────────
  if (brand.isLoading) return <PageSkeleton />
  if (brand.isError) return <ErrorState onRetry={() => brand.refetch()} />
  if (brand.brands.length === 0) {
    return (
      <EmptyState
        title="Nenhuma marca assinada ainda"
        description="Assine uma marca para ver a evolução de sentimento."
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
          <div className="flex-1 max-w-160 min-w-70">
            <div className="eyebrow mb-3">Intelligence · Análise</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Sentimento
            </h1>
            {/* O design traz "NPS calculado · BERT-pt" aqui; trocado por números
                reais — não calculamos NPS nem usamos BERT-pt no pipeline. */}
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              Análise de sentimento ao longo do tempo e por tópico.{" "}
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                {stats.total} {stats.total === 1 ? "menção" : "menções"}
              </span>{" "}
              · <span className="font-mono-zoe">{periodLabel.toLowerCase()}</span>.
            </div>
          </div>
        </div>

        {/* Filtro de período (o "Todas marcas"/"Semanal" do design ficaram de fora
            — marca é global e não temos agregação semanal). */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <SelectFilterChip
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            placeholder="Todo o período"
          />
        </div>
      </section>

      {evolution.isError ? (
        <ErrorState onRetry={() => evolution.refetch()} />
      ) : (
        <>
          {/* Score hero — 3 colunas (design) */}
          <section className="grid grid-cols-1 md:grid-cols-3 border-b border-border-soft">
            <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
              <div className="eyebrow mb-2.5">Net sentiment score</div>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="font-display leading-none" style={{ fontSize: 64, color: "var(--color-teal-500)" }}>
                  {evolution.isLoading ? "—" : stats.netSigned}
                </span>
                {!evolution.isLoading && points.length >= 4 && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11.5px] font-medium ${
                      stats.delta >= 0 ? "text-[#16A34A] bg-[#F0FDF4]" : "text-[#DC2626] bg-[#FEF2F2]"
                    }`}
                  >
                    {stats.delta >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {stats.deltaSigned} vs. início
                  </span>
                )}
              </div>
              <div className="text-[12px] text-ink-muted mt-2.5 leading-relaxed max-w-[280px]">
                Saldo entre menções positivas e negativas. Escala{" "}
                <span className="font-mono-zoe">−1,00</span> a <span className="font-mono-zoe">+1,00</span>.
              </div>
            </div>
            <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
              <div className="eyebrow mb-2.5">Volume analisado</div>
              <div className="font-display leading-none" style={{ fontSize: 56, color: "var(--ink)" }}>
                {evolution.isLoading ? "—" : stats.total}
              </div>
              <div className="text-[12.5px] text-ink-muted mt-2.5">menções no período</div>
            </div>
            <div className="p-7">
              <div className="eyebrow mb-3.5">Distribuição</div>
              <div className="flex flex-col gap-3">
                {[
                  { label: "Positivo", pct: stats.pctPos, color: "var(--color-pos)", count: stats.totalPos },
                  { label: "Neutro", pct: stats.pctNeu, color: "#9AA1AE", count: stats.totalNeu },
                  { label: "Negativo", pct: stats.pctNeg, color: "var(--color-neg)", count: stats.totalNeg },
                ].map((d) => (
                  <div key={d.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[13px] font-medium" style={{ color: d.color }}>{d.label}</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono-zoe text-[11.5px] text-ink-muted">{d.count}</span>
                        <span className="font-mono-zoe text-[12px] text-ink-2">{d.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-[#EEF0F2] dark:bg-[#1C1F2E] rounded-full overflow-hidden">
                      <div style={{ width: `${d.pct}%`, height: "100%", background: d.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Evolução + Eventos de impacto — 2 colunas (design) */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] border-b border-border-soft">
            <div className="p-7 border-b lg:border-b-0 lg:border-r border-border-soft">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="eyebrow">Evolução de sentimento</div>
                  <div className="text-[12px] text-ink-muted mt-1">{periodLabel}</div>
                </div>
                <div className="flex items-center gap-3 text-[11.5px] text-ink-muted flex-wrap justify-end">
                  {series.map((s) => (
                    <span key={s.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
              {evolution.isLoading ? (
                <div className="h-[200px] rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
              ) : stats.total === 0 ? (
                <EmptyBlock
                  className="h-[200px] justify-center"
                  message="Sem menções no período"
                  hint="A linha do tempo aparece quando houver vídeos analisados para esta marca."
                />
              ) : (
                <MultiLine series={series} labels={labels} height={200} />
              )}
            </div>

            {/* Eventos de impacto */}
            <div className="p-7">
              <div className="mb-4">
                <div className="eyebrow">Eventos de impacto</div>
                <div className="text-[12px] text-ink-muted mt-1">Menções que mais moveram o score</div>
              </div>
              {impact.isLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-10 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
                  ))}
                </div>
              ) : (impact.data?.items?.length ?? 0) === 0 ? (
                <EmptyBlock message="Sem eventos de impacto no período." />
              ) : (
                <div>
                  {(impact.data?.items ?? []).slice(0, 5).map((ev, i) => (
                    <button
                      key={ev.analysisId}
                      onClick={() => navigate("/intelligence/monitoring")}
                      className={`grid items-center gap-3 py-3 w-full text-left ${i > 0 ? "border-t border-border-soft" : ""}`}
                      style={{ gridTemplateColumns: "58px 1fr auto" }}
                    >
                      <span className="font-mono-zoe text-[11px] text-ink-muted">
                        {ev.date.slice(5).replace("-", "/")}
                      </span>
                      <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                        {ev.title}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium font-mono-zoe ${
                          ev.delta >= 0 ? "text-[#16A34A] bg-[#F0FDF4]" : "text-[#DC2626] bg-[#FEF2F2]"
                        }`}
                      >
                        {ev.delta >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                        {ev.delta >= 0 ? "+" : ""}{ev.delta.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Sentimento por tópico (design) */}
          <section className="px-8 py-7 border-b border-border-soft">
            <div className="mb-5">
              <div className="eyebrow">Sentimento por tópico</div>
              <div className="text-[12px] text-ink-muted mt-1">Tópicos extraídos das menções · distribuição de sentimento</div>
            </div>
            {topics.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
                ))}
              </div>
            ) : (topics.data?.items?.length ?? 0) === 0 ? (
              <EmptyBlock
                message="Nenhum tópico no período"
                hint="Os tópicos são extraídos por IA das menções analisadas — aparecem quando houver vídeos processados."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(topics.data?.items ?? []).map((t) => (
                  <div key={t.label} className="p-4.5 rounded-xl border border-border-soft bg-[#FAFBFC] dark:bg-[#181B28]">
                    <div className="flex items-start justify-between mb-3.5">
                      <div>
                        <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{t.label}</div>
                        <div className="font-mono-zoe text-[10.5px] text-ink-muted uppercase mt-0.5">{t.volume} menções</div>
                      </div>
                      {t.pos >= 70 && <span className="chip chip-pos text-[10.5px]">Forte</span>}
                      {t.pos < 50 && <span className="chip chip-neg text-[10.5px]">Atenção</span>}
                    </div>
                    {/* Barra empilhada pos/neu/neg (não há StackedBar nos charts). */}
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div style={{ width: `${t.pos}%`, background: "var(--color-pos)" }} />
                      <div style={{ width: `${t.neu}%`, background: "#9AA1AE" }} />
                      <div style={{ width: `${t.neg}%`, background: "var(--color-neg)" }} />
                    </div>
                    <div className="flex justify-between mt-2.5 text-[11px] font-mono-zoe">
                      <span className="font-medium" style={{ color: "var(--color-pos)" }}>{t.pos}%</span>
                      <span className="text-ink-muted">{t.neu}%</span>
                      <span className="font-medium" style={{ color: "var(--color-neg)" }}>{t.neg}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Termos em destaque */}
          <section className="px-8 py-7">
            <div className="mb-5">
              <div className="eyebrow">Termos em destaque</div>
              <div className="text-[12px] text-ink-muted mt-1">Tamanho proporcional ao volume · cor indica sentimento</div>
            </div>
            {keywords.isLoading ? (
              <div className="h-16 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
            ) : (keywords.data?.items.length ?? 0) === 0 ? (
              <EmptyBlock message="Nenhum termo no período." />
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
                {keywords.data!.items.map((k) => (
                  <span
                    key={k.keyword}
                    className="font-display transition-opacity hover:opacity-80"
                    style={{
                      fontSize: 16 + (k.volume / maxKw) * 20,
                      fontWeight: 500 + Math.round((k.volume / maxKw) * 2) * 100,
                      color: keywordColor(k.sentiment),
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {k.keyword}
                  </span>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
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
      <div className="p-7"><div className="h-[200px] rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" /></div>
    </div>
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
