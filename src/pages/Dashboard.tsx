import { useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  AlertCircle, ArrowUp, ArrowDown, ArrowUpRight, Banknote, BellRing, FileText, Package,
  PenLine, ShieldAlert, Wallet,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useAuth } from "@/features/auth/context"
import { useFeature } from "@/features/auth/useFeature"
import { CoverageNotice } from "@/components/coverage/CoverageNotice"
import { CompetitorChannelCard } from "@/components/owned/CompetitorChannelCard"
import { Heatmap, Sparkline, StackedArea } from "@/components/ui/charts"
import { CountUp } from "@/components/ui/count-up"
import { heatmapRamp } from "@/lib/heatmap-ramp"
import { useTheme } from "next-themes"
import { EmptyState } from "@/components/ui/empty-state"
import { EmptyBlock } from "@/components/ui/empty-block"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { VideoThumb } from "@/components/ui/video-thumb"
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
import { formatScore, scoreColor } from "@/lib/score"
import { stagger } from "@/lib/motion"
import { StatBand } from "@/components/ui/stat-band"
import { useOperationsDashboard, fmtCents, type OperationsDashboard } from "@/lib/api/operations"
import { ESCROW_STATE_COLOR } from "@/lib/status-colors"
import OperationsDashboardPage from "@/pages/operations/Dashboard"

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
const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })

export default function DashboardPage() {
  const hasIntelligence = useFeature("intelligence")
  const hasOperations = useFeature("operations")

  if (hasIntelligence && hasOperations) return <FullPlatformDashboard />
  if (hasOperations) return <OperationsDashboardPage />
  if (hasIntelligence) return <IntelligenceDashboard />

  return (
    <EmptyState
      title="Nenhum módulo ativo"
      description="Este workspace ainda não tem acesso ao Intelligence ou ao Operations."
    />
  )
}

/**
 * Dashboard de quem tem os dois módulos.
 *
 * Não é um módulo embaixo do outro: era isso antes, cada um dentro de uma
 * moldura, e o resultado era o Dashboard e o Painel na mesma rolagem — duas
 * páginas coabitando, sem nenhuma informação nova nascendo do encontro.
 *
 * O que muda: a abertura volta a ser o resumo com números reais; as pendências
 * dos dois módulos se somam numa faixa só (é a única coisa que de fato soma —
 * alerta não lido e contrato parado são a mesma categoria: trabalho esperando);
 * e Operations entra como RESUMO com atalho, não como o Painel inteiro.
 */
function FullPlatformDashboard() {
  return (
    <div className="-m-6">
      <IntelligenceDashboard embedded afterHero={<NeedsYouBand />} />
      <OperationsSummary />
    </div>
  )
}

/**
 * Um item de trabalho parado, numa pastilha que flui com as outras.
 *
 * Duas tentativas até aqui, cada uma errando de um lado. Texto corrido separado
 * por "·" era compacto mas ilegível — e os rótulos perdiam o substantivo ("2 em
 * rascunho", rascunho de quê?). Cartões em grade resolveram a leitura e
 * quebraram a proporção: com um item só, um cartão sozinho numa grade de quatro
 * colunas gastava 150px de altura para dizer um fato.
 *
 * A pastilha tem a borda que agrupa o que é um item só, o rótulo por extenso, e
 * flui: um item ocupa uma linha curta, sete ocupam duas.
 */
function NeedsYouChip({ n, singular, plural, to, icon }: {
  n: number
  singular: string
  plural: string
  to: string
  icon: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-lg border border-border-soft bg-inset hover:bg-hover transition-colors"
    >
      <span className="shrink-0 text-ink-muted-2" aria-hidden>{icon}</span>
      <span className="font-mono-zoe font-semibold text-[13px]" style={{ color: "var(--color-teal-500)" }}>
        {n}
      </span>
      <span className="text-[12.5px] text-ink-muted whitespace-nowrap">
        {n === 1 ? singular : plural}
      </span>
    </Link>
  )
}

/**
 * O que espera por você, dos dois módulos.
 *
 * Some inteira quando não há nada: uma faixa de pendências vazia treina a
 * pessoa a ignorá-la, e aí ela não vê quando enche.
 *
 * Fundo neutro, e não âmbar: nem tudo aqui é problema — contrato em rascunho é
 * trabalho normal. O âmbar fica para o bloco de Atenção, onde algo travou.
 */
function NeedsYouBand() {
  const brand = useActiveBrand()
  const alerts = useAlertEvents({ brandId: brand.brandId, unreadOnly: true })
  const ops = useOperationsDashboard()

  const unread = alerts.data?.pages[0]?.unreadCount ?? 0
  const p = ops.data?.pending
  const itens = [
    {
      n: unread,
      singular: "alerta não lido",
      plural: "alertas não lidos",
      to: "/alerts",
      icon: <BellRing className="w-3.5 h-3.5" />,
    },
    {
      n: p?.contractDrafts ?? 0,
      singular: "contrato em rascunho",
      plural: "contratos em rascunho",
      to: "/operations/contracts",
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    {
      n: p?.contractsAwaitingSignature ?? 0,
      singular: "contrato aguardando assinatura",
      plural: "contratos aguardando assinatura",
      to: "/operations/contracts",
      icon: <PenLine className="w-3.5 h-3.5" />,
    },
    {
      n: p?.draftsAwaitingReview ?? 0,
      singular: "corte para aprovar",
      plural: "cortes para aprovar",
      to: "/operations/deliveries",
      icon: <Package className="w-3.5 h-3.5" />,
    },
    {
      n: p?.deliveriesAwaitingReview ?? 0,
      singular: "entrega para revisar",
      plural: "entregas para revisar",
      to: "/operations/deliveries",
      icon: <Package className="w-3.5 h-3.5" />,
    },
    {
      n: p?.escrowsAwaitingDeposit ?? 0,
      singular: "custódia sem depósito",
      plural: "custódias sem depósito",
      to: "/operations/escrow",
      icon: <Wallet className="w-3.5 h-3.5" />,
    },
    {
      n: p?.escrowsReleasable ?? 0,
      singular: "custódia pronta para liberar",
      plural: "custódias prontas para liberar",
      to: "/operations/escrow",
      icon: <Banknote className="w-3.5 h-3.5" />,
    },
  ].filter((i) => i.n > 0)

  if (itens.length === 0) return null

  return (
    // Rótulo na mesma linha das pastilhas: a faixa inteira mede 56px com um
    // item, contra os ~150px que a grade gastava.
    <section className="px-8 py-3 border-b border-border-soft flex items-center gap-x-3 gap-y-2 flex-wrap">
      <span className="eyebrow shrink-0">Precisa de você</span>
      {itens.map((i) => <NeedsYouChip key={i.plural} {...i} />)}
    </section>
  )
}

/**
 * Operations em resumo, não o Painel inteiro.
 *
 * O escopo vai escrito: campanha, contrato e custódia são do workspace, e não
 * mudam quando se troca a marca ativa lá em cima. Sem dizer isso, quem troca de
 * marca espera estes números mudarem.
 */
function OperationsSummary() {
  const q = useOperationsDashboard()
  const d = q.data

  return (
    <>
      <section className="px-8 py-3 border-y border-border-soft flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="eyebrow">Operations</span>
          <span className="chip text-[10.5px]">workspace inteiro</span>
        </div>
        <Link
          to="/operations"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-teal-700 dark:text-teal-300 hover:text-teal-500"
        >
          Abrir painel <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {q.isLoading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 border-b border-border-soft">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-6 py-5 border-r border-border-soft">
              <div className="h-3 w-24 rounded z-skeleton mb-3" />
              <div className="h-9 w-28 rounded z-skeleton" />
            </div>
          ))}
        </div>
      ) : d ? (
        <>
          <StatBand
            items={[
              {
                label: "Em custódia",
                value: fmtCents(d.money.inCustodyCents),
                hint: "reservado e ainda não resolvido",
              },
              {
                label: "Liberado",
                value: fmtCents(d.money.releasedCents),
                hint: "já pago aos criadores",
                tone: "pos",
              },
              {
                label: "Campanhas ativas",
                value: d.volume.activeCampaigns,
                hint: `de ${d.volume.totalCampaigns} no total`,
              },
              {
                label: "Criadores",
                value: d.volume.creators,
                hint: `${d.volume.signedContracts} ${d.volume.signedContracts === 1 ? "contrato assinado" : "contratos assinados"}`,
              },
            ]}
          />

          <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] border-b border-border-soft">
            <div className="p-7 lg:border-r border-b lg:border-b-0 border-border-soft">
              <EscrowByState rows={d.escrowByState} />
            </div>
            <div className="p-7">
              <OpsRisks risks={d.risks} />
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}

function IntelligenceDashboard({ embedded = false, afterHero }: {
  /** Dentro do dashboard full platform: sem o `-m-6`, que já veio de fora. */
  embedded?: boolean
  /** Entra logo abaixo da abertura — é onde mora a faixa de pendências. */
  afterHero?: React.ReactNode
}) {
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

  /** Média por dia e o dia de pico — o que o total do título não conta. */
  const ritmo = useMemo(() => {
    if (points.length === 0 || dist.total === 0) return null
    const porDia = points.map((p) => p.positive + p.neutral + p.negative)
    const pico = Math.max(...porDia)
    const iPico = porDia.indexOf(pico)
    const d = points[iPico].date
    return { media: dist.total / points.length, pico, picoDia: `${d.slice(8, 10)}/${d.slice(5, 7)}` }
  }, [points, dist.total])
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
    <div className={embedded ? "" : "-m-6"}>
      {/* Abertura: o resumo do período escrito em frase, com os números reais.
          Ela vale nos dois modos — no full platform ela era trocada por um
          slogan, e slogan não diz o que mudou desde ontem. */}
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

      {afterHero}

      <CoverageNotice tenantBrandIds={[brand.active?.tenantBrandId]} className="mx-8 mt-4" />

      {/* Faixa de números */}
      <section className="grid grid-cols-2 xl:grid-cols-4 border-b border-border-soft">
        {/* Média por dia, e não o total: o total já é o título da página, e repeti-lo
            aqui gastava a coluna mais visível com o número que a pessoa acabou de ler. */}
        <KpiCell i={0} label="Média diária · 30d" loading={evolution.isLoading} className="border-r border-b xl:border-b-0">
          <div className="flex items-end justify-between gap-4">
            <BigNumber color="var(--color-teal-500)">
              {ritmo == null ? "—" : <CountUp value={ritmo.media} format={(n) => nf1.format(n)} />}
            </BigNumber>
            {sparkVolume.length > 1 && (
              <div className="w-28 shrink-0"><Sparkline data={sparkVolume} height={30} color="#00A799" /></div>
            )}
          </div>
          <div className="text-[11.5px] text-ink-muted mt-3">
            {ritmo == null
              ? "sem menções no período"
              : `menções por dia · pico de ${ritmo.pico} em ${ritmo.picoDia}`}
          </div>
        </KpiCell>

        <KpiCell i={1} label="Score médio" loading={summary.isLoading} className="xl:border-r border-b xl:border-b-0">
          {s && (
            <>
              <div className="flex items-baseline gap-2">
                <BigNumber color={s.totalMentions > 0 ? scoreColor(s.avgScore) : "var(--ink)"}>
                  <CountUp value={s.avgScore} format={(n) => formatScore(n)} />
                </BigNumber>
                <span className="font-mono-zoe text-[11px] text-ink-muted">de 1,00</span>
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
              {/* 
              <div className="flex gap-3 mt-2.5 font-mono-zoe text-[10.5px] text-ink-muted">
                <span>{dist.pctNeu}% neutras</span>
                <span>{dist.pctNeg}% negativas</span>
              </div>
              */}
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
          /* Cartões com a miniatura, e não uma tabela: a lista em colunas é o que o
             Monitoramento já faz melhor — aqui a pergunta é "o que saiu agora". */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-8 pb-7">
            {recent.map((m, i) => (
              <button
                key={m.analysisId}
                onClick={() => navigate("/intelligence/monitoring")}
                className="z-rise group text-left rounded-lg border border-border-soft overflow-hidden bg-surface hover:border-teal-500 hover:bg-hover transition-colors cursor-pointer"
                style={stagger(6 + i)}
              >
                <div className="flex gap-3 p-3">
                  <VideoThumb
                    youtubeVideoId={m.youtubeVideoId}
                    durationSeconds={m.durationSeconds}
                    className="w-28 h-16"
                    playSize={18}
                  />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="text-[13px] font-medium leading-snug line-clamp-2 text-ink">{m.title}</div>
                    <div className="text-[11px] text-ink-muted truncate mt-1">
                      {m.channelName} · {formatDistanceToNow(new Date(m.publishedAt), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                </div>
                {/* Rodapé do cartão: o que a leitura do score assume (cobertura) e o
                    tamanho da audiência. Separado por linha, como os blocos da página. */}
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border-soft bg-inset">
                  <ConfidenceBadge pipelinePath={m.pipelinePath} confidence={m.confidence} />
                  {m.classificacao && (
                    <span className={`${classificationChip(m.classificacao)} text-[11.5px]`}>
                      {tEnum("classification", m.classificacao)}
                    </span>
                  )}
                  <span className="flex-1" />
                  <span className="font-mono-zoe text-[10.5px] text-ink-muted-2">
                    {m.views != null ? `${compact(m.views)} views` : "sem views"}
                  </span>
                </div>
              </button>
            ))}
          </div>
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
    avgScore != null && `score médio de ${formatScore(avgScore)}`,
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
  const bg = positive ? "var(--pos-bg)" : "var(--neg-bg)"
  return (
    <>
      <div className="flex items-center gap-2.5">
        <BigNumber color={color}>
          <CountUp value={value} format={(n) => `${n >= 0 ? "+" : ""}${Math.round(n)}%`} />
        </BigNumber>
        {value !== 0 && (
          <span className="w-6 h-6 rounded-full flex items-center justify-center z-fade" style={{ background: bg, color }}>
            <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
          </span>
        )}
      </div>
      <div className="text-[11.5px] text-ink-muted mt-3">contra os 30 dias anteriores</div>
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
  // A barra mede MENÇÕES porque é por menções que a API ordena (depois alcance).
  // Medindo alcance, o 1º da lista aparecia com a barra menor que o 3º.
  const maxMentions = Math.max(...top.map((r) => r.mentions), 1)

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Quem mais fala</div>
          <div className="text-[12px] text-ink-muted mt-1 mb-4">
            Top 5 canais por número de menções · 30 dias
          </div>
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
                  {/* Cada número dito por extenso: "67 · 4 menções" fazia o alcance
                      parecer contagem de menção. */}
                  <span className="text-[11.5px] text-ink-muted shrink-0">
                    {inf.mentions} {inf.mentions === 1 ? "menção" : "menções"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <span className="flex-1 h-[3px] rounded-full bg-tint-2 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-teal-500 z-grow-x"
                      style={{ width: `${Math.max(4, Math.round((inf.mentions / maxMentions) * 100))}%`, ...stagger(8 + i) }}
                    />
                  </span>
                  <span className="text-[10.5px] text-ink-muted-2 shrink-0">
                    <span className="font-mono-zoe">{compact(inf.reach)}</span> views ·{" "}
                    score <span className="font-mono-zoe" style={{ color: scoreColor(inf.avgScore) }}>
                      {formatScore(inf.avgScore)}
                    </span>
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-8 pb-7">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border-soft p-3 flex gap-3">
          <div className="w-28 h-16 rounded-md z-skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-11/12 rounded z-skeleton" />
            <div className="h-3 w-1/2 rounded z-skeleton" />
            <div className="h-4 w-20 rounded z-skeleton" />
          </div>
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

/**
 * Onde o dinheiro está parado, por estado da custódia.
 *
 * O total sozinho ("R$ 1,2 mi em custódia") não diz se o valor está esperando
 * depósito, esperando entrega ou pronto para sair — e são situações com donos
 * diferentes. A barra dá a proporção antes da leitura; a lista dá o número.
 */
function EscrowByState({ rows }: { rows: OperationsDashboard["escrowByState"] }) {
  const comValor = rows.filter((r) => r.amountCents > 0)
  const total = comValor.reduce((acc, r) => acc + r.amountCents, 0)

  if (total === 0) {
    return (
      <>
        <div className="eyebrow mb-3">Onde está o dinheiro</div>
        <p className="text-[13px] text-ink-muted m-0">
          Nenhum valor em custódia agora. A conta nasce do contrato assinado que prevê reserva.
        </p>
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="eyebrow">Onde está o dinheiro</div>
        <Link
          to="/operations/escrow"
          className="text-[12px] font-medium text-teal-700 dark:text-teal-300 hover:underline"
        >
          Ver custódia →
        </Link>
      </div>

      {/* `z-wipe`: escalar cada pedaço distorceria as proporções na entrada. */}
      <div className="flex h-2 rounded-full overflow-hidden bg-tint-2 z-wipe">
        {comValor.map((r) => (
          <span
            key={r.state}
            style={{ width: `${(r.amountCents / total) * 100}%`, background: ESCROW_STATE_COLOR[r.state] }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-4">
        {comValor.map((r) => (
          <div key={r.state} className="flex items-center gap-2.5 text-[12.5px]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: ESCROW_STATE_COLOR[r.state] }}
            />
            <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink-2)" }}>
              {tEnum("escrowState", r.state)}
            </span>
            <span className="font-mono-zoe text-[11.5px] text-ink-muted-2">
              {r.count}
            </span>
            <span className="font-mono-zoe w-28 text-right" style={{ color: "var(--ink)" }}>
              {fmtCents(r.amountCents)}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * O que travou — diferente das filas da faixa de cima.
 *
 * Fila é trabalho esperando a sua vez; isto aqui é coisa que não anda sozinha.
 * Cada linha diz a consequência, porque o número sem ela não move ninguém: "2
 * criadores sem conta" só vira urgente quando se lê que o pagamento não sai.
 */
function OpsRisks({ risks: r }: { risks: OperationsDashboard["risks"] }) {
  const itens = [
    r.stuckFinancialCommands > 0 && {
      n: r.stuckFinancialCommands,
      texto: r.stuckFinancialCommands === 1
        ? "operação financeira parada"
        : "operações financeiras paradas",
      consequencia: "O valor não se move sozinho a partir daqui.",
      href: "/operations/escrow",
    },
    r.contractsBlockedByLegalReview > 0 && {
      n: r.contractsBlockedByLegalReview,
      texto: r.contractsBlockedByLegalReview === 1
        ? "rascunho preso na revisão jurídica"
        : "rascunhos presos na revisão jurídica",
      consequencia: "O envio para assinatura é recusado até a Zoe liberar o template.",
      href: "/operations/contracts",
    },
    r.creatorsWithoutPayoutAccount > 0 && {
      n: r.creatorsWithoutPayoutAccount,
      texto: r.creatorsWithoutPayoutAccount === 1
        ? "criador sem conta de recebimento"
        : "criadores sem conta de recebimento",
      consequencia: "Podem assinar e produzir, mas o pagamento não sai.",
      href: "/operations/influencers",
    },
  ].filter(Boolean) as { n: number; texto: string; consequencia: string; href: string }[]

  if (itens.length === 0) {
    return (
      <>
        <div className="eyebrow mb-3">Atenção</div>
        <p className="text-[13px] text-ink-muted m-0">Nada travado na operação agora.</p>
      </>
    )
  }

  return (
    <>
      <div className="eyebrow mb-3">Atenção</div>
      <div className="flex flex-col gap-2">
        {itens.map((it) => (
          <Link
            key={it.href + it.texto}
            to={it.href}
            className="flex items-start gap-3 p-3 rounded-xl border transition-colors hover:brightness-[0.98]"
            style={{ borderColor: "var(--color-warn)", background: "var(--warn-bg)" }}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-warn)" }} />
            <span className="min-w-0">
              <span className="block text-[13px]" style={{ color: "var(--ink)" }}>
                <span className="font-mono-zoe font-semibold">{it.n}</span> {it.texto}
              </span>
              <span className="block text-[11.5px] text-ink-muted mt-0.5">{it.consequencia}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
