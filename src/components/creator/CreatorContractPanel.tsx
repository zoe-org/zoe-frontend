import { useState } from "react"
import { CONTRACT_STATUS_COLOR, ESCROW_STATE_COLOR } from "@/lib/status-colors"
import { Loader2, FileText, Lock, Download, AlertCircle, Send, Wallet } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { StatusChip } from "@/components/ui/status-chip"
import { tEnum } from "@/i18n/enums"
import { fmtDate } from "@/lib/operations-format"
import { fmtCents } from "@/lib/api/operations"
import {
  useCreatorContract, useResendSignature, creatorApi, workLabel,
  type CreatorEngagement, type CreatorContract, type CreatorContractClause,
  type CreatorContractField,
} from "@/lib/api/creator"

const CONTRACT_COLOR = CONTRACT_STATUS_COLOR

const ESCROW_COLOR = ESCROW_STATE_COLOR

/** Estado da custódia dito para quem recebe: "eu vou receber, e quando?". */
const ESCROW_NOTE: Record<string, string> = {
  PendingDeposit: "A marca ainda não depositou. A produção começa depois do depósito.",
  Funded: "O valor já está reservado em custódia. Ele sai para você depois que a entrega for aprovada.",
  InProduction: "Valor reservado. Entregue o combinado para liberar o pagamento.",
  Delivered: "Entrega enviada. O valor continua reservado até a marca revisar.",
  UnderReview: "A marca está revisando sua entrega. O valor segue reservado.",
  Releasable: "Entrega aprovada. O pagamento entrou na fila de liberação.",
  Released: "Pagamento liberado para a sua conta de recebimento.",
  Disputed: "Há uma divergência em aberto neste contrato. O valor fica retido até a resolução.",
  Refunded: "O valor foi devolvido à marca.",
}

/**
 * O contrato pela ótica do criador: o mesmo texto da marca e do PDF, na ordem de quanto recebe, o combinado e as cláusulas.
 */
export function CreatorContractPanel({
  engagements, initialContractId,
}: {
  engagements: CreatorEngagement[]
  /** Contrato aberto ao entrar — quando a pessoa chega por "Assinar o contrato". */
  initialContractId?: string | null
}) {
  const [selected, setSelected] = useState<string | null>(
    initialContractId ?? engagements[0]?.contractId ?? null)

  if (engagements.length === 0) {
    return (
      <div
        className="rounded-xl border border-border-soft p-6 text-center"
        style={{ background: "var(--surface)" }}
      >
        <FileText className="w-7 h-7 mx-auto mb-3 text-ink-muted" strokeWidth={1.5} />
        <p className="text-[13.5px] text-ink-muted m-0">
          Você ainda não tem contrato. Ele aparece aqui quando a marca emitir.
        </p>
      </div>
    )
  }

  // Campanhas com o mesmo nome acontecem; sem diferenciar, os botões do seletor seriam idênticos.
  const repeated = new Set(
    engagements
      .map((e) => e.campaignName)
      .filter((name, i, all) => all.indexOf(name) !== i))

  return (
    <div className="flex flex-col gap-4">
      {engagements.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {engagements.map((e) => (
            <ContractTab
              key={e.contractId}
              e={e}
              active={selected === e.contractId}
              onClick={() => setSelected(e.contractId)}
              shortRef={repeated.has(e.campaignName) ? e.contractId.slice(0, 4) : null}
            />
          ))}
        </div>
      )}

      {/* key remonta a view ao trocar de contrato: sem isso o estado interno (download em
          curso, por exemplo) atravessaria de um documento para outro. */}
      {selected && <ContractView key={selected} contractId={selected} />}
    </div>
  )
}

function ContractTab({
  e, active, onClick, shortRef,
}: {
  e: CreatorEngagement
  active: boolean
  onClick: () => void
  /** Sufixo curto do id, só quando o nome da campanha se repete. */
  shortRef: string | null
}) {
  const color = CONTRACT_COLOR[e.contractStatus] ?? "#6B7280"

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-0.5 px-3.5 py-2 rounded-xl border text-left transition-colors"
      style={{
        background: "var(--surface)",
        borderColor: active ? "var(--color-teal-500)" : "var(--border-soft)",
        boxShadow: active ? "inset 0 0 0 1px var(--color-teal-500)" : undefined,
      }}
      aria-pressed={active}
    >
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>
          {workLabel(e.campaignName)}
        </span>
        {shortRef && (
          <span className="font-mono-zoe text-[10px] text-ink-muted">#{shortRef}</span>
        )}
      </span>
      <span className="text-[11px] text-ink-muted pl-3">
        {tEnum("contractStatus", e.contractStatus)}
        {e.netToInfluencerCents != null && ` · ${fmtCents(e.netToInfluencerCents)}`}
      </span>
    </button>
  )
}

function ContractView({ contractId }: { contractId: string }) {
  const contract = useCreatorContract(contractId)
  const resending = useResendSignature(contractId)
  const [downloading, setDownloading] = useState(false)

  const resend = async () => {
    try {
      const r = await resending.mutateAsync()
      if (r.sent) notifySuccess("Link reenviado. Confira seu e-mail.")
      else notifyError(null, r.message ?? "O provedor não reenviou o aviso.")
    } catch (e) {
      notifyError(e, "Não foi possível reenviar.")
    }
  }

  const openPdf = async () => {
    setDownloading(true)
    try {
      const blob = await creatorApi.contractDocument(contractId)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener")
      // Revoga depois de dar tempo de a aba abrir; segurar para sempre vaza memória.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      notifyError(e, "Não foi possível abrir o PDF.")
    } finally {
      setDownloading(false)
    }
  }

  if (contract.isLoading) {
    return (
      <div className="flex items-center gap-2 text-ink-muted text-[13px] p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando contrato…
      </div>
    )
  }

  if (contract.isError || !contract.data) {
    return (
      <div className="rounded-xl border border-border-soft p-5" style={{ background: "var(--surface)" }}>
        <AlertCircle className="w-6 h-6 mb-2" style={{ color: "var(--color-warn)" }} />
        <p className="text-[13px] text-ink-muted m-0">Não foi possível carregar o contrato.</p>
      </div>
    )
  }

  const c = contract.data

  return (
    <div className="flex flex-col gap-4">
      <HeaderCard
        c={c}
        downloading={downloading}
        onOpenPdf={openPdf}
        onResend={resend}
        resending={resending.isPending}
      />
      <FieldsCard fields={c.fields} />
      <ClausesCard clauses={c.clauses} />
    </div>
  )
}

function HeaderCard({
  c, downloading, onOpenPdf, onResend, resending,
}: {
  c: CreatorContract
  downloading: boolean
  onOpenPdf: () => void
  onResend: () => void
  resending: boolean
}) {
  return (
    <div className="rounded-xl border border-border-soft p-5 sm:p-6" style={{ background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="eyebrow mb-1">{c.brandName}</div>
          <h2 className="font-display m-0 mb-2" style={{ fontSize: 20, color: "var(--ink)" }}>
            {workLabel(c.campaignName)}
          </h2>
          {/* Status era texto corrido e repetia a palavra "assinado" duas vezes na mesma
              linha. Vira chip porque é a informação que se procura de relance. */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip status={c.status} kind="contractStatus" colors={CONTRACT_COLOR} small />
            <span className="chip text-[10.5px]">{tEnum("contractModality", c.modalityLabel)}</span>
            {c.signedAt && (
              <span className="text-[11.5px] text-ink-muted">
                assinado em {fmtDate(c.signedAt)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onOpenPdf}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft disabled:opacity-50 shrink-0"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                       : <Download className="w-3.5 h-3.5" />}
          Abrir PDF
        </button>
      </div>

      {/* Assinar destrava depósito e produção. Sem link de assinatura na API da Clicksign, a tela reenvia o aviso. */}
      {c.canResendSignature && (
        <div className="mt-5 rounded-lg p-3.5" style={{ background: "#D9770610" }}>
          <div className="text-[13px] font-medium mb-1" style={{ color: "var(--color-warn)" }}>
            Aguardando sua assinatura
          </div>
          <p className="text-[12.5px] text-ink-2 m-0">
            O link foi enviado para o seu e-mail pela Clicksign. Não achou? Peça de novo.
          </p>
          <button
            onClick={onResend}
            disabled={resending}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium border border-border-soft disabled:opacity-50"
          >
            {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                       : <Send className="w-3.5 h-3.5" />}
            Reenviar link de assinatura
          </button>
        </div>
      )}

      {/* Como a plataforma é paga, declarado na cláusula de sistema: custódias novas cobram a taxa da marca, as antigas descontavam do criador. */}
      {c.amountCents != null && (
        <div
          className="mt-5 rounded-xl border border-border-soft overflow-hidden"
          style={{ background: "var(--bg, #FAFBFC)" }}
        >
          {feeDeductedFromCreator(c) ? (
            <div className="grid grid-cols-1 sm:grid-cols-3">
              <Money label="Valor do contrato" value={c.amountCents} />
              <Money
                label={`Taxa da plataforma${c.takeRateBps ? ` (${(c.takeRateBps / 100).toFixed(0)}%)` : ""}`}
                value={c.takeRateCents ?? 0}
                muted
              />
              <Money label="Você recebe" value={c.netToInfluencerCents ?? 0} highlight />
            </div>
          ) : (
            <div className="px-4 py-3">
              <Money label="Você recebe — o valor inteiro do contrato" value={c.netToInfluencerCents ?? 0} highlight />
              <p className="text-[11.5px] text-ink-muted m-0 mt-1">
                A taxa da plataforma{c.takeRateBps ? ` (${(c.takeRateBps / 100).toFixed(0)}%)` : ""} é paga pela marca, por fora do seu valor.
              </p>
            </div>
          )}

          {/* Onde o dinheiro está, em uma frase. É a pergunta que o criador realmente traz
              para esta tela, e o rótulo do estado sozinho não responde. */}
          {c.escrowState && (
            <div
              className="flex items-start gap-2.5 px-4 py-3 border-t border-border-soft"
              style={{ background: "var(--surface)" }}
            >
              <Wallet
                className="w-3.5 h-3.5 mt-0.5 shrink-0"
                style={{ color: ESCROW_COLOR[c.escrowState] ?? "var(--ink-muted)" }}
              />
              <div className="text-[12.5px]">
                <span className="font-medium" style={{ color: ESCROW_COLOR[c.escrowState] ?? "var(--ink)" }}>
                  {tEnum("escrowState", c.escrowState)}
                </span>
                <span className="text-ink-muted">
                  {" — "}{ESCROW_NOTE[c.escrowState] ?? "Acompanhe por aqui."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** O combinado só neste contrato, antes das cláusulas padrão. Campos em branco aparecem agrupados. */
function FieldsCard({ fields }: { fields: CreatorContractField[] }) {
  if (fields.length === 0) return null

  const filled = fields.filter((f) => f.value)
  const pending = fields.filter((f) => !f.value)

  return (
    <div className="rounded-xl border border-border-soft p-5 sm:p-6" style={{ background: "var(--surface)" }}>
      <div className="eyebrow mb-3">Condições combinadas</div>

      {filled.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 m-0">
          {filled.map((f) => (
            <div
              key={f.placeholder}
              className="flex items-baseline justify-between gap-4 py-2 border-b border-border-soft last:border-b-0"
            >
              <dt className="text-[12.5px] text-ink-muted min-w-0">{f.label}</dt>
              <dd
                className="text-[12.5px] m-0 text-right break-words min-w-0"
                style={{ color: "var(--ink)" }}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {pending.length > 0 && (
        <div
          className="mt-4 rounded-lg p-3.5"
          style={{ background: "#D9770610" }}
        >
          <div className="text-[12.5px] font-medium mb-1" style={{ color: "var(--color-warn)" }}>
            {pending.length === 1
              ? "1 campo ainda não foi preenchido"
              : `${pending.length} campos ainda não foram preenchidos`}
          </div>
          <p className="text-[12px] text-ink-muted m-0">
            {pending.map((f) => f.label).join(" · ")}
          </p>
        </div>
      )}
    </div>
  )
}

/** Cláusulas com índice, sem esconder texto: quem assina precisa ler tudo. */
function ClausesCard({ clauses }: { clauses: CreatorContractClause[] }) {
  const jump = (order: number) =>
    document.getElementById(`clausula-${order}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <div className="rounded-xl border border-border-soft p-5 sm:p-6" style={{ background: "var(--surface)" }}>
      <div className="eyebrow mb-3">Cláusulas ({clauses.length})</div>

      {clauses.length > 3 && (
        <nav className="flex flex-wrap gap-x-4 gap-y-1.5 pb-4 mb-6 border-b border-border-soft">
          {clauses.map((c) => (
            <button
              key={c.order}
              onClick={() => jump(c.order)}
              className="text-[11px] text-ink-muted hover:opacity-60 transition-opacity text-left"
            >
              <span className="font-mono-zoe">{c.order}.</span> {c.title}
            </button>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-6">
        {clauses.map((c) => <Clause key={c.order} c={c} />)}
      </div>
    </div>
  )
}

function Clause({ c }: { c: CreatorContractClause }) {
  const items = splitClauseBody(c.body)

  return (
    <section id={`clausula-${c.order}`} className="scroll-mt-6">
      <div className="flex items-baseline gap-2 flex-wrap mb-2">
        <h3
          className="m-0 text-[13px] font-semibold"
          style={{ color: "var(--ink)", letterSpacing: "0.01em" }}
        >
          {c.order}. {c.title}
        </h3>
        {/* Marcar é honestidade: cláusula de sistema não entra em negociação, e a parte
            precisa saber disso ao ler, não ao tentar mudar. */}
        {c.isSystem && (
          <span
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg, #F3F4F6)", color: "var(--ink-muted)" }}
          >
            <Lock className="w-2.5 h-2.5" /> cláusula fixa
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted m-0">
          Esta cláusula ainda não tem texto — ela é composta quando os campos do contrato
          forem preenchidos.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <p
              key={i}
              className="flex gap-2 text-[13px] text-ink-2 leading-[1.6] m-0 whitespace-pre-line"
            >
              {it.marker && (
                <span className="font-mono-zoe text-ink-muted shrink-0">{it.marker}</span>
              )}
              <span className="min-w-0">{it.text}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Quebra a cláusula nos itens numerados ("1.1."), sem alterar texto; exige 1–2 dígitos para não pegar valores como "R$ 15.000.".
 */
function splitClauseBody(body: string): { marker: string | null; text: string }[] {
  const trimmed = body?.trim() ?? ""
  if (!trimmed) return []

  return trimmed
    .split(/(?<=(?:^|\s))(?=\d{1,2}\.\d{1,2}\.\s)/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^(\d{1,2}\.\d{1,2}\.)\s*([\s\S]*)$/.exec(part)
      return m ? { marker: m[1], text: m[2] } : { marker: null, text: part }
    })
}

/** Regra antiga: cobrança igual a taxa + líquido. Na cobrança por cima, o total inclui o processamento. */
function feeDeductedFromCreator(c: { amountCents: number | null; takeRateCents: number | null; netToInfluencerCents: number | null }) {
  return c.amountCents != null
    && c.amountCents === (c.takeRateCents ?? 0) + (c.netToInfluencerCents ?? 0)
}

function Money({
  label, value, muted, highlight,
}: {
  label: string
  value: number
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className="px-4 py-3 border-b sm:border-b-0 sm:border-r border-border-soft last:border-0"
    >
      <div className="text-[11px] text-ink-muted mb-0.5">{label}</div>
      <div
        className="font-mono-zoe font-semibold"
        style={{
          fontSize: highlight ? 18 : 15,
          color: highlight ? "var(--color-teal-500)" : muted ? "var(--ink-muted)" : "var(--ink)",
        }}
      >
        {muted ? `− ${fmtCents(value)}` : fmtCents(value)}
      </div>
    </div>
  )
}
