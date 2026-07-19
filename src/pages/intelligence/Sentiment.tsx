import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle } from "lucide-react"
import { MultiLine } from "@/components/ui/charts"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useActiveBrand } from "@/features/brands/useActiveBrand"
import { useSentimentEvolution, useTopKeywords } from "@/lib/api/dashboard"

function keywordColor(sentiment: string): string {
  if (sentiment === "Positive") return "var(--color-pos)"
  if (sentiment === "Negative") return "var(--color-neg)"
  return "var(--color-warn)"
}

export default function SentimentPage() {
  const navigate = useNavigate()
  const brand = useActiveBrand()
  const evolution = useSentimentEvolution(brand.brandId)
  const keywords = useTopKeywords(brand.brandId)

  const points = useMemo(() => evolution.data?.points ?? [], [evolution.data])
  const stats = useMemo(() => {
    const totalPos = points.reduce((a, p) => a + p.positive, 0)
    const totalNeu = points.reduce((a, p) => a + p.neutral, 0)
    const totalNeg = points.reduce((a, p) => a + p.negative, 0)
    const total = totalPos + totalNeu + totalNeg || 1
    const net = (totalPos - totalNeg) / total
    return {
      totalPos, totalNeu, totalNeg, total,
      pctPos: Math.round((totalPos / total) * 100),
      pctNeu: Math.round((totalNeu / total) * 100),
      pctNeg: Math.round((totalNeg / total) * 100),
      net,
      netSigned: net >= 0 ? `+${net.toFixed(2)}` : net.toFixed(2),
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
            <div className="eyebrow mb-3">Sentimento · evolução</div>
            <h1 className="font-display m-0" style={{ fontSize: 36, lineHeight: 1.1, color: "var(--ink)" }}>
              Net score{" "}
              <span style={{ color: "var(--color-teal-500)" }}>
                {evolution.isLoading ? "—" : stats.netSigned}
              </span>{" "}
              <span style={{ color: "var(--ink-muted-2)" }}>no período.</span>
            </h1>
          </div>
          {brand.brands.length > 1 && (
            <Select value={brand.brandId ?? undefined} onValueChange={brand.setBrand}>
              <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {brand.brands.map((b) => (
                  <SelectItem key={b.brandId} value={b.brandId}>{b.displayName ?? b.brandName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </section>

      {evolution.isError ? (
        <ErrorState onRetry={() => evolution.refetch()} />
      ) : (
        <>
          {/* Score hero */}
          <section className="grid grid-cols-1 md:grid-cols-3 border-b border-border-soft">
            <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
              <div className="eyebrow mb-2">Net score</div>
              <div className="font-display leading-none" style={{ fontSize: 64, color: "var(--color-teal-500)" }}>
                {evolution.isLoading ? "—" : stats.netSigned}
              </div>
              <div className="text-[12.5px] text-ink-muted mt-2">escala −1 a +1 · {stats.total} menções</div>
            </div>
            <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
              <div className="eyebrow mb-2">Volume total</div>
              <div className="font-display leading-none" style={{ fontSize: 56, color: "var(--ink)" }}>
                {evolution.isLoading ? "—" : stats.total}
              </div>
              <div className="text-[12px] text-ink-muted mt-3">menções no período</div>
            </div>
            <div className="p-7">
              <div className="eyebrow mb-3">Distribuição</div>
              <div className="flex flex-col gap-2.5 mt-1">
                {[
                  { label: "Positivo", pct: stats.pctPos, color: "var(--color-pos)", count: stats.totalPos },
                  { label: "Neutro", pct: stats.pctNeu, color: "#9AA1AE", count: stats.totalNeu },
                  { label: "Negativo", pct: stats.pctNeg, color: "var(--color-neg)", count: stats.totalNeg },
                ].map((d) => (
                  <div key={d.label}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[12.5px] text-ink-2">{d.label}</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono-zoe text-[11.5px] text-ink-muted">{d.count}</span>
                        <span className="font-display" style={{ fontSize: 18, color: d.color }}>{d.pct}%</span>
                      </div>
                    </div>
                    <div className="h-[3px] bg-[#EEF0F2] dark:bg-[#1C1F2E] rounded-sm overflow-hidden">
                      <div style={{ width: `${d.pct}%`, height: "100%", background: d.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Evolução */}
          <section className="p-7 border-b border-border-soft">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="eyebrow">Evolução de sentimento</div>
                <div className="text-[12px] text-ink-muted mt-1">Últimos 30 dias</div>
              </div>
              <div className="flex items-center gap-4 text-[11.5px] text-ink-muted">
                {series.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
            {evolution.isLoading ? (
              <div className="h-[200px] rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
            ) : points.length === 0 ? (
              <div className="py-12 text-center text-sm text-ink-muted">Sem dados de sentimento no período.</div>
            ) : (
              <MultiLine series={series} labels={labels} height={200} />
            )}
          </section>

          {/* Top keywords */}
          <section className="px-8 py-7">
            <div className="mb-5">
              <div className="eyebrow">Palavras e tópicos mais citados</div>
              <div className="text-[12px] text-ink-muted mt-1">Tamanho proporcional ao volume · cor indica sentimento</div>
            </div>
            {keywords.isLoading ? (
              <div className="h-16 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
            ) : (keywords.data?.items.length ?? 0) === 0 ? (
              <div className="text-sm text-ink-muted">Nenhuma palavra-chave no período.</div>
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
