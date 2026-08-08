import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { X, Loader2, Play, Check, RotateCcw, Ban, ExternalLink, Clock } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate } from "@/pages/operations/format"
import { TableSkeleton, ErrorState } from "@/pages/operations/shared"
import {
  useDeliveries, useDeliveryMutations, fmtCents, youtubeThumb, youtubeWatch,
  type DeliverySummary, type DeliveryDecision,
} from "@/lib/api/operations"

const STATUS_COLOR: Record<string, string> = {
  Submitted: "#6B7280",
  UnderReview: "#D97706",
  Approved: "#00A799",
  ReworkRequested: "#DC2626",
  Rejected: "#DC2626",
}

const DeliveryChip = (p: { status: string; small?: boolean }) => (
  <StatusChip {...p} kind="deliveryStatus" colors={STATUS_COLOR} />
)

const NO_DELIVERIES: DeliverySummary[] = []

/**
 * Fila de entregas. Layout do protótipo (`src-ops/entregas.jsx`): grade de cards com
 * miniatura e gaveta de revisão à direita.
 *
 * Duas divergências conscientes, das quais a regra de negócio venceu:
 *
 * 1. **Não há badge de score.** O protótipo estampa 92/58/81 em cada card, mas
 *    `audit_score` é da auditoria por IA (Etapa 8.6) e não existe. Número inventado
 *    numa tela que decide pagamento é pior que número ausente.
 * 2. **Aprovar não paga.** O protótipo tem "Aprovar e liberar" num só botão; aqui
 *    aprovar apenas torna a custódia liberável (RN-O-043). A captura é passo separado
 *    e humano — a IA nunca libera pagamento sozinha, e nem o clique de aprovação.
 */
export default function OperationsDeliveriesPage() {
  const [tab, setTab] = useState<string>("all")
  const [selected, setSelected] = useState<string | null>(null)
  const deliveries = useDeliveries()

  // Referência estável: um `?? []` inline nasce novo a cada render e invalidaria o
  // useMemo das contagens toda vez.
  const items = deliveries.data?.items ?? NO_DELIVERIES

  const counts = useMemo(() => ({
    all: items.length,
    Submitted: items.filter((d) => d.status === "Submitted").length,
    UnderReview: items.filter((d) => d.status === "UnderReview").length,
    ReworkRequested: items.filter((d) => d.status === "ReworkRequested").length,
    Approved: items.filter((d) => d.status === "Approved").length,
    Rejected: items.filter((d) => d.status === "Rejected").length,
  }), [items])

  const filtered = tab === "all" ? items : items.filter((d) => d.status === tab)

  // A seleção é derivada da lista para o card não ficar apontando para uma entrega que
  // já mudou de estado depois de uma decisão.
  const current = filtered.find((d) => d.deliveryId === selected)
    ?? items.find((d) => d.deliveryId === selected)
    ?? null

  const tabs: [string, string][] = [
    ["all", "Todas"],
    ["Submitted", "Aguardando"],
    ["UnderReview", "Em revisão"],
    ["ReworkRequested", "Correção"],
    ["Approved", "Aprovadas"],
    ["Rejected", "Recusadas"],
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="eyebrow mb-2">Operations · Qualidade</div>
        <h1 className="font-display m-0" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
          Entregas
        </h1>
        <p className="text-[14px] text-ink-muted mt-1.5 max-w-[620px]">
          A entrega é o link do vídeo já publicado — é sobre o conteúdo público que a
          conformidade se verifica. Aprovar libera a custódia para pagamento; o pagamento
          em si é um passo à parte.
        </p>
      </div>

      <div className="flex gap-1 flex-wrap">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors"
            style={tab === k
              ? { background: "var(--color-teal-500)", color: "#fff" }
              : { color: "var(--ink-muted)" }}
          >
            {label}{" "}
            <span className="font-normal" style={{ opacity: 0.7 }}>
              ({counts[k as keyof typeof counts]})
            </span>
          </button>
        ))}
      </div>

      {deliveries.isLoading ? (
        <TableSkeleton rows={3} />
      ) : deliveries.isError ? (
        <ErrorState onRetry={() => deliveries.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          message={tab === "all"
            ? "Nenhuma entrega ainda. Elas aparecem aqui quando o criador manda o link do vídeo publicado."
            : "Nenhuma entrega neste estado."}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <DeliveryCard key={d.deliveryId} d={d} onOpen={() => setSelected(d.deliveryId)} />
          ))}
        </div>
      )}

      {current && <ReviewDrawer d={current} onClose={() => setSelected(null)} />}
    </div>
  )
}

function DeliveryCard({ d, onOpen }: { d: DeliverySummary; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-xl border border-border-soft overflow-hidden hover:opacity-95 transition-opacity"
      style={{ background: "var(--surface)" }}
    >
      <div className="relative aspect-video bg-[#111827]">
        {/* A miniatura vem do YouTube porque a entrega É um vídeo público. Se o id
            estiver errado a imagem não carrega e o play continua legível. */}
        <img
          src={youtubeThumb(d.youtubeVideoId)}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="w-8 h-8" style={{ color: "rgba(255,255,255,.9)" }} />
        </div>
        <span className="absolute top-2.5 left-2.5">
          <DeliveryChip status={d.status} small />
        </span>
        {d.isReviewOverdue && (
          <span
            className="absolute top-2.5 right-2.5 text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,0,0,.7)", color: "#FCD34D" }}
          >
            prazo vencido
          </span>
        )}
      </div>
      <div className="p-3.5">
        <div className="text-[13.5px] font-medium mb-1.5 truncate" style={{ color: "var(--ink)" }}>
          {d.campaignName}
        </div>
        <div className="flex items-center justify-between text-[11.5px] text-ink-muted gap-2">
          <span className="truncate">{d.influencerName}</span>
          <span className="font-mono-zoe shrink-0">
            {d.escrowAmountCents != null ? fmtCents(d.escrowAmountCents) : "Permuta"}
          </span>
        </div>
        {d.escrowState && (
          <div className="text-[11px] text-ink-muted mt-1.5">
            custódia: {tEnum("escrowState", d.escrowState)}
          </div>
        )}
      </div>
    </button>
  )
}

function ReviewDrawer({ d, onClose }: { d: DeliverySummary; onClose: () => void }) {
  const { startReview, decide } = useDeliveryMutations()
  const [notes, setNotes] = useState("")

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível concluir.")
    }
  }

  const decideWith = (decision: DeliveryDecision, ok: string) => {
    // Correção e recusa mudam o rumo do contrato: exigir o motivo é o mínimo para o
    // criador saber o que refazer, e é o que fica no relatório da entrega.
    if (decision !== "Approve" && !notes.trim()) {
      toast.error("Diga o motivo — ele vai para o criador junto com a decisão.")
      return
    }
    return run(
      () => decide.mutateAsync({ deliveryId: d.deliveryId, decision, notes: notes.trim() || undefined }),
      ok,
    )
  }

  const busy = startReview.isPending || decide.isPending
  const decided = d.status === "Approved" || d.status === "Rejected"

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(11,15,26,.5)" }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] overflow-y-auto border-l border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border-soft"
          style={{ background: "var(--surface)" }}
        >
          <div className="eyebrow">Revisão da entrega</div>
          <button onClick={onClose} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <a
            href={youtubeWatch(d.youtubeVideoId)}
            target="_blank"
            rel="noreferrer noopener"
            className="block relative aspect-video rounded-lg overflow-hidden bg-[#111827] mb-4"
          >
            <img
              src={youtubeThumb(d.youtubeVideoId)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.95)" }}
              >
                <Play className="w-6 h-6" style={{ color: "var(--ink)" }} />
              </div>
            </div>
          </a>

          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <DeliveryChip status={d.status} />
            {d.submissionAttempt > 1 && (
              <span className="chip text-[10.5px]">{d.submissionAttempt}ª tentativa</span>
            )}
          </div>

          <h2 className="font-display m-0 mt-2 mb-1.5" style={{ fontSize: 19, color: "var(--ink)" }}>
            {d.campaignName}
          </h2>
          <div className="text-[12.5px] text-ink-muted mb-1">
            {d.influencerName} · enviada em {fmtDate(d.submittedAt)}
          </div>
          <a
            href={youtubeWatch(d.youtubeVideoId)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[12px] font-mono-zoe"
            style={{ color: "var(--color-teal-500)" }}
          >
            {d.submittedUrl} <ExternalLink className="w-3 h-3" />
          </a>

          {d.reviewDueAt && !decided && (
            <div
              className="flex items-center gap-1.5 rounded-lg p-2.5 text-[12px] mt-4"
              style={d.isReviewOverdue
                ? { background: "#DC262615", color: "#DC2626" }
                : { background: "var(--bg, #F9FAFB)", color: "var(--ink-muted)" }}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {d.isReviewOverdue
                ? `Prazo de revisão venceu em ${fmtDate(d.reviewDueAt)}.`
                : `Prazo de revisão até ${fmtDate(d.reviewDueAt)}.`}
              {" "}Nada acontece automaticamente — a decisão é sua.
            </div>
          )}

          {/* O lugar do score existe e fica explícito enquanto a auditoria não chega.
              Melhor dizer que a revisão é manual do que deixar um vazio sem explicação. */}
          <div
            className="rounded-lg border border-border-soft p-4 mt-4"
            style={{ background: "var(--bg, #FAFBFC)" }}
          >
            <div className="eyebrow mb-2">Conformidade</div>
            <p className="text-[12.5px] text-ink-muted m-0">
              Revisão manual: assista ao vídeo e confira menção da marca, logo, tom e o
              disclosure de publicidade. A auditoria automática — score e checklist — entra
              com o combo Intelligence, e mesmo lá o clique final continua sendo seu.
            </p>
          </div>

          {d.escrowState && (
            <div className="rounded-lg border border-border-soft p-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Custódia</div>
                  <div className="text-[12.5px] mt-1" style={{ color: "var(--ink)" }}>
                    {tEnum("escrowState", d.escrowState)}
                  </div>
                </div>
                <div className="font-mono-zoe text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                  {d.escrowAmountCents != null ? fmtCents(d.escrowAmountCents) : "—"}
                </div>
              </div>
              <Link
                to={`/operations/contracts/${d.contractId}`}
                className="text-[12px] mt-2.5 inline-block"
                style={{ color: "var(--color-teal-500)" }}
              >
                Ver contrato →
              </Link>
            </div>
          )}

          {d.decisionNotes && (
            <div className="rounded-lg p-3 text-[12.5px] mt-4" style={{ background: "var(--bg, #F9FAFB)" }}>
              <div className="text-[11px] text-ink-muted mb-1">Motivo registrado</div>
              <span style={{ color: "var(--ink)" }}>{d.decisionNotes}</span>
            </div>
          )}

          <RoleGate minRole="Manager">
            {decided ? (
              <div className="text-[12.5px] text-ink-muted mt-5">
                Entrega {tEnum("deliveryStatus", d.status).toLowerCase()} — decisão registrada e
                não se refaz. Correção posterior é nova submissão do criador.
              </div>
            ) : d.status === "Submitted" ? (
              <>
                <p className="text-[12px] text-ink-muted mt-5 mb-2">
                  Abrir a revisão fixa o prazo do SLA definido no contrato.
                </p>
                <button
                  onClick={() => run(() => startReview.mutateAsync(d.deliveryId), "Revisão aberta.")}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[14px] font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--color-teal-500)" }}
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Abrir revisão
                </button>
              </>
            ) : (
              <>
                <div className="mt-5">
                  <div className="text-[11px] text-ink-muted mb-1.5">
                    Observações {" "}
                    <span style={{ opacity: 0.8 }}>(obrigatórias para correção ou recusa)</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="O que precisa mudar, ou por que está conforme."
                    className="w-full px-3 py-2 rounded-lg border border-border-soft text-[13px] bg-transparent resize-y"
                    style={{ color: "var(--ink)" }}
                  />
                </div>

                <button
                  onClick={() => decideWith("Approve", "Entrega aprovada. A custódia ficou liberável.")}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[14px] font-medium text-white mt-3 disabled:opacity-50"
                  style={{ background: "var(--color-teal-500)" }}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Aprovar entrega
                </button>
                <p className="text-[11px] text-ink-muted mt-1.5 mb-3">
                  Aprovar não paga: torna a custódia liberável. A liberação é um passo
                  separado, e continua sendo um clique humano.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => decideWith("RequestRework", "Correção solicitada.")}
                    disabled={busy}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[13px] border border-border-soft disabled:opacity-50"
                    style={{ color: "#D97706" }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Pedir correção
                  </button>
                  <button
                    onClick={() => decideWith("Reject", "Entrega recusada. A custódia foi para disputa.")}
                    disabled={busy}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[13px] border border-border-soft disabled:opacity-50"
                    style={{ color: "#DC2626" }}
                  >
                    <Ban className="w-3.5 h-3.5" /> Recusar
                  </button>
                </div>
                <p className="text-[11px] text-ink-muted mt-2">
                  Recusar é definitivo e leva a custódia para disputa, com resolução manual.
                  Para dar nova chance ao criador, use correção.
                </p>
              </>
            )}
          </RoleGate>
        </div>
      </div>
    </>
  )
}
