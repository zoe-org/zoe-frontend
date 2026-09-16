import { useMemo, useState, Fragment } from "react"
import { DRAFT_STATUS_COLOR } from "@/pages/operations/statusColors"
import { Loader2, Check, RotateCcw, Film } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { EmptyBlock } from "@/components/ui/empty-block"
import { RoleGate } from "@/features/auth/RoleGate"
import { fmtDate, matches, campanhaLabel } from "@/pages/operations/format"
import {
  ErrorState, TableSkeleton, SearchBox, NoResults,
} from "@/pages/operations/shared"
import { QueueLayout, QueueRow, QueueSection } from "@/pages/operations/ReviewQueue"
import { secoesPorCampanha, itensVisiveis } from "@/pages/operations/queueSections"
import { useIsWide, useQueueKeys, esperaLabel } from "@/pages/operations/queueNavigation"
import {
  useDeliveryDrafts, useDeliveryDraftMutations, type DeliveryDraftItem,
} from "@/lib/api/operations"

const STATUS_LABEL: Record<string, string> = {
  AwaitingReview: "Aguardando revisão",
  Approved: "Aprovado",
  ChangesRequested: "Correção pedida",
}

const STATUS_COLOR = DRAFT_STATUS_COLOR

/** Valor do filtro de campanha para contrato avulso — "" já significa "todas". */
const SEM_CAMPANHA = "avulso"

const DraftChip = ({ status }: { status: string }) => (
  <span
    className="chip text-[10.5px]"
    style={{ color: STATUS_COLOR[status], background: `${STATUS_COLOR[status]}15` }}
  >
    {STATUS_LABEL[status] ?? status}
  </span>
)

/**
 * Fila de cortes esperando decisão — o primeiro dos dois portões, do lado da marca.
 *
 * <p>Aprovar aqui libera a <b>publicação</b>, não o pagamento. O dinheiro continua atrás
 * do segundo portão, sobre o link do vídeo público — a tela diz isso explicitamente,
 * porque confundir os dois faria alguém achar que aprovou o pagamento sem querer.</p>
 *
 * <p>Um vídeo por vez: cada corte era um card com o player aberto, empilhado, e com cinco
 * deles achar o próximo virava rolagem sem fim.</p>
 */
export function DeliveryDrafts() {
  const wide = useIsWide()
  const [filter, setFilter] = useState<string>("AwaitingReview")
  const [busca, setBusca] = useState("")
  const [campanha, setCampanha] = useState("")
  const [selected, setSelected] = useState<string | null>(null)

  // Busca SEM filtro e separa em memoria, como Entregas e Custodia ja' faziam. Mandar o
  // filtro para a API punha a aba na chave do cache: cada troca era um cache diferente,
  // uma ida ao servidor, e a tela em branco ate a resposta voltar.
  const { data, isLoading, isError, refetch } = useDeliveryDrafts()

  const todos = useMemo(() => data?.items ?? [], [data])

  // Mesmo filtro das entregas publicadas: com várias campanhas ao mesmo tempo, a fila de cortes
  // misturava trabalhos de marcas e prazos diferentes numa lista só.
  const campanhas = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of todos) m.set(d.campaignId ?? SEM_CAMPANHA, campanhaLabel(d.campaignName))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
  }, [todos])

  // Aguardando: quem chegou antes no topo, que é a ordem de trabalho. Todos: mais recentes.
  const items = useMemo(
    () => todos
      .filter((d) => (!filter || d.status === filter)
        && (!campanha || (d.campaignId ?? SEM_CAMPANHA) === campanha)
        && matches(busca, d.influencerName, d.campaignName, d.fileName))
      .sort((a, b) => filter
        ? Date.parse(a.submittedAt) - Date.parse(b.submittedAt)
        : Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
    [todos, filter, busca, campanha],
  )

  // Mesmas seções da fila de entregas: sem campanha escolhida e com mais de uma, uma seção por
  // campanha, na ordem da fila. Teclado e "próximo" seguem a ordem da tela.
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(() => new Set())
  const secoes = useMemo(
    () => secoesPorCampanha(
      items,
      (d) => ({ id: d.campaignId, nome: d.campaignName }),
      (d) => d.status === "AwaitingReview",
      campanhaLabel,
    ),
    [items],
  )
  const agrupar = !campanha && secoes.length > 1
  const visiveis = agrupar ? itensVisiveis(secoes, recolhidas) : items
  const alternarSecao = (chave: string) => setRecolhidas((atuais) => {
    const proximas = new Set(atuais)
    if (proximas.has(chave)) proximas.delete(chave)
    else proximas.add(chave)
    return proximas
  })

  const contagem = {
    AwaitingReview: todos.filter((d) => d.status === "AwaitingReview").length,
    todos: todos.length,
  }

  const ids = visiveis.map((d) => d.draftId)
  const atual = visiveis.find((d) => d.draftId === selected) ?? (wide ? visiveis[0] : undefined) ?? null

  const aposDecidir = (draftId: string) => {
    if (filter !== "AwaitingReview") return
    const i = ids.indexOf(draftId)
    setSelected(ids[i + 1] ?? ids[i - 1] ?? null)
  }

  useQueueKeys({
    ids,
    selected: atual?.draftId ?? null,
    onSelect: setSelected,
    onClose: wide ? undefined : () => setSelected(null),
    notesId: "draft-notes",
  })

  const linha = (d: DeliveryDraftItem) => (
    <QueueRow
      key={d.draftId}
      id={d.draftId}
      active={atual?.draftId === d.draftId}
      onSelect={setSelected}
      title={d.influencerName}
      subtitle={`${campanhaLabel(d.campaignName)}${d.revision > 1 ? ` · revisão ${d.revision}` : ""}`}
      status={<DraftChip status={d.status} />}
      meta={esperaLabel(d.submittedAt)}
    />
  )

  return (
    <>
      <div>
        <div className="eyebrow mb-2">Operations · Qualidade</div>
        <h1 className="font-display m-0" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
          Cortes por aprovar
        </h1>
        <p className="text-[14px] text-ink-muted mt-1.5 max-w-[620px]">
          O vídeo antes de ir ao ar. Aprovar libera a publicação — o pagamento só sai depois,
          sobre o vídeo publicado.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center justify-between">
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
          <div className="flex gap-2 flex-wrap items-center">
            {campanhas.length > 1 && (
              <select
                value={campanha}
                onChange={(e) => setCampanha(e.target.value)}
                aria-label="Filtrar por campanha"
                className="h-9 px-2.5 rounded-lg border border-border-soft text-[12.5px] bg-transparent max-w-[220px]"
                style={{ color: "var(--ink)" }}
              >
                <option value="">Todas as campanhas</option>
                {campanhas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            )}
            <SearchBox value={busca} onChange={setBusca} placeholder="Buscar por criador, campanha…" />
          </div>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 && (busca || campanha) ? (
        <NoResults
          query={busca || campanhas.find(([id]) => id === campanha)?.[1] || ""}
          onClear={() => { setBusca(""); setCampanha("") }}
        />
      ) : items.length === 0 ? (
        <EmptyBlock
          className="py-14"
          icon={<Film className="w-7 h-7" strokeWidth={1.5} />}
          message="Nenhum corte esperando"
          hint="Quando um criador enviar o vídeo antes de publicar, ele aparece aqui para você aprovar."
        />
      ) : (
        <QueueLayout
          wide={wide}
          detailTitle="Revisão do corte"
          onCloseDetail={() => setSelected(null)}
          hint="↑ ↓ ou J K andam pela fila · C escreve o que mudar"
          list={agrupar
            ? secoes.map((sec) => (
              <Fragment key={sec.chave}>
                <QueueSection
                  label={sec.rotulo}
                  count={sec.itens.length}
                  pending={sec.pendentes}
                  collapsed={recolhidas.has(sec.chave)}
                  onToggle={() => alternarSecao(sec.chave)}
                />
                {!recolhidas.has(sec.chave) && sec.itens.map(linha)}
              </Fragment>
            ))
            : items.map(linha)}
          detail={atual && (
            // A revisão entra na chave: o reenvio do criador reaproveita o mesmo corte, e o
            // texto digitado para a versão anterior não pode ficar pendurado na nova.
            <DraftPanel
              key={`${atual.draftId}-${atual.revision}`}
              draft={atual}
              onDecided={() => aposDecidir(atual.draftId)}
            />
          )}
        />
      )}
    </>
  )
}

function DraftPanel({ draft, onDecided }: { draft: DeliveryDraftItem; onDecided: () => void }) {
  const { decide } = useDeliveryDraftMutations()
  const [notes, setNotes] = useState("")

  const pending = draft.status === "AwaitingReview"

  const run = async (decision: "Approve" | "RequestChanges") => {
    if (decision === "RequestChanges" && !notes.trim()) {
      toast.error("Diga o que precisa mudar — o criador não tem como adivinhar.")
      document.getElementById("draft-notes")?.focus()
      return
    }

    try {
      const res = await decide.mutateAsync({
        draftId: draft.draftId, decision, notes: notes.trim() || undefined,
      })
      toast.success(res.publicationReleased
        ? "Corte aprovado. O criador já pode publicar."
        : "Devolvido com o que mudar.")
      onDecided()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível registrar a decisão.")
    }
  }

  return (
    <div className="p-6">
      {/* O vídeo é o ponto da tela: quem decide precisa assistir, não ler metadado. Um player
          só, do corte aberto — a pilha carregava os metadados de todos ao montar. */}
      {draft.previewUrl ? (
        <video
          key={draft.previewUrl}
          src={draft.previewUrl}
          controls
          preload="metadata"
          className="w-full rounded-lg mb-4"
          style={{ maxHeight: 420, background: "#000" }}
        />
      ) : (
        <div className="rounded-lg mb-4 aspect-video flex items-center justify-center text-ink-muted" style={{ background: "#111827" }}>
          <Film className="w-8 h-8" strokeWidth={1.5} />
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-display m-0" style={{ fontSize: 19, color: "var(--ink)" }}>
          {draft.influencerName}
        </h2>
        <DraftChip status={draft.status} />
      </div>
      <div className="text-[12.5px] text-ink-muted mb-3">
        {campanhaLabel(draft.campaignName)}
        {draft.revision > 1 && ` · revisão ${draft.revision}`}
      </div>

      <div className="text-[11.5px] text-ink-muted mb-3">
        {draft.fileName ?? "Arquivo"}
        {draft.sizeBytes && ` · ${(draft.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
        {` · enviado em ${fmtDate(draft.submittedAt)} (${esperaLabel(draft.submittedAt)})`}
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

      {draft.decisionNotes && (
        <div className="rounded-lg p-3 mb-3 text-[12.5px]" style={{ background: "var(--bg, #F9FAFB)" }}>
          <span className="text-ink-muted">{pending ? "Devolutiva da versão anterior: " : "Sua devolutiva: "}</span>
          {draft.decisionNotes}
        </div>
      )}

      {pending && (
        <RoleGate minRole="Manager">
          <label htmlFor="draft-notes" className="block text-[11px] text-ink-muted mb-1.5 mt-4">
            O que precisa mudar? <span style={{ opacity: 0.8 }}>(obrigatório para pedir correção)</span>
          </label>
          <textarea
            id="draft-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ex.: cortar os 10s iniciais e mencionar a marca antes do minuto 2"
            className="w-full px-3 py-2 rounded-lg border border-border-soft text-[13px] bg-transparent resize-y"
            style={{ color: "var(--ink)" }}
          />

          <div className="flex gap-2 flex-wrap mt-3">
            <button
              onClick={() => run("Approve")}
              disabled={decide.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--color-teal-500)" }}
            >
              {decide.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5" />}
              Aprovar e liberar publicação
            </button>
            <button
              onClick={() => run("RequestChanges")}
              disabled={decide.isPending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] border border-border-soft disabled:opacity-50"
              style={{ color: "#D97706" }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Pedir correção
            </button>
          </div>

          {/* A confusão que esta linha evita custa caro nos dois sentidos. */}
          <p className="text-[11.5px] text-ink-muted mt-2.5 mb-0">
            Aprovar libera a <strong>publicação</strong>, não o pagamento — o dinheiro só
            sai depois que você aprovar o vídeo publicado.
          </p>
        </RoleGate>
      )}
    </div>
  )
}
