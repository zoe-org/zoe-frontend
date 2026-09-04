import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, ArrowUp, ArrowDown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useAuth } from "@/features/auth/context"
import { AreaLine, Heatmap, Sparkline } from "@/components/ui/charts"
import { EmptyState } from "@/components/ui/empty-state"
import { EmptyBlock } from "@/components/ui/empty-block"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { useActiveBrand } from "@/features/brands/context"
import {
  useDashboardSummary, useInfluencers, useMentionActivity, useSentimentEvolution,
  type Influencer, type MentionActivity,
} from "@/lib/api/dashboard"
import { useAlertEvents } from "@/lib/api/alerts"
import { useVideosFeed } from "@/lib/api/videos"
import { tEnum } from "@/i18n/enums"

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

function classificationClass(cls: string | null): string {
  if (cls === "Positive") return "text-[#16A34A] bg-[#F0FDF4]"
  if (cls === "Negative") return "text-[#DC2626] bg-[#FEF2F2]"
  return "text-[#6B7280] bg-[#F3F4F6]"
}

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
  // Três é o teto: a seção é uma chamada para ação, não um segundo histórico.
  const pendingAlerts = (alerts.data?.pages[0]?.items ?? []).slice(0, 3)

  const points = useMemo(() => evolution.data?.points ?? [], [evolution.data])
  const dist = useMemo(() => {
    const pos = points.reduce((a, p) => a + p.positive, 0)
    const neu = points.reduce((a, p) => a + p.neutral, 0)
    const neg = points.reduce((a, p) => a + p.negative, 0)
    const total = pos + neu + neg || 1
    return { pos, neu, neg, total, pctPos: Math.round((pos / total) * 100), pctNeu: Math.round((neu / total) * 100), pctNeg: Math.round((neg / total) * 100) }
  }, [points])

  const trend = useMemo(
    () => points.map((p, i) => ({ day: i, value: p.positive + p.neutral + p.negative, label: p.date.slice(5).replace("-", "/") })),
    [points],
  )
  const sparkVolume = trend.slice(-14).map((t) => t.value)
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

  return (
    <div className="-m-6">
      {/* Hero */}
      <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex-1 min-w-70">
            <div className="eyebrow mb-3">
              {getGreeting()}, {displayName} · {getTodayLabel()}
            </div>
            <h1 className="font-display m-0" style={{ fontSize: 40, lineHeight: 1.1, color: "var(--ink)" }}>
              Visão geral de{" "}
              <span style={{ color: "var(--color-teal-500)" }}>{brand.active?.displayName ?? brand.active?.brandName}</span>
            </h1>
            {/* O concorrente pode ser a marca ativa — o dado dele é pago e completo.
                Mas a tela precisa DIZER isso: sem o selo, um print desta página num
                deck passa os números do rival como se fossem do cliente. */}
            {brand.active?.relationship === "Competitor" && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium">
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{ background: "#FFFBEB", color: "var(--color-warn)" }}
                >
                  Marca concorrente
                </span>
                <span className="text-ink-muted">
                  os números abaixo são dela, não do seu workspace
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 border-b border-border-soft">
        <Kpi
          label="Menções · 30d"
          loading={summary.isLoading}
          value={s ? String(s.totalMentions) : "—"}
          spark={sparkVolume}
          accent
          className="border-r border-b md:border-b-0 border-border-soft"
        />
        <Kpi
          label="Score médio"
          loading={summary.isLoading}
          value={s ? s.avgScore.toFixed(2) : "—"}
          spark={points.slice(-14).map((p) => p.avgScore)}
          className="border-r border-b md:border-b-0 border-border-soft"
        />
        <DeltaKpi label="Variação · 30d" loading={summary.isLoading} value={s?.deltaPct30d ?? null} />
      </section>

      {/* Tendência + Distribuição */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] border-b border-border-soft">
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft p-7">
          <div className="eyebrow mb-4">Tendência de menções · 30 dias</div>
          {evolution.isLoading ? (
            <div className="h-40 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
          ) : trend.length === 0 ? (
            <EmptyBlock className="h-40 justify-center" message="Sem menções no período" />
          ) : (
            <AreaLine data={trend} height={160} color="#00A799" fillOpacity={0.12} />
          )}
        </div>
        <div className="p-7">
          <div className="eyebrow mb-4">Distribuição de sentimento</div>
          {evolution.isLoading ? (
            <div className="h-24 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
          ) : (dist.pos + dist.neu + dist.neg) === 0 ? (
            <EmptyBlock className="py-8" message="Sem dados no período" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {[
                { label: "Positivo", pct: dist.pctPos, color: "var(--color-pos)", count: dist.pos },
                { label: "Neutro", pct: dist.pctNeu, color: "#9AA1AE", count: dist.neu },
                { label: "Negativo", pct: dist.pctNeg, color: "var(--color-neg)", count: dist.neg },
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
          )}
        </div>
      </section>

      {/* Menções recentes */}
      <section>
        <div className="flex items-center justify-between px-8 pt-6 pb-3">
          <div className="eyebrow">Menções recentes</div>
          <button
            onClick={() => navigate("/intelligence/monitoring")}
            className="text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium"
          >
            Ver todas →
          </button>
        </div>
        {feed.isLoading ? (
          <RecentSkeleton />
        ) : feed.isError ? (
          <ErrorState onRetry={() => feed.refetch()} />
        ) : recent.length === 0 ? (
          <EmptyBlock
            className="py-14"
            message="Ainda não há menções para esta marca"
            hint="Assim que o pipeline analisar vídeos que a citam, as menções mais recentes aparecem aqui."
          />
        ) : (
          recent.map((m) => (
            <button
              key={m.analysisId}
              onClick={() => navigate("/intelligence/monitoring")}
              className="grid items-center gap-4 px-8 py-3.5 border-t border-border-soft w-full text-left cursor-pointer hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
              style={{ gridTemplateColumns: "1fr 200px 130px 80px" }}
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate mb-0.5" style={{ color: "var(--ink)" }}>{m.title}</div>
                <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
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
              <div className="text-right font-mono-zoe text-[13px]" style={{ color: "var(--ink)" }}>
                {m.score != null ? m.score.toFixed(2) : "—"}
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

      {/* Alertas fecham a página: é a única seção acionável, e ela some quando não
          há nada pendente, em vez de mostrar um vazio decorativo. */}
      {pendingAlerts.length > 0 && (
        <section className="border-t border-border-soft p-7">
          <PendingAlerts
            items={pendingAlerts}
            total={alerts.data?.pages[0]?.unreadCount ?? 0}
            onOpen={() => navigate("/alerts")}
          />
        </section>
      )}
    </div>
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
            {["#F0FDFB", "#CCFBF4", "#5DE0D4", "#00A799", "#006B60"].map((c) => (
              <div key={c} className="w-3 h-2.5 rounded-xs" style={{ background: c }} />
            ))}
          </div>
          <span>mais</span>
        </div>
      </div>

      {loading ? (
        <div className="h-36 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
      ) : !normalized || !data ? (
        <EmptyBlock
          className="py-10"
          message="Sem menções no período"
          hint="O mapa aparece quando houver conteúdo de terceiros analisado."
        />
      ) : (
        <>
          <Heatmap data={normalized} />
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

  return (
    <div>
      <div className="eyebrow">Quem mais fala</div>
      <div className="text-[12px] text-ink-muted mt-1 mb-4">Top 5 canais por alcance · 30 dias</div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <EmptyBlock className="py-10" message="Nenhum canal identificado ainda" />
      ) : (
        <div className="flex flex-col">
          {top.map((inf, i) => (
            <div
              key={inf.channelId}
              className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-border-soft" : ""}`}
            >
              <span className="font-mono-zoe text-[11px] text-ink-muted-2 w-5 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                  {inf.name}
                </div>
                <div className="font-mono-zoe text-[10.5px] text-ink-muted">
                  {compact(inf.reach)} de alcance · {inf.mentions}{" "}
                  {inf.mentions === 1 ? "menção" : "menções"}
                </div>
              </div>
              <span
                className="font-mono-zoe text-[12px] shrink-0"
                style={{ color: scoreColor(inf.avgScore) }}
              >
                {inf.avgScore.toFixed(2)}
              </span>
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

// ── Alertas pendentes ───────────────────────────────────────────────────

type PendingAlert = {
  id: string
  ruleName: string
  brandName: string
  severity: string
  triggeredAt: string
}

function PendingAlerts({
  items,
  total,
  onOpen,
}: {
  items: PendingAlert[]
  total: number
  onOpen: () => void
}) {
  const tom = (sev: string) =>
    sev === "Critical"
      ? { color: "var(--color-neg)", bg: "var(--neg-bg)" }
      : sev === "Warning"
        ? { color: "var(--color-warn)", bg: "var(--warn-bg)" }
        : { color: "var(--color-teal-500)", bg: "var(--color-teal-50)" }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="eyebrow">Alertas não lidos</div>
          <div className="text-[12px] text-ink-muted mt-1">
            {total} {total === 1 ? "disparo aguardando você" : "disparos aguardando você"}
          </div>
        </div>
        <button
          onClick={onOpen}
          className="text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium"
        >
          Ver todos →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((a) => {
          const t = tom(a.severity)
          return (
            <button
              key={a.id}
              onClick={onOpen}
              className="text-left rounded-[12px] px-4 py-3 transition-opacity hover:opacity-85"
              style={{ background: t.bg }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                  {a.ruleName}
                </span>
              </div>
              <div className="text-[12px] text-ink-muted truncate">
                {a.brandName} ·{" "}
                {formatDistanceToNow(new Date(a.triggeredAt), { addSuffix: true, locale: ptBR })}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── KPIs ────────────────────────────────────────────────────────────────

function Kpi({ label, value, spark, accent, loading, className }: {
  label: string; value: string; spark: number[]; accent?: boolean; loading?: boolean; className?: string
}) {
  return (
    <div className={`px-5 pt-6 pb-5 flex flex-col gap-1 min-h-[150px] ${className ?? ""}`}>
      <div className="eyebrow">{label}</div>
      {loading ? (
        <div className="h-10 w-24 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
      ) : (
        <span className="font-display leading-none" style={{ fontSize: 40, color: accent ? "var(--color-teal-500)" : "var(--ink)" }}>
          {value}
        </span>
      )}
      {!loading && spark.length > 1 && (
        <div className="mt-3"><Sparkline data={spark} width={200} height={28} color={accent ? "#00A799" : "#9AA1AE"} /></div>
      )}
    </div>
  )
}

function DeltaKpi({ label, value, loading }: { label: string; value: number | null; loading?: boolean }) {
  const positive = (value ?? 0) >= 0
  const Icon = positive ? ArrowUp : ArrowDown
  return (
    <div className="px-5 pt-6 pb-5 flex flex-col gap-1 min-h-[150px]">
      <div className="eyebrow">{label}</div>
      {loading ? (
        <div className="h-10 w-24 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
      ) : (
        <span className="font-display leading-none" style={{ fontSize: 40, color: value == null ? "var(--ink)" : positive ? "var(--color-pos)" : "var(--color-neg)" }}>
          {value == null ? "—" : `${positive ? "+" : ""}${value}%`}
        </span>
      )}
      {!loading && value != null && (
        <span className={`chip mt-3 w-fit ${positive ? "chip-pos" : "chip-neg"}`}>
          <Icon className="w-2.5 h-2.5" /> vs. 30d anteriores
        </span>
      )}
    </div>
  )
}

// ── Estados ───────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="-m-6 animate-pulse">
      <div className="px-8 pt-7 pb-6 border-b border-border-soft"><div className="h-10 w-80 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" /></div>
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-border-soft">
        {[0, 1, 2].map((i) => <div key={i} className="p-6 border-r border-border-soft"><div className="h-10 w-24 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" /></div>)}
      </div>
      <div className="p-7"><div className="h-40 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" /></div>
    </div>
  )
}

function RecentSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-8 py-3.5 border-t border-border-soft">
          <div className="flex-1 space-y-2"><div className="h-3.5 w-2/3 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" /><div className="h-3 w-1/3 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" /></div>
          <div className="h-5 w-24 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">Tentar de novo</button>
    </div>
  )
}
