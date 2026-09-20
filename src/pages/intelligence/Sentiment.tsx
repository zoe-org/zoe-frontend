import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertCircle, ArrowUp, ArrowDown, ArrowUpRight } from "lucide-react"
import { NetLine, type NetPoint } from "@/components/ui/charts"
import { CountUp } from "@/components/ui/count-up"
import { EmptyState } from "@/components/ui/empty-state"
import { EmptyBlock } from "@/components/ui/empty-block"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import { useActiveBrand } from "@/features/brands/context"
import { CoverageNotice } from "@/components/coverage/CoverageNotice"
import { brandVoice } from "@/features/brands/voice"
import {
  useSentimentEvolution, useTopKeywords, useImpactEvents, useTopicSentiments,
  type SentimentPoint,
} from "@/lib/api/dashboard"
import { deltaChip } from "@/lib/chip"
import { formatScoreDelta } from "@/lib/score"
import { stagger } from "@/lib/motion"

function keywordColor(sentiment: string): string {
  if (sentiment === "Positive") return "var(--color-pos)"
  if (sentiment === "Negative") return "var(--color-neg)"
  return "var(--ink-muted-2)"
}

// Período do FilterChip. Chave vazia = "todo o período" (days=0 no backend);
// os demais viram o próprio número de dias. Default: 30 dias.
const PERIOD_OPTIONS = [
  { key: "", label: "Todo o período" },
  { key: "7", label: "Últimos 7 dias" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "90", label: "Últimos 90 dias" },
] as const

const nf = new Intl.NumberFormat("pt-BR")

/** Saldo de um conjunto de dias: (positivas − negativas) ÷ total. Null sem menção. */
function netOf(points: SentimentPoint[]): number | null {
  const pos = points.reduce((a, p) => a + p.positive, 0)
  const neg = points.reduce((a, p) => a + p.negative, 0)
  const total = points.reduce((a, p) => a + p.positive + p.neutral + p.negative, 0)
  return total === 0 ? null : (pos - neg) / total
}

/** Como o saldo se lê em português. Cinco faixas, para não chamar 0,05 de "positivo". */
function leituraDoSaldo(net: number): string {
  if (net >= 0.5) return "bem mais positivo que negativo"
  if (net >= 0.2) return "mais positivo que negativo"
  if (net > -0.2) return "dividido entre positivo e negativo"
  if (net > -0.5) return "mais negativo que positivo"
  return "bem mais negativo que positivo"
}

export default function SentimentPage() {
  const navigate = useNavigate()
  const brand = useActiveBrand()

  const [period, setPeriod] = useState("30")
  const days = period === "" ? 0 : Number(period)
  const periodLabel = period === "" ? "todo o período" : `últimos ${period} dias`

  const evolution = useSentimentEvolution(brand.brandId, days)
  // Janela dobrada só para ter o período ANTERIOR de verdade. Antes a tela
  // comparava a 2ª metade da janela com a 1ª e chamava isso de "vs. início".
  const wide = useSentimentEvolution(brand.brandId, days > 0 ? days * 2 : 0)
  const keywords = useTopKeywords(brand.brandId, days)
  const impact = useImpactEvents(brand.brandId, days)
  const topics = useTopicSentiments(brand.brandId, days)

  const points = useMemo(() => evolution.data?.points ?? [], [evolution.data])

  const stats = useMemo(() => {
    const totalPos = points.reduce((a, p) => a + p.positive, 0)
    const totalNeu = points.reduce((a, p) => a + p.neutral, 0)
    const totalNeg = points.reduce((a, p) => a + p.negative, 0)
    const total = totalPos + totalNeu + totalNeg
    const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))
    return {
      totalPos, totalNeu, totalNeg, total,
      pctPos: pct(totalPos), pctNeu: pct(totalNeu), pctNeg: pct(totalNeg),
      net: netOf(points) ?? 0,
    }
  }, [points])

  /** Período anterior de mesmo tamanho, recortado por data dentro da janela dobrada. */
  const anterior = useMemo(() => {
    if (days === 0) return null
    const todos = wide.data?.points ?? []
    if (todos.length === 0) return null
    const corte = new Date()
    corte.setDate(corte.getDate() - days)
    const iso = corte.toISOString().slice(0, 10)
    const antes = todos.filter((p) => p.date < iso)
    const net = netOf(antes)
    return net == null ? null : { net, delta: stats.net - net }
  }, [wide.data, days, stats.net])

  /**
   * Saldo por dia + média móvel. A janela é menor em períodos curtos, senão a
   * média de 7 dias engoliria uma janela de 7.
   */
  const janela = days > 0 && days <= 7 ? 3 : 7
  const netSeries = useMemo<NetPoint[]>(() => {
    return points.map((p, i) => {
      const dia = p.positive + p.neutral + p.negative
      const desde = Math.max(0, i - janela + 1)
      const fatia = points.slice(desde, i + 1)
      return {
        label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`,
        net: dia === 0 ? null : (p.positive - p.negative) / dia,
        avg: netOf(fatia) ?? 0,
        total: dia,
      }
    })
  }, [points, janela])

  const maxKw = keywords.data?.items[0]?.volume ?? 1
  const topicos = useMemo(
    () => [...(topics.data?.items ?? [])].sort((a, b) => b.volume - a.volume),
    [topics.data],
  )

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

  const nomeMarca = brand.active?.displayName ?? brand.active?.brandName ?? "a marca"
  const carregando = evolution.isLoading

  return (
    <div className="-m-6" style={{ color: "var(--ink)" }}>
      {/* Abertura: a leitura do saldo em uma frase, antes de qualquer gráfico. */}
      <section className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 max-w-180 min-w-70">
            <div className="eyebrow mb-3">Intelligence · Análise</div>
            <h1 className="font-display m-0 text-ink" style={{ fontSize: 34, lineHeight: 1.1 }}>
              Sentimento
            </h1>
            {carregando ? (
              <div className="h-4 w-[30rem] max-w-full rounded z-skeleton mt-3" />
            ) : stats.total === 0 ? (
              <p className="text-[14.5px] text-ink-muted mt-2.5 max-w-150">
                Nenhuma menção de terceiros a {nomeMarca} nos {periodLabel}. O saldo aparece
                quando houver vídeos analisados no período.
              </p>
            ) : (
              <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 max-w-150">
                Nos {periodLabel}, o que dizem de {nomeMarca} está{" "}
                <span className="text-ink font-medium">{leituraDoSaldo(stats.net)}</span>:{" "}
                {stats.pctPos}% das {nf.format(stats.total)} menções são positivas e {stats.pctNeg}% negativas.
                {anterior && (
                  <>
                    {" "}O saldo{" "}
                    {Math.abs(anterior.delta) < 0.02
                      ? "está estável em relação ao período anterior"
                      : `${anterior.delta > 0 ? "subiu" : "caiu"} ${formatScoreDelta(Math.abs(anterior.delta)).replace("+", "")} contra o período anterior`}
                    .
                  </>
                )}
              </p>
            )}
            <EarnedOnlyNote />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SelectFilterChip
              value={period}
              onChange={setPeriod}
              options={PERIOD_OPTIONS}
              placeholder="Todo o período"
            />
          </div>
        </div>
      </section>

      <CoverageNotice tenantBrandIds={[brand.active?.tenantBrandId]} className="mx-8 mt-4" />

      {evolution.isError ? (
        <ErrorState onRetry={() => evolution.refetch()} />
      ) : (
        <>
          {/* Faixa de números */}
          <section className="grid grid-cols-2 xl:grid-cols-4 border-b border-border-soft">
            <Cell i={0} label="Saldo do período" className="border-r border-b xl:border-b-0">
              {carregando ? (
                <div className="h-10 w-28 rounded z-skeleton" />
              ) : (
                <>
                  <span className="font-display leading-none" style={{ fontSize: 40, color: netColor(stats.net) }}>
                    <CountUp value={stats.net} format={(n) => formatScoreDelta(n)} />
                  </span>
                  <NetRuler value={stats.net} />
                </>
              )}
              <p className="text-[11.5px] text-ink-muted mt-3 leading-snug">
                Positivas menos negativas, dividido pelo total. Vai de −1,00 a +1,00.
              </p>
            </Cell>

            <Cell i={1} label="Contra o período anterior" className="xl:border-r border-b xl:border-b-0">
              {carregando ? (
                <div className="h-10 w-24 rounded z-skeleton" />
              ) : anterior == null ? (
                <>
                  <span className="font-display leading-none text-ink-muted-2" style={{ fontSize: 40 }}>—</span>
                  <p className="text-[11.5px] text-ink-muted mt-3 leading-snug">
                    {days === 0
                      ? "Escolha um período para comparar com o anterior."
                      : "Ainda não há histórico suficiente antes deste período."}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="font-display leading-none" style={{ fontSize: 40, color: netColor(anterior.delta) }}>
                      {formatScoreDelta(anterior.delta)}
                    </span>
                    {/* Sem seta quando a variação arredonda para zero: a seta afirmaria
                        uma direção que o número exibido não mostra. */}
                    {Math.abs(anterior.delta) >= 0.005 ? (
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center z-fade"
                        style={{
                          background: anterior.delta > 0 ? "var(--pos-bg)" : "var(--neg-bg)",
                          color: netColor(anterior.delta),
                        }}
                      >
                        {anterior.delta > 0 ? <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.5} /> : <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.5} />}
                      </span>
                    ) : (
                      <span className="chip">estável</span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-ink-muted mt-3 leading-snug">
                    De <span className="font-mono-zoe">{formatScoreDelta(anterior.net)}</span> para{" "}
                    <span className="font-mono-zoe">{formatScoreDelta(stats.net)}</span>, comparando janelas de{" "}
                    {days} dias.
                  </p>
                </>
              )}
            </Cell>

            <Cell i={2} label="Menções analisadas" className="border-r">
              {carregando ? (
                <div className="h-10 w-20 rounded z-skeleton" />
              ) : (
                <span className="font-display leading-none text-ink" style={{ fontSize: 40 }}>
                  <CountUp value={stats.total} format={(n) => nf.format(Math.round(n))} />
                </span>
              )}
              <p className="text-[11.5px] text-ink-muted mt-3 leading-snug">
                {stats.pctNeu}% saíram neutras — citação sem carga, nem elogio nem crítica.
              </p>
            </Cell>

            <Cell i={3} label="Precisam de leitura">
              {carregando ? (
                <div className="h-10 w-20 rounded z-skeleton" />
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display leading-none" style={{ fontSize: 40, color: "var(--color-neg)" }}>
                      <CountUp value={stats.totalNeg} format={(n) => nf.format(Math.round(n))} />
                    </span>
                    <span className="text-[12.5px] text-ink-muted">negativas</span>
                  </div>
                  {stats.totalNeg > 0 && (
                    <Link
                      to={`/intelligence/monitoring?sent=Negative${days > 0 ? `&period=${days}` : ""}`}
                      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-teal-700 dark:text-teal-300 hover:text-teal-500 mt-3"
                    >
                      Ler as negativas <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </>
              )}
            </Cell>
          </section>

          {/* Saldo no tempo + o que mexeu nele */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] border-b border-border-soft">
            <div className="p-7 border-b lg:border-b-0 lg:border-r border-border-soft z-rise" style={stagger(4)}>
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="eyebrow">Saldo ao longo do tempo</div>
                  <div className="text-[12px] text-ink-muted mt-1">
                    Acima da linha, mais elogio que crítica; abaixo, o contrário
                  </div>
                </div>
                <div className="flex items-center gap-3.5 text-[11.5px] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded-full bg-teal-500" />
                    média de {janela} dias
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-muted-2" />
                    cada dia
                  </span>
                </div>
              </div>
              {carregando ? (
                <div className="h-55 rounded z-skeleton" />
              ) : stats.total === 0 ? (
                <EmptyBlock
                  className="h-55 justify-center"
                  message="Sem menções no período"
                  hint="A linha aparece quando houver vídeos de terceiros analisados."
                />
              ) : (
                <NetLine data={netSeries} height={220} window={janela} />
              )}
            </div>

            <div className="p-7 z-rise" style={stagger(5)}>
              <div className="mb-4">
                <div className="eyebrow">O que mais mexeu no saldo</div>
                <div className="text-[12px] text-ink-muted mt-1">
                  Quanto cada menção puxou o saldo do período, para cima ou para baixo
                </div>
              </div>
              {impact.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded z-skeleton" />)}
                </div>
              ) : (impact.data?.items?.length ?? 0) === 0 ? (
                <EmptyBlock message="Nenhuma menção moveu o saldo no período." />
              ) : (
                <div className="flex flex-col">
                  {(impact.data?.items ?? []).slice(0, 5).map((ev, i) => (
                    <button
                      key={ev.analysisId}
                      onClick={() => navigate("/intelligence/monitoring")}
                      className={`z-row z-rise flex items-start gap-3 py-3 -mx-2 px-2 rounded-md w-full text-left ${i > 0 ? "border-t border-border-soft" : ""}`}
                      style={stagger(6 + i)}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-medium truncate text-ink">{ev.title}</span>
                        <span className="block text-[11.5px] text-ink-muted truncate mt-0.5">
                          {ev.channelName} · {ev.date.slice(8, 10)}/{ev.date.slice(5, 7)}
                        </span>
                      </span>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium font-mono-zoe ${deltaChip(ev.delta)}`}>
                        {ev.delta >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                        {formatScoreDelta(ev.delta)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Tópicos: em linhas, para comparar de cima a baixo. */}
          <section className="px-8 py-7 border-b border-border-soft">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <div className="eyebrow">Sobre o que estão falando</div>
                <div className="text-[12px] text-ink-muted mt-1">
                  Tópicos extraídos das menções por IA, do mais falado ao menos falado
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><span className="chip chip-pos h-4.5 text-[10px]">Forte</span> 70% ou mais positivas</span>
                <span className="inline-flex items-center gap-1.5"><span className="chip chip-neg h-4.5 text-[10px]">Atenção</span> menos da metade positivas</span>
              </div>
            </div>
            {topics.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 rounded z-skeleton" />)}
              </div>
            ) : topicos.length === 0 ? (
              <EmptyBlock
                message="Nenhum tópico no período"
                hint="Os tópicos são extraídos por IA das menções analisadas — aparecem quando houver vídeos processados."
              />
            ) : (
              <div className="flex flex-col">
                {topicos.map((t, i) => (
                  <div
                    key={t.label}
                    className={`z-rise grid items-center gap-4 py-3 ${i > 0 ? "border-t border-border-soft" : ""}`}
                    style={{ gridTemplateColumns: "minmax(0,1fr) 92px minmax(0,2fr) 150px", ...stagger(6 + i) }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13.5px] font-medium truncate text-ink">{t.label}</span>
                      {t.pos >= 70 && <span className="chip chip-pos h-4.5 text-[10px] shrink-0">Forte</span>}
                      {t.pos < 50 && <span className="chip chip-neg h-4.5 text-[10px] shrink-0">Atenção</span>}
                    </div>
                    <span className="font-mono-zoe text-[11.5px] text-ink-muted">
                      {t.volume} {t.volume === 1 ? "menção" : "menções"}
                    </span>
                    {/* Barra empilhada pos/neu/neg (não há StackedBar nos charts). */}
                    <div className="flex h-2 rounded-full overflow-hidden bg-tint">
                      <div className="z-grow-x" style={{ width: `${t.pos}%`, background: "var(--color-pos)", ...stagger(6 + i) }} />
                      <div className="z-grow-x" style={{ width: `${t.neu}%`, background: "var(--ink-muted-2)", ...stagger(6 + i) }} />
                      <div className="z-grow-x" style={{ width: `${t.neg}%`, background: "var(--color-neg)", ...stagger(6 + i) }} />
                    </div>
                    <div className="flex items-center justify-end gap-3 font-mono-zoe text-[11.5px]">
                      <span style={{ color: "var(--color-pos)" }}>{t.pos}%</span>
                      <span className="text-ink-muted-2">{t.neu}%</span>
                      <span style={{ color: "var(--color-neg)" }}>{t.neg}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Termos: lista ordenada, não nuvem — nuvem não deixa comparar volume. */}
          <section className="px-8 py-7">
            <div className="mb-5">
              <div className="eyebrow">Termos mais citados</div>
              <div className="text-[12px] text-ink-muted mt-1">
                Barra proporcional ao número de menções; a cor é o tom em que o termo aparece
              </div>
            </div>
            {keywords.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
                {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-7 rounded z-skeleton" />)}
              </div>
            ) : (keywords.data?.items.length ?? 0) === 0 ? (
              <EmptyBlock message="Nenhum termo no período." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                {keywords.data!.items.map((k, i) => (
                  <div
                    key={k.keyword}
                    className="z-rise grid items-center gap-3 py-2 border-t border-border-soft"
                    style={{ gridTemplateColumns: "minmax(0,1fr) 110px 48px", ...stagger(6 + Math.min(i, 10)) }}
                  >
                    <span className="text-[13.5px] truncate text-ink">{k.keyword}</span>
                    <span className="h-1.5 rounded-full bg-tint overflow-hidden">
                      <span
                        className="block h-full rounded-full z-grow-x"
                        style={{
                          width: `${Math.max(4, Math.round((k.volume / maxKw) * 100))}%`,
                          background: keywordColor(k.sentiment),
                          ...stagger(6 + Math.min(i, 10)),
                        }}
                      />
                    </span>
                    <span className="font-mono-zoe text-[11.5px] text-ink-muted text-right">{k.volume}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

// ── Peças ──────────────────────────────────────────────────────────────

function Cell({ i, label, className, children }: {
  i: number
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`px-6 pt-6 pb-6 min-h-[168px] border-border-soft z-rise ${className ?? ""}`} style={stagger(i)}>
      <div className="eyebrow mb-3">{label}</div>
      {children}
    </div>
  )
}

function netColor(net: number): string {
  if (net >= 0.2) return "var(--color-pos)"
  if (net <= -0.2) return "var(--color-neg)"
  return "var(--ink)"
}

/** Régua −1 … 0 … +1 com o saldo marcado: dá escala ao número sem precisar explicá-la. */
function NetRuler({ value }: { value: number }) {
  const pct = Math.round(((value + 1) / 2) * 100)
  return (
    <div className="mt-4 max-w-56">
      <div
        className="relative h-[5px] rounded-full"
        style={{ background: "linear-gradient(90deg, var(--neg-bg), var(--tint-2) 50%, var(--pos-bg))" }}
      >
        <span className="absolute left-1/2 -top-1 h-[13px] w-px bg-border" />
        <span
          className="absolute -top-[3px] w-[11px] h-[11px] -ml-[5.5px] rounded-full z-fade transition-[left] duration-700"
          style={{ left: `${pct}%`, background: netColor(value), boxShadow: "0 0 0 3px var(--surface)", ...stagger(30) }}
        />
      </div>
      <div className="flex justify-between font-mono-zoe text-[10px] text-ink-muted-2 mt-2">
        <span>−1,00</span>
        <span>0</span>
        <span>+1,00</span>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="-m-6">
      <div className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="h-3 w-44 rounded z-skeleton mb-4" />
        <div className="h-9 w-80 max-w-full rounded z-skeleton" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 border-b border-border-soft">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="p-6 border-r border-border-soft">
            <div className="h-10 w-28 rounded z-skeleton" />
          </div>
        ))}
      </div>
      <div className="p-7"><div className="h-55 rounded z-skeleton" /></div>
    </div>
  )
}

/**
 * Nota de rodapé da exclusão de owned (ADR-035, D4). Existe pra evitar o ticket
 * "por que meu vídeo não aparece aqui": a exclusão é definição da métrica, não
 * bug nem filtro que o usuário esqueceu de ligar — e por isso não há controle
 * para desligá-la nesta página.
 */
function EarnedOnlyNote() {
  // A regra é a mesma para marca própria e concorrente; só o sujeito muda.
  const voice = brandVoice(useActiveBrand().active)

  return (
    <p className="text-[11.5px] text-ink-muted-2 mt-3 leading-snug max-w-140">
      Considera apenas conteúdo de terceiros. Vídeos publicados em {voice.oCanalProprio}
      {" "}ficam de fora por definição — o roteiro é de quem publica, então medi-los
      seria medir {voice.aMarca} falando de si.{" "}
      <Link to="/intelligence/monitoring?rel=owned" className="underline hover:text-ink-muted">
        Ver conteúdo próprio
      </Link>
      .
    </p>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold text-ink mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-ink-muted mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
