import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2, Wallet, AlertTriangle, Clock, X } from "lucide-react"
import { toast } from "sonner"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { ApiError } from "@/lib/api"
import { EmptyBlock } from "@/components/ui/empty-block"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, matches, campanhaLabel } from "@/pages/operations/format"
import {
  TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/pages/operations/shared"
import {
  useEscrowAccounts, useEscrowMutations, fmtCents,
  ESCROW_STATES, ESCROW_ACTION_TRIGGER,
  type EscrowSummary, type EscrowAction,
} from "@/lib/api/operations"

/**
 * Quadro da custódia: KPIs em faixa, trilha de estados e lista.
 *
 * <p><b>O kanban do protótipo saiu.</b> Ele custa nove colunas de largura fixa — rolagem
 * horizontal garantida — para mostrar, quase sempre, oito colunas vazias e um cartão
 * empurrado para fora da tela. Kanban se paga quando as colunas estão povoadas e o
 * trabalho é arrastar entre elas; aqui a transição é ação com regra, e o volume de uma
 * marca cabe numa lista.</p>
 *
 * <p>A trilha de estados continua existindo, comprimida numa faixa que <b>filtra</b> em
 * vez de conter. O panorama sobrevive; a rolagem, não.</p>
 *
 * <p><b>Os nove estados continuam visíveis</b>, incluindo os três que o protótipo omitia:
 * <c>Delivered</c>, <c>Disputed</c> e <c>Refunded</c>. Esconder disputa e devolução de uma
 * tela de dinheiro é o pior lugar possível para simplificar — some justamente com os casos
 * que o operador precisa achar rápido.</p>
 */
const COLUMN_COLOR: Record<string, string> = {
  PendingDeposit: "#9CA3AF",
  Funded: "#2563EB",
  InProduction: "#D97706",
  Delivered: "#7C3AED",
  UnderReview: "#8B5CF6",
  Releasable: "#00A799",
  Released: "#059669",
  Disputed: "#DC2626",
  Refunded: "#6B7280",
}

const NO_ITEMS: EscrowSummary[] = []

export default function OperationsEscrowPage() {
  const escrow = useEscrowAccounts()
  const [selected, setSelected] = useState<string | null>(null)

  const items = escrow.data?.items ?? NO_ITEMS
  const totals = escrow.data?.totals
  const [filtro, setFiltro] = useState<string | null>(null)
  const [busca, setBusca] = useState("")

  const contagem = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of ESCROW_STATES) c[s] = 0
    for (const e of items) c[e.state] = (c[e.state] ?? 0) + 1
    return c
  }, [items])

  // Ordena por URGENCIA, nao por data: numa tela de dinheiro o que precisa de alguem tem
  // de vir primeiro. Reserva caida e' o pior caso — o valor deixou de estar separado.
  const lista = useMemo(() => {
    const peso = (e: EscrowSummary) =>
      e.authorizationLapsedAt ? 0
      : e.isAuthorizationExpired ? 1
      : e.payoutAccountMissing && !e.isTerminal ? 2
      : e.state === "Disputed" ? 3
      : e.allowedTriggers.length > 0 && !e.hasPendingCommand ? 4
      : e.isTerminal ? 6
      : 5

    return items
      .filter((e) => (filtro ? e.state === filtro : true))
      .filter((e) => matches(busca, e.influencerName, e.campaignName))
      .slice()
      .sort((a, b) => peso(a) - peso(b) || b.amountCents - a.amountCents)
  }, [items, filtro, busca])

  const current = items.find((e) => e.escrowAccountId === selected) ?? null

  const kpis = [
    {
      label: "Em custódia",
      value: totals ? fmtCents(totals.heldCents) : "—",
      hint: "autorizado e ainda não resolvido",
    },
    {
      label: "Liberado",
      value: totals ? fmtCents(totals.releasedCents) : "—",
      hint: "histórico pago aos criadores",
      color: "#059669",
    },
    {
      label: "Contratos ativos",
      value: totals ? String(totals.activeCount) : "—",
      hint: "custódias em andamento",
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="eyebrow mb-2">Operations · Custódia</div>
        <h1 className="font-display m-0" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
          Custódia
        </h1>
        <p className="text-[14px] text-ink-muted mt-1.5 max-w-[640px]">
          O dinheiro fica reservado no provedor de pagamento até a entrega ser aprovada.
          A Zoe orquestra e nunca custodia — nenhum valor passa por conta nossa.
        </p>
      </div>

      <div className="rounded-xl border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {kpis.map((k, i) => (
            <div
              key={k.label}
              className="px-5 py-4"
              style={{ borderRight: i < 2 ? "1px solid var(--border-soft)" : undefined }}
            >
              <div className="eyebrow">{k.label}</div>
              <div
                className="font-display mt-1.5"
                style={{ fontSize: 26, lineHeight: 1, color: k.color ?? "var(--ink)" }}
              >
                {k.value}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">{k.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {totals && totals.refundedCents > 0 && (
        <div className="text-[12px] text-ink-muted">
          Devolvido às marcas: <span className="font-mono-zoe">{fmtCents(totals.refundedCents)}</span>
        </div>
      )}

      {escrow.isLoading ? (
        <TableSkeleton rows={3} />
      ) : escrow.isError ? (
        <ErrorState onRetry={() => escrow.refetch()} />
      ) : items.length === 0 ? (
        <EmptyBlock message="Nenhuma custódia ainda. Ela nasce quando um contrato assinado tem valor a reservar." />
      ) : (
        <>
          <div className="flex justify-end">
            <SearchBox value={busca} onChange={setBusca} placeholder="Buscar por criador, campanha…" />
          </div>

          {/* Trilha de estados: o panorama do kanban sem a largura dele. Quebra em varias
              linhas em vez de rolar, e serve de filtro. */}
          <div className="flex flex-wrap gap-1.5">
            <TrilhaChip
              rotulo="Todas"
              n={items.length}
              cor="var(--ink-muted)"
              ativo={filtro === null}
              onClick={() => setFiltro(null)}
            />
            {ESCROW_STATES.map((st) => (
              <TrilhaChip
                key={st}
                rotulo={tEnum("escrowState", st)}
                n={contagem[st]}
                cor={COLUMN_COLOR[st]}
                ativo={filtro === st}
                // Estado vazio nao vira botao morto: continua visivel para o panorama,
                // mas nao convida a um clique que leva a lugar nenhum.
                onClick={contagem[st] ? () => setFiltro(st) : undefined}
              />
            ))}
          </div>

          {lista.length === 0 && busca ? (
            <NoResults query={busca} onClear={() => setBusca("")} />
          ) : lista.length === 0 ? (
            <EmptyBlock message="Nenhuma custódia neste estado." />
          ) : (
            <div
              className="rounded-xl border border-border-soft overflow-hidden"
              style={{ background: "var(--surface)" }}
            >
              {lista.map((e, i) => (
                <EscrowRow
                  key={e.escrowAccountId}
                  e={e}
                  primeira={i === 0}
                  onOpen={() => setSelected(e.escrowAccountId)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {current && <EscrowDrawer e={current} onClose={() => setSelected(null)} />}
    </div>
  )
}

function TrilhaChip({
  rotulo, n, cor, ativo, onClick,
}: {
  rotulo: string
  n: number
  cor: string
  ativo: boolean
  onClick?: () => void
}) {
  const vazio = n === 0

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors disabled:cursor-default"
      style={{
        background: ativo ? "var(--ink)" : "var(--surface)",
        color: ativo ? "var(--surface)" : vazio ? "var(--ink-muted-2)" : "var(--ink-2)",
        borderColor: ativo ? "var(--ink)" : "var(--border-soft)",
        opacity: vazio && !ativo ? 0.55 : 1,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cor }} />
      {rotulo}
      <span className="font-mono-zoe text-[11px] tabular-nums">{n}</span>
    </button>
  )
}

/**
 * Uma custódia por linha.
 *
 * <p>O que decide a ordem e' urgencia, nao data — e o motivo do alerta aparece na propria
 * linha. Escondê-lo na gaveta obrigaria a abrir uma a uma para descobrir qual esta' com
 * problema, que e' exatamente o trabalho que a tela deveria poupar.</p>
 */
function EscrowRow({
  e, primeira, onOpen,
}: {
  e: EscrowSummary
  primeira: boolean
  onOpen: () => void
}) {
  // Caduca e' pior que vencida: vencida e' a data ter passado, caduca e' a renovacao ter
  // falhado — o dinheiro NAO esta' mais reservado e a liberacao vai recusar.
  // Custódia encerrada (liberada, devolvida) não tem mais reserva a vencer: o alerta ali
  // assustaria sobre um dinheiro que já foi pago.
  const alerta =
    e.authorizationLapsedAt && !e.isTerminal
      ? { icone: AlertTriangle, texto: "reserva caiu — refinanciar", cor: "#DC2626", forte: true }
      : e.isAuthorizationExpired && !e.isTerminal
        ? { icone: Clock, texto: "autorização vencida", cor: "#D97706", forte: false }
        : e.payoutAccountMissing && !e.isTerminal
          ? { icone: Wallet, texto: "criador sem conta de recebimento", cor: "#D97706", forte: false }
          : e.payoutAccountUnverified && !e.isTerminal
            ? { icone: Wallet, texto: "aguardando verificação da conta do criador", cor: "#D97706", forte: false }
            : null

  const Icone = alerta?.icone

  return (
    <button
      onClick={onOpen}
      className="w-full text-left px-4 py-3.5 flex items-center gap-4 hover:bg-[var(--surface-2,#FAFBFC)] transition-colors"
      style={{ borderTop: primeira ? undefined : "1px solid var(--border-soft)" }}
    >
      <span
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ background: COLUMN_COLOR[e.state], minHeight: 34 }}
      />

      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>
          {e.influencerName}
        </div>
        <div className="text-[12px] text-ink-muted truncate">{campanhaLabel(e.campaignName)}</div>

        {alerta && Icone && (
          <div
            className="flex items-center gap-1 text-[11.5px] mt-1"
            style={{ color: alerta.cor, fontWeight: alerta.forte ? 600 : 400 }}
          >
            <Icone className="w-3 h-3 shrink-0" /> {alerta.texto}
          </div>
        )}
      </div>

      <div className="hidden sm:block shrink-0">
        <span
          className="text-[11.5px] px-2 py-1 rounded-md whitespace-nowrap"
          style={{ background: `${COLUMN_COLOR[e.state]}18`, color: COLUMN_COLOR[e.state] }}
        >
          {tEnum("escrowState", e.state)}
        </span>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono-zoe text-[13.5px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
          {fmtCents(e.amountCents)}
        </div>
        {e.hasPendingCommand ? (
          <div className="flex items-center justify-end gap-1 text-[11px] mt-0.5" style={{ color: "#2563EB" }}>
            <Loader2 className="w-2.5 h-2.5 animate-spin" /> processando
          </div>
        ) : (
          <div className="font-mono-zoe text-[10.5px] text-ink-muted mt-0.5">
            {(e.takeRateBps / 100).toFixed(0)}% take
          </div>
        )}
      </div>
    </button>
  )
}

function EscrowDrawer({ e, onClose }: { e: EscrowSummary; onClose: () => void }) {
  const { apply } = useEscrowMutations()
  useEscapeKey(onClose)

  const can = (action: EscrowAction) => e.allowedTriggers.includes(ESCROW_ACTION_TRIGGER[action])

  const run = async (action: EscrowAction) => {
    try {
      const res = await apply.mutateAsync({ escrowAccountId: e.escrowAccountId, action })
      // A resposta distingue enfileirado de transicionado. Dizer "liberado" quando o
      // provedor ainda não capturou seria a tela mentindo sobre dinheiro.
      toast.success(res.queued
        ? "Pedido na fila. O estado muda quando o provedor confirmar."
        : `Custódia agora em ${tEnum("escrowState", res.to ?? "")}.`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível concluir.")
    }
  }

  const rows: [string, string][] = [
    ["Valor bruto", fmtCents(e.amountCents)],
    [`Take rate (${(e.takeRateBps / 100).toFixed(0)}%)`, fmtCents(e.takeRateCents)],
    ["Líquido ao criador", fmtCents(e.netToInfluencerCents)],
  ]

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(11,15,26,.5)" }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[440px] overflow-y-auto border-l border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border-soft"
          style={{ background: "var(--surface)" }}
        >
          <div className="eyebrow">Custódia</div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: COLUMN_COLOR[e.state] }} />
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>
              {tEnum("escrowState", e.state)}
            </span>
          </div>
          <h2 className="font-display m-0 mb-1" style={{ fontSize: 20, color: "var(--ink)" }}>
            {e.influencerName}
          </h2>
          <div className="text-[12.5px] text-ink-muted">
            {campanhaLabel(e.campaignName)} · aberta em {fmtDate(e.createdAt)}
          </div>

          <div className="rounded-lg border border-border-soft mt-5">
            {rows.map(([label, value], i) => (
              <div
                key={label}
                className="flex items-center justify-between px-3.5 py-2.5"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--border-soft)" }}
              >
                <span className="text-[12.5px] text-ink-muted">{label}</span>
                <span className="font-mono-zoe text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {e.disputeReason && (
            <div className="rounded-lg p-3 text-[12.5px] mt-4" style={{ background: "#DC262615", color: "#DC2626" }}>
              <div className="font-semibold mb-0.5">Em disputa</div>
              {e.disputeReason} A resolução é manual — fale com o suporte.
            </div>
          )}

          {e.payoutAccountMissing && !e.isTerminal && (
            <div
              className="rounded-lg p-3 text-[12px] mt-4 flex items-start gap-2"
              style={{ background: "#D9770615", color: "#D97706" }}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                O criador ainda não tem conta de recebimento. O bloqueio é só no pagamento —
                a entrega segue normalmente, e a liberação espera a conta existir.
              </span>
            </div>
          )}

          {e.payoutAccountUnverified && !e.isTerminal && (
            <div
              className="rounded-lg p-3 text-[12px] mt-4 flex items-start gap-2"
              style={{ background: "#D9770615", color: "#D97706" }}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                A conta de recebimento do criador está em verificação pelo provedor. A liberação
                espera essa verificação — o criador conclui pela área dele, e nada precisa ser
                feito aqui.
              </span>
            </div>
          )}

          {e.authorizationLapsedAt && !e.isTerminal && (
            <div
              className="rounded-lg p-3 mt-4 flex items-start gap-2.5"
              style={{ background: "#DC262612", border: "1px solid #DC2626" }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#DC2626" }} />
              <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                <div className="font-semibold mb-0.5" style={{ color: "#DC2626" }}>
                  O dinheiro não está mais reservado
                </div>
                A renovação da autorização falhou em {fmtDate(e.authorizationLapsedAt)} e o
                provedor soltou a reserva. A entrega e o trabalho do criador seguem valendo —
                o que falta é financiar de novo antes de liberar o pagamento.
              </div>
            </div>
          )}

          {e.authorizationExpiresAt && !e.authorizationLapsedAt && !e.isTerminal && (
            <p
              className="text-[11.5px] mt-4 mb-0"
              style={{ color: e.isAuthorizationExpired ? "#DC2626" : "var(--ink-muted)" }}
            >
              {e.isAuthorizationExpired
                ? `A autorização venceu em ${fmtDate(e.authorizationExpiresAt)} e precisa ser refeita antes de liberar.`
                : `A autorização do pagamento vale até ${fmtDate(e.authorizationExpiresAt)}.`}
            </p>
          )}

          <Link
            to={`/operations/contracts/${e.contractId}`}
            className="text-[12.5px] mt-4 inline-block"
            style={{ color: "var(--color-teal-500)" }}
          >
            Ver contrato →
          </Link>

          <RoleGate minRole="Admin">
            {e.isTerminal ? (
              <div className="text-[12.5px] text-ink-muted mt-6">
                Custódia encerrada. Não há mais transição possível.
              </div>
            ) : e.hasPendingCommand ? (
              <div
                className="flex items-center gap-2 rounded-lg p-3 text-[12.5px] mt-6"
                style={{ background: "#2563EB12", color: "#2563EB" }}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Já existe uma operação na fila para esta custódia. Nenhuma outra entra até
                ela terminar — é o que impede pagamento duplicado.
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-2">
                {/* No fluxo encadeado os botões continuam existindo, mas como recurso: o
                    normal é a reserva e o pagamento serem pedidos sozinhos. */}
                {e.autoAdvance && (
                  <p className="text-[12px] text-ink-muted m-0 mb-1">
                    Pagamento automático: a reserva e o pagamento são pedidos sozinhos. Use os
                    botões só se algo ficou parado.
                  </p>
                )}
                {/* Os botões vêm de `allowedTriggers`, que é a máquina de estados falando.
                    A tela não decide o que é possível. */}
                {can("fund") && (
                  <ActionButton
                    label="Reservar o pagamento"
                    hint="Autoriza os fundos no provedor. Só depois o criador pode gravar."
                    busy={apply.isPending}
                    onClick={() => run("fund")}
                    primary
                  />
                )}
                {can("start-production") && (
                  <ActionButton
                    label="Liberar produção"
                    hint="Avisa o criador de que ele pode começar."
                    busy={apply.isPending}
                    onClick={() => run("start-production")}
                    primary
                  />
                )}
                {can("release") && (
                  <ActionButton
                    label="Liberar o pagamento"
                    hint="Captura, retém o take rate e transfere ao criador. Entra na fila; não é instantâneo."
                    busy={apply.isPending}
                    onClick={() => run("release")}
                    primary
                  />
                )}
                {can("refund") && (
                  <ActionButton
                    label="Devolver à marca"
                    hint="Cancela a autorização e encerra a custódia sem pagamento."
                    busy={apply.isPending}
                    onClick={() => run("refund")}
                    danger
                  />
                )}
                {!can("fund") && !can("start-production") && !can("release") && !can("refund") && (
                  <div className="text-[12.5px] text-ink-muted">
                    Nada a fazer aqui agora — o próximo passo é da entrega, não do dinheiro.
                  </div>
                )}
              </div>
            )}
          </RoleGate>
        </div>
      </div>
    </>
  )
}

function ActionButton({
  label, hint, busy, onClick, primary, danger,
}: {
  label: string
  hint: string
  busy: boolean
  onClick: () => void
  primary?: boolean
  danger?: boolean
}) {
  return (
    <div>
      <button
        onClick={onClick}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13.5px] font-medium disabled:opacity-50"
        style={primary
          ? { background: "var(--color-teal-500)", color: "#fff" }
          : { border: "1px solid var(--border-soft)", color: danger ? "#DC2626" : "var(--ink)" }}
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {label}
      </button>
      <p className="text-[11px] text-ink-muted mt-1 mb-0">{hint}</p>
    </div>
  )
}
