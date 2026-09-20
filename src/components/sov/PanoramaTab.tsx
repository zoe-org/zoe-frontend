import { useState } from "react"
import { Link } from "react-router-dom"
import { useActiveBrand } from "@/features/brands/context"
import { ArrowRight, ChevronRight } from "lucide-react"
import { MultiLine } from "@/components/ui/charts"
import { EmptyBlock } from "@/components/ui/empty-block"
import { InfoHint } from "@/components/ui/info-hint"
import type { SovTrend } from "@/lib/api/dashboard"
import { Stat } from "@/components/ui/stat"
import {
  brandColor, formatScore, GLOSSARY, nearestRival, positionSummary, readSentiment,
  type RankedBrand,
} from "@/lib/sov"
import { stagger } from "@/lib/motion"
import { BlockSkeleton, BrandSwatch, DeltaPp, SectionHead, SentimentChip } from "./shared"

const NO_PREVIOUS =
  " Com \"Todo o período\" não existe período anterior para comparar, e a variação não aparece."

export function PanoramaTab({ ranked, periodLabel, hasPreviousPeriod, trend, trendLoading, onCompare }: {
  ranked: RankedBrand[]
  periodLabel: string
  /** Falso em "Todo o período": sem janela anterior, todo delta é zero por construção. */
  hasPreviousPeriod: boolean
  trend: SovTrend | undefined
  trendLoading: boolean
  /** Leva pra aba Comparar já mirando o alvo mais próximo. */
  onCompare?: () => void
}) {
  const ppHint = GLOSSARY.pp + (hasPreviousPeriod ? "" : NO_PREVIOUS)
  return (
    <>
      <PositionSection ranked={ranked} periodLabel={periodLabel} hasPreviousPeriod={hasPreviousPeriod} onCompare={onCompare} />
      <RankingSection ranked={ranked} hasPreviousPeriod={hasPreviousPeriod} ppHint={ppHint} />
      <TrendSection trend={trend} loading={trendLoading} />
    </>
  )
}

// ── Sua posição ───────────────────────────────────────────────────────────

function PositionSection({ ranked, periodLabel, hasPreviousPeriod, onCompare }: {
  ranked: RankedBrand[]
  periodLabel: string
  hasPreviousPeriod: boolean
  onCompare?: () => void
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
    <section
      className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-x-10 gap-y-6 px-8 py-7 border-b border-border-soft z-rise"
      style={stagger(0)}
    >
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
        <RivalTarget ranked={ranked} onCompare={onCompare} />
      </div>

      <div className="grid grid-cols-3 gap-4 self-end">
        <Stat
          label="Share"
          hint={GLOSSARY.sov}
          foot={hasPreviousPeriod ? <DeltaPp value={you.deltaPp} /> : "sem comparação"}
        >
          {you.sharePct}%
        </Stat>
        <Stat
          label="Sentimento"
          hint={GLOSSARY.sentiment}
          color={sent.color}
          foot={<span style={{ color: sent.color }}>{sent.label}</span>}
        >
          {formatScore(you.avgScore)}
        </Stat>
        <Stat label="Menções" hint={GLOSSARY.mentions} foot="vídeos analisados">
          {you.mentions.toLocaleString("pt-BR")}
        </Stat>
      </div>
    </section>
  )
}

/**
 * O concorrente que decide a próxima posição, com a distância em pp e o atalho
 * pra comparação.
 *
 * O ranking mostra todo mundo e o resumo cita o líder; nenhum dos dois responde
 * "quem eu preciso passar agora" — que em 3º lugar não é o líder, é o 2º. A
 * regra de qual marca é essa já vive testada em `nearestRival`.
 */
function RivalTarget({ ranked, onCompare }: { ranked: RankedBrand[]; onCompare?: () => void }) {
  const you = ranked.find((b) => b.isYou)
  const alvo = nearestRival(ranked)
  if (!you || !alvo) return null

  const lidera = you.rank === 1
  const gap = Math.abs(you.sharePct - alvo.sharePct)

  return (
    <div className="flex items-center gap-4 flex-wrap mt-5 rounded-[14px] border border-border-soft bg-inset px-4 py-3">
      <div className="min-w-0">
        <div className="eyebrow mb-1.5">{lidera ? "Quem pode te passar" : "Alvo mais próximo"}</div>
        <div className="flex items-center gap-2 min-w-0">
          <BrandSwatch color={brandColor(alvo.brandId, alvo.color)} />
          <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>
            {alvo.brandName}
          </span>
          <span className="text-[12.5px] text-ink-muted whitespace-nowrap">
            {/* Mesmo share com posições diferentes é desempate por menções: dizer
                "0pp atrás" leria como erro de conta. */}
            {gap === 0 ? (
              <>mesmo share · decide no volume</>
            ) : (
              <>
                <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{gap}pp</span>
                {lidera ? " atrás de você" : " à sua frente"}
              </>
            )}
          </span>
        </div>
      </div>
      {onCompare && (
        <button
          onClick={onCompare}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-medium rounded-lg border border-border-soft hover:bg-hover transition-colors shrink-0"
        >
          Comparar <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
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
  const { brands, setBrand } = useActiveBrand()
  // Só vira link o que o tenant assina: marca fora da lista não pode ser a ativa.
  const assinadas = new Set(brands.map((x) => x.brandId))
  return (
    <section className="px-8 py-7 border-b border-border-soft z-rise" style={stagger(1)}>
      <SectionHead
        title="Ranking do conjunto"
        sub="Share e sentimento lado a lado: share alto com sentimento baixo é exposição, não vantagem. Clique num concorrente para abrir o Dashboard dele."
      />
      <div className="overflow-x-auto overflow-y-clip">
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
            {ranked.map((b, i) => {
              const c = brandColor(b.brandId, b.color)
              return (
                <tr
                  key={b.brandId}
                  className="border-t border-border-soft z-rise"
                  style={{ ...stagger(Math.min(i, 12)), ...(b.isYou ? { background: "var(--teal-bg)" } : {}) }}
                >
                  <td className="py-3 pl-1 font-mono-zoe text-[11.5px] text-ink-muted-2">{b.rank}</td>
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <BrandSwatch color={c} />
                      {/* ADR-063: o concorrente se lê no Dashboard, com ele como marca
                          ativa. O SoV continua só earned; a reação nos canais oficiais
                          dele é um card à parte lá, nunca somada a este número. */}
                      {b.isYou || !assinadas.has(b.brandId) ? (
                        <span className="truncate" style={{ color: "var(--ink)", fontWeight: b.isYou ? 700 : 400 }}>{b.brandName}</span>
                      ) : (
                        <Link
                          to="/dashboard"
                          onClick={() => setBrand(b.brandId)}
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
                      <div className="flex-1 h-2 rounded-full overflow-hidden bg-tint">
                        {/* `transition` continua para a troca de período; o
                            `z-grow-x` é só a entrada. */}
                        <div
                          className="h-full rounded-full z-grow-x"
                          style={{ width: `${b.sharePct}%`, background: c, transition: "width .5s", ...stagger(Math.min(i, 12)) }}
                        />
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
    <section className="px-8 py-7 z-rise" style={stagger(2)}>
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
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border-soft text-[12px] transition-opacity hover:bg-hover"
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
