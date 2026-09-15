import { Link } from "react-router-dom"
import { ESCROW_STATE_COLOR } from "@/pages/operations/statusColors"
import {
  AlertTriangle, ArrowRight, CheckCircle2, FileText, Film, Megaphone, Users,
  Wallet, PenLine, Banknote,
} from "lucide-react"
import { tEnum } from "@/i18n/enums"
import { TableSkeleton, ErrorState } from "@/pages/operations/shared"
import {
  useOperationsDashboard, fmtCents, type OperationsDashboard,
} from "@/lib/api/operations"

/** Mesmas cores da trilha de custódia — o mesmo estado não pode mudar de cor entre telas. */
const ESCROW_COLOR = ESCROW_STATE_COLOR

/**
 * Painel do Operations.
 *
 * <p>A ordem da tela é a ordem da utilidade: primeiro o que está parado esperando alguém,
 * depois onde está o dinheiro, e só então os totais. Um painel que abre com "23 contratos"
 * informa sem pedir nada; a fila de aprovação é o que muda o dia de quem opera.</p>
 *
 * <p>Nenhum número aqui é estimado ou projetado. Todos vêm somados do servidor, do mesmo
 * lado em que a custódia é escrita — em módulo financeiro, duas contas para a mesma
 * pergunta é uma a mais.</p>
 */
export default function OperationsDashboardPage() {
  const q = useOperationsDashboard()

  if (q.isLoading) return <TableSkeleton rows={5} />
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />

  const d = q.data

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="eyebrow mb-2">Operations · Painel</div>
        <h1 className="font-display m-0" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
          Visão geral
        </h1>
        <p className="text-[14px] text-ink-muted mt-1.5 max-w-[620px]">
          O que está parado, onde está o dinheiro e o tamanho da operação — nesta ordem,
          porque só a primeira parte pede alguma coisa de você.
        </p>
      </div>

      <PendingPanel pending={d.pending} />
      <MoneyPanel money={d.money} byState={d.escrowByState} />
      <RisksPanel risks={d.risks} />
      <VolumePanel volume={d.volume} />
    </div>
  )
}

// ————————————————————————— O que espera por você —————————————————————————

type Fila = {
  n: number
  rotulo: string
  detalhe: string
  href: string
  icon: React.ReactNode
  urgente?: boolean
}

function PendingPanel({ pending: p }: { pending: OperationsDashboard["pending"] }) {
  const filas: Fila[] = [
    {
      n: p.escrowsReleasable,
      rotulo: p.escrowsReleasable === 1 ? "custódia liberável" : "custódias liberáveis",
      // A IA nunca libera sozinha (RN-O-056): esta fila não se esvazia por conta própria.
      detalhe: "Entrega aprovada. Falta o clique que solta o pagamento.",
      href: "/operations/escrow",
      icon: <Banknote className="w-4 h-4" />,
      urgente: true,
    },
    {
      n: p.draftsAwaitingReview,
      rotulo: p.draftsAwaitingReview === 1 ? "corte por aprovar" : "cortes por aprovar",
      detalhe: "O criador espera o aval antes de publicar.",
      href: "/operations/deliveries?etapa=cortes",
      icon: <Film className="w-4 h-4" />,
      urgente: true,
    },
    {
      n: p.deliveriesAwaitingReview,
      rotulo: p.deliveriesAwaitingReview === 1 ? "entrega por conferir" : "entregas por conferir",
      detalhe: "Vídeo publicado aguardando conferência.",
      href: "/operations/deliveries",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      n: p.escrowsAwaitingDeposit,
      rotulo: p.escrowsAwaitingDeposit === 1 ? "custódia sem depósito" : "custódias sem depósito",
      detalhe: "Sem o depósito, a produção não começa.",
      href: "/operations/escrow",
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      n: p.contractsAwaitingSignature,
      rotulo: p.contractsAwaitingSignature === 1
        ? "contrato aguardando assinatura" : "contratos aguardando assinatura",
      detalhe: "Enviado ao criador. Nada avança até ele assinar.",
      href: "/operations/contracts",
      icon: <PenLine className="w-4 h-4" />,
    },
    {
      n: p.contractDrafts,
      rotulo: p.contractDrafts === 1 ? "contrato em rascunho" : "contratos em rascunho",
      detalhe: "Ainda não saiu para assinatura.",
      href: "/operations/contracts",
      icon: <FileText className="w-4 h-4" />,
    },
  ]

  const ativas = filas.filter((f) => f.n > 0)

  return (
    <section>
      <div className="eyebrow mb-3">Esperando por você</div>

      {ativas.length === 0 ? (
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
          {ativas.map((f) => (
            <Link
              key={f.rotulo}
              to={f.href}
              className="group rounded-xl border p-4 transition-colors"
              style={{
                background: "var(--surface)",
                borderColor: f.urgente ? "var(--color-teal-500)" : "var(--border-soft)",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ color: f.urgente ? "var(--color-teal-500)" : "var(--ink-muted)" }}>
                  {f.icon}
                </span>
                <span
                  className="font-mono-zoe font-semibold"
                  style={{ fontSize: 22, color: "var(--ink)" }}
                >
                  {f.n}
                </span>
                <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                  {f.rotulo}
                </span>
              </div>
              <p className="text-[12px] text-ink-muted m-0">{f.detalhe}</p>
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
            destaque
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
            alerta={m.disputedCents > 0}
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
                      background: ESCROW_COLOR[b.state] ?? "#9CA3AF",
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
                    style={{ background: ESCROW_COLOR[b.state] ?? "#9CA3AF" }}
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
  label, value, hint, destaque, alerta,
}: {
  label: string
  value: number
  hint: string
  destaque?: boolean
  alerta?: boolean
}) {
  return (
    <div className="px-5 py-4 border-b sm:border-b-0 sm:border-r border-border-soft last:border-0">
      <div className="text-[11px] text-ink-muted mb-1">{label}</div>
      <div
        className="font-mono-zoe font-semibold"
        style={{
          fontSize: 20,
          color: alerta ? "#DC2626" : destaque ? "var(--color-teal-500)" : "var(--ink)",
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
  const itens = [
    r.stuckFinancialCommands > 0 && {
      n: r.stuckFinancialCommands,
      texto: r.stuckFinancialCommands === 1
        ? "operação financeira parada após esgotar as tentativas"
        : "operações financeiras paradas após esgotarem as tentativas",
      // Sem isto visível em algum lugar, uma liberação travada só aparece quando o
      // criador cobra.
      acao: "O valor não se move sozinho a partir daqui — precisa de intervenção.",
      href: "/operations/escrow",
      grave: true,
    },
    r.contractsBlockedByLegalReview > 0 && {
      n: r.contractsBlockedByLegalReview,
      texto: r.contractsBlockedByLegalReview === 1
        ? "rascunho preso na revisão jurídica do template"
        : "rascunhos presos na revisão jurídica do template",
      acao: "O envio para assinatura é recusado até a Zoe liberar o template.",
      href: "/operations/contracts",
      grave: false,
    },
    r.creatorsWithoutPayoutAccount > 0 && {
      n: r.creatorsWithoutPayoutAccount,
      texto: r.creatorsWithoutPayoutAccount === 1
        ? "criador sem conta de recebimento"
        : "criadores sem conta de recebimento",
      acao: "Podem assinar e produzir, mas o pagamento não sai.",
      href: "/operations/influencers",
      grave: false,
    },
  ].filter(Boolean) as { n: number; texto: string; acao: string; href: string; grave: boolean }[]

  if (itens.length === 0) return null

  return (
    <section>
      <div className="eyebrow mb-3">Atenção</div>
      <div className="flex flex-col gap-2">
        {itens.map((it) => (
          <Link
            key={it.texto}
            to={it.href}
            className="rounded-xl border p-4 flex items-start gap-3 transition-colors"
            style={{
              background: it.grave ? "#DC262610" : "var(--surface)",
              borderColor: it.grave ? "#DC2626" : "var(--border-soft)",
            }}
          >
            <AlertTriangle
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: it.grave ? "#DC2626" : "#D97706" }}
            />
            <div>
              <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                <span className="font-mono-zoe">{it.n}</span> {it.texto}
              </div>
              <p className="text-[12px] text-ink-muted m-0 mt-0.5">{it.acao}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ————————————————————————————— Volume —————————————————————————————

function VolumePanel({ volume: v }: { volume: OperationsDashboard["volume"] }) {
  const itens = [
    {
      icon: <Megaphone className="w-3.5 h-3.5" />,
      n: v.activeCampaigns,
      rotulo: "campanhas ativas",
      extra: `de ${v.totalCampaigns}`,
      href: "/operations/campaigns",
    },
    {
      icon: <Users className="w-3.5 h-3.5" />,
      n: v.creators,
      rotulo: v.creators === 1 ? "criador no elenco" : "criadores no elenco",
      extra: null,
      href: "/operations/influencers",
    },
    {
      icon: <FileText className="w-3.5 h-3.5" />,
      n: v.signedContracts,
      rotulo: v.signedContracts === 1 ? "contrato assinado" : "contratos assinados",
      extra: null,
      href: "/operations/contracts",
    },
    {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      n: v.approvedDeliveries,
      rotulo: v.approvedDeliveries === 1 ? "entrega aprovada" : "entregas aprovadas",
      extra: null,
      href: "/operations/deliveries",
    },
  ]

  return (
    <section>
      <div className="eyebrow mb-3">Tamanho da operação</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {itens.map((it) => (
          <Link
            key={it.rotulo}
            to={it.href}
            className="rounded-xl border border-border-soft p-4 hover:opacity-80 transition-opacity"
            style={{ background: "var(--surface)" }}
          >
            <div className="flex items-center gap-1.5 text-ink-muted mb-1.5">
              {it.icon}
              <span className="text-[11px]">{it.rotulo}</span>
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
