import { useMemo, useState } from "react"
import { Loader2, Check, RotateCcw, Film, X } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { EmptyBlock } from "@/components/ui/empty-block"
import { fmtDate, matches, campanhaLabel } from "@/pages/operations/format"
import {
  ErrorState, TableSkeleton, SearchBox, NoResults,
} from "@/pages/operations/shared"
import {
  useDeliveryDrafts, useDeliveryDraftMutations, type DeliveryDraftItem,
} from "@/lib/api/operations"

const STATUS_LABEL: Record<string, string> = {
  AwaitingReview: "Aguardando revisão",
  Approved: "Aprovado",
  ChangesRequested: "Correção pedida",
}

const STATUS_COLOR: Record<string, string> = {
  AwaitingReview: "#D97706",
  Approved: "#00A799",
  ChangesRequested: "#DC2626",
}

/**
 * Fila de cortes esperando decisão — o primeiro dos dois portões, do lado da marca.
 *
 * <p>Aprovar aqui libera a <b>publicação</b>, não o pagamento. O dinheiro continua atrás
 * do segundo portão, sobre o link do vídeo público — a tela diz isso explicitamente,
 * porque confundir os dois faria alguém achar que aprovou o pagamento sem querer.</p>
 */
export function DeliveryDrafts() {
  const [filter, setFilter] = useState<string>("AwaitingReview")
  const [busca, setBusca] = useState("")

  // Busca SEM filtro e separa em memoria, como Entregas e Custodia ja' faziam. Mandar o
  // filtro para a API punha a aba na chave do cache: cada troca era um cache diferente,
  // uma ida ao servidor, e a tela em branco ate a resposta voltar.
  const { data, isLoading, isError, refetch } = useDeliveryDrafts()

  const todos = useMemo(() => data?.items ?? [], [data])
  const porAba = filter ? todos.filter((d) => d.status === filter) : todos

  const items = useMemo(
    () => porAba.filter((d) => matches(busca, d.influencerName, d.campaignName, d.fileName)),
    [porAba, busca],
  )

  const contagem = {
    AwaitingReview: todos.filter((d) => d.status === "AwaitingReview").length,
    todos: todos.length,
  }

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap items-center justify-between">
        <div className="flex gap-1">
        {([["AwaitingReview", "Aguardando"], ["", "Todos"]] as const).map(([id, label]) => (
          <button
            key={id || "todos"}
            onClick={() => setFilter(id)}
            className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors inline-flex items-center gap-1.5"
            style={
              filter === id
                ? { background: "var(--color-teal-500)", color: "#fff" }
                : { color: "var(--ink-muted)", border: "1px solid var(--border-soft)" }
            }
          >
            {label}
            {/* A contagem antes do clique: sem ela a pessoa precisa entrar na aba para
                descobrir que ela esta' vazia. */}
            <span
              className="text-[11px] font-mono-zoe px-1.5 rounded"
              style={filter === id
                ? { background: "#ffffff28" }
                : { background: "var(--border-soft)" }}
            >
              {id ? contagem.AwaitingReview : contagem.todos}
            </span>
          </button>
        ))}
        </div>
        {todos.length > 0 && (
          <SearchBox value={busca} onChange={setBusca} placeholder="Buscar por criador, campanha…" />
        )}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 && busca ? (
        <NoResults query={busca} onClear={() => setBusca("")} />
      ) : items.length === 0 ? (
        <EmptyBlock
          className="py-14"
          icon={<Film className="w-7 h-7" strokeWidth={1.5} />}
          message="Nenhum corte esperando"
          hint="Quando um criador enviar o vídeo antes de publicar, ele aparece aqui para você aprovar."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((d) => <DraftCard key={d.draftId} draft={d} />)}
        </div>
      )}
    </div>
  )
}

function DraftCard({ draft }: { draft: DeliveryDraftItem }) {
  const { decide } = useDeliveryDraftMutations()
  const [asking, setAsking] = useState(false)
  const [notes, setNotes] = useState("")

  const pending = draft.status === "AwaitingReview"

  const run = async (decision: "Approve" | "RequestChanges") => {
    if (decision === "RequestChanges" && !notes.trim()) {
      toast.error("Diga o que precisa mudar — o criador não tem como adivinhar.")
      return
    }

    try {
      const res = await decide.mutateAsync({
        draftId: draft.draftId, decision, notes: notes.trim() || undefined,
      })
      setAsking(false)
      setNotes("")
      toast.success(res.publicationReleased
        ? "Corte aprovado. O criador já pode publicar."
        : "Devolvido com o que mudar.")
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível registrar a decisão.")
    }
  }

  return (
    <div
      className="rounded-xl border border-border-soft p-4"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0">
          <div className="font-medium text-[14px]" style={{ color: "var(--ink)" }}>
            {draft.influencerName}
          </div>
          <div className="text-[12.5px] text-ink-muted">
            {campanhaLabel(draft.campaignName)}
            {draft.revision > 1 && ` · revisão ${draft.revision}`}
          </div>
        </div>
        <span
          className="chip text-[10.5px]"
          style={{ color: STATUS_COLOR[draft.status], background: `${STATUS_COLOR[draft.status]}15` }}
        >
          {STATUS_LABEL[draft.status] ?? draft.status}
        </span>
      </div>

      {/* O vídeo é o ponto da tela: quem decide precisa assistir, não ler metadado. */}
      {draft.previewUrl && (
        <video
          src={draft.previewUrl}
          controls
          preload="metadata"
          className="w-full rounded-lg mb-3"
          style={{ maxHeight: 380, background: "#000" }}
        />
      )}

      <div className="text-[11.5px] text-ink-muted mb-3">
        {draft.fileName ?? "Arquivo"}
        {draft.sizeBytes && ` · ${(draft.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
        {` · enviado em ${fmtDate(draft.submittedAt)}`}
      </div>

      {draft.creatorNotes && (
        <div
          className="rounded-lg p-3 mb-3 text-[12.5px]"
          style={{ background: "var(--bg, #F9FAFB)", color: "var(--ink-2)" }}
        >
          <span className="text-ink-muted">Recado do criador: </span>
          {draft.creatorNotes}
        </div>
      )}

      {!pending && draft.decisionNotes && (
        <div className="rounded-lg p-3 mb-3 text-[12.5px]" style={{ background: "var(--bg, #F9FAFB)" }}>
          <span className="text-ink-muted">Sua devolutiva: </span>
          {draft.decisionNotes}
        </div>
      )}

      {pending && (
        <>
          {asking && (
            <div className="mb-3">
              <div className="text-[11px] text-ink-muted mb-1.5">
                O que precisa mudar? O criador vai ler isto para refazer.
              </div>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: cortar os 10s iniciais e mencionar a marca antes do minuto 2"
                autoFocus
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {asking ? (
              <>
                <button
                  onClick={() => run("RequestChanges")}
                  disabled={decide.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                  style={{ background: "#DC2626" }}
                >
                  {decide.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RotateCcw className="w-3.5 h-3.5" />}
                  Devolver para correção
                </button>
                <button
                  onClick={() => { setAsking(false); setNotes("") }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] border border-border-soft"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => run("Approve")}
                  disabled={decide.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--color-teal-500)" }}
                >
                  {decide.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Check className="w-3.5 h-3.5" />}
                  Aprovar e liberar publicação
                </button>
                <button
                  onClick={() => setAsking(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] border border-border-soft"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Pedir correção
                </button>
              </>
            )}
          </div>

          {/* A confusão que esta linha evita custa caro nos dois sentidos. */}
          <p className="text-[11.5px] text-ink-muted mt-2.5 mb-0">
            Aprovar libera a <strong>publicação</strong>, não o pagamento — o dinheiro só
            sai depois que você aprovar o vídeo publicado.
          </p>
        </>
      )}
    </div>
  )
}
