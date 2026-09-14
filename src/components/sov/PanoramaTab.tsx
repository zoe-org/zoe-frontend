import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { MultiLine } from "@/components/ui/charts"
import { EmptyBlock } from "@/components/ui/empty-block"
import { InfoHint } from "@/components/ui/info-hint"
import type { SovTrend } from "@/lib/api/dashboard"
import { brandColor, formatScore, GLOSSARY, positionSummary, readSentiment, type RankedBrand } from "@/lib/sov"
import { BlockSkeleton, BrandSwatch, DeltaPp, SectionHead, SentimentChip } from "./shared"

const NO_PREVIOUS =
  " Com \"Todo o período\" não existe período anterior para comparar, e a variação não aparece."

export function PanoramaTab({ ranked, periodLabel, hasPreviousPeriod, trend, trendLoading }: {
  ranked: RankedBrand[]
  periodLabel: string
  /** Falso em "Todo o período": sem janela anterior, todo delta é zero por construção. */
  hasPreviousPeriod: boolean
  trend: SovTrend | undefined
  trendLoading: boolean
}) {
  const ppHint = GLOSSARY.pp + (hasPreviousPeriod ? "" : NO_PREVIOUS)
  return (
    <>
      <PositionSection ranked={ranked} periodLabel={periodLabel} hasPreviousPeriod={hasPreviousPeriod} />
      <RankingSection ranked={ranked} hasPreviousPeriod={hasPreviousPeriod} ppHint={ppHint} />
      <TrendSection trend={trend} loading={trendLoading} />
    </>
  )
}

// ── Sua posição ───────────────────────────────────────────────────────────

function PositionSection({ ranked, periodLabel, hasPreviousPeriod }: {
  ranked: RankedBrand[]
  periodLabel: string
  hasPreviousPeriod: boolean
}) {
  const you = ranked.find((b) => b.isYou)

  if (!you) {
    return (
      <section className="px-8 py-7 border-b border-border-soft">
        <div className="eyebrow mb-2">Sua posição</div>
        <p className="text-[13px] text-ink-muted max-w-160 leading-relaxed">
          Nenhuma marca própria neste recorte. Marque uma das suas marcas como própria em
          Gestão · Marcas para ver a posição dela frente aos concorrentes.
        </p>
      </section>
    )
  }

  const sent = readSentiment(you.avgScore)
  const summary = positionSummary(ranked)

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-x-10 gap-y-6 px-8 py-7 border-b border-border-soft">
      <div>
        <div className="eyebrow mb-3">Sua posição · {periodLabel.toLowerCase()}</div>
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <span className="font-display" style={{ fontSize: 56, lineHeight: 1, color: "var(--color-teal-500)" }}>
            #{you.rank}
          </span>
          <span className="text-[13px] text-ink-muted">
            de {ranked.length} {ranked.length === 1 ? "marca" : "marcas"} no conjunto
          </span>
        </div>
        {summary && (
          <p className="text-[14px] leading-relaxed max-w-140 m-0" style={{ color: "var(--ink-2)" }}>{summary}</p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-4 self-end m-0">
        <Metric
          label="Share"
          hint={GLOSSARY.sov}
          value={`${you.sharePct}%`}
          foot={hasPreviousPeriod
            ? <DeltaPp value={you.deltaPp} />
            : <span className="text-[11.5px] text-ink-muted-2">sem comparação</span>}
        />
        <Metric
          label="Sentimento"
          hint={GLOSSARY.sentiment}
          value={formatScore(you.avgScore)}
          valueColor={sent.color}
          foot={<span className="text-[11.5px]" style={{ color: sent.color }}>{sent.label}</span>}
        />
        <Metric
          label="Menções"
          hint={GLOSSARY.mentions}
          value={you.mentions.toLocaleString("pt-BR")}
          foot={<span className="text-[11.5px] text-ink-muted-2">vídeos analisados</span>}
        />
      </dl>
    </section>
  )
}

function Metric({ label, hint, value, valueColor, foot }: {
  label: string
  hint: string
  value: string
  valueColor?: string
  foot: ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[12px] text-ink-muted">
        {label}
        <InfoHint text={hint} />
      </dt>
      <dd className="m-0 mt-1 font-display" style={{ fontSize: 26, lineHeight: 1.1, color: valueColor ?? "var(--ink)" }}>
        {value}
      </dd>
      <dd className="m-0 mt-1">{foot}</dd>
    </div>
  )
}

// ── Ranking ───────────────────────────────────────────────────────────────

/**
 * Ranking e qualidade numa tabela só. Antes eram duas seções e o share aparecia duas
 * vezes — e a leitura que importa é justamente a das colunas juntas.
 */
function RankingSection({ ranked, hasPreviousPeriod, ppHint }: {
  ranked: RankedBrand[]
  hasPreviousPeriod: boolean
  ppHint: string
}) {
  return (
    <section className="px-8 py-7 border-b border-border-soft">
      <SectionHead
        title="Ranking do conjunto"
        sub="Share e sentimento lado a lado: share alto com sentimento baixo é exposição, não vantagem. Clique num concorrente para ver o detalhe dele."
      />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-160">
          <thead>
            <tr className="text-ink-muted text-[12px]">
              <th className="text-left font-medium pb-2 w-8">#</th>
              <th className="text-left font-medium pb-2">Marca</th>
              <th className="text-left font-medium pb-2 w-[32%]">
                <span className="inline-flex items-center gap-1">Share <InfoHint text={GLOSSARY.sov} /></span>
              </th>
              <th className="text-right font-medium pb-2">
                <span className="inline-flex items-center gap-1">Variação <InfoHint text={ppHint} /></span>
              </th>
              <th className="text-right font-medium pb-2">
                <span className="inline-flex items-center gap-1">Sentimento <InfoHint text={GLOSSARY.sentiment} /></span>
              </th>
              <th className="text-right font-medium pb-2">
                <span className="inline-flex items-center gap-1">Menções <InfoHint text={GLOSSARY.mentions} /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((b) => {
              const c = brandColor(b.brandId, b.color)
              return (
                <tr
                  key={b.brandId}
                  className="border-t border-border-soft"
                  style={b.isYou ? { background: "var(--teal-bg)" } : undefined}
                >
                  <td className="py-3 pl-1 font-mono-zoe text-[11.5px] text-ink-muted-2">{b.rank}</td>
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <BrandSwatch color={c} />
                      {/* ADR-035 D6: o SoV mantém o número limpo (earned puro) e o clique
                          leva ao detalhe, onde earned e owned aparecem separados. Só
                          concorrente — a própria marca tem a tela de canal próprio. */}
                      {b.isYou ? (
                        <span className="truncate font-bold" style={{ color: "var(--ink)" }}>{b.brandName}</span>
                      ) : (
                        <Link
                          to={`/intelligence/competitive/${b.brandId}`}
                          className="truncate hover:underline inline-flex items-center gap-1 group"
                          style={{ color: "var(--ink)" }}
                        >
                          {b.brandName}
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" aria-hidden />
                        </Link>
                      )}
                      {b.isYou && <span className="chip chip-primary text-[9.5px] px-1.5 py-px">VOCÊ</span>}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {/* Barra na escala absoluta: 34% ocupa 34% do trilho. Relativa ao
                        líder, o primeiro sempre pareceria dono de tudo. */}
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-2 rounded-sm overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
                        <div style={{ width: `${b.sharePct}%`, height: "100%", background: c, transition: "width .5s" }} />
                      </div>
                      <span className="font-mono-zoe w-10 text-right" style={{ color: "var(--ink)" }}>{b.sharePct}%</span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    {hasPreviousPeriod ? <DeltaPp value={b.deltaPp} /> : <span className="text-ink-muted-2">—</span>}
                  </td>
                  <td className="py-3 text-right"><SentimentChip score={b.avgScore} /></td>
                  <td className="py-3 pr-1 text-right font-mono-zoe text-ink-muted">{b.mentions.toLocaleString("pt-BR")}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Evolução ──────────────────────────────────────────────────────────────

function TrendSection({ trend, loading }: { trend: SovTrend | undefined; loading: boolean }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const series = trend?.series ?? []
  const weeks = trend?.weeks ?? []
  const you = series.find((s) => s.isYou)

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      // Esconder todas deixaria um gráfico vazio que parece erro.
      return next.size >= series.length ? prev : next
    })

  // A API manda "S1…S12", com a S12 sendo os últimos 7 dias. O eixo diz quanto tempo atrás.
  const semanasAtras = (i: number) => weeks.length - 1 - i
  const axisLabel = (i: number) => {
    const atras = semanasAtras(i)
    if (atras === 0) return "agora"
    return i % 3 === (weeks.length - 1) % 3 ? `−${atras} sem` : ""
  }
  const columnLabel = (i: number) => {
    const atras = semanasAtras(i)
    return atras === 0 ? "Últimos 7 dias" : atras === 1 ? "Há 1 semana" : `Há ${atras} semanas`
  }
  // Semana sem menção nenhuma vem como 0% para todos: é ausência, não medição.
  const emptyColumn = (i: number) => series.every((s) => (s.data[i] ?? 0) === 0)

  return (
    <section className="px-8 py-7">
      <SectionHead
        title="Evolução do share"
        hint={GLOSSARY.trend}
        sub="Últimas 12 semanas. Passe o mouse para ver cada semana; clique numa marca para escondê-la e dar zoom nas outras."
      />

      {series.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {series.map((s) => {
            const off = hidden.has(s.brandName)
            return (
              <button
                key={s.brandId}
                type="button"
                onClick={() => toggle(s.brandName)}
                aria-pressed={!off}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border-soft text-[12px] transition-opacity hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"
                style={{ opacity: off ? 0.45 : 1, color: "var(--ink)" }}
              >
                <span className="w-2.5 h-0.5 rounded-full" style={{ background: brandColor(s.brandId, s.color) }} />
                <span style={{ fontWeight: s.isYou ? 600 : 400, textDecoration: off ? "line-through" : undefined }}>
                  {s.brandName}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <BlockSkeleton rows={1} h="h-[220px]" />
      ) : series.length === 0 ? (
        <EmptyBlock className="h-[220px] justify-center" message="Sem dados nas últimas 12 semanas" />
      ) : (
        <MultiLine
          interactive
          height={220}
          labels={weeks.map((_, i) => axisLabel(i))}
          series={series.map((s) => ({ name: s.brandName, color: brandColor(s.brandId, s.color), data: s.data }))}
          emphasize={you?.brandName}
          hidden={hidden}
          formatValue={(v) => `${v}%`}
          columnLabel={columnLabel}
          isEmptyColumn={emptyColumn}
          emptyLabel="Nenhuma marca do conjunto teve menção nesta semana"
        />
      )}
    </section>
  )
}
