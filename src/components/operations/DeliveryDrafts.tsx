import { useMemo, useState, Fragment } from "react"
import { DRAFT_STATUS_COLOR } from "@/lib/status-colors"
import { Loader2, Check, RotateCcw, Film } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { EmptyBlock } from "@/components/ui/empty-block"
import { RoleGate } from "@/features/auth/RoleGate"
import { fmtDate, matches, campaignLabel } from "@/lib/operations-format"
import {
  ErrorState, TableSkeleton, SearchBox, NoResults,
} from "@/components/operations/shared"
import { QueueLayout, QueueRow, QueueSection } from "@/components/operations/ReviewQueue"
import { sectionsByCampaign, visibleItems } from "@/lib/queue-sections"
import { useIsWide, useQueueKeys, waitingLabel } from "@/lib/queue-navigation"
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
const NO_CAMPAIGN = "avulso"

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
  const [search, setSearch] = useState("")
  const [campaignFilter, setCampaignFilter] = useState("")
  const [selected, setSelected] = useState<string | null>(null)

  // Busca SEM filtro e separa em memoria, como Entregas e Custodia ja' faziam. Mandar o
  // filtro para a API punha a aba na chave do cache: cada troca era um cache diferente,
  // uma ida ao servidor, e a tela em branco ate a resposta voltar.
  const { data, isLoading, isError, refetch } = useDeliveryDrafts()

  const all = useMemo(() => data?.items ?? [], [data])

  // Mesmo filtro das entregas publicadas: com várias campanhas ao mesmo tempo, a fila de cortes
  // misturava trabalhos de marcas e prazos diferentes numa lista só.
  const campaignOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of all) m.set(d.campaignId ?? NO_CAMPAIGN, campaignLabel(d.campaignName))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
  }, [all])

  // Aguardando: quem chegou antes no topo, que é a ordem de trabalho. Todos: mais recentes.
  const items = useMemo(
    () => all
      .filter((d) => (!filter || d.status === filter)
        && (!campaignFilter || (d.campaignId ?? NO_CAMPAIGN) === campaignFilter)
        && matches(search, d.influencerName, d.campaignName, d.fileName))
      .sort((a, b) => filter
        ? Date.parse(a.submittedAt) - Date.parse(b.submittedAt)
        : Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
    [all, filter, search, campaignFilter],
  )

  // Mesmas seções da fila de entregas: sem campanha escolhida e com mais de uma, uma seção por
  // campanha, na ordem da fila. Teclado e "próximo" seguem a ordem da tela.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const sections = useMemo(
    () => sectionsByCampaign(
      items,
      (d) => ({ id: d.campaignId, name: d.campaignName }),
      (d) => d.status === "AwaitingReview",
      campaignLabel,
    ),
    [items],
  )
  const grouped = !campaignFilter && sections.length > 1
  const visible = grouped ? visibleItems(sections, collapsed) : items
  const toggleSection = (key: string) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const counts = {
    AwaitingReview: all.filter((d) => d.status === "AwaitingReview").length,
    all: all.length,
  }

  const ids = visible.map((d) => d.draftId)
  const selectedDraft = visible.find((d) => d.draftId === selected) ?? (wide ? visible[0] : undefined) ?? null

  const afterDecision = (draftId: string) => {
    if (filter !== "AwaitingReview") return
    const i = ids.indexOf(draftId)
    setSelected(ids[i + 1] ?? ids[i - 1] ?? null)
  }

  useQueueKeys({
    ids,
    selected: selectedDraft?.draftId ?? null,
    onSelect: setSelected,
    onClose: wide ? undefined : () => setSelected(null),
    notesId: "draft-notes",
  })

  const renderRow = (d: DeliveryDraftItem) => (
    <QueueRow
      key={d.draftId}
      id={d.draftId}
      active={selectedDraft?.draftId === d.draftId}
      onSelect={setSelected}
      title={d.influencerName}
      subtitle={`${campaignLabel(d.campaignName)}${d.revision > 1 ? ` · revisão ${d.revision}` : ""}`}
      status={<DraftChip status={d.status} />}
      meta={waitingLabel(d.submittedAt)}
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
                {id ? counts.AwaitingReview : counts.all}
              </span>
            </button>
          ))}
        </div>
        {all.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            {campaignOptions.length > 1 && (
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                aria-label="Filtrar por campanha"
                className="h-9 px-2.5 rounded-lg border border-border-soft text-[12.5px] bg-transparent max-w-[220px]"
                style={{ color: "var(--ink)" }}
              >
                <option value="">Todas as campanhas</option>
                {campaignOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            )}
            <SearchBox value={search} onChange={setSearch} placeholder="Buscar por criador, campanha…" />
          </div>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 && (search || campaignFilter) ? (
        <NoResults
          query={search || campaignOptions.find(([id]) => id === campaignFilter)?.[1] || ""}
          onClear={() => { setSearch(""); setCampaignFilter("") }}
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
          list={grouped
            ? sections.map((sec) => (
              <Fragment key={sec.key}>
                <QueueSection
                  label={sec.label}
                  count={sec.items.length}
                  pending={sec.pendingCount}
                  collapsed={collapsed.has(sec.key)}
                  onToggle={() => toggleSection(sec.key)}
                />
                {!collapsed.has(sec.key) && sec.items.map(renderRow)}
              </Fragment>
            ))
            : items.map(renderRow)}
          detail={selectedDraft && (
            // A revisão entra na chave: o reenvio do criador reaproveita o mesmo corte, e o
            // texto digitado para a versão anterior não pode ficar pendurado na nova.
            <DraftPanel
              key={`${selectedDraft.draftId}-${selectedDraft.revision}`}
              draft={selectedDraft}
              onDecided={() => afterDecision(selectedDraft.draftId)}
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
      notifyError(null, "Diga o que precisa mudar — o criador não tem como adivinhar.")
      document.getElementById("draft-notes")?.focus()
      return
    }

    try {
      const res = await decide.mutateAsync({
        draftId: draft.draftId, decision, notes: notes.trim() || undefined,
      })
      notifySuccess(res.publicationReleased
        ? "Corte aprovado. O criador já pode publicar."
        : "Devolvido com o que mudar.")
      onDecided()
    } catch (e) {
      notifyError(e, "Não foi possível registrar a decisão.")
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
        {campaignLabel(draft.campaignName)}
        {draft.revision > 1 && ` · revisão ${draft.revision}`}
      </div>

      <div className="text-[11.5px] text-ink-muted mb-3">
        {draft.fileName ?? "Arquivo"}
        {draft.sizeBytes && ` · ${(draft.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
        {` · enviado em ${fmtDate(draft.submittedAt)} (${waitingLabel(draft.submittedAt)})`}
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
