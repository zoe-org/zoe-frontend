import { Link } from "react-router-dom"
import { ESCROW_STATE_COLOR } from "@/lib/status-colors"
import {
  AlertTriangle, ArrowRight, CheckCircle2, FileText, Film, Megaphone, Users,
  Wallet, PenLine, Banknote, CircleDollarSign, ShieldAlert,
} from "lucide-react"
import { tEnum } from "@/i18n/enums"
import { TableSkeleton, ErrorState } from "@/components/operations/shared"
import { StatBand } from "@/components/ui/stat-band"
import { stagger } from "@/lib/motion"
import {
  useOperationsDashboard, fmtCents, type OperationsDashboard,
} from "@/lib/api/operations"

/** Mesmas cores da trilha de custódia — o mesmo estado não pode mudar de cor entre telas. */
const ESCROW_COLOR = ESCROW_STATE_COLOR

/**
 * Painel do Operations: o que espera alguém, onde está o dinheiro e só então os totais, todos somados no servidor.
 */
export default function OperationsDashboardPage({ embedded = false }: { embedded?: boolean }) {
  const q = useOperationsDashboard()

  if (q.isLoading) return <TableSkeleton rows={5} />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />

  const d = q.data
  const riskTotal = Object.values(d.risks).reduce((total, value) => total + value, 0)

  if (embedded) return <OperationsOverview data={d} />

  return (
    // Abertura full-bleed como o resto da plataforma; os painéis seguem em
    // cartões dentro de um container com respiro — num painel os cartões são o
    // agrupamento certo, diferente das listas, que sangram até a borda.
    <div className={embedded ? "" : "-m-6"} style={{ color: "var(--ink)" }}>
      {!embedded && <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex-1 max-w-220 min-w-70">
          <div className="eyebrow mb-3">Operations · Workspace inteiro</div>
          <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
            Centro de operações
          </h1>
          {/* Sem a linha de resumo que havia aqui: ela dizia "N pendências ·
              R$ X em custódia · N riscos", que é exatamente o que as três
              seções logo abaixo detalham. Ler o mesmo número duas vezes em
              200px não é reforço, é ruído. */}
          <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-150">
            Acompanhe o que está parado, onde está o dinheiro e o tamanho da operação.
            Estes números não mudam quando você troca a marca ativa.
          </p>
        </div>
      </section>}

      {/* Faixa de números, como em Custódia e Alertas. O Painel era a única
          tela do módulo sem ela — os valores viviam dentro do cartão de
          dinheiro, no meio da página. */}
      <StatBand
        items={[
          {
            label: "Em custódia",
            value: fmtCents(d.money.inCustodyCents),
            hint: "reservado no provedor, à espera da entrega",
          },
          {
            label: "Aguardando depósito",
            value: fmtCents(d.money.pendingDepositCents),
            hint: "custódia aberta, valor não reservado",
            tone: d.money.pendingDepositCents > 0 ? "warn" : undefined,
          },
          {
            label: "Liberado a criadores",
            value: fmtCents(d.money.netReleasedToCreatorsCents),
            hint: `líquido pago · taxa de ${fmtCents(d.money.platformFeeOnReleasedCents)}`,
            tone: "pos",
          },
          {
            label: "Riscos abertos",
            value: riskTotal,
            hint: riskTotal === 0 ? "nada travado" : "não andam sozinhos",
            tone: riskTotal > 0 ? "warn" : undefined,
          },
        ]}
      />

      {/* O trabalho primeiro e junto. Fila é o que espera a sua vez; risco é
          o que não anda sozinho — as duas coisas que pedem ação. */}
      <section
        className={`px-8 py-7 border-b border-border-soft z-rise ${riskTotal > 0
          ? "grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-8 items-start"
          : ""}`}
        style={stagger(0)}
      >
        <PendingPanel pending={d.pending} byState={d.escrowByState} />
        {riskTotal > 0 && <RisksPanel risks={d.risks} />}
      </section>

      <section className="px-8 py-7 border-b border-border-soft z-rise" style={stagger(1)}>
        <MoneyPanel money={d.money} byState={d.escrowByState} />
      </section>

      {/* Contexto, não trabalho. */}
      <section className="px-8 py-5 z-rise" style={stagger(2)}>
        <VolumeStrip volume={d.volume} />
      </section>
    </div>
  )
}

function OperationsOverview({ data: d }: { data: OperationsDashboard }) {
  const reviewQueue = d.pending.draftsAwaitingReview + d.pending.deliveriesAwaitingReview
  const riskTotal = Object.values(d.risks).reduce((total, value) => total + value, 0)
  const activeRate = d.volume.totalCampaigns === 0
    ? 0
    : Math.round((d.volume.activeCampaigns / d.volume.totalCampaigns) * 100)

  return (
    <div>
      <section className="grid grid-cols-2 xl:grid-cols-4 border-b border-border-soft">
        <OverviewKpi
          label="Campanhas ativas"
          value={d.volume.activeCampaigns}
          detail={`${activeRate}% das ${d.volume.totalCampaigns} campanhas`}
          href="/operations/campaigns"
          icon={<Megaphone className="w-4 h-4" />}
        />
        <OverviewKpi
          label="Aguardando revisão"
          value={reviewQueue}
          detail={`${d.pending.draftsAwaitingReview} cortes · ${d.pending.deliveriesAwaitingReview} entregas`}
          href="/operations/deliveries"
          icon={<Film className="w-4 h-4" />}
          emphasis={reviewQueue > 0}
        />
        <OverviewKpi
          label="Em custódia"
          value={fmtCents(d.money.inCustodyCents)}
          detail={`${fmtCents(d.money.pendingDepositCents)} aguardando depósito`}
          href="/operations/escrow"
          icon={<CircleDollarSign className="w-4 h-4" />}
        />
        <OverviewKpi
          label="Pronto para liberar"
          value={d.pending.escrowsReleasable}
          detail={d.pending.escrowsReleasable > 0 ? "pagamentos dependem de ação" : "nenhum pagamento pendente"}
          href="/operations/escrow"
          icon={<Banknote className="w-4 h-4" />}
          emphasis={d.pending.escrowsReleasable > 0}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] border-b border-border-soft">
        <div className="p-7 lg:border-r border-b lg:border-b-0 border-border-soft">
          <OperationalFlow pending={d.pending} />
        </div>
        <div className="p-7">
          <OperationsHealth data={d} riskTotal={riskTotal} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr]">
        <div className="p-7 lg:border-r border-b lg:border-b-0 border-border-soft">
          <EscrowFlow money={d.money} byState={d.escrowByState} />
        </div>
        <div className="p-7">
          <OperationReach volume={d.volume} />
        </div>
      </section>
    </div>
  )
}

function OverviewKpi({ label, value, detail, href, icon, emphasis }: {
  label: string
  value: number | string
  detail: string
  href: string
  icon: React.ReactNode
  emphasis?: boolean
}) {
  return (
    <Link
      to={href}
      className="group min-h-38 px-6 py-5 border-r border-b xl:border-b-0 border-border-soft last:border-r-0 hover:bg-hover transition-colors"
    >
      <div className="flex items-center justify-between gap-3 text-ink-muted mb-4">
        <span className="eyebrow">{label}</span>
        <span className="group-hover:text-teal-500 transition-colors">{icon}</span>
      </div>
      <div
        className="font-mono-zoe font-semibold leading-none"
        style={{ fontSize: 27, color: emphasis ? "var(--color-teal-500)" : "var(--ink)" }}
      >
        {value}
      </div>
      <div className="text-[11.5px] text-ink-muted mt-3">{detail}</div>
    </Link>
  )
}

function OperationalFlow({ pending: p }: { pending: OperationsDashboard["pending"] }) {
  const stages = [
    { label: "Contratos em rascunho", value: p.contractDrafts, href: "/operations/contracts" },
    { label: "Aguardando assinatura", value: p.contractsAwaitingSignature, href: "/operations/contracts" },
    { label: "Cortes por aprovar", value: p.draftsAwaitingReview, href: "/operations/deliveries?stage=drafts" },
    { label: "Entregas por conferir", value: p.deliveriesAwaitingReview, href: "/operations/deliveries" },
    { label: "Pagamentos liberáveis", value: p.escrowsReleasable, href: "/operations/escrow" },
  ]
  const peak = Math.max(1, ...stages.map((stage) => stage.value))

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <div className="eyebrow">Fila operacional</div>
          <p className="text-[12px] text-ink-muted mt-1 mb-0">Onde o trabalho está acumulando agora</p>
        </div>
        <Link to="/operations" className="text-[12px] font-medium text-teal-700 dark:text-teal-300 hover:text-teal-500">
          Ver painel →
        </Link>
      </div>
      <div className="space-y-3.5">
        {stages.map((stage) => (
          <Link key={stage.label} to={stage.href} className="group grid grid-cols-[minmax(0,1fr)_2.5rem] gap-4 items-center">
            <div>
              <div className="flex justify-between gap-4 text-[12px] mb-1.5">
                <span className="text-ink group-hover:text-teal-500 transition-colors">{stage.label}</span>
                <span className="font-mono-zoe text-ink-muted">{stage.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-tint-2 overflow-hidden">
                <span
                  className="block h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${(stage.value / peak) * 100}%`, background: stage.value > 0 ? "var(--color-teal-500)" : "var(--border)" }}
                />
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-ink-muted-2 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>
    </section>
  )
}

function OperationsHealth({ data: d, riskTotal }: { data: OperationsDashboard; riskTotal: number }) {
  const signals = [
    { value: d.risks.stuckFinancialCommands, label: "falhas financeiras", href: "/operations/escrow", severe: true },
    { value: d.risks.contractsBlockedByLegalReview, label: "contratos bloqueados", href: "/operations/contracts" },
    { value: d.risks.creatorsWithoutPayoutAccount, label: "criadores sem conta", href: "/operations/influencers" },
    { value: d.pending.escrowsAwaitingDeposit, label: "custódias sem depósito", href: "/operations/escrow" },
  ].filter((signal) => signal.value > 0)

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <div className="eyebrow">Saúde da operação</div>
          <p className="text-[12px] text-ink-muted mt-1 mb-0">Bloqueios que podem atrasar o fluxo</p>
        </div>
        <ShieldAlert className="w-4 h-4" style={{ color: riskTotal > 0 ? "#D97706" : "var(--color-teal-500)" }} />
      </div>
      {signals.length === 0 ? (
        <div className="min-h-40 flex flex-col justify-center items-center text-center border-y border-border-soft">
          <CheckCircle2 className="w-6 h-6 text-teal-500 mb-2" />
          <div className="text-[13px] font-medium text-ink">Fluxo saudável</div>
          <div className="text-[11.5px] text-ink-muted mt-1">Nenhum bloqueio operacional detectado.</div>
        </div>
      ) : (
        <div className="divide-y divide-border-soft border-y border-border-soft">
          {signals.map((signal) => (
            <Link key={signal.label} to={signal.href} className="flex items-center gap-3 py-3 group">
              <span className="font-mono-zoe text-[16px] font-semibold" style={{ color: signal.severe ? "#DC2626" : "#D97706" }}>
                {signal.value}
              </span>
              <span className="text-[12.5px] text-ink flex-1 group-hover:text-teal-500">{signal.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-ink-muted-2" />
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function EscrowFlow({ money: m, byState }: {
  money: OperationsDashboard["money"]
  byState: OperationsDashboard["escrowByState"]
}) {
  const total = byState.reduce((sum, state) => sum + state.amountCents, 0)

  return (
    <section>
      <div className="eyebrow">Fluxo financeiro</div>
      <p className="text-[12px] text-ink-muted mt-1 mb-5">Distribuição do dinheiro nas custódias do workspace</p>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mb-4">
        <div>
          <div className="font-mono-zoe text-[24px] font-semibold text-ink">{fmtCents(total)}</div>
          <div className="text-[11px] text-ink-muted mt-1">movimentado nas custódias abertas</div>
        </div>
        <div className="text-[11.5px] text-ink-muted">
          {fmtCents(m.netReleasedToCreatorsCents)} já liberados a criadores
        </div>
      </div>
      {total > 0 ? (
        <>
          <div className="flex h-2 rounded-full overflow-hidden bg-tint-2">
            {byState.filter((state) => state.amountCents > 0).map((state) => (
              <span
                key={state.state}
                title={`${tEnum("escrowState", state.state)}: ${fmtCents(state.amountCents)}`}
                style={{ width: `${(state.amountCents / total) * 100}%`, background: ESCROW_COLOR[state.state] ?? "var(--ink-muted-2)" }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            {byState.filter((state) => state.amountCents > 0).map((state) => (
              <span key={state.state} className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
                <span className="w-2 h-2 rounded-full" style={{ background: ESCROW_COLOR[state.state] ?? "var(--ink-muted-2)" }} />
                {tEnum("escrowState", state.state)} · {state.count}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="py-5 border-y border-border-soft text-[12.5px] text-ink-muted">Nenhuma custódia aberta.</div>
      )}
    </section>
  )
}

function OperationReach({ volume: v }: { volume: OperationsDashboard["volume"] }) {
  const items = [
    { value: v.creators, label: "criadores no elenco", href: "/operations/influencers" },
    { value: v.signedContracts, label: "contratos assinados", href: "/operations/contracts" },
    { value: v.approvedDeliveries, label: "entregas aprovadas", href: "/operations/deliveries" },
  ]

  return (
    <section>
      <div className="eyebrow">Alcance operacional</div>
      <p className="text-[12px] text-ink-muted mt-1 mb-3">Base acumulada do workspace</p>
      <div className="divide-y divide-border-soft border-y border-border-soft">
        {items.map((item) => (
          <Link key={item.label} to={item.href} className="flex items-baseline justify-between gap-4 py-3 group">
            <span className="text-[12px] text-ink-muted group-hover:text-teal-500">{item.label}</span>
            <span className="font-mono-zoe text-[18px] font-semibold text-ink">{item.value}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ————————————————————————— O que espera por você —————————————————————————

type WorkQueue = {
  n: number
  label: string
  detail: string
  href: string
  icon: React.ReactNode
  urgent?: boolean
  /** Dinheiro parado nesta fila, quando ela é de custódia. */
  amountCents?: number
}

function PendingPanel({ pending: p, byState }: {
  pending: OperationsDashboard["pending"]
  byState: OperationsDashboard["escrowByState"]
}) {
  /**
   * Quanto dinheiro há em cada fila de custódia.
   *
   * A contagem sozinha não dimensiona: "5 custódias liberáveis" pode ser R$ 3
   * mil ou R$ 300 mil, e a decisão de parar o que está fazendo para liberar é
   * diferente nos dois casos. O valor já vinha na resposta, em `escrowByState`,
   * só não estava ligado à fila correspondente.
   */
  const valorDoEstado = (state: string) =>
    byState.find((b) => b.state === state)?.amountCents ?? 0

  const queues: WorkQueue[] = [
    {
      n: p.escrowsReleasable,
      label: p.escrowsReleasable === 1 ? "custódia liberável" : "custódias liberáveis",
      // A IA nunca libera sozinha (RN-O-056): esta fila não se esvazia por conta própria.
      detail: "Entrega aprovada. Falta o clique que solta o pagamento.",
      amountCents: valorDoEstado("Releasable"),
      href: "/operations/escrow",
      icon: <Banknote className="w-4 h-4" />,
      urgent: true,
    },
    {
      n: p.draftsAwaitingReview,
      label: p.draftsAwaitingReview === 1 ? "corte por aprovar" : "cortes por aprovar",
      detail: "O criador espera o aval antes de publicar.",
      href: "/operations/deliveries?stage=drafts",
      icon: <Film className="w-4 h-4" />,
      urgent: true,
    },
    {
      n: p.deliveriesAwaitingReview,
      label: p.deliveriesAwaitingReview === 1 ? "entrega por conferir" : "entregas por conferir",
      detail: "Vídeo publicado aguardando conferência.",
      href: "/operations/deliveries",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      n: p.escrowsAwaitingDeposit,
      label: p.escrowsAwaitingDeposit === 1 ? "custódia sem depósito" : "custódias sem depósito",
      detail: "Sem o depósito, a produção não começa.",
      amountCents: valorDoEstado("PendingDeposit"),
      href: "/operations/escrow",
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      n: p.contractsAwaitingSignature,
      label: p.contractsAwaitingSignature === 1
        ? "contrato aguardando assinatura" : "contratos aguardando assinatura",
      detail: "Enviado ao criador. Nada avança até ele assinar.",
      href: "/operations/contracts",
      icon: <PenLine className="w-4 h-4" />,
    },
    {
      n: p.contractDrafts,
      label: p.contractDrafts === 1 ? "contrato em rascunho" : "contratos em rascunho",
      detail: "Ainda não saiu para assinatura.",
      href: "/operations/contracts",
      icon: <FileText className="w-4 h-4" />,
    },
  ]

  const activeQueues = queues.filter((f) => f.n > 0)

  return (
    <section>
      <div className="eyebrow mb-3">Esperando por você</div>

      {activeQueues.length === 0 ? (
        <div
          className="rounded-xl border border-border-soft p-5 flex items-center gap-3"
          style={{ background: "var(--surface)" }}
        >
          <CheckCircle2 className="w-5 h-5" style={{ color: "var(--color-teal-500)" }} />
          <p className="text-[13.5px] text-ink-muted m-0">
            Nada parado. Nenhum contrato, corte ou pagamento depende de você agora.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeQueues.map((f) => (
            <Link
              key={f.label}
              to={f.href}
              className="group rounded-xl border p-4 transition-colors"
              style={{
                background: "var(--surface)",
                borderColor: f.urgent ? "var(--color-teal-500)" : "var(--border-soft)",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ color: f.urgent ? "var(--color-teal-500)" : "var(--ink-muted)" }}>
                  {f.icon}
                </span>
                <span
                  className="font-mono-zoe font-semibold"
                  style={{ fontSize: 22, color: "var(--ink)" }}
                >
                  {f.n}
                </span>
                <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                  {f.label}
                </span>
              </div>
              <p className="text-[12px] text-ink-muted m-0">{f.detail}</p>
              {f.amountCents !== undefined && f.amountCents > 0 && (
                <p className="text-[12.5px] font-mono-zoe m-0 mt-1.5" style={{ color: "var(--ink)" }}>
                  {fmtCents(f.amountCents)}
                </p>
              )}
              <span
                className="inline-flex items-center gap-1 text-[12px] font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-teal-500)" }}
              >
                Abrir <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

// ————————————————————————————— Dinheiro —————————————————————————————

function MoneyPanel({
  money: m, byState,
}: {
  money: OperationsDashboard["money"]
  byState: OperationsDashboard["escrowByState"]
}) {
  const total = byState.reduce((acc, b) => acc + b.amountCents, 0)
  const comValor = byState.filter((b) => b.amountCents > 0)

  return (
    <>
      {/* Só a divisão por estado. As quatro células de valor que havia aqui —
          reservado, aguardando depósito, liberado — repetiam a faixa de números
          do topo, com a mesma explicação reescrita. Ler o mesmo R$ duas vezes na
          mesma tela não é reforço: faz duvidar se são a mesma coisa. */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="eyebrow">Custódia por estado</div>
        <Link
          to="/operations/escrow"
          className="text-[12px] font-medium text-teal-700 dark:text-teal-300 hover:underline"
        >
          Ver custódia →
        </Link>
      </div>

      {total > 0 ? (
        <>
          {/* Barra proporcional aos valores, nao a contagem: uma custodia de R$ 50 mil e
              vinte de R$ 500 nao pesam igual, e uma barra por contagem diria que sim. */}
          <div className="flex h-2 rounded-full overflow-hidden bg-tint-2 z-wipe">
            {comValor.map((b) => (
              <div
                key={b.state}
                title={`${tEnum("escrowState", b.state)}: ${fmtCents(b.amountCents)}`}
                style={{
                  width: `${(b.amountCents / total) * 100}%`,
                  background: ESCROW_COLOR[b.state] ?? "var(--ink-muted-2)",
                }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {comValor.map((b) => (
              <Link
                key={b.state}
                to="/operations/escrow"
                className="flex items-center gap-2.5 text-[12.5px] hover:opacity-70"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: ESCROW_COLOR[b.state] ?? "var(--ink-muted-2)" }}
                />
                <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink-2)" }}>
                  {tEnum("escrowState", b.state)}
                </span>
                <span className="font-mono-zoe text-[11.5px] text-ink-muted-2">{b.count}</span>
                <span className="font-mono-zoe w-32 text-right" style={{ color: "var(--ink)" }}>
                  {fmtCents(b.amountCents)}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[12.5px] text-ink-muted m-0">
          Nenhuma custódia aberta ainda. Ela nasce quando um contrato assinado tem valor
          a reservar.
        </p>
      )}

      {/* Devolvido e disputa não cabem na faixa do topo e não são "estado
          corrente" — mas somem da tela se não forem ditos em algum lugar. */}
      {(m.refundedCents > 0 || m.disputedCents > 0) && (
        <p className="text-[12px] text-ink-muted mt-4 mb-0">
          Devolvido às marcas:{" "}
          <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{fmtCents(m.refundedCents)}</span>
          {m.disputedCents > 0 && (
            <>
              {" · "}
              <span className="font-mono-zoe" style={{ color: "var(--color-warn)" }}>
                {fmtCents(m.disputedCents)}
              </span>{" "}
              retidos em disputa
            </>
          )}
        </p>
      )}
    </>
  )
}

// ————————————————————————————— Riscos —————————————————————————————

function RisksPanel({ risks: r }: { risks: OperationsDashboard["risks"] }) {
  const items = [
    r.stuckFinancialCommands > 0 && {
      n: r.stuckFinancialCommands,
      text: r.stuckFinancialCommands === 1
        ? "operação financeira parada após esgotar as tentativas"
        : "operações financeiras paradas após esgotarem as tentativas",
      // Sem isto visível em algum lugar, uma liberação travada só aparece quando o
      // criador cobra.
      consequence: "O valor não se move sozinho a partir daqui — precisa de intervenção.",
      href: "/operations/escrow",
      severe: true,
    },
    r.contractsBlockedByLegalReview > 0 && {
      n: r.contractsBlockedByLegalReview,
      text: r.contractsBlockedByLegalReview === 1
        ? "rascunho preso na revisão jurídica do template"
        : "rascunhos presos na revisão jurídica do template",
      consequence: "O envio para assinatura é recusado até a Zoe liberar o template.",
      href: "/operations/contracts",
      severe: false,
    },
    r.creatorsWithoutPayoutAccount > 0 && {
      n: r.creatorsWithoutPayoutAccount,
      text: r.creatorsWithoutPayoutAccount === 1
        ? "criador sem conta de recebimento"
        : "criadores sem conta de recebimento",
      consequence: "Podem assinar e produzir, mas o pagamento não sai.",
      href: "/operations/influencers",
      severe: false,
    },
  ].filter(Boolean) as { n: number; text: string; consequence: string; href: string; severe: boolean }[]

  if (items.length === 0) return null

  return (
    <section>
      <div className="eyebrow mb-3">Atenção</div>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <Link
            key={it.text}
            to={it.href}
            className="rounded-xl border p-4 flex items-start gap-3 transition-colors"
            style={{
              background: it.severe ? "#DC262610" : "var(--surface)",
              borderColor: it.severe ? "#DC2626" : "var(--border-soft)",
            }}
          >
            <AlertTriangle
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: it.severe ? "#DC2626" : "#D97706" }}
            />
            <div>
              <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                <span className="font-mono-zoe">{it.n}</span> {it.text}
              </div>
              <p className="text-[12px] text-ink-muted m-0 mt-0.5">{it.consequence}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ————————————————————————————— Volume —————————————————————————————

function VolumeStrip({ volume: v }: { volume: OperationsDashboard["volume"] }) {
  const items = [
    {
      icon: <Megaphone className="w-3.5 h-3.5" />,
      n: v.activeCampaigns,
      label: "campanhas ativas",
      extra: `de ${v.totalCampaigns}`,
      href: "/operations/campaigns",
    },
    {
      icon: <Users className="w-3.5 h-3.5" />,
      n: v.creators,
      label: v.creators === 1 ? "criador no elenco" : "criadores no elenco",
      extra: null,
      href: "/operations/influencers",
    },
    {
      icon: <FileText className="w-3.5 h-3.5" />,
      n: v.signedContracts,
      label: v.signedContracts === 1 ? "contrato assinado" : "contratos assinados",
      extra: null,
      href: "/operations/contracts",
    },
    {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      n: v.approvedDeliveries,
      label: v.approvedDeliveries === 1 ? "entrega aprovada" : "entregas aprovadas",
      extra: null,
      href: "/operations/deliveries",
    },
  ]

  return (
    <section
      className="rounded-xl border border-border-soft px-4 py-3 flex items-center gap-x-7 gap-y-2 flex-wrap"
      style={{ background: "var(--surface)" }}
    >
      <span className="eyebrow shrink-0">Tamanho da operação</span>
      {items.map((it) => (
        <Link
          key={it.label}
          to={it.href}
          className="inline-flex items-center gap-1.5 hover:underline"
          style={{ color: "var(--ink)" }}
        >
          <span className="text-ink-muted-2 shrink-0" aria-hidden>{it.icon}</span>
          <span className="font-mono-zoe font-semibold text-[14px]">{it.n}</span>
          <span className="text-[12px] text-ink-muted">
            {it.label}{it.extra ? ` ${it.extra}` : ""}
          </span>
        </Link>
      ))}
    </section>
  )
}
