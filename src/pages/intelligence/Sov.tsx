import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Lock, AlertCircle, Sparkles, Download, ArrowUp, ArrowDown, ChevronRight } from "lucide-react"
import { MultiLine } from "@/components/ui/charts"
import { EmptyBlock } from "@/components/ui/empty-block"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useFeature } from "@/features/auth/useFeature"
import { useActiveBrand } from "@/features/brands/context"
import {
  useShareOfVoice, useSovTrend, useSovByTopic,
  type SovBrand, type SovTopic, type SovTopicShare,
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

  // O recorte segue o brand switcher global quando a marca ativa é própria: quem
  // acabou de escolher "Itaú" lá em cima não deve ter que escolher de novo aqui.
  const brand = useActiveBrand()
  const marcaAtivaPropria =
    brand.active?.relationship === "OwnBrand" ? brand.active.brandId : null

  // Escolha local carimbada com a marca ativa do momento. Trocar no switcher global
  // descarta o override sozinho — sem efeito de reset, que dispararia render em
  // cascata e o lint recusa.
  const [override, setOverride] = useState<{ para: string | null; ownBrandId: string } | null>(null)
  const ownBrandId =
    override && override.para === marcaAtivaPropria ? override.ownBrandId : marcaAtivaPropria
  const setOwnBrandId = (id: string) => setOverride({ para: marcaAtivaPropria, ownBrandId: id })

  const sov = useShareOfVoice(hasSov, days, ownBrandId)
  const trend = useSovTrend(hasSov, 12, ownBrandId)
  const topics = useSovByTopic(hasSov, days, ownBrandId)

  const brands = useMemo(() => sov.data?.brands ?? [], [sov.data])
  const competitors = brands.filter((b) => !b.isYou).length

  const ownBrands = sov.data?.ownBrands ?? []
  const selectedOwn = sov.data?.selectedOwnBrandId ?? null
  // Mais de uma marca própria e nenhuma escolhida: a API devolve vazio de propósito
  // em vez de chutar a primeira (ADR-044). A tela pergunta.
  const precisaEscolher = ownBrands.length > 1 && selectedOwn === null

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
      { header: "Sentimento", value: (b) => (b.avgScore != null ? b.avgScore.toFixed(2) : "") },
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
              A participação de{" "}
              {sov.data?.brands.find((b) => b.isYou)?.brandName ?? "cada marca própria"} nas
              conversas do setor, frente ao conjunto competitivo declarado para ela.
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
          {/* O SoV é POR marca própria (ADR-044). Com mais de uma, o seletor é a
              primeira coisa a decidir — o período vem depois.

              `Select` direto e não `SelectFilterChip`: aquele reserva a chave vazia
              para a opção neutra ("todas"), e aqui não existe estado neutro — o
              recorte é obrigatório. Passar "" para ele deixava a pill em branco. */}
          {ownBrands.length > 1 && (
            <Select value={selectedOwn ?? ""} onValueChange={(v) => setOwnBrandId(v)}>
              <SelectTrigger
                aria-label="Marca própria do recorte"
                className={`h-8 rounded-full px-3.5 text-[13px] font-medium border transition-colors ${
                  selectedOwn
                    ? "border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/25"
                    : "border-warn text-warn"
                }`}
                style={selectedOwn ? undefined : { borderColor: "var(--color-warn)", color: "var(--color-warn)" }}
              >
                <SelectValue placeholder="Escolha a marca própria" />
              </SelectTrigger>
              <SelectContent>
                {ownBrands.map((b) => (
                  <SelectItem key={b.brandId} value={b.brandId}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SelectFilterChip value={period} onChange={setPeriod} options={PERIOD_OPTIONS} placeholder="Todo o período" />
          {!precisaEscolher && (
            <span className="chip text-[12px]">
              <span className="font-mono-zoe">{competitors}</span> {competitors === 1 ? "concorrente" : "concorrentes"}
            </span>
          )}
        </div>
      </section>

      {sov.isError && !forbidden ? (
        <ErrorState onRetry={() => sov.refetch()} />
      ) : sov.isLoading ? (
        <BarsSkeleton />
      ) : precisaEscolher ? (
        <EmptyBlock
          className="py-20"
          message="Escolha a marca própria"
          hint="Cada marca própria tem o seu conjunto competitivo, e o share é calculado dentro dele. Somar todas num número só compararia marcas de mercados diferentes."
        />
      ) : competitors === 0 && brands.length > 0 ? (
        // Sem concorrente declarado não há denominador: a marca marcaria 100%, que é
        // um número correto para uma pergunta que ninguém fez.
        <EmptyBlock
          className="py-20"
          message="Nenhum concorrente no conjunto desta marca"
          hint="Monte o conjunto competitivo dela em Gestão · Marcas para comparar o share."
        />
      ) : brands.length === 0 ? (
        <EmptyBlock className="py-20" message="Ainda não há dados de share of voice" hint="Assine marcas concorrentes, monte o conjunto competitivo da sua marca e aguarde o pipeline analisar menções." />
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
                          {/* ADR-035, D6: o SoV mantém o número limpo (earned puro) e o
                              clique leva ao detalhe, onde earned e owned aparecem em
                              painéis separados. Só concorrente — a própria marca tem a
                              tela de reação em canal próprio, que é outra pergunta. */}
                          {b.isYou ? (
                            <span className="text-[13.5px] truncate" style={{ fontWeight: 700, color: "var(--ink)" }}>
                              {b.brandName}
                            </span>
                          ) : (
                            <Link
                              to={`/intelligence/competitive/${b.brandId}`}
                              className="text-[13.5px] truncate hover:underline inline-flex items-center gap-1 group"
                              style={{ fontWeight: 500, color: "var(--ink)" }}
                            >
                              {b.brandName}
                              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" aria-hidden />
                            </Link>
                          )}
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
                  Nenhuma marca própria assinada. Marque uma das suas marcas como "própria"
                  para ver sua posição.
                </p>
              )}
            </div>
          </section>

          {/* Volume não é reputação (design: sov-insights). É a leitura que o
              ranking sozinho não dá — e a que muda a conversa de "quem fala mais"
              para "quem fala bem". */}
          <QualitySection brands={brands} />

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

          {/* Espaços não ocupados (design: sov-insights). Deriva de sov/topics —
              nenhuma chamada nova. */}
          <WhitespaceSection
            topics={topics.data?.topics ?? []}
            loading={topics.isLoading}
            yourShare={you?.sharePct ?? 0}
          />

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

// ── Volume não é reputação ──────────────────────────────────────────────

/** Cor do sentimento na escala do domínio, onde o neutro é 0,5 — não zero. */
function sentimentColor(score: number | null): string {
  if (score == null) return "var(--ink-muted-2)"
  if (score >= 0.6) return "var(--color-pos)"
  if (score <= 0.4) return "var(--color-neg)"
  return "var(--color-warn)"
}

/**
 * Share cruzado com sentimento.
 *
 * <p>O ranking sozinho responde "quem fala mais", que é meia pergunta: share alto
 * com sentimento baixo é <b>exposição</b>, não vantagem. Por isso os dois números
 * aparecem na mesma linha, e não em seções separadas onde o leitor teria que
 * cruzá-los de cabeça.</p>
 *
 * <p>Sem quadrante desenhado: com o conjunto competitivo típico — uma marca e dois
 * ou três concorrentes — os pontos se sobrepõem e a tabela lê melhor que o gráfico.</p>
 */
function QualitySection({ brands }: { brands: SovBrand[] }) {
  // Sem nenhum score não há o que cruzar, e uma tabela de traços não informa.
  if (brands.every((b) => b.avgScore == null)) return null

  return (
    <section className="px-8 py-7 border-b border-border-soft">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-1">
        <div className="eyebrow">Volume não é reputação</div>
        <span className="text-[12px] text-ink-muted">
          Share cruzado com o sentimento médio do período
        </span>
      </div>
      <p className="text-[13px] text-ink-muted mb-5 max-w-160 leading-relaxed">
        Share alto com sentimento baixo é exposição, não vantagem. A leitura útil é a
        das duas colunas juntas.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-140">
          <thead>
            <tr className="text-ink-muted">
              <th className="text-left font-medium pb-2">Marca</th>
              <th className="text-right font-medium pb-2">Share</th>
              <th className="text-right font-medium pb-2">Sentimento</th>
              <th className="text-right font-medium pb-2">Menções</th>
              <th className="text-right font-medium pb-2">Variação</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.brandId} className="border-t border-border-soft">
                <td className="py-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: brandColor(b.brandId, b.color) }}
                    />
                    <span style={{ color: "var(--ink)", fontWeight: b.isYou ? 700 : 400 }}>
                      {b.brandName}
                    </span>
                    {b.isYou && <span className="chip chip-primary text-[9.5px]">VOCÊ</span>}
                  </span>
                </td>
                <td className="text-right font-mono-zoe" style={{ color: "var(--ink)" }}>
                  {b.sharePct}%
                </td>
                <td
                  className="text-right font-mono-zoe"
                  style={{ color: sentimentColor(b.avgScore) }}
                >
                  {b.avgScore != null ? b.avgScore.toFixed(2) : "—"}
                </td>
                <td className="text-right font-mono-zoe text-ink-muted">{b.mentions}</td>
                <td className="text-right font-mono-zoe">
                  <span className={b.deltaPp === 0 ? "text-ink-muted" : undefined}
                    style={b.deltaPp > 0
                      ? { color: "var(--color-pos)" }
                      : b.deltaPp < 0 ? { color: "var(--color-neg)" } : undefined}
                  >
                    {b.deltaPp > 0 ? "+" : ""}{b.deltaPp}pp
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Espaços não ocupados ────────────────────────────────────────────────

/**
 * Tópicos com conversa relevante e share seu ABAIXO da sua média.
 *
 * <p>É a pergunta que o SoV total não responde: onde o setor conversa e você quase
 * não aparece. Deriva inteiramente de `sov/topics` — a mesma resposta que já
 * alimenta a seção seguinte, sem chamada nova.</p>
 *
 * <p>O corte é a sua própria média, não um número fixo: "share baixo" só significa
 * algo em relação ao quanto você costuma ocupar.</p>
 */
function WhitespaceSection({
  topics,
  loading,
  yourShare,
}: {
  topics: SovTopic[]
  loading: boolean
  yourShare: number
}) {
  const gaps = useMemo(() => {
    return topics
      .map((t) => {
        const mine = t.shares.find((s) => s.isYou)
        const leader = t.shares.reduce<SovTopicShare | null>(
          (a, s) => (a && a.sharePct >= s.sharePct ? a : s), null,
        )
        return { topic: t, mine: mine?.sharePct ?? 0, leader }
      })
      // Só onde alguém MAIS lidera: tópico que você já lidera não é espaço vago.
      .filter((g) => g.mine < yourShare && g.leader != null && !g.leader.isYou)
      .sort((a, b) => b.topic.volume - a.topic.volume)
      .slice(0, 4)
  }, [topics, yourShare])

  if (loading) {
    return (
      <section className="px-8 py-7 border-b border-border-soft">
        <div className="eyebrow mb-4">Espaços não ocupados</div>
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          ))}
        </div>
      </section>
    )
  }

  if (gaps.length === 0) return null

  return (
    <section className="px-8 py-7 border-b border-border-soft">
      <div className="eyebrow mb-1">Espaços não ocupados</div>
      <p className="text-[13px] text-ink-muted mb-5 max-w-160 leading-relaxed">
        Tópicos com conversa no setor em que seu share está abaixo dos seus{" "}
        <span className="font-mono-zoe">{yourShare}%</span> gerais — e onde outra marca lidera.
      </p>

      <div className="flex flex-col gap-4 max-w-3xl">
        {gaps.map(({ topic, mine, leader }) => (
          <div key={topic.topic} className="border-t border-border-soft pt-3.5">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                {topic.topic}
              </span>
              <span className="font-mono-zoe text-[11.5px] text-ink-muted shrink-0">
                {topic.volume} {topic.volume === 1 ? "menção" : "menções"} no setor
              </span>
            </div>

            <div className="flex items-center justify-between text-[11.5px] text-ink-muted mb-1.5">
              <span>seu share <span className="font-mono-zoe">{mine}%</span></span>
              <span>
                {leader!.brandName} <span className="font-mono-zoe">{leader!.sharePct}%</span>
              </span>
            </div>

            {/* Duas barras sobre o mesmo trilho: a comparação é entre você e o líder,
                e um empilhado com todos diluiria justamente esse contraste. */}
            <div className="relative h-2.5 rounded-sm overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
              <div
                className="absolute inset-y-0 left-0 opacity-40"
                style={{
                  width: `${leader!.sharePct}%`,
                  background: brandColor(leader!.brandId, leader!.color),
                }}
              />
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${mine}%`, background: "var(--color-teal-500)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function UpsellScreen() {
  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <div className="flex flex-col items-center justify-center text-center px-6 py-24 max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--teal-bg)" }}>
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
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
