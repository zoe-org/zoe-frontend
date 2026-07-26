import { useMemo, useState } from "react"
import { Lock, AlertCircle, Sparkles, Download, ArrowUp, ArrowDown } from "lucide-react"
import { MultiLine } from "@/components/ui/charts"
import { EmptyBlock } from "@/components/ui/empty-block"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import { useFeature } from "@/features/auth/useFeature"
import {
  useShareOfVoice, useSovTrend, useSovByTopic,
  type SovTopicShare,
} from "@/lib/api/dashboard"
import { ApiError } from "@/lib/api"
import { toCsv, downloadCsv } from "@/lib/csv"

const PERIOD_OPTIONS = [
  { key: "", label: "Todo o período" },
  { key: "7", label: "Últimos 7 dias" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "90", label: "Últimos 90 dias" },
] as const

// Cor por marca: a escolhida pelo tenant, ou uma derivada determinística do id.
function brandColor(id: string, color: string | null): string {
  if (color) return color
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return `hsl(${Math.abs(h) % 360}, 55%, 55%)`
}

export default function SovPage() {
  const hasSov = useFeature("sov")

  const [period, setPeriod] = useState("90")
  const days = period === "" ? 0 : Number(period)
  const periodLabel = period === "" ? "Todo o período" : `Últimos ${period} dias`

  const sov = useShareOfVoice(hasSov, days)
  const trend = useSovTrend(hasSov, 12)
  const topics = useSovByTopic(hasSov, days)

  const brands = useMemo(() => sov.data?.brands ?? [], [sov.data])
  const competitors = brands.filter((b) => !b.isYou).length

  // Sem a feature → upsell. O backend também retorna 403 (defesa: a UI não depende
  // só de si), caindo no mesmo upsell.
  const forbidden = sov.error instanceof ApiError && sov.error.status === 403
  if (!hasSov || forbidden) return <UpsellScreen />

  const you = brands.find((b) => b.isYou)
  const yourRank = you ? brands.findIndex((b) => b.brandId === you.brandId) + 1 : null
  const topGain = [...brands].sort((a, b) => b.deltaPp - a.deltaPp)[0]
  const topDrop = [...brands].sort((a, b) => a.deltaPp - b.deltaPp)[0]
  const maxPct = brands[0]?.sharePct ?? 100

  const exportCsv = () => {
    if (brands.length === 0) return
    const csv = toCsv(brands, [
      { header: "Marca", value: (b) => b.brandName },
      { header: "Você", value: (b) => (b.isYou ? "sim" : "") },
      { header: "Menções", value: (b) => b.mentions },
      { header: "Share (%)", value: (b) => b.sharePct },
      { header: "Delta (pp)", value: (b) => b.deltaPp },
    ])
    downloadCsv(`zoe-share-of-voice-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      {/* Hero */}
      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-160 min-w-70">
            <div className="eyebrow mb-2.5">Intelligence · Competitivo</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Share of Voice
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              Sua participação nas conversas do setor frente aos concorrentes monitorados, em vídeo.
            </div>
          </div>
          <button
            onClick={exportCsv}
            disabled={brands.length === 0}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <SelectFilterChip value={period} onChange={setPeriod} options={PERIOD_OPTIONS} placeholder="Todo o período" />
          <span className="chip text-[12px]">
            <span className="font-mono-zoe">{competitors}</span> {competitors === 1 ? "concorrente" : "concorrentes"}
          </span>
        </div>
      </section>

      {sov.isError && !forbidden ? (
        <ErrorState onRetry={() => sov.refetch()} />
      ) : sov.isLoading ? (
        <BarsSkeleton />
      ) : brands.length === 0 ? (
        <EmptyBlock className="py-20" message="Ainda não há dados de share of voice" hint="Assine marcas concorrentes e aguarde o pipeline analisar menções para comparar." />
      ) : (
        <>
          {/* Leaderboard: Ranking atual + Sua posição */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 px-8 py-7 border-b border-border-soft">
            <div>
              <div className="eyebrow mb-4">Ranking atual</div>
              <div className="flex flex-col gap-4">
                {brands.map((b, i) => {
                  const c = brandColor(b.brandId, b.color)
                  return (
                    <div key={b.brandId}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono-zoe text-[11px] text-ink-muted-2 w-4">{i + 1}</span>
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: c }} />
                          <span className="text-[13.5px] truncate" style={{ fontWeight: b.isYou ? 700 : 500, color: "var(--ink)" }}>
                            {b.brandName}
                          </span>
                          {b.isYou && <span className="chip chip-primary text-[10px] px-1.5 py-px">VOCÊ</span>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-display" style={{ fontSize: 19, color: c }}>{b.sharePct}%</span>
                          <DeltaPp value={b.deltaPp} />
                        </div>
                      </div>
                      <div className="h-2 bg-[#F3F4F6] dark:bg-[#1C1F2E] rounded-sm overflow-hidden">
                        <div style={{ width: `${maxPct ? Math.round((b.sharePct / maxPct) * 100) : 0}%`, height: "100%", background: c, transition: "width .5s" }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="eyebrow mb-4">Sua posição</div>
              {you ? (
                <>
                  <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                    <span className="font-display" style={{ fontSize: 56, lineHeight: 1, color: "var(--color-teal-500)" }}>
                      #{yourRank}
                    </span>
                    <DeltaPp value={you.deltaPp} suffix={` em ${periodLabel.toLowerCase()}`} big />
                  </div>
                  <p className="text-[13px] text-ink-muted leading-relaxed mb-5 max-w-md">
                    {you.brandName} tem <strong style={{ color: "var(--ink)" }}>{you.sharePct}% de SoV</strong>{" "}
                    entre {brands.length} {brands.length === 1 ? "marca" : "marcas"} monitoradas
                    {yourRank === 1 ? ", liderando as conversas do setor." : `, na ${yourRank}ª posição.`}
                  </p>
                  <div className="grid grid-cols-2 gap-4 max-w-sm">
                    <div>
                      <div className="eyebrow">Maior avanço</div>
                      <div className="text-[13.5px] font-semibold mt-1" style={{ color: "var(--color-pos)" }}>
                        {topGain && topGain.deltaPp > 0 ? `${topGain.brandName} +${topGain.deltaPp}pp` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="eyebrow">Maior queda</div>
                      <div className="text-[13.5px] font-semibold mt-1" style={{ color: "var(--color-neg)" }}>
                        {topDrop && topDrop.deltaPp < 0 ? `${topDrop.brandName} ${topDrop.deltaPp}pp` : "—"}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-ink-muted">
                  Nenhuma marca própria (OwnBrand) assinada. Marque uma das suas marcas como "própria" para ver sua posição.
                </p>
              )}
            </div>
          </section>

          {/* Evolução do SoV */}
          <section className="px-7 py-6 border-b border-border-soft">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="eyebrow">Evolução do SoV</div>
                <div className="text-[12px] text-ink-muted mt-1">Últimas 12 semanas</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {(trend.data?.series ?? []).map((s) => (
                  <span key={s.brandId} className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                    <span className="w-2.5 h-0.5 rounded-full" style={{ background: brandColor(s.brandId, s.color) }} />
                    {s.brandName}
                  </span>
                ))}
              </div>
            </div>
            {trend.isLoading ? (
              <div className="h-[200px] rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
            ) : (trend.data?.series.length ?? 0) === 0 ? (
              <EmptyBlock className="h-[200px] justify-center" message="Sem dados no período" />
            ) : (
              <MultiLine
                height={200}
                labels={trend.data!.weeks.map((w, i) => (i % 2 === 0 ? w : ""))}
                series={trend.data!.series.map((s) => ({
                  name: s.brandName,
                  color: brandColor(s.brandId, s.color),
                  data: s.data,
                }))}
              />
            )}
          </section>

          {/* SoV por tópico (por plataforma fica de fora: só temos YouTube) */}
          <section className="px-7 py-6">
            <div className="eyebrow mb-4">SoV por tópico</div>
            {topics.isLoading ? (
              <div className="space-y-4 animate-pulse">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
              </div>
            ) : (topics.data?.topics.length ?? 0) === 0 ? (
              <EmptyBlock message="Nenhum tópico no período" hint="Os tópicos vêm da análise de IA das menções — aparecem quando houver vídeos processados." />
            ) : (
              <div className="flex flex-col gap-3.5 max-w-3xl">
                {topics.data!.topics.map((t) => {
                  const leader = t.shares.reduce<SovTopicShare | null>(
                    (a, s) => (a && a.sharePct >= s.sharePct ? a : s), null,
                  )
                  return (
                    <div key={t.topic}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px]" style={{ color: "var(--ink)" }}>{t.topic}</span>
                        {leader && (
                          <span
                            className="chip text-[10px]"
                            style={{ background: `${brandColor(leader.brandId, leader.color)}18`, color: brandColor(leader.brandId, leader.color) }}
                          >
                            líder: {leader.brandName}
                          </span>
                        )}
                      </div>
                      <div className="flex h-2.5 rounded-sm overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
                        {t.shares.map((s) => (
                          <div
                            key={s.brandId}
                            title={`${s.brandName}: ${s.sharePct}%`}
                            style={{ width: `${s.sharePct}%`, background: brandColor(s.brandId, s.color) }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function DeltaPp({ value, suffix, big }: { value: number; suffix?: string; big?: boolean }) {
  if (value === 0) {
    return <span className={`text-ink-muted-2 font-mono-zoe ${big ? "text-[12px]" : "text-[11.5px]"}`}>—</span>
  }
  const up = value > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-medium ${big ? "px-2 py-0.5 rounded text-[11.5px]" : "text-[11.5px]"}`}
      style={big ? { background: up ? "var(--pos-bg)" : "var(--neg-bg)", color: up ? "var(--color-pos)" : "var(--color-neg)" } : { color: up ? "var(--color-pos)" : "var(--color-neg)" }}
    >
      {up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {up ? "+" : ""}{value}pp{suffix}
    </span>
  )
}

// ── Upsell (estado premium, não erro) ─────────────────────────────────────

function UpsellScreen() {
  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <div className="flex flex-col items-center justify-center text-center px-6 py-24 max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--color-teal-50)" }}>
          <Lock className="w-6 h-6" style={{ color: "var(--color-teal-500)" }} />
        </div>
        <div className="eyebrow mb-3">Recurso premium</div>
        <h1 className="font-display m-0 mb-3" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
          Share of Voice
        </h1>
        <p className="text-[14px] text-ink-muted mb-6 max-w-md">
          Compare a fatia de voz da sua marca com a dos concorrentes e acompanhe a evolução ao
          longo do tempo. Ative o add-on em Configurações · Add-ons.
        </p>
        <a
          href="mailto:contato@heyzoe.com.br?subject=Habilitar%20Share%20of%20Voice"
          className="inline-flex items-center gap-1.5 h-10 px-5 text-[13.5px] font-medium rounded-md text-white transition-colors"
          style={{ background: "var(--color-ember)" }}
        >
          <Sparkles className="w-4 h-4" /> Falar com o time
        </a>
      </div>
    </div>
  )
}

function BarsSkeleton() {
  return (
    <section className="px-8 py-7 animate-pulse">
      <div className="flex flex-col gap-4 max-w-3xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 w-40 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
            <div className="h-2 w-full rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          </div>
        ))}
      </div>
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
