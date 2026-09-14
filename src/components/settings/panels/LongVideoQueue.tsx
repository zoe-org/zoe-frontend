import { useMemo, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from "lucide-react"
import { TabPill } from "@/components/ui/tab-pill"
import { EmptyBlock } from "@/components/ui/empty-block"
import { useAuth } from "@/features/auth/context"
import { useConfirm } from "@/features/confirm/context"
import { apiMessage } from "@/lib/api-error"
import { notifyError, notifySuccess } from "@/lib/feedback"
import {
  useDecideLongVideos, useLongVideoDecisions, useUsageMeter,
  type LongVideoAction, type LongVideoDecision, type LongVideoDecisionStatus,
} from "@/lib/api/usage"
import {
  describeDecision, formatDuration, quotaImpact, selectionTotals, summarizeDecision,
  type DecisionMessage,
} from "@/lib/long-videos"

// Fila de decisão de vídeo longo (WS-F10). Sem design próprio: o card segue o
// vocabulário do painel de Consumo, onde a decisão de gasto já mora.

const int = (v: number) => Math.round(v).toLocaleString("pt-BR")
const plural = (n: number, one: string, many: string) => `${int(n)} ${n === 1 ? one : many}`
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })

const TABS: { key: LongVideoDecisionStatus; label: string }[] = [
  { key: "Pending", label: "Pendentes" },
  { key: "Approved", label: "Aprovados" },
  { key: "Dismissed", label: "Descartados" },
]

// Oito linhas: a fila de um tenant com muitas lives passava de 40 itens e empurrava
// o resto do painel de Consumo para fora da tela.
const PAGE_SIZE = 8

const RESULT_TONE = {
  partial: { color: "var(--color-warn)", bg: "#FFFBEB", border: "rgba(217,119,6,.32)" },
  failure: { color: "var(--color-neg)", bg: "#FEF2F2", border: "rgba(220,38,38,.32)" },
} as const

type BatchResult = DecisionMessage & { tone: "partial" | "failure"; spendCapShortMinutes: number }

export function LongVideoQueue() {
  const { role } = useAuth()
  // Aprovar é autorizar gasto: a api só aceita Owner/Admin, e a tela não oferece a quem ela recusaria.
  const canDecide = role === "Owner" || role === "Admin"

  const [tab, setTab] = useState<LongVideoDecisionStatus>("Pending")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<BatchResult | null>(null)
  const [page, setPage] = useState(0)

  const pending = useLongVideoDecisions("Pending")
  const list = useLongVideoDecisions(tab)
  const meter = useUsageMeter()
  const decide = useDecideLongVideos()
  const confirm = useConfirm()

  const items = useMemo(() => list.data?.items ?? [], [list.data])
  const pendingCount = pending.data?.pendingCount ?? 0
  const pendingMinutes = pending.data?.pendingMinutes ?? 0

  // Seleção derivada da lista atual: item decidido por outra pessoa some sem sobrar marcado.
  const effective = useMemo(
    () => new Set(tab === "Pending" ? items.filter((i) => selected.has(i.id)).map((i) => i.id) : []),
    [items, selected, tab],
  )
  const totals = selectionTotals(items, effective)
  const impact = meter.data ? quotaImpact(meter.data, totals.minutes) : null

  // Página corrigida na leitura, não por efeito: decidir o último item de uma página
  // encurta a lista, e um setState em efeito renderizaria a página vazia antes.
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = items.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  const pageSelected = pageItems.length > 0 && pageItems.every((i) => effective.has(i.id))
  const allSelected = items.length > 0 && effective.size === items.length

  const switchTab = (next: LongVideoDecisionStatus) => {
    setTab(next)
    setSelected(new Set())
    setPage(0)
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = async (action: LongVideoAction) => {
    const chosen = items.filter((i) => effective.has(i.id))
    if (chosen.length === 0) return

    const ok = await confirm(action === "Approve"
      ? {
          title: `Aprovar ${plural(chosen.length, "vídeo", "vídeos")}?`,
          description: approveDescription(totals, impact?.overageAddedMinutes ?? 0),
          confirmLabel: "Aprovar",
        }
      : {
          title: `Descartar ${plural(chosen.length, "vídeo", "vídeos")}?`,
          description: "Eles saem da fila e não serão analisados. Não há cobrança.",
          confirmLabel: "Descartar",
          tone: "danger",
        })
    if (!ok) return

    decide.mutate({ decisionIds: chosen.map((i) => i.id), action }, {
      onSuccess: (response) => {
        const summary = summarizeDecision(action, response, chosen)
        const message = describeDecision(summary)
        setSelected(new Set())
        if (message.tone === "success") {
          setResult(null)
          notifySuccess(message.detail ? `${message.title} ${message.detail}` : message.title)
        } else {
          // Parcial ou vazio fica no card: tem ação a tomar, e toast some antes de ser lido.
          setResult({ ...message, tone: message.tone, spendCapShortMinutes: summary.spendCapShortMinutes })
        }
      },
      onError: (e) => notifyError(
        e,
        action === "Approve" ? "Não foi possível aprovar os vídeos." : "Não foi possível descartar os vídeos.",
        { terminal: true },
      ),
    })
  }

  return (
    <section className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow">Vídeos longos</div>
            <h2 className="font-display mt-2 mb-0" style={{ fontSize: 18, color: "var(--ink)" }}>
              {pendingCount > 0
                ? `${plural(pendingCount, "vídeo aguardando", "vídeos aguardando")} sua decisão`
                : "Fila de vídeos longos"}
            </h2>
            <p className="text-[13px] text-ink-muted mt-2 max-w-165 leading-relaxed">
              Vídeo acima do teto por vídeo não entra sozinho: uma live de 3 horas consumiria 180
              minutos de uma vez. Aprovar coleta o vídeo e debita a duração dele; descartar tira da
              fila sem custo.
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="text-right">
              <div className="font-display" style={{ fontSize: 24, lineHeight: 1, color: "var(--ink)" }}>
                {int(pendingMinutes)}
              </div>
              <div className="text-[11.5px] text-ink-muted mt-1">minutos pendentes</div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mt-4">
          {TABS.map((t) => (
            <TabPill
              key={t.key}
              active={tab === t.key}
              onClick={() => switchTab(t.key)}
              label={t.label}
              badge={t.key === "Pending" ? pendingCount : undefined}
            />
          ))}
        </div>
      </div>

      {result && (
        <ResultBanner
          result={result}
          onClose={() => setResult(null)}
        />
      )}

      <QueueBody
        tab={tab}
        items={pageItems}
        loading={list.isLoading}
        error={list.error}
        selectable={tab === "Pending" && canDecide}
        selected={effective}
        allSelected={pageSelected}
        onToggle={toggle}
        onToggleAll={() => setSelected((prev) => {
          const next = new Set(prev)
          // O cabeçalho é da PÁGINA; a fila inteira tem o atalho no rodapé.
          for (const i of pageItems) {
            if (pageSelected) next.delete(i.id)
            else next.add(i.id)
          }
          return next
        })}
      />

      {items.length > PAGE_SIZE && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={items.length}
          shown={pageItems.length}
          from={currentPage * PAGE_SIZE + 1}
          onChange={setPage}
          selectAll={tab === "Pending" && canDecide && pageSelected && !allSelected
            ? () => setSelected(new Set(items.map((i) => i.id)))
            : undefined}
        />
      )}

      {tab === "Pending" && canDecide && totals.count > 0 && (
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap px-6 py-3.5 border-t border-border-soft bg-[#FAFBFC] dark:bg-[#151824]">
          <div className="text-[13px]" style={{ color: "var(--ink)" }}>
            <strong>{plural(totals.count, "selecionado", "selecionados")}</strong> ·{" "}
            <span className="font-mono-zoe">{int(totals.minutes)} min</span>
          </div>
          {impact && (
            <div className="text-[12.5px] text-ink-muted">
              {impact.overageAddedMinutes > 0
                ? <>{impact.entersOverage ? "Passa da cota" : "Soma ao excedente"}: +{int(impact.overageAddedMinutes)} min além da cota.</>
                : <>Cabe na cota: o consumo iria a {int(impact.billedAfter)} de {int(impact.quotaMinutes)} min.</>}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => run("Dismiss")}
              disabled={decide.isPending}
              className="h-9 px-4 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              onClick={() => run("Approve")}
              disabled={decide.isPending}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--color-teal-500)" }}
            >
              {decide.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Aprovar {totals.count}
            </button>
          </div>
        </div>
      )}

      {tab === "Pending" && !canDecide && items.length > 0 && (
        <div className="px-6 py-3.5 border-t border-border-soft text-[12.5px] text-ink-muted">
          Só Owner ou Admin do workspace aprovam ou descartam: aprovar é autorizar gasto.
        </div>
      )}
    </section>
  )
}

function Pagination({ page, pageCount, total, shown, from, onChange, selectAll }: {
  page: number
  pageCount: number
  total: number
  shown: number
  from: number
  onChange: (page: number) => void
  /** Só aparece com a página inteira marcada e algo fora dela — o atalho do lote. */
  selectAll?: () => void
}) {
  const botao = "h-7 w-7 inline-flex items-center justify-center rounded-md border border-border-soft " +
    "hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"

  return (
    <div className="flex items-center gap-x-4 gap-y-2 flex-wrap px-6 py-2.5 border-t border-border-soft">
      <div className="text-[12.5px] text-ink-muted">
        <span className="font-mono-zoe">{from}–{from + shown - 1}</span> de{" "}
        <span className="font-mono-zoe">{total}</span>
      </div>
      {selectAll && (
        <button onClick={selectAll} className="text-[12.5px] font-semibold text-teal-700 dark:text-teal-300 hover:underline">
          Selecionar todos os {total} da fila
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          aria-label="Página anterior"
          className={botao}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[12px] text-ink-muted-2">{page + 1}/{pageCount}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Próxima página"
          className={botao}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function approveDescription(
  totals: { count: number; minutes: number; notCollected: number },
  overageAddedMinutes: number,
): string {
  const parts = [`Debita cerca de ${int(totals.minutes)} minutos da cota.`]
  if (overageAddedMinutes > 0) parts.push(`${int(overageAddedMinutes)} deles ficam além da cota, dentro do teto de gasto.`)
  if (totals.notCollected > 0) {
    parts.push(totals.notCollected === 1
      ? "1 ainda não foi coletado: entra na próxima coleta e é cobrado quando a análise chegar."
      : `${totals.notCollected} ainda não foram coletados: entram na próxima coleta e são cobrados quando a análise chegar.`)
  }
  parts.push("O que não couber no teto de gasto fica de fora, sem cobrança.")
  return parts.join(" ")
}

function ResultBanner({ result, onClose }: { result: BatchResult; onClose: () => void }) {
  const t = RESULT_TONE[result.tone]
  const raiseCap = () => {
    const input = document.getElementById("spend-cap")
    input?.scrollIntoView({ behavior: "smooth", block: "center" })
    input?.focus({ preventScroll: true })
  }

  return (
    <div className="mx-6 mb-4 flex items-start gap-3 rounded-[14px] border px-4 py-3.5" style={{ background: t.bg, borderColor: t.border }}>
      <AlertCircle className="w-[17px] h-[17px] shrink-0 mt-0.5" style={{ color: t.color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold" style={{ color: t.color }}>{result.title}</div>
        {result.detail && (
          <div className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>{result.detail}</div>
        )}
        {result.spendCapShortMinutes > 0 && (
          <button
            onClick={raiseCap}
            className="mt-2.5 text-[12.5px] font-semibold underline"
            style={{ color: t.color }}
          >
            Elevar o teto de gasto ({int(result.spendCapShortMinutes)} min ficaram de fora)
          </button>
        )}
      </div>
      <button onClick={onClose} aria-label="Fechar" className="p-1 rounded-md text-ink-muted hover:text-ink transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

const EMPTY: Record<LongVideoDecisionStatus, { message: string; hint?: string }> = {
  Pending: {
    message: "Nenhum vídeo longo aguardando decisão.",
    hint: "Quando a coleta encontrar um vídeo acima do teto por vídeo, ele aparece aqui antes de consumir qualquer minuto.",
  },
  Approved: { message: "Nenhum vídeo longo aprovado ainda." },
  Dismissed: { message: "Nenhum vídeo longo descartado." },
}

function QueueBody({
  tab, items, loading, error, selectable, selected, allSelected, onToggle, onToggleAll,
}: {
  tab: LongVideoDecisionStatus
  items: LongVideoDecision[]
  loading: boolean
  error: unknown
  selectable: boolean
  selected: ReadonlySet<string>
  allSelected: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
}) {
  if (loading) {
    return (
      <div className="px-6 pb-6 space-y-2 animate-pulse">
        {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 pb-6">
        <EmptyBlock message={apiMessage(error, "Não foi possível carregar a fila de vídeos longos.")} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-6 pb-6">
        <EmptyBlock message={EMPTY[tab].message} hint={EMPTY[tab].hint} />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-y border-border-soft">
            {selectable && (
              <th className="pl-6 pr-1 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Selecionar todos"
                  className="accent-teal-500"
                />
              </th>
            )}
            <th className={`text-left font-medium text-ink-muted py-2.5 ${selectable ? "px-3" : "px-6"}`}>Vídeo</th>
            <th className="text-left font-medium text-ink-muted px-3 py-2.5">Marca</th>
            <th className="text-right font-medium text-ink-muted px-3 py-2.5">Duração</th>
            <th className="text-right font-medium text-ink-muted px-3 py-2.5">Minutos</th>
            <th className="text-right font-medium text-ink-muted px-6 py-2.5">
              {tab === "Pending" ? "Chegou" : tab === "Approved" ? "Situação" : "Descartado"}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr
              key={v.id}
              className="border-b border-border-soft last:border-b-0"
              style={selected.has(v.id) ? { background: "var(--teal-bg)" } : undefined}
            >
              {selectable && (
                <td className="pl-6 pr-1 py-3 align-top">
                  <input
                    type="checkbox"
                    checked={selected.has(v.id)}
                    onChange={() => onToggle(v.id)}
                    aria-label={`Selecionar ${v.title}`}
                    className="accent-teal-500 mt-0.5"
                  />
                </td>
              )}
              <td className={`py-3 align-top ${selectable ? "px-3" : "px-6"}`}>
                <a
                  href={`https://www.youtube.com/watch?v=${v.youtubeVideoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-1.5 font-semibold hover:underline max-w-90"
                  style={{ color: "var(--ink)" }}
                >
                  <span className="line-clamp-2">{v.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 mt-1 text-ink-muted-2" />
                </a>
                <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-ink-muted">
                  <span className="truncate">{v.channelName}</span>
                  {tab === "Pending" && !v.collected && (
                    <span
                      className="chip text-[10px] shrink-0"
                      title="Aprovar reserva o teto de gasto; o vídeo é coletado no próximo ciclo e cobrado quando a análise chegar."
                    >
                      não coletado
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 align-top">{v.brandName}</td>
              <td className="text-right px-3 py-3 align-top">
                <div className="font-mono-zoe">{formatDuration(v.durationSeconds)}</div>
                {/* O teto que ele passou é o "por quê" de estar aqui. */}
                <div className="text-[11px] text-ink-muted-2 mt-0.5">teto {int(v.maxVideoMinutes)} min</div>
              </td>
              <td className="text-right px-3 py-3 align-top font-mono-zoe">{int(v.estimatedMinutes)}</td>
              <td className="text-right px-6 py-3 align-top text-[12.5px] text-ink-muted whitespace-nowrap">
                {tab === "Pending" && shortDate(v.createdAt)}
                {tab === "Approved" && (v.collected
                  ? <span className="chip chip-pos text-[10.5px]">cobrado</span>
                  : <span className="chip chip-warn text-[10.5px]" title="Cobrado quando a análise chegar.">aguardando coleta</span>)}
                {tab === "Dismissed" && (v.decidedAt ? shortDate(v.decidedAt) : "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
