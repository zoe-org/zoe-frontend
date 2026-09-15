import { useMemo, useState } from "react"
import { DeliveryDrafts } from "@/pages/operations/DeliveryDrafts"
import { Link } from "react-router-dom"
import {
  X, Loader2, Play, Check, RotateCcw, Ban, ExternalLink, Clock, AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, matches, campanhaLabel } from "@/pages/operations/format"
import {
  TableSkeleton, ErrorState, SearchBox, NoResults,
} from "@/pages/operations/shared"
import {
  useDeliveries, useDeliveryMutations, fmtCents, youtubeThumb, youtubeWatch,
  type DeliverySummary, type DeliveryDecision, type DeliveryAudit,
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
 * 1. **A nota só aparece quando existe.** O protótipo estampa 92/58/81 em todo card;
 *    aqui o badge some em entrega de revisão manual, que não tem nota. Número inventado
 *    numa tela que decide pagamento é pior que espaço vazio.
 * 2. **Aprovar não paga, e a nota não decide.** O protótipo tem "Aprovar e liberar" num
 *    só botão; aqui aprovar apenas torna a custódia liberável (RN-O-043), e o botão
 *    continua disponível mesmo com a nota abaixo do mínimo — a IA é gate de qualidade,
 *    não autoridade financeira (RN-O-056).
 */
export default function OperationsDeliveriesPage() {
  const [tab, setTab] = useState<string>("all")
  // Os dois portões são momentos distintos do processo — cortes por aprovar e vídeos já
  // publicados. Numa lista só, a distinção some e alguém aprova o que não pretendia.
  const [gate, setGate] = useState<"drafts" | "published">("published")
  const [selected, setSelected] = useState<string | null>(null)
  const [busca, setBusca] = useState("")
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

  const porAba = tab === "all" ? items : items.filter((d) => d.status === tab)

  // A busca vem DEPOIS da aba: a aba diz em que fase olhar, a busca diz de quem. Inverter
  // faria a contagem das abas mudar conforme se digita, que e' o oposto de um indice.
  const filtered = useMemo(
    () => porAba.filter((d) => matches(busca, d.influencerName, d.campaignName, d.submittedUrl)),
    [porAba, busca],
  )

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

  if (gate === "drafts") {
    return (
      <div className="flex flex-col gap-5">
        <GateHeader gate={gate} onChange={setGate} />
        <DeliveryDrafts />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <GateHeader gate={gate} onChange={setGate} />
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

      <div className="flex gap-2 flex-wrap items-center justify-between">
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
        {items.length > 0 && (
          <SearchBox value={busca} onChange={setBusca} placeholder="Buscar por criador, campanha…" />
        )}
      </div>

      {deliveries.isLoading ? (
        <TableSkeleton rows={3} />
      ) : deliveries.isError ? (
        <ErrorState onRetry={() => deliveries.refetch()} />
      ) : filtered.length === 0 && busca ? (
        <NoResults query={busca} onClear={() => setBusca("")} />
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
        {/* Escurece so' a faixa superior, onde vivem a etiqueta e a nota. Escurecer a
            capa inteira esconderia o video, que e' o conteudo. */}
        <div
          className="absolute inset-x-0 top-0 h-14 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.45), transparent)" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="w-8 h-8" style={{ color: "rgba(255,255,255,.9)", filter: "drop-shadow(0 1px 3px rgba(0,0,0,.5))" }} />
        </div>
        {/* Sobre a capa, a etiqueta disputava com a imagem: um video claro apagava o
            "Aprovada", um escuro apagava o resto. Fundo proprio e sombra dao a ela um
            plano so' seu, independente do que houver embaixo. */}
        <span
          className="absolute top-2.5 left-2.5 rounded-md px-1 py-0.5"
          style={{
            background: "rgba(10,12,20,.72)",
            backdropFilter: "blur(4px)",
            boxShadow: "0 1px 4px rgba(0,0,0,.35)",
          }}
        >
          <DeliveryChip status={d.status} small />
        </span>
        {/* A nota ocupa o canto que o protótipo reservou. Só aparece quando existe —
            entrega em revisão manual não tem nota, e inventar um número aqui seria pior
            que o espaço vazio. */}
        {d.audit && (
          // A nota nunca aparece sem o badge (RN-O-061): o mesmo 82 vale menos quando só
          // houve comentários para analisar, e aqui ele decide pagamento.
          <span className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
            <span
              className="font-mono-zoe text-[11px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(0,0,0,.7)",
                color: d.audit.isApprovable ? "#34D399" : "#FCA5A5",
              }}
            >
              {d.audit.score}
            </span>
            <ConfidenceBadge pipelinePath={d.audit.pipelinePath} className="shadow-sm" />
          </span>
        )}
        {d.isReviewOverdue && (
          <span
            className="absolute bottom-2.5 right-2.5 text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,0,0,.7)", color: "#FCD34D" }}
          >
            prazo vencido
          </span>
        )}
      </div>
      <div className="p-3.5">
        <div className="text-[13.5px] font-medium mb-1.5 truncate" style={{ color: "var(--ink)" }}>
          {campanhaLabel(d.campaignName)}
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

/**
 * Conformidade da entrega. Quando houve auditoria, mostra a nota, o threshold que valeu e
 * o checklist item a item; quando não houve, diz que a revisão é manual — a ausência de
 * parecer é informação, não um vazio.
 *
 * A nota **não** esconde nem habilita o botão de aprovar: ela informa. Quem decide é quem
 * paga, inclusive contra o parecer da máquina (RN-O-056).
 */
function AuditCard({ audit }: { audit: DeliveryAudit | null }) {
  if (!audit) {
    return (
      <div
        className="rounded-lg border border-border-soft p-4 mt-4"
        style={{ background: "var(--bg, #FAFBFC)" }}
      >
        <div className="eyebrow mb-2">Conformidade</div>
        <p className="text-[12.5px] text-ink-muted m-0">
          Revisão manual: assista ao vídeo e confira menção da marca, logo, tom e o
          disclosure de publicidade. A auditoria automática entra com o combo Intelligence,
          e mesmo lá o clique final continua sendo seu.
        </p>
      </div>
    )
  }

  const color = audit.isApprovable ? "#00A799" : "#DC2626"
  const failures = audit.checklist.filter((i) => !i.passed)

  return (
    <div
      className="rounded-lg border border-border-soft p-4 mt-4"
      style={{ background: "var(--bg, #FAFBFC)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">Auditoria</div>
        <span
          className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
          style={{ background: `${color}18`, color }}
        >
          {audit.isApprovable ? "atingiu a nota" : "abaixo da nota"}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-display" style={{ fontSize: 40, lineHeight: 1, color }}>
          {audit.score}
        </span>
        <span className="text-[12.5px] text-ink-muted">
          / 100 · mínimo {audit.appliedThreshold}
        </span>
        <ConfidenceBadge pipelinePath={audit.pipelinePath} className="ml-auto self-center" />
      </div>

      {/* RN-O-061: pipeline degradado num contexto que decide pagamento tem de aparecer. */}
      {audit.isDegraded && (
        <div
          className="flex items-start gap-1.5 rounded p-2.5 text-[11.5px] mb-3"
          style={{ background: "#D9770615", color: "#D97706" }}
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Análise limitada ({tEnum("pipelinePath", audit.pipelinePath)}). Um item pode ter
            falhado por falta de dado, não por descumprimento — vale assistir ao vídeo antes
            de decidir.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {audit.checklist.map((item) => (
          <div key={item.criterion} className="flex items-start gap-1.5 text-[12.5px]">
            {item.passed
              ? <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#00A799" }} />
              : <X className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#DC2626" }} />}
            <span style={{ color: item.passed ? "var(--ink)" : "#DC2626" }}>
              {tEnum("auditCriterion", item.criterion)}
              {item.detail && (
                <span className="text-ink-muted"> — {item.detail}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* O texto muda com o resultado, mas a mensagem de fundo é a mesma nos dois casos:
          a nota não decide. */}
      <p className="text-[11px] text-ink-muted mt-3 mb-0">
        {audit.isApprovable
          ? "A nota alcançou o mínimo do contrato. Ainda assim, a aprovação é sua — a auditoria não libera pagamento sozinha."
          : failures.length > 0
            ? "Peça correção com estes pontos: o criador recebe a lista e pode reenviar. Você também pode aprovar mesmo assim, se entender que o caso é válido."
            : "A nota ficou abaixo do mínimo do contrato."}
      </p>
    </div>
  )
}

function ReviewDrawer({ d, onClose }: { d: DeliverySummary; onClose: () => void }) {
  const { decide } = useDeliveryMutations()
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

  const busy = decide.isPending
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
            {campanhaLabel(d.campaignName)}
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

          <AuditCard audit={d.audit} />

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
                  onClick={() => decideWith(
                    "Approve",
                    d.paymentFollowsApproval
                      ? "Entrega aprovada. O pagamento foi pedido."
                      : "Entrega aprovada. A custódia ficou liberável.",
                  )}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[14px] font-medium text-white mt-3 disabled:opacity-50"
                  style={{ background: "var(--color-teal-500)" }}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {d.paymentFollowsApproval ? "Aprovar e liberar pagamento" : "Aprovar entrega"}
                </button>
                <p className="text-[11px] text-ink-muted mt-1.5 mb-3">
                  {d.paymentFollowsApproval
                    ? `Aprovar pede o pagamento${d.escrowAmountCents != null ? ` de ${fmtCents(d.escrowAmountCents)}` : ""}. Ele sai pela fila, assim que o criador tiver a conta de recebimento verificada.`
                    : "Aprovar não paga: torna a custódia liberável. A liberação é um passo separado, e continua sendo um clique humano."}
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

/**
 * Alterna entre os dois portões. Fica acima do título de propósito: é a pergunta que vem
 * antes de "qual entrega", porque cada portão decide uma coisa diferente.
 */
function GateHeader({
  gate,
  onChange,
}: {
  gate: "drafts" | "published"
  onChange: (g: "drafts" | "published") => void
}) {
  const options: [typeof gate, string, string][] = [
    ["drafts", "Cortes por aprovar", "Antes de publicar"],
    ["published", "Entregas publicadas", "Libera pagamento"],
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(([id, label, hint]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="px-4 py-2.5 rounded-lg text-left transition-colors border"
          style={
            gate === id
              ? { background: "var(--color-teal-500)", color: "#fff", borderColor: "transparent" }
              : { color: "var(--ink-muted)", borderColor: "var(--border-soft)" }
          }
        >
          <div className="text-[13px] font-semibold">{label}</div>
          <div className="text-[11px]" style={{ opacity: 0.75 }}>{hint}</div>
        </button>
      ))}
    </div>
  )
}
