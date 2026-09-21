import { useMemo, useState, Fragment } from "react"
import { DELIVERY_STATUS_COLOR } from "@/lib/status-colors"
import { DeliveryDrafts } from "@/components/operations/DeliveryDrafts"
import { Link, useSearchParams } from "react-router-dom"
import {
  X, Loader2, Play, Check, RotateCcw, Ban, ExternalLink, Clock, AlertTriangle,
} from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { ConfidenceBadge } from "@/components/ui/confidence-badge"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, matches, campaignLabel } from "@/lib/operations-format"
import {
  TableSkeleton, ErrorState, SearchBox, NoResults, PlatformCover,
} from "@/components/operations/shared"
import { QueueLayout, QueueRow, QueueSection } from "@/components/operations/ReviewQueue"
import { Segmented } from "@/components/ui/segmented"
import { SelectField } from "@/components/ui/select-field"
import { sectionsByCampaign, visibleItems } from "@/lib/queue-sections"
import { ContractTimeline } from "@/components/operations/ContractTimeline"
import { useIsWide, useQueueKeys, waitingLabel } from "@/lib/queue-navigation"
import {
  groupByContract, sortQueue, PENDING_STATUSES, type DeliveryGroup,
} from "@/lib/delivery-queue"
import {
  useDeliveries, useDeliveryDrafts, useDeliveryMutations, fmtCents, useDeliveryThumb, deliveryLink,
  PLATFORM_LABEL,
  type DeliverySummary, type DeliveryDecision, type DeliveryAudit, type ReworkScope,
} from "@/lib/api/operations"

const STATUS_COLOR = DELIVERY_STATUS_COLOR

const DeliveryChip = (p: { status: string; small?: boolean }) => (
  <StatusChip {...p} kind="deliveryStatus" colors={STATUS_COLOR} />
)

const NO_DELIVERIES: DeliverySummary[] = []

type Gate = "drafts" | "published"

/** Aguardando junta "enviada" e "em revisão": para quem abre a fila, os dois esperam por ela. */
type QueueTab = "pending" | "ReworkRequested" | "Approved" | "Rejected" | "all"

const TABS: [QueueTab, string][] = [
  ["pending", "Aguardando"],
  ["ReworkRequested", "Correção"],
  ["Approved", "Aprovadas"],
  ["Rejected", "Recusadas"],
  ["all", "Todas"],
]

const inTab = (tab: QueueTab, status: string) =>
  tab === "all" ? true : tab === "pending" ? PENDING_STATUSES.has(status) : status === tab

/** Valor do filtro de campanha para contrato avulso — "" já significa "todas". */
const NO_CAMPAIGN = "avulso"

/**
 * Entregas nos dois portões. A nota só aparece quando existe, e não decide: aprovar continua disponível abaixo do mínimo (RN-O-056).
 */
export default function OperationsDeliveriesPage() {
  // Dois portões em abas separadas; <code>?stage=drafts</code> abre no de cortes.
  const [params] = useSearchParams()
  const [gate, setGate] = useState<Gate>(() => (params.get("stage") === "drafts" ? "drafts" : "published"))
  const deliveries = useDeliveries()
  const drafts = useDeliveryDrafts()

  // Referência estável: um `?? []` inline nasce novo a cada render e invalidaria os useMemo.
  const items = deliveries.data?.items ?? NO_DELIVERIES
  const groups = useMemo(() => groupByContract(items), [items])

  // O contador vai no botão do portão: sem ele era preciso lembrar de abrir as duas abas para
  // saber se havia algo esperando.
  const counts = {
    drafts: (drafts.data?.items ?? []).filter((d) => d.status === "AwaitingReview").length,
    published: groups.filter((g) => PENDING_STATUSES.has(g.current.status)).length,
  }

  return (
    // Full-bleed, como o resto da plataforma. Antes era uma pilha de blocos
    // dentro do padding padrão, e cada uma das duas filas trazia o PRÓPRIO
    // `<h1>` — o título da página trocava ao alternar de fila.
    <div className="-m-6" style={{ color: "var(--ink)" }}>
      <section className="px-8 pt-7 pb-6 border-b border-border-soft flex items-end justify-between" style={{ background: "var(--surface)" }}>
        <div className="flex-1 max-w-200 min-w-70">
          <div className="eyebrow mb-3">Operations · Qualidade</div>
          <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
            Entregas
          </h1>
          <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-200">
            Duas portas de qualidade: aprovar o corte libera a publicação, aprovar a entrega
            publicada libera o pagamento.
          </p>
        </div>
        <Segmented
          items={[
            { key: "drafts", label: "Cortes por aprovar", count: counts.drafts },
            { key: "published", label: "Entregas publicadas", count: counts.published },
          ]}
          value={gate}
          onChange={(k) => setGate(k as Gate)}
          ariaLabel="Fila de entregas"
        />
      </section>

      {gate === "drafts"
        ? <DeliveryDrafts />
        : (
          <PublishedQueue
            groups={groups}
            hasItems={items.length > 0}
            isLoading={deliveries.isLoading}
            isError={deliveries.isError}
            onRetry={() => deliveries.refetch()}
          />
        )}
    </div>
  )
}

function PublishedQueue({
  groups, hasItems, isLoading, isError, onRetry,
}: {
  groups: DeliveryGroup[]
  hasItems: boolean
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  const wide = useIsWide()
  // Vindo do detalhe da campanha, a fila já abre filtrada por ela — e no contrato clicado.
  const [params] = useSearchParams()
  const initialContractId = params.get("contract")
  const [chosenTab, setChosenTab] = useState<QueueTab | null>(null)
  const [search, setSearch] = useState("")
  const [campaignFilter, setCampaignFilter] = useState(() => params.get("campaign") ?? "")
  /** Por contrato, não por entrega: o reenvio do criador continua selecionado. */
  const [selected, setSelected] = useState<string | null>(initialContractId)

  // Sem escolha da pessoa, "Aguardando" — a menos que o que veio pelo link não tenha nada
  // esperando: abrir numa aba vazia fazia o "Ver todas" da campanha parecer quebrado.
  const tab: QueueTab = chosenTab ?? (
    (campaignFilter || initialContractId) && !groups.some((g) =>
      PENDING_STATUSES.has(g.current.status)
      && (!campaignFilter || (g.current.campaignId ?? NO_CAMPAIGN) === campaignFilter)
      && (!initialContractId || g.current.contractId === initialContractId))
      ? "all"
      : "pending")

  const counts = useMemo(
    () => Object.fromEntries(
      TABS.map(([k]) => [k, groups.filter((g) => inTab(k, g.current.status)).length]),
    ) as Record<QueueTab, number>,
    [groups],
  )

  const campaignOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.current.campaignId ?? NO_CAMPAIGN, campaignLabel(g.current.campaignName))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
  }, [groups])

  // A busca e a campanha vêm DEPOIS da aba: a aba diz em que fase olhar, os filtros dizem de
  // quem. Inverter faria a contagem das abas mudar conforme se digita.
  const filtered = useMemo(
    () => sortQueue(
      groups.filter((g) =>
        inTab(tab, g.current.status)
        && (!campaignFilter || (g.current.campaignId ?? NO_CAMPAIGN) === campaignFilter)
        && matches(search, g.current.influencerName, g.current.campaignName, g.current.submittedUrl)),
      tab === "pending",
    ),
    [groups, tab, campaignFilter, search],
  )

  // Sem campanha escolhida e com mais de uma na fila, a lista vira seções por campanha — a do item
  // mais urgente no topo. Teclado e "próximo depois de decidir" seguem a mesma ordem da tela.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const sections = useMemo(
    () => sectionsByCampaign(
      filtered,
      (g) => ({ id: g.current.campaignId, name: g.current.campaignName }),
      (g) => PENDING_STATUSES.has(g.current.status),
      campaignLabel,
    ),
    [filtered],
  )
  const grouped = !campaignFilter && sections.length > 1
  const visible = grouped ? visibleItems(sections, collapsed) : filtered
  const toggleSection = (key: string) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const ids = visible.map((g) => g.current.contractId)
  // Na tela larga sempre há um item aberto: o detalhe vazio ao lado da lista era espaço perdido.
  const selectedGroup = visible.find((g) => g.current.contractId === selected)
    ?? (wide ? visible[0] : undefined)
    ?? null

  // Decidiu em "Aguardando": o item sai da aba, e o próximo abre sozinho em vez de a pessoa
  // voltar ao topo da lista para achar onde parou.
  const afterDecision = (contractId: string) => {
    if (tab !== "pending") return
    const i = ids.indexOf(contractId)
    setSelected(ids[i + 1] ?? ids[i - 1] ?? null)
  }

  useQueueKeys({
    ids,
    selected: selectedGroup?.current.contractId ?? null,
    onSelect: setSelected,
    onClose: wide ? undefined : () => setSelected(null),
    notesId: "review-notes",
  })

  const renderRow = (g: DeliveryGroup) => {
    const d = g.current
    return (
      <QueueRow
        key={d.contractId}
        id={d.contractId}
        active={selectedGroup?.current.contractId === d.contractId}
        onSelect={setSelected}
        thumb={<RowThumb d={d} />}
        // O título é quem entregou. Pela campanha, todo contrato avulso virava
        // "Sem campanha" e o nome da pessoa ficava em letra miúda.
        title={d.influencerName}
        subtitle={`${campaignLabel(d.campaignName)}${d.submissionAttempt > 1 ? ` · ${d.submissionAttempt}ª tentativa` : ""}`}
        status={<DeliveryChip status={d.status} small />}
        meta={waitingLabel(d.submittedAt)}
        alert={d.isReviewOverdue && PENDING_STATUSES.has(d.status) ? "prazo vencido" : null}
      />
    )
  }

  return (
    <>
      <section className="px-8 py-3 border-b border-border-soft flex items-center justify-between gap-x-4 gap-y-2.5 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setChosenTab(k)}
              className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors inline-flex items-center gap-1.5"
              style={tab === k
                ? { background: "var(--color-teal-500)", color: "#fff" }
                : { color: "var(--ink-muted)", border: "1px solid var(--border-soft)" }}
            >
              {label}
              <span
                className="text-[11px] font-mono-zoe px-1.5 rounded"
                style={tab === k ? { background: "#ffffff28" } : { background: "var(--border-soft)" }}
              >
                {counts[k]}
              </span>
            </button>
          ))}
        </div>
        {hasItems && (
          <div className="flex gap-2 flex-wrap items-center ml-auto">
            {(campaignOptions.length > 1 || campaignFilter) && (
              <SelectField
                value={campaignFilter}
                onChange={setCampaignFilter}
                ariaLabel="Filtrar por campanha"
                className="data-[size=default]:h-8 px-3 text-[12.5px] rounded-lg border-border-soft max-w-[220px]"
                options={[
                  { key: "", label: "Todas as campanhas" },
                  ...campaignOptions.map(([id, name]) => ({ key: id, label: name })),
                ]}
              />
            )}
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Buscar por criador, campanha…"
              className="w-48 sm:w-60"
            />
          </div>
        )}
      </section>

      {/* O que esta fila decide — a frase saiu do `<h1>` que trocava. */}
      <p className="px-8 pt-4 pb-0 m-0 text-[12.5px] text-ink-muted max-w-160">
        A entrega é o link do vídeo já publicado — é sobre o conteúdo público que a
        conformidade se verifica. Aprovar libera a custódia para pagamento.
      </p>

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : isError ? (
        <ErrorState onRetry={onRetry} />
      ) : filtered.length === 0 && (search || campaignFilter) ? (
        <NoResults
          query={search || campaignOptions.find(([id]) => id === campaignFilter)?.[1] || ""}
          onClear={() => { setSearch(""); setCampaignFilter("") }}
        />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          message={!hasItems
            ? "Nenhuma entrega ainda. Elas aparecem aqui quando o criador manda o link do vídeo publicado."
            : tab === "pending"
              ? "Nada esperando revisão agora."
              : "Nenhuma entrega neste estado."}
        />
      ) : (
        <QueueLayout
          wide={wide}
          detailTitle="Revisão da entrega"
          onCloseDetail={() => setSelected(null)}
          hint="↑ ↓ ou J K andam pela fila · C escreve as observações"
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
            : filtered.map(renderRow)}
          detail={selectedGroup && (
            <ReviewPanel
              key={selectedGroup.current.deliveryId}
              group={selectedGroup}
              onDecided={() => afterDecision(selectedGroup.current.contractId)}
            />
          )}
        />
      )}
    </>
  )
}

/**
 * Conformidade da entrega: nota, threshold e checklist, ou aviso de revisão manual. A nota informa, não habilita o botão (RN-O-056).
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
          style={{ background: "var(--warn-bg)", color: "var(--color-warn)" }}
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
              : <X className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--color-neg)" }} />}
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

/** Sugere o tipo de correção pelo que a auditoria reprovou; quem revisa escolhe. */
function suggestScope(audit: DeliveryAudit | null): ReworkScope {
  const failures = audit?.checklist.filter((i) => !i.passed).map((i) => i.criterion.toLowerCase()) ?? []
  if (failures.length === 0) return "Content"
  const publicationOnly = failures.every((c) => c.includes("disclosure") || c.includes("hashtag") || c.includes("conar"))
  return publicationOnly ? "Publication" : "Content"
}

/** Capa da linha da fila. Componente porque a miniatura do TikTok é buscada, e hook não cabe em `linha`. */
function RowThumb({ d }: { d: DeliverySummary }) {
  const thumb = useDeliveryThumb(d)
  return thumb
    ? (
      <img
        src={thumb}
        alt=""
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
      />
    )
    : <PlatformCover platform={d.platform} compact />
}

/** O vídeo, dentro da tela quando é do YouTube — sair para outra aba a cada entrega cansava. */
function VideoPreview({ d }: { d: DeliverySummary }) {
  // Antes do retorno do YouTube: hook não pode ficar atrás de condição.
  const thumb = useDeliveryThumb(d)
  if (d.youtubeVideoId) {
    return (
      <div className="relative aspect-video rounded-lg overflow-hidden bg-[#111827] mb-4">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${d.youtubeVideoId}`}
          title={`Vídeo de ${d.influencerName}`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <a
      href={deliveryLink(d)}
      target="_blank"
      rel="noreferrer noopener"
      className="block relative aspect-video rounded-lg overflow-hidden bg-[#111827] mb-4"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
        />
      ) : (
        <PlatformCover platform={d.platform} />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,.95)" }}
        >
          <Play className="w-6 h-6" style={{ color: "var(--ink)" }} />
        </div>
      </div>
    </a>
  )
}

function ReviewPanel({ group, onDecided }: { group: DeliveryGroup; onDecided: () => void }) {
  const d = group.current
  const { decide } = useDeliveryMutations()
  const [notes, setNotes] = useState("")
  const [scope, setScope] = useState<ReworkScope>(() => suggestScope(d.audit))

  const decideWith = async (decision: DeliveryDecision, ok: string) => {
    // Correção e recusa mudam o rumo do contrato: exigir o motivo é o mínimo para o
    // criador saber o que refazer, e é o que fica no relatório da entrega.
    if (decision !== "Approve" && !notes.trim()) {
      notifyError(null, "Diga o motivo — ele vai para o criador junto com a decisão.")
      document.getElementById("review-notes")?.focus()
      return
    }
    try {
      await decide.mutateAsync({
        deliveryId: d.deliveryId,
        decision,
        notes: notes.trim() || undefined,
        scope: decision === "RequestRework" ? scope : undefined,
      })
      notifySuccess(ok)
      onDecided()
    } catch (e) {
      notifyError(e, "Não foi possível concluir.", { terminal: true })
    }
  }

  const busy = decide.isPending
  const decided = d.status === "Approved" || d.status === "Rejected"

  return (
    <div className="p-6">
      <VideoPreview d={d} />

      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <DeliveryChip status={d.status} />
        <span className="chip text-[10.5px]">{PLATFORM_LABEL[d.platform] ?? d.platform}</span>
        {d.submissionAttempt > 1 && (
          <span className="chip text-[10.5px]">{d.submissionAttempt}ª tentativa</span>
        )}
      </div>

      <h2 className="font-display m-0 mt-2 mb-1" style={{ fontSize: 19, color: "var(--ink)" }}>
        {d.influencerName}
      </h2>
      <div className="text-[12.5px] text-ink-muted mb-1">
        {campaignLabel(d.campaignName)} · enviada em {fmtDate(d.submittedAt)} ({waitingLabel(d.submittedAt)})
      </div>
      <a
        href={deliveryLink(d)}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 text-[12px] font-mono-zoe break-all"
        style={{ color: "var(--color-teal-500)" }}
      >
        {d.submittedUrl} <ExternalLink className="w-3 h-3 shrink-0" />
      </a>

      {d.reviewDueAt && !decided && (
        <div
          className="flex items-center gap-1.5 rounded-lg p-2.5 text-[12px] mt-4"
          style={d.isReviewOverdue
            ? { background: "#DC262615", color: "var(--color-neg)" }
            : { background: "var(--bg, #F9FAFB)", color: "var(--ink-muted)" }}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {d.isReviewOverdue
            ? `Prazo de revisão venceu em ${fmtDate(d.reviewDueAt)}.`
            : `Prazo de revisão até ${fmtDate(d.reviewDueAt)}.`}
          {" "}
          {/* Antes dizia sempre que nada acontecia sozinho. Com o termo no contrato (RN-O-055) o prazo
              decide, e quem revisa precisa saber disso antes de deixar para depois. */}
          {d.autoReleaseOnTimeout
            ? d.isReviewOverdue
              ? "Pelo contrato, a entrega será aprovada automaticamente em instantes."
              : "Se ninguém revisar até lá, a entrega é aprovada automaticamente, como diz o contrato."
            : "Nada acontece automaticamente — a decisão é sua."}
        </div>
      )}

      <AuditCard audit={d.audit} />

      {/* Custódia só no item atual: o estado é do contrato, e repeti-lo numa tentativa antiga
          já devolvida dava a entender que ela ainda contava. */}
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

      {group.previous.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-2">Tentativas anteriores</div>
          <ol className="flex flex-col gap-2 m-0 p-0 list-none">
            {group.previous.map((p) => (
              <li key={p.deliveryId} className="rounded-lg border border-border-soft p-3 text-[12px]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium" style={{ color: "var(--ink)" }}>
                    {p.submissionAttempt}ª tentativa · {fmtDate(p.submittedAt)}
                  </span>
                  <DeliveryChip status={p.status} small />
                </div>
                <a
                  href={deliveryLink(p)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-mono-zoe text-[11px] break-all"
                  style={{ color: "var(--color-teal-500)" }}
                >
                  {p.submittedUrl}
                </a>
                {p.decisionNotes && (
                  <div className="text-ink-muted mt-1">Motivo: {p.decisionNotes}</div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* A história do contrato, recolhida: quem revisa a 2ª tentativa precisa ver o que foi
          pedido da outra vez, e o corte que passou antes. */}
      <div className="mt-4">
        <ContractTimeline contractId={d.contractId} collapsible />
      </div>

      <RoleGate minRole="Manager">
        {decided ? (
          <div className="text-[12.5px] text-ink-muted mt-5">
            Entrega {tEnum("deliveryStatus", d.status).toLowerCase()} — decisão registrada e
            não se refaz. Correção posterior é nova submissão do criador.
          </div>
        ) : d.status === "ReworkRequested" ? (
          <div className="text-[12.5px] text-ink-muted mt-5">
            Correção pedida — a próxima tentativa do criador aparece aqui, no lugar desta.
          </div>
        ) : (
          <>
            <div className="mt-5">
              <label htmlFor="review-notes" className="block text-[11px] text-ink-muted mb-1.5">
                Observações{" "}
                <span style={{ opacity: 0.8 }}>(obrigatórias para correção ou recusa)</span>
              </label>
              <textarea
                id="review-notes"
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
                  ? (d.creatorPayoutReady
                    ? "Entrega aprovada. O pagamento foi pedido."
                    : "Entrega aprovada. O pagamento sai assim que a conta do criador for verificada.")
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
                ? `Aprovar pede o pagamento${d.escrowAmountCents != null ? ` de ${fmtCents(d.escrowAmountCents)}` : ""}. ${d.creatorPayoutReady ? " Ele sai pela fila em instantes." : " A conta de recebimento do criador ainda não está verificada — o pagamento espera por ela."}`
                : "Aprovar não paga: torna a custódia liberável. A liberação é um passo separado, e continua sendo um clique humano."}
            </p>

            {/* O tipo muda o caminho do criador: editar a postagem e reenviar o link, ou
                subir um corte novo que passa de novo pela aprovação. */}
            <div className="mb-2">
              <div className="text-[11px] text-ink-muted mb-1.5">Se pedir correção, o que precisa mudar?</div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ["Publication", "Ajustar a publicação", "legenda, #publi, link, privacidade"],
                  ["Content", "Refazer o vídeo", "marca, logo, tom — volta ao corte"],
                ] as const).map(([id, label, hint]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setScope(id)}
                    aria-pressed={scope === id}
                    className="px-2.5 py-1.5 rounded-lg text-left border text-[12px] transition-colors"
                    style={scope === id
                      ? { borderColor: "#D97706", background: "var(--warn-bg)", color: "var(--color-warn)" }
                      : { borderColor: "var(--border-soft)", color: "var(--ink-muted)" }}
                  >
                    <div className="font-medium">{label}</div>
                    <div className="text-[10.5px] opacity-80">{hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => decideWith(
                  "RequestRework",
                  scope === "Publication"
                    ? "Pedido de ajuste na publicação enviado."
                    : "Pedido para refazer o vídeo enviado — o corte volta para aprovação.",
                )}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[13px] border border-border-soft disabled:opacity-50"
                style={{ color: "var(--color-warn)" }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Pedir correção
              </button>
              <button
                onClick={() => decideWith("Reject", "Entrega recusada. A custódia foi para disputa.")}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[13px] border border-border-soft disabled:opacity-50"
                style={{ color: "var(--color-neg)" }}
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
  )
}

