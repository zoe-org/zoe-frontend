import { useMemo, type CSSProperties } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertCircle, ArrowUp, ArrowDown, ArrowUpRight, BellRing } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useAuth } from "@/features/auth/context"
import { CoverageNotice } from "@/components/coverage/CoverageNotice"
import { CompetitorChannelCard } from "@/components/owned/CompetitorChannelCard"
import { Heatmap, Sparkline, StackedArea } from "@/components/ui/charts"
import { CountUp } from "@/components/ui/count-up"
import { heatmapRamp } from "@/lib/heatmap-ramp"
import { useTheme } from "next-themes"
import { EmptyState } from "@/components/ui/empty-state"
import { EmptyBlock } from "@/components/ui/empty-block"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { useActiveBrand } from "@/features/brands/context"
import {
  useDashboardSummary, useInfluencers, useMentionActivity, useSentimentEvolution,
  type Influencer, type MentionActivity,
} from "@/lib/api/dashboard"
import { useAlertEvents, type AlertEvent } from "@/lib/api/alerts"
import { useVideosFeed } from "@/lib/api/videos"
import { SEVERITY_LABEL } from "@/lib/alerts"
import { tEnum } from "@/i18n/enums"
import { classificationChip } from "@/lib/chip"

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

/**
 * "Segunda, 17 abril" — formato do design. O `weekday: "long"` do pt-BR devolve
 * "segunda-feira"; o design usa a forma curta capitalizada, então cortamos o
 * "-feira" e subimos a inicial.
 */
function getTodayLabel(now: Date = new Date()): string {
  const weekday = now
    .toLocaleDateString("pt-BR", { weekday: "long" })
    .replace(/-feira$/, "")
  const dayMonth = now.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayMonth}`
}

const nf = new Intl.NumberFormat("pt-BR")

/** Escalonamento das entradas: `style={stagger(n)}`. */
const stagger = (i: number) => ({ "--i": i }) as CSSProperties

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? ""

  const brand = useActiveBrand()
  const summary = useDashboardSummary(brand.brandId)
  const evolution = useSentimentEvolution(brand.brandId)
  const feed = useVideosFeed(brand.brandId ? { brandId: brand.brandId, limit: 6 } : null)
  const activity = useMentionActivity(brand.brandId)
  const influencers = useInfluencers(brand.brandId)
  const alerts = useAlertEvents({ brandId: brand.brandId, unreadOnly: true })
  // Três é o teto: a coluna é uma chamada para ação, não um segundo histórico.
  const pendingAlerts = (alerts.data?.pages[0]?.items ?? []).slice(0, 3)
  const unreadCount = alerts.data?.pages[0]?.unreadCount ?? 0

  const points = useMemo(() => evolution.data?.points ?? [], [evolution.data])
  const dist = useMemo(() => {
    const pos = points.reduce((a, p) => a + p.positive, 0)
    const neu = points.reduce((a, p) => a + p.neutral, 0)
    const neg = points.reduce((a, p) => a + p.negative, 0)
    const total = pos + neu + neg
    const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))
    return { pos, neu, neg, total, pctPos: pct(pos), pctNeu: pct(neu), pctNeg: pct(neg) }
  }, [points])

  const dayLabels = points.map((p) => `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`)
  const sparkVolume = points.slice(-14).map((p) => p.positive + p.neutral + p.negative)
  const recent = feed.data?.pages[0]?.items.slice(0, 6) ?? []

  // ── Estados de topo ───────────────────────────────────────────────────
  if (brand.isLoading) return <PageSkeleton />
  if (brand.isError) return <ErrorState onRetry={() => brand.refetch()} />
  if (brand.brands.length === 0) {
    return (
      <EmptyState
        title="Nenhuma marca assinada ainda"
        description="Assine uma marca para ver o resumo de menções, sentimento e vídeos em destaque."
        actionLabel="Assinar uma marca"
        onAction={() => navigate("/brands")}
      />
    )
  }

  const s = summary.data
  const brandName = brand.active?.displayName ?? brand.active?.brandName ?? ""

  return (
    <div className="-m-6">
      {/* Abertura: o resumo do período escrito em frase, com os números reais. */}
      <section className="px-8 pt-7 pb-7 border-b border-border-soft">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex-1 min-w-70">
            <div className="eyebrow mb-3">
              {getGreeting()}, {displayName} · {getTodayLabel()}
            </div>
            <Briefing
              brandName={brandName}
              loading={summary.isLoading || evolution.isLoading}
              total={s?.totalMentions ?? null}
              delta={s?.deltaPct30d ?? null}
              avgScore={s?.avgScore ?? null}
              pctPos={dist.total > 0 ? dist.pctPos : null}
              unread={unreadCount}
            />
            {/* O concorrente pode ser a marca ativa — o dado dele é pago e completo.
                Mas a tela precisa DIZER isso: sem o selo, um print desta página num
                deck passa os números do rival como se fossem do cliente. */}
            {brand.active?.relationship === "Competitor" && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium">
                <span className="chip chip-warn">Marca concorrente</span>
                <span className="text-ink-muted">
                  os números abaixo são dela, não do seu workspace
                </span>
              </div>
            )}
          </div>
          <Link
            to="/intelligence/monitoring"
            className="group shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-teal-500 text-[13.5px] font-semibold text-midnight hover:brightness-110 transition-[filter]"
          >
            Ver menções
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </section>

      <CoverageNotice tenantBrandIds={[brand.active?.tenantBrandId]} className="mx-8 mt-4" />

      {/* Faixa de números */}
      <section className="grid grid-cols-2 xl:grid-cols-4 border-b border-border-soft">
        <KpiCell i={0} label="Menções · 30d" loading={summary.isLoading} className="border-r border-b xl:border-b-0">
          {s && (
            <>
              <BigNumber color="var(--color-teal-500)">
                <CountUp value={s.totalMentions} format={(n) => nf.format(Math.round(n))} />
              </BigNumber>
              {sparkVolume.length > 1 && (
                <div className="mt-4"><Sparkline data={sparkVolume} height={28} color="#00A799" /></div>
              )}
            </>
          )}
        </KpiCell>

        <KpiCell i={1} label="Score médio" loading={summary.isLoading} className="xl:border-r border-b xl:border-b-0">
          {s && (
            <>
              <div className="flex items-baseline gap-2">
                <BigNumber color={s.totalMentions > 0 ? scoreColor(s.avgScore) : "var(--ink)"}>
                  <CountUp value={s.avgScore} format={(n) => n.toFixed(2)} />
                </BigNumber>
                <span className="font-mono-zoe text-[11px] text-ink-muted">de 1.00</span>
              </div>
              <ScoreGauge value={s.totalMentions > 0 ? s.avgScore : null} />
            </>
          )}
        </KpiCell>

        <KpiCell i={2} label="Variação · 30d" loading={summary.isLoading} className="border-r">
          {s && <Delta value={s.deltaPct30d} />}
        </KpiCell>

        <KpiCell i={3} label="Distribuição" loading={evolution.isLoading}>
          {dist.total === 0 ? (
            <>
              <BigNumber color="var(--ink-muted-2)">—</BigNumber>
              <div className="text-[12px] text-ink-muted mt-3">Sem dados no período</div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <BigNumber color="var(--ink)">
                  <CountUp value={dist.pctPos} format={(n) => `${Math.round(n)}%`} />
                </BigNumber>
                <span className="text-[12.5px] text-ink-muted">positivas</span>
              </div>
              <div className="flex gap-[3px] h-[5px] mt-4">
                {[
                  { pct: dist.pctPos, color: "var(--color-pos)" },
                  { pct: dist.pctNeu, color: "var(--ink-muted-2)" },
                  { pct: dist.pctNeg, color: "var(--color-neg)" },
                ].filter((d) => d.pct > 0).map((d, k) => (
                  <span
                    key={k}
                    className="rounded-full z-grow-x"
                    style={{ width: `${d.pct}%`, background: d.color, ...stagger(k + 3) }}
                  />
                ))}
              </div>
              <div className="flex gap-3 mt-2.5 font-mono-zoe text-[10.5px] text-ink-muted">
                <span>{dist.pctNeu}% neutras</span>
                <span>{dist.pctNeg}% negativas</span>
              </div>
            </>
          )}
        </KpiCell>
      </section>

      {/* Sentimento no tempo + o que pede ação */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] border-b border-border-soft">
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft p-7 z-rise" style={stagger(4)}>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <div className="eyebrow">Sentimento · 30 dias</div>
              <div className="text-[12px] text-ink-muted mt-1">Menções por dia, empilhadas por classificação</div>
            </div>
            <div className="flex items-center gap-3.5 text-[11.5px] text-ink-muted">
              <Legend color="var(--color-pos)">Positivo</Legend>
              <Legend color="var(--ink-muted-2)">Neutro</Legend>
              <Legend color="var(--color-neg)">Negativo</Legend>
            </div>
          </div>
          {evolution.isLoading ? (
            <div className="h-50 rounded z-skeleton" />
          ) : dist.total === 0 ? (
            <EmptyBlock className="h-50 justify-center" message="Sem menções no período" />
          ) : (
            <StackedArea
              height={200}
              labels={dayLabels}
              series={[
                { name: "Negativo", color: "var(--color-neg)", data: points.map((p) => p.negative) },
                { name: "Neutro", color: "var(--ink-muted-2)", data: points.map((p) => p.neutral) },
                { name: "Positivo", color: "var(--color-pos)", data: points.map((p) => p.positive) },
              ]}
            />
          )}
        </div>

        <div className="p-7 flex flex-col z-rise" style={stagger(5)}>
          <PendingAlerts
            items={pendingAlerts}
            total={unreadCount}
            loading={alerts.isLoading}
            onOpen={() => navigate("/alerts")}
          />
        </div>
      </section>

      {/* Menções recentes */}
      <section>
        <div className="flex items-center justify-between px-8 pt-6 pb-3">
          <div className="eyebrow">Menções recentes</div>
          <Link
            to="/intelligence/monitoring"
            className="text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium"
          >
            Ver todas →
          </Link>
        </div>
        <div className="hidden md:grid gap-4 px-8 pb-2 font-mono-zoe text-[10px] uppercase tracking-[0.12em] text-ink-muted-2" style={{ gridTemplateColumns: RECENT_COLUMNS }}>
          <span>Vídeo</span>
          <span>Cobertura</span>
          <span>Tom</span>
          <span className="text-right">Views</span>
          <span className="text-right">Score</span>
        </div>
        {feed.isLoading ? (
          <RecentSkeleton />
        ) : feed.isError ? (
          <ErrorState onRetry={() => feed.refetch()} />
        ) : recent.length === 0 ? (
          <EmptyBlock
            className="py-14 border-t border-border-soft"
            message="Ainda não há menções para esta marca"
            hint="Assim que o pipeline analisar vídeos que a citam, as menções mais recentes aparecem aqui."
          />
        ) : (
          recent.map((m, i) => (
            <button
              key={m.analysisId}
              onClick={() => navigate("/intelligence/monitoring")}
              className="z-row z-rise grid items-center gap-4 px-8 py-3.5 border-t border-border-soft w-full text-left cursor-pointer"
              style={{ gridTemplateColumns: RECENT_COLUMNS, ...stagger(6 + i) }}
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate mb-0.5" style={{ color: "var(--ink)" }}>{m.title}</div>
                <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
                  <span className="truncate">{m.channelName}</span>
                  <span>·</span>
                  <span className="shrink-0">{formatDistanceToNow(new Date(m.publishedAt), { addSuffix: true, locale: ptBR })}</span>
                </div>
              </div>
              <div><ConfidenceBadge pipelinePath={m.pipelinePath} confidence={m.confidence} /></div>
              <div>
                {m.classificacao && (
                  <span className={classificationChip(m.classificacao)}>
                    {tEnum("classification", m.classificacao)}
                  </span>
                )}
              </div>
              <div className="text-right font-mono-zoe text-[12px] text-ink-muted">
                {m.views != null ? compact(m.views) : "—"}
              </div>
              <div className="flex items-center justify-end gap-2">
                {m.score != null && (
                  <span className="hidden lg:block w-10 h-[3px] rounded-full bg-tint-2 overflow-hidden">
                    <span
                      className="block h-full rounded-full z-grow-x"
                      style={{ width: `${Math.round(m.score * 100)}%`, background: scoreColor(m.score), ...stagger(6 + i) }}
                    />
                  </span>
                )}
                <span className="font-mono-zoe text-[13px]" style={{ color: m.score != null ? scoreColor(m.score) : "var(--ink-muted)" }}>
                  {m.score != null ? m.score.toFixed(2) : "—"}
                </span>
              </div>
            </button>
          ))
        )}
      </section>

      {/* Quando falam da marca + quem fala. Os dois respondem à mesma pergunta
          operacional por ângulos diferentes — quando estar de plantão e com quem
          falar —, então dividem a linha. */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] border-t border-border-soft">
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft p-7">
          <ActivityHeatmap data={activity.data} loading={activity.isLoading} />
        </div>
        <div className="p-7">
          <TopInfluencers rows={influencers.data?.items ?? []} loading={influencers.isLoading} />
        </div>
      </section>

      {/* ADR-063: com um concorrente ativo, a reação nos canais oficiais dele entra
          aqui — o único pedaço do antigo drill-down que o Dashboard não cobria. Fica
          em seção própria: as métricas acima são sobre o que terceiros falam dele. */}
      {brand.active?.relationship === "Competitor" && (
        <CompetitorChannelCard
          brandId={brand.active.brandId}
          brandName={brand.active.displayName ?? brand.active.brandName}
        />
      )}
    </div>
  )
}

const RECENT_COLUMNS = "minmax(0,1fr) 170px 110px 64px 96px"

// ── Abertura ────────────────────────────────────────────────────────────

/**
 * O título da página é o resumo do período. Só diz o que a API sustenta: total,
 * variação, score médio e a parcela positiva da evolução diária. Sem menção, não
 * inventa tendência — diz que não há dado ainda.
 */
function Briefing({ brandName, loading, total, delta, avgScore, pctPos, unread }: {
  brandName: string
  loading: boolean
  total: number | null
  delta: number | null
  avgScore: number | null
  pctPos: number | null
  unread: number
}) {
  if (loading || total == null) {
    return (
      <>
        <div className="h-10 w-[28rem] max-w-full rounded z-skeleton" />
        <div className="h-4 w-[34rem] max-w-full rounded mt-4 z-skeleton" />
      </>
    )
  }

  if (total === 0) {
    return (
      <>
        <h1 className="font-display m-0 text-ink" style={{ fontSize: 38, lineHeight: 1.1 }}>
          Nenhuma menção a <span className="text-teal-500">{brandName}</span> nos últimos 30 dias
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted mt-3 max-w-[62ch]">
          Assim que o pipeline analisar vídeos que citam a marca, o resumo do período aparece aqui.
        </p>
      </>
    )
  }

  const tendencia =
    delta == null || delta === 0
      ? "Volume estável em relação aos 30 dias anteriores"
      : `Volume ${Math.abs(delta)}% ${delta > 0 ? "acima" : "abaixo"} dos 30 dias anteriores`
  const partes = [
    tendencia,
    avgScore != null && `score médio de ${avgScore.toFixed(2)}`,
    pctPos != null && `${pctPos}% das menções em tom positivo`,
  ].filter(Boolean) as string[]
  const frase = partes.length > 1
    ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}.`
    : `${partes[0]}.`

  return (
    <>
      <h1 className="font-display m-0 text-ink" style={{ fontSize: 38, lineHeight: 1.1 }}>
        <span className="text-teal-500">
          <CountUp value={total} format={(n) => nf.format(Math.round(n))} /> {total === 1 ? "menção" : "menções"}
        </span>{" "}
        a {brandName} nos últimos 30 dias
      </h1>
      <p className="text-[15px] leading-relaxed text-ink-muted mt-3 max-w-[66ch]">
        {frase}
        {unread > 0 && (
          <>
            {" "}
            <Link to="/alerts" className="text-ink font-medium underline decoration-border underline-offset-4 hover:decoration-teal-500">
              {unread === 1 ? "1 alerta aguarda leitura" : `${nf.format(unread)} alertas aguardam leitura`}
            </Link>
            .
          </>
        )}
      </p>
    </>
  )
}

// ── Faixa de números ────────────────────────────────────────────────────

function KpiCell({ i, label, loading, className, children }: {
  i: number
  label: string
  loading: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`px-6 pt-6 pb-6 min-h-[150px] border-border-soft z-rise ${className ?? ""}`} style={stagger(i)}>
      <div className="eyebrow mb-3">{label}</div>
      {loading ? <div className="h-10 w-24 rounded z-skeleton" /> : children}
    </div>
  )
}

function BigNumber({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="font-display leading-none" style={{ fontSize: 40, color }}>
      {children}
    </span>
  )
}

/** Régua 0–1 com o neutro marcado: o número só faz sentido perto do 0,5. */
function ScoreGauge({ value }: { value: number | null }) {
  return (
    <div className="relative h-[5px] rounded-full mt-5" style={{ background: "linear-gradient(90deg, var(--neg-bg), var(--tint-2), var(--pos-bg))" }}>
      <span className="absolute left-1/2 -top-1 h-[13px] w-px bg-border" />
      {value != null && (
        <span
          className="absolute -top-[3px] w-[11px] h-[11px] -ml-[5.5px] rounded-full z-fade transition-[left] duration-700"
          style={{ left: `${Math.round(value * 100)}%`, background: scoreColor(value), boxShadow: "0 0 0 3px var(--surface)", ...stagger(30) }}
        />
      )}
    </div>
  )
}

function Delta({ value }: { value: number }) {
  const positive = value >= 0
  const Icon = positive ? ArrowUp : ArrowDown
  const color = value === 0 ? "var(--ink)" : positive ? "var(--color-pos)" : "var(--color-neg)"
  return (
    <>
      <BigNumber color={color}>
        <CountUp value={value} format={(n) => `${n >= 0 ? "+" : ""}${Math.round(n)}%`} />
      </BigNumber>
      <div className="mt-4">
        <span className={`chip ${value === 0 ? "" : positive ? "chip-pos" : "chip-neg"}`}>
          {value !== 0 && <Icon className="w-2.5 h-2.5" />} vs. 30d anteriores
        </span>
      </div>
    </>
  )
}

function Legend({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-[2px]" style={{ background: color }} />
      {children}
    </span>
  )
}

// ── Alertas pendentes ───────────────────────────────────────────────────

function PendingAlerts({ items, total, loading, onOpen }: {
  items: AlertEvent[]
  total: number
  loading: boolean
  onOpen: () => void
}) {
  const tom = (sev: string) =>
    sev === "Critical"
      ? { color: "var(--color-neg)", bg: "var(--neg-bg)" }
      : sev === "Warning"
        ? { color: "var(--color-warn)", bg: "var(--warn-bg)" }
        : { color: "var(--teal-fg)", bg: "var(--teal-bg)" }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="eyebrow">Precisa de atenção</div>
        {total > 0 && (
          <span className="chip chip-neg">{total === 1 ? "1 não lido" : `${nf.format(total)} não lidos`}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-md z-skeleton" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyBlock
          className="flex-1"
          icon={<BellRing className="w-7 h-7" strokeWidth={1.5} />}
          message="Nada pendente"
          hint="Os disparos das suas regras de alerta aparecem aqui até alguém ler."
        />
      ) : (
        <div className="flex flex-col flex-1">
          {items.map((a, i) => {
            const t = tom(a.severity)
            return (
              <button
                key={a.id}
                onClick={onOpen}
                className={`z-row z-rise text-left flex items-start gap-3 py-3 -mx-2 px-2 rounded-md ${i > 0 ? "border-t border-border-soft" : ""}`}
                style={stagger(6 + i)}
              >
                <span className="mt-0.5 w-7 h-7 rounded-md shrink-0 flex items-center justify-center" style={{ background: t.bg, color: t.color }}>
                  <AlertCircle className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate text-ink">{a.ruleName}</span>
                  <span className="block text-[11.5px] text-ink-muted truncate mt-0.5">
                    {SEVERITY_LABEL[a.severity]} · {a.brandName}
                  </span>
                </span>
                <span className="font-mono-zoe text-[10.5px] text-ink-muted-2 shrink-0 mt-1">
                  {formatDistanceToNow(new Date(a.triggeredAt), { addSuffix: true, locale: ptBR })}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={onOpen}
        className="mt-3 self-start text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium"
      >
        {total > 0 ? "Ver todos os alertas →" : "Configurar alertas →"}
      </button>
    </>
  )
}

// ── Quando falam da marca ───────────────────────────────────────────────

/**
 * Mapa dia × hora.
 *
 * A normalização é feita AQUI e não no servidor: a API devolve contagem crua para
 * que o rodapé possa dizer quantas menções a célula mais quente tem. Intensidade
 * sozinha não responde "quantas?".
 *
 * A escala é sobre o máximo da PRÓPRIA grade, não sobre um teto absoluto — o mapa
 * responde "quando, comparado comigo mesmo", e uma marca de volume baixo ficaria
 * com o mapa inteiro apagado se a régua fosse global.
 */
function ActivityHeatmap({ data, loading }: { data?: MentionActivity; loading: boolean }) {
  const { resolvedTheme } = useTheme()
  // Um degrau sim, um não: cinco quadradinhos comunicam a escala sem virar régua.
  const legenda = heatmapRamp(resolvedTheme === "dark").filter((_, i) => i % 2 === 0 || i === 3)

  const normalized = useMemo(() => {
    if (!data || data.maxCount === 0) return null
    return data.cells.map((row) => row.map((v) => v / data.maxCount))
  }, [data])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="eyebrow">Quando falam da marca</div>
          <div className="text-[12px] text-ink-muted mt-1">
            Dia da semana × hora · últimos 30 dias
            {data && <> · {data.timeZone.replace("_", " ")}</>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span>menos</span>
          <div className="flex gap-0.5">
            {legenda.map((c) => (
              <div key={c} className="w-3 h-2.5 rounded-xs" style={{ background: c }} />
            ))}
          </div>
          <span>mais</span>
        </div>
      </div>

      {loading ? (
        <div className="h-36 rounded z-skeleton" />
      ) : !normalized || !data ? (
        <EmptyBlock
          className="py-10"
          message="Sem menções no período"
          hint="O mapa aparece quando houver conteúdo de terceiros analisado."
        />
      ) : (
        <>
          <Heatmap data={normalized} counts={data.cells} />
          {/* Owned fica de fora por definição: o mapa responde quando FALAM da
              marca, e vídeo do canal próprio é quando a marca fala. */}
          <div className="text-[11.5px] text-ink-muted-2 mt-2">
            {data.total} menções de terceiros · a célula mais quente tem {data.maxCount}
          </div>
        </>
      )}
    </div>
  )
}

// ── Quem mais fala ──────────────────────────────────────────────────────

function TopInfluencers({ rows, loading }: { rows: Influencer[]; loading: boolean }) {
  const top = rows.slice(0, 5)
  const maxReach = Math.max(...top.map((r) => r.reach), 1)

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Quem mais fala</div>
          <div className="text-[12px] text-ink-muted mt-1 mb-4">Top 5 canais por alcance · 30 dias</div>
        </div>
        <Link to="/intelligence/influencers" className="text-[12.5px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium shrink-0">
          Ver todos →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded z-skeleton" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <EmptyBlock className="py-10" message="Nenhum canal identificado ainda" />
      ) : (
        <div className="flex flex-col">
          {top.map((inf, i) => (
            <div
              key={inf.channelId}
              className={`flex items-center gap-3 py-2.5 z-rise ${i > 0 ? "border-t border-border-soft" : ""}`}
              style={stagger(8 + i)}
            >
              <span className="font-mono-zoe text-[11px] text-ink-muted-2 w-5 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium truncate text-ink">{inf.name}</span>
                  <span className="font-mono-zoe text-[12px] shrink-0" style={{ color: scoreColor(inf.avgScore) }}>
                    {inf.avgScore.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <span className="flex-1 h-[3px] rounded-full bg-tint-2 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-teal-500 z-grow-x"
                      style={{ width: `${Math.max(4, Math.round((inf.reach / maxReach) * 100))}%`, ...stagger(8 + i) }}
                    />
                  </span>
                  <span className="font-mono-zoe text-[10.5px] text-ink-muted shrink-0">
                    {compact(inf.reach)} · {inf.mentions} {inf.mentions === 1 ? "menção" : "menções"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** A escala do domínio é [0,1] — o neutro é 0,5, não zero. */
function scoreColor(score: number): string {
  if (score >= 0.6) return "var(--color-pos)"
  if (score <= 0.4) return "var(--color-neg)"
  return "var(--ink-muted)"
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ── Estados ───────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="-m-6">
      <div className="px-8 pt-7 pb-7 border-b border-border-soft">
        <div className="h-3 w-56 rounded z-skeleton mb-4" />
        <div className="h-10 w-96 max-w-full rounded z-skeleton" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 border-b border-border-soft">
        {[0, 1, 2, 3].map((i) => <div key={i} className="p-6 border-r border-border-soft"><div className="h-10 w-24 rounded z-skeleton" /></div>)}
      </div>
      <div className="p-7"><div className="h-50 rounded z-skeleton" /></div>
    </div>
  )
}

function RecentSkeleton() {
  return (
    <div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-8 py-3.5 border-t border-border-soft">
          <div className="flex-1 space-y-2"><div className="h-3.5 w-2/3 rounded z-skeleton" /><div className="h-3 w-1/3 rounded z-skeleton" /></div>
          <div className="h-5 w-24 rounded z-skeleton" />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold text-ink mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-ink-muted mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors">Tentar de novo</button>
    </div>
  )
}
