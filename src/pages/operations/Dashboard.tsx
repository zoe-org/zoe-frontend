import { Link } from "react-router-dom"
import { ESCROW_STATE_COLOR } from "@/lib/status-colors"
import {
  AlertTriangle, ArrowRight, CheckCircle2, FileText, Film, Megaphone, Users,
  Wallet, PenLine, Banknote,
} from "lucide-react"
import { tEnum } from "@/i18n/enums"
import { TableSkeleton, ErrorState } from "@/components/operations/shared"
import {
  useOperationsDashboard, fmtCents, type OperationsDashboard,
} from "@/lib/api/operations"

/** Mesmas cores da trilha de custódia — o mesmo estado não pode mudar de cor entre telas. */
const ESCROW_COLOR = ESCROW_STATE_COLOR

/**
 * Painel do Operations: o que espera alguém, onde está o dinheiro e só então os totais, todos somados no servidor.
 */
export default function OperationsDashboardPage() {
  const q = useOperationsDashboard()

  if (q.isLoading) return <TableSkeleton rows={5} />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />

  const d = q.data

  return (
    // Abertura full-bleed como o resto da plataforma; os painéis seguem em
    // cartões dentro de um container com respiro — num painel os cartões são o
    // agrupamento certo, diferente das listas, que sangram até a borda.
    <div className="-m-6" style={{ color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex-1 max-w-190 min-w-70">
          <div className="eyebrow mb-3">Operations · Painel</div>
          <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
            Visão geral
          </h1>
          <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-150">
            O que está parado, onde está o dinheiro e o tamanho da operação — nesta ordem,
            porque só a primeira parte pede alguma coisa de você.
          </p>
        </div>
      </section>

      <div className="px-8 py-7 flex flex-col gap-8">
        <PendingPanel pending={d.pending} />
        <MoneyPanel money={d.money} byState={d.escrowByState} />
        <RisksPanel risks={d.risks} />
        <VolumePanel volume={d.volume} />
      </div>
    </div>
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
}

function PendingPanel({ pending: p }: { pending: OperationsDashboard["pending"] }) {
  const queues: WorkQueue[] = [
    {
      n: p.escrowsReleasable,
      label: p.escrowsReleasable === 1 ? "custódia liberável" : "custódias liberáveis",
      // A IA nunca libera sozinha (RN-O-056): esta fila não se esvazia por conta própria.
      detail: "Entrega aprovada. Falta o clique que solta o pagamento.",
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

  return (
    <section>
      <div className="eyebrow mb-3">Dinheiro em custódia</div>

      <div
        className="rounded-xl border border-border-soft overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Money
            label="Aguardando depósito"
            value={m.pendingDepositCents}
            hint="Custódia aberta, valor ainda não reservado"
          />
          <Money
            label="Reservado agora"
            value={m.inCustodyCents}
            hint="Separado no provedor, à espera da entrega"
            emphasis
          />
          <Money
            label="Liberado a criadores"
            value={m.netReleasedToCreatorsCents}
            hint={`Líquido pago · taxa de ${fmtCents(m.platformFeeOnReleasedCents)}`}
          />
          <Money
            label="Devolvido"
            value={m.refundedCents}
            hint={m.disputedCents > 0
              ? `${fmtCents(m.disputedCents)} retidos em disputa`
              : "Nenhuma disputa em aberto"}
            warning={m.disputedCents > 0}
          />
        </div>

        {/* Barra proporcional aos valores, nao a contagem: uma custodia de R$ 50 mil e
            vinte de R$ 500 nao pesam igual, e uma barra por contagem diria que sim. */}
        {total > 0 && (
          <div className="px-5 pb-5 pt-1 border-t border-border-soft">
            <div className="flex h-2 rounded-full overflow-hidden mt-4 mb-3">
              {byState
                .filter((b) => b.amountCents > 0)
                .map((b) => (
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

            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {byState.filter((b) => b.amountCents > 0).map((b) => (
                <Link
                  key={b.state}
                  to="/operations/escrow"
                  className="inline-flex items-center gap-1.5 text-[11.5px] hover:opacity-70"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: ESCROW_COLOR[b.state] ?? "var(--ink-muted-2)" }}
                  />
                  <span style={{ color: "var(--ink)" }}>{tEnum("escrowState", b.state)}</span>
                  <span className="text-ink-muted font-mono-zoe">
                    {b.count} · {fmtCents(b.amountCents)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {total === 0 && (
          <p className="text-[12.5px] text-ink-muted m-0 px-5 pb-5">
            Nenhuma custódia aberta ainda. Ela nasce quando um contrato assinado tem valor
            a reservar.
          </p>
        )}
      </div>
    </section>
  )
}

function Money({
  label, value, hint, emphasis, warning,
}: {
  label: string
  value: number
  hint: string
  emphasis?: boolean
  warning?: boolean
}) {
  return (
    <div className="px-5 py-4 border-b sm:border-b-0 sm:border-r border-border-soft last:border-0">
      <div className="text-[11px] text-ink-muted mb-1">{label}</div>
      <div
        className="font-mono-zoe font-semibold"
        style={{
          fontSize: 20,
          color: warning ? "#DC2626" : emphasis ? "var(--color-teal-500)" : "var(--ink)",
        }}
      >
        {fmtCents(value)}
      </div>
      <div className="text-[11px] text-ink-muted mt-1">{hint}</div>
    </div>
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

function VolumePanel({ volume: v }: { volume: OperationsDashboard["volume"] }) {
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
    <section>
      <div className="eyebrow mb-3">Tamanho da operação</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.href}
            className="rounded-xl border border-border-soft p-4 hover:opacity-80 transition-opacity"
            style={{ background: "var(--surface)" }}
          >
            <div className="flex items-center gap-1.5 text-ink-muted mb-1.5">
              {it.icon}
              <span className="text-[11px]">{it.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-mono-zoe font-semibold"
                style={{ fontSize: 24, color: "var(--ink)" }}
              >
                {it.n}
              </span>
              {it.extra && <span className="text-[11.5px] text-ink-muted">{it.extra}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
