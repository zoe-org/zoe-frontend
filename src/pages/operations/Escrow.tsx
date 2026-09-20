import { useMemo, useState } from "react"
import { ESCROW_STATE_COLOR } from "@/lib/status-colors"
import { Link } from "react-router-dom"
import { Loader2, Wallet, AlertTriangle, Clock, X } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { EmptyBlock } from "@/components/ui/empty-block"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, matches, campaignLabel } from "@/lib/operations-format"
import { stagger } from "@/lib/motion"
import { StatBand, type Stat } from "@/components/ui/stat-band"
import {
  TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/components/operations/shared"
import {
  useEscrowAccounts, useEscrowMutations, fmtCents,
  ESCROW_STATES, ESCROW_ACTION_TRIGGER,
  type EscrowSummary, type EscrowAction,
} from "@/lib/api/operations"

const COLUMN_COLOR = ESCROW_STATE_COLOR

const NO_ITEMS: EscrowSummary[] = []

/**
 * Quadro da custódia: KPIs, trilha de estados que filtra e lista ordenada por urgência. Os nove
 * estados ficam visíveis, inclusive Delivered, Disputed e Refunded, que o protótipo omitia.
 */
export default function OperationsEscrowPage() {
  const escrow = useEscrowAccounts()
  const [selected, setSelected] = useState<string | null>(null)

  const items = escrow.data?.items ?? NO_ITEMS
  const totals = escrow.data?.totals
  const [stateFilter, setStateFilter] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of ESCROW_STATES) c[s] = 0
    for (const e of items) c[e.state] = (c[e.state] ?? 0) + 1
    return c
  }, [items])

  // Ordena por URGENCIA, nao por data: numa tela de dinheiro o que precisa de alguem tem
  // de vir primeiro. Reserva caida e' o pior caso — o valor deixou de estar separado.
  const visible = useMemo(() => {
    const priority = (e: EscrowSummary) =>
      e.authorizationLapsedAt ? 0
      : e.isAuthorizationExpired ? 1
      : e.payoutAccountMissing && !e.isTerminal ? 2
      : e.state === "Disputed" ? 3
      : e.allowedTriggers.length > 0 && !e.hasPendingCommand ? 4
      : e.isTerminal ? 6
      : 5

    return items
      .filter((e) => (stateFilter ? e.state === stateFilter : true))
      .filter((e) => matches(search, e.influencerName, e.campaignName))
      .slice()
      .sort((a, b) => priority(a) - priority(b) || b.amountCents - a.amountCents)
  }, [items, stateFilter, search])

  const current = items.find((e) => e.escrowAccountId === selected) ?? null

  const kpis: Stat[] = [
    {
      label: "Em custódia",
      value: totals ? fmtCents(totals.heldCents) : "—",
      hint: "autorizado e ainda não resolvido",
    },
    {
      // `tone` e não `#059669`: o hex fixo não acompanhava o modo escuro.
      label: "Liberado",
      value: totals ? fmtCents(totals.releasedCents) : "—",
      hint: "histórico pago aos criadores",
      tone: "pos",
    },
    {
      label: "Contratos ativos",
      value: totals ? String(totals.activeCount) : "—",
      hint: "custódias em andamento",
    },
    // Só aparece quando houve devolução: uma coluna fixa em zero seria ruído,
    // e essa linha andava solta embaixo da faixa sem rótulo de destaque.
    ...(totals && totals.refundedCents > 0
      ? [{
        label: "Devolvido às marcas",
        value: fmtCents(totals.refundedCents),
        hint: "custódias canceladas ou expiradas",
      } as Stat]
      : []),
  ]

  return (
    // Full-bleed com divisórias, como o resto da plataforma. Era uma pilha de
    // cartões dentro do padding padrão — na mesma sidebar que Contratos e
    // Elenco, as duas linguagens liam como dois produtos.
    <div className="-m-6" style={{ color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex-1 max-w-190 min-w-70">
          <div className="eyebrow mb-3">Operations · Custódia</div>
          <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
            Custódia
          </h1>
          <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-150">
            O dinheiro fica reservado no provedor de pagamento até a entrega ser aprovada.
            A Zoe orquestra e nunca custodia — nenhum valor passa por conta nossa.
          </p>
        </div>
      </section>

      <StatBand items={kpis} />

      {escrow.isLoading ? (
        <TableSkeleton rows={3} />
      ) : escrow.isError ? (
        <ErrorState onRetry={() => escrow.refetch()} />
      ) : items.length === 0 ? (
        <EmptyBlock
          className="py-16"
          message="Nenhuma custódia ainda. Ela nasce quando um contrato assinado tem valor a reservar."
        />
      ) : (
        <>
          {/* Barra de trabalho: a trilha de estados (que é panorama e filtro ao
              mesmo tempo) à esquerda, o resultado e a busca à direita. */}
          <section
            className="px-8 py-3 border-b border-border-soft flex items-center justify-between gap-x-4 gap-y-2.5 flex-wrap sticky top-0 z-10"
            style={{ background: "var(--surface)" }}
          >
            <div className="flex flex-wrap gap-1.5">
              <StateChip
                label="Todas"
                n={items.length}
                color="var(--ink-muted)"
                active={stateFilter === null}
                onClick={() => setStateFilter(null)}
              />
              {ESCROW_STATES.map((st) => (
                <StateChip
                  key={st}
                  label={tEnum("escrowState", st)}
                  n={counts[st]}
                  color={COLUMN_COLOR[st]}
                  active={stateFilter === st}
                  // Estado vazio nao vira botao morto: continua visivel para o panorama,
                  // mas nao convida a um clique que leva a lugar nenhum.
                  onClick={counts[st] ? () => setStateFilter(st) : undefined}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[12px] text-ink-muted whitespace-nowrap">
                {visible.length === items.length
                  ? `${items.length} ${items.length === 1 ? "custódia" : "custódias"}`
                  : `${visible.length} de ${items.length} custódias`}
              </span>
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Buscar por criador, campanha…"
                className="w-48 sm:w-64"
              />
            </div>
          </section>

          {visible.length === 0 && search ? (
            <NoResults query={search} onClear={() => setSearch("")} />
          ) : visible.length === 0 ? (
            <EmptyBlock className="py-16" message="Nenhuma custódia neste estado." />
          ) : (
            <div>
              {visible.map((e, i) => (
                <EscrowRow
                  key={e.escrowAccountId}
                  e={e}
                  index={i}
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

function StateChip({
  label, n, color, active, onClick,
}: {
  label: string
  n: number
  color: string
  active: boolean
  onClick?: () => void
}) {
  const isEmpty = n === 0

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors disabled:cursor-default"
      style={{
        background: active ? "var(--ink)" : "var(--surface)",
        color: active ? "var(--surface)" : isEmpty ? "var(--ink-muted-2)" : "var(--ink-2)",
        borderColor: active ? "var(--ink)" : "var(--border-soft)",
        opacity: isEmpty && !active ? 0.55 : 1,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {label}
      <span className="font-mono-zoe text-[11px] tabular-nums">{n}</span>
    </button>
  )
}

/** Uma custódia por linha, ordenada por urgência e com o alerta visível. */
function EscrowRow({
  e, index, onOpen,
}: {
  e: EscrowSummary
  index: number
  onOpen: () => void
}) {
  // Reserva caída pesa mais que vencida; custódia encerrada não recebe alerta.
  const warning =
    e.authorizationLapsedAt && !e.isTerminal
      ? { icon: AlertTriangle, text: "reserva caiu — refinanciar", color: "var(--color-neg)", strong: true }
      : e.isAuthorizationExpired && !e.isTerminal
        ? { icon: Clock, text: "autorização vencida", color: "var(--color-warn)", strong: false }
        : e.payoutAccountMissing && !e.isTerminal
          ? { icon: Wallet, text: "criador sem conta de recebimento", color: "var(--color-warn)", strong: false }
          : e.payoutAccountUnverified && !e.isTerminal
            ? { icon: Wallet, text: "aguardando verificação da conta do criador", color: "var(--color-warn)", strong: false }
            : null

  const WarningIcon = warning?.icon

  return (
    <button
      onClick={onOpen}
      // `hover:bg-hover` e não `--surface-2` com fallback claro fixo: o
      // `#FAFBFC` clareava a linha no modo escuro.
      className="w-full text-left px-8 py-3.5 flex items-center gap-4 border-b border-border-soft hover:bg-hover transition-colors cursor-pointer z-rise"
      style={stagger(Math.min(index, 12))}
    >
      <span
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ background: COLUMN_COLOR[e.state], minHeight: 34 }}
      />

      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>
          {e.influencerName}
        </div>
        <div className="text-[12px] text-ink-muted truncate">{campaignLabel(e.campaignName)}</div>

        {warning && WarningIcon && (
          <div
            className="flex items-center gap-1 text-[11.5px] mt-1"
            style={{ color: warning.color, fontWeight: warning.strong ? 600 : 400 }}
          >
            <WarningIcon className="w-3 h-3 shrink-0" /> {warning.text}
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
  const dialogRef = useFocusTrap<HTMLDivElement>()

  const can = (action: EscrowAction) => e.allowedTriggers.includes(ESCROW_ACTION_TRIGGER[action])

  const run = async (action: EscrowAction) => {
    try {
      const res = await apply.mutateAsync({ escrowAccountId: e.escrowAccountId, action })
      // A resposta distingue enfileirado de transicionado. Dizer "liberado" quando o
      // provedor ainda não capturou seria a tela mentindo sobre dinheiro.
      notifySuccess(res.queued
        ? "Pedido na fila. O estado muda quando o provedor confirmar."
        : `Custódia agora em ${tEnum("escrowState", res.to ?? "")}.`)
    } catch (err) {
      notifyError(err, "Não foi possível concluir.", { terminal: true })
    }
  }

  // Na ordem da conta: o criador recebe o valor do contrato, e taxa e processamento vão por
  // cima. Custódia anterior a essa regra não repassou processamento — a linha não aparece.
  const rows: [string, string][] = [
    ["Ao criador", fmtCents(e.netToInfluencerCents)],
    [`Taxa da plataforma (${(e.takeRateBps / 100).toFixed(0)}%)`, fmtCents(e.takeRateCents)],
    ...(e.processingFeeCents > 0
      ? [["Processamento do pagamento", fmtCents(e.processingFeeCents)] as [string, string]]
      : []),
    ["A marca paga", fmtCents(e.amountCents)],
  ]

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(11,15,26,.5)" }} onClick={onClose} />
      <div
        ref={dialogRef}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[440px] overflow-y-auto border-l border-border-soft"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Custódia"
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
            {campaignLabel(e.campaignName)} · aberta em {fmtDate(e.createdAt)}
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
            <div className="rounded-lg p-3 text-[12.5px] mt-4" style={{ background: "#DC262615", color: "var(--color-neg)" }}>
              <div className="font-semibold mb-0.5">Em disputa</div>
              {e.disputeReason} A resolução é manual — fale com o suporte.
            </div>
          )}

          {e.payoutAccountMissing && !e.isTerminal && (
            <div
              className="rounded-lg p-3 text-[12px] mt-4 flex items-start gap-2"
              style={{ background: "var(--warn-bg)", color: "var(--color-warn)" }}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                O criador ainda não tem conta de recebimento. O bloqueio é só no pagamento —
                a entrega segue normalmente, e a liberação espera a conta existir.{" "}
                <Link to={`/operations/influencers?creator=${e.influencerId}`} className="underline">
                  Ver {e.influencerName} no elenco
                </Link>
              </span>
            </div>
          )}

          {e.payoutAccountUnverified && !e.isTerminal && (
            <div
              className="rounded-lg p-3 text-[12px] mt-4 flex items-start gap-2"
              style={{ background: "var(--warn-bg)", color: "var(--color-warn)" }}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                A conta de recebimento do criador está em verificação pelo provedor. A liberação
                espera essa verificação — o criador conclui pela área dele, e nada precisa ser
                feito aqui.{" "}
                <Link to={`/operations/influencers?creator=${e.influencerId}`} className="underline">
                  Ver {e.influencerName} no elenco
                </Link>
              </span>
            </div>
          )}

          {e.authorizationLapsedAt && !e.isTerminal && (
            <div
              className="rounded-lg p-3 mt-4 flex items-start gap-2.5"
              style={{ background: "#DC262612", border: "1px solid #DC2626" }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-neg)" }} />
              <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                <div className="font-semibold mb-0.5" style={{ color: "var(--color-neg)" }}>
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

          <div className="flex gap-4 flex-wrap mt-4 text-[12.5px]">
            <Link to={`/operations/contracts/${e.contractId}`} style={{ color: "var(--color-teal-500)" }}>
              Ver contrato →
            </Link>
            {/* Só o contrato não bastava: para saber quem é o criador e em que pé está a conta
                dele, era preciso lembrar o nome e procurar no Elenco. */}
            <Link to={`/operations/influencers?creator=${e.influencerId}`} style={{ color: "var(--color-teal-500)" }}>
              Ver criador no elenco →
            </Link>
          </div>

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
