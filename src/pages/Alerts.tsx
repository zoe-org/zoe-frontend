import { useEffect, useMemo, useState } from "react"
import {
  Activity, AlertCircle, BarChart3, Bell, BellOff, Check, ChevronRight, Download, ExternalLink, Hash,
  Lock, Mail, Pencil, Plus, Trash2, X,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { useConfirm } from "@/features/confirm/context"
import { EmptyBlock } from "@/components/ui/empty-block"
import { AlertEventDrawer } from "@/components/features/AlertEventDrawer"
import { Segmented } from "@/components/ui/segmented"
import { StatBand } from "@/components/ui/stat-band"
import { SelectField } from "@/components/ui/select-field"
import { EmptyState } from "@/components/ui/empty-state"
import { RoleGate } from "@/features/auth/RoleGate"
import { useActiveBrand } from "@/features/brands/context"
import { ApiError } from "@/lib/api"
import { toCsv, downloadCsv } from "@/lib/csv"
import { formatScore, scoreColor } from "@/lib/score"
import { stagger } from "@/lib/motion"
import {
  useAlertEvents, useAlertRules, useCreateAlertRule, useDeleteAlertRule,
  useMarkAlertRead, useMarkAllAlertsRead, useUpdateAlertRule,
  type AlertEvent, type AlertRule, type AlertRuleType, type AlertSeverity,
} from "@/lib/api/alerts"
import {
  KEYWORD_MAX_LENGTH, MENTION_VOLUME_WINDOW_LABEL, NAME_MAX_LENGTH,
  RULE_TYPE_LABEL, SEVERITY_CHIP_CLASS, SEVERITY_COLOR, SEVERITY_LABEL,
  alertEventOrigin, alertEventVideoTitle, describeAlertEvent, describeChannelShort, describeRuleCondition,
  emptyRuleForm, ruleToForm, toCreatePayload, toUpdatePayload, validateAlertRuleForm,
  type AlertRuleForm,
} from "@/lib/alerts"

/**
 * Alertas (Etapa 5, WS-F1/WS-F2). Última tela mock do Intelligence a virar real.
 *
 * Layout segue o design (`src/alertas.jsx` no Claude Design): hero full-bleed,
 * tabs em pill com **Histórico como padrão** (abre-se Alertas pra ver o que
 * disparou, não pra configurar) e linhas em grid denso.
 *
 * **O que do design NÃO foi construído, e por quê**: os KPIs "tempo médio de
 * resposta" e "taxa de falso positivo", o `Nx · 7d` por regra, o status de três
 * estados (aberto/em análise/resolvido) e a coluna `origem` multi-plataforma não
 * têm dado por trás — a API expõe `isRead` booleano, é YouTube-only e não agrega
 * disparos por regra. Renderizá-los exigiria inventar número.
 *
 * Duas coisas que o mock ensinava errado e que a tela agora respeita:
 * 1. A escala de sentimento é **[0,1]** (0 = pior, 1 = melhor), não [-1,1].
 * 2. A janela do volume de menções é **fixa em 24h** — não existe seletor porque
 *    o backend ignoraria qualquer outro valor.
 */

const RULE_TYPES: AlertRuleType[] = ["SentimentBelow", "MentionVolumeAbove", "KeywordMatch"]
const SEVERITIES: AlertSeverity[] = ["Info", "Warning", "Critical"]

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

/**
 * Estado de leitura do disparo. **Dois** estados, não os três do design
 * (aberto/em análise/resolvido): o backend expõe `isRead` booleano e não há
 * carimbo de reconhecimento — um terceiro estado seria decoração sem dado.
 */
/**
 * Rótulo do grupo do dia. Um feed de vigilância se lê por proximidade — "há 3 h"
 * responde "isso é urgente?" bem melhor que "20/09/2026 14:12".
 */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Sem data"
  const hoje = new Date()
  const dia = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  if (dia(d) === dia(hoje)) return "Hoje"
  if (dia(d) === dia(ontem)) return "Ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
}

/** Relativo no dia corrente, relógio nos anteriores: é o que o olho procura. */
function shortTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const hoje = new Date()
  const mesmoDia = d.toDateString() === hoje.toDateString()
  if (mesmoDia) return formatDistanceToNow(d, { locale: ptBR, addSuffix: true })
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

type DayGroup = { key: string; label: string; items: { event: AlertEvent; seq: number }[] }

/**
 * Agrupa por dia carregando o `seq` corrido junto: a cascata de entrada precisa
 * da posição no feed inteiro, não da posição dentro do grupo — senão o primeiro
 * item de "Ontem" entra junto com o primeiro de "Hoje".
 */
function groupByDay(events: AlertEvent[]): DayGroup[] {
  const out: DayGroup[] = []
  events.forEach((event, seq) => {
    const label = dayLabel(event.triggeredAt)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push({ event, seq })
    else out.push({ key: `${label}-${event.id}`, label, items: [{ event, seq }] })
  })
  return out
}

/** Quadrado tingido com a cor da gravidade — a âncora visual de cada disparo. */
function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  const c = SEVERITY_COLOR[severity]
  return (
    <span
      className="w-[30px] h-[30px] rounded-[10px] shrink-0 flex items-center justify-center"
      style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
      aria-hidden
    >
      <AlertCircle className="w-[15px] h-[15px]" />
    </span>
  )
}

/**
 * Esqueleto no formato do cartão, não um retângulo genérico: o que carrega aqui
 * é uma lista densa, e um bloco cinza único não antecipa nada da forma dela.
 */
function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3.5 rounded-[14px] border border-border-soft">
          <span className="w-[30px] h-[30px] rounded-[10px] z-skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/5 rounded z-skeleton" />
            <div className="h-3 w-4/5 rounded z-skeleton" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AlertsPage() {
  const brand = useActiveBrand()

  const rules = useAlertRules()
  const ruleItems = useMemo(() => rules.data?.items ?? [], [rules.data])
  const enabledCount = ruleItems.filter((r) => r.isEnabled).length

  /**
   * O recorte de marca é o do switcher do header — não existe seletor próprio
   * nesta tela. Dois controles para a mesma decisão, a 40px um do outro, é
   * pedir para os dois discordarem. `allBrands` é o único caso em que a tela
   * agrega: a API de disparos aceita `brandId` nulo.
   */
  const scopeBrandId = brand.allBrands ? null : brand.brandId

  const [unreadOnly, setUnreadOnly] = useState(false)
  const events = useAlertEvents({ brandId: scopeBrandId, unreadOnly })
  const eventItems = useMemo(() => events.data?.pages.flatMap((p) => p.items) ?? [], [events.data])
  const unreadCount = events.data?.pages[0]?.unreadCount ?? 0

  // O filtro de marca vale para as duas abas: um disparo é de uma marca, e uma
  // regra também. Antes ele sumia na aba Regras e a barra ficava só com as tabs.
  const visibleRules = useMemo(
    () => (scopeBrandId ? ruleItems.filter((r) => r.brandId === scopeBrandId) : ruleItems),
    [ruleItems, scopeBrandId],
  )

  /**
   * Marcas com ao menos uma regra LIGADA. "Monitoradas" contava marca assinada,
   * o que dava 5 com tudo pausado — o número dizia o oposto do que parecia.
   */
  const coveredNames = useMemo(() => {
    const ids = new Set(ruleItems.filter((r) => r.isEnabled).map((r) => r.brandId))
    return brand.brands.filter((b) => ids.has(b.brandId)).map((b) => b.displayName ?? b.brandName)
  }, [ruleItems, brand.brands])

  const [editing, setEditing] = useState<AlertRule | "new" | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<AlertEvent | null>(null)
  // Mutação própria do drawer: a da lista vive dentro de HistoryList.
  const markReadFromDrawer = useMarkAlertRead()

  /**
   * Exporta o que já foi carregado (paginação por cursor), não força refetch de
   * todas as páginas. Motivo e título vêm do YouTube — input hostil — então tudo
   * passa pelo `toCsv`, que desarma formula injection (RN-I-070).
   */
  const exportCsv = () => {
    if (eventItems.length === 0) return
    const csv = toCsv(eventItems, [
      { header: "Disparado em", value: (e) => formatDateTime(e.triggeredAt) },
      { header: "Marca", value: (e) => e.brandName },
      { header: "Regra", value: (e) => e.ruleName },
      { header: "Gravidade", value: (e) => SEVERITY_LABEL[e.severity] },
      { header: "Motivo", value: (e) => describeAlertEvent(e) },
      { header: "Vídeo", value: (e) => alertEventVideoTitle(e) ?? "" },
      // Coluna explícita, mesmo motivo do CSV de Monitoramento: exportação que
      // mistura owned e earned sem declarar qual induz a leitura errada na planilha.
      {
        header: "Origem",
        value: (e) => {
          const origin = alertEventOrigin(e)
          if (origin === "owned") return "Canal próprio"
          if (origin === "earned") return "Terceiro"
          return "" // disparo anterior a 09/08: campo ausente vira célula vazia, não um palpite
        },
      },
      { header: "Link", value: (e) => `https://www.youtube.com/watch?v=${e.youtubeVideoId}` },
      { header: "Lido", value: (e) => (e.isRead ? "Sim" : "Não") },
      { header: "E-mail enviado", value: (e) => (e.emailNotified ? "Sim" : "Não") },
    ])
    downloadCsv(`alertas-${new Date().toISOString().slice(0, 10)}`, csv)
  }

  if (brand.isLoading) {
    return <div className="px-8 py-20 text-center text-ink-muted text-[13px]">Carregando…</div>
  }

  // Regra exige marca: sem nenhuma assinada não há o que configurar nem o que disparar.
  if (brand.brands.length === 0) {
    return (
      <EmptyState
        title="Nenhuma marca assinada ainda"
        description="Alertas avisam quando algo acontece com uma marca monitorada. Assine uma para começar a configurar regras."
        actionLabel="Assinar uma marca"
        onAction={() => { window.location.href = "/brands" }}
      />
    )
  }

  return (
    <div className="-m-6" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      {/* Abertura */}
      <section className="px-8 pt-7 pb-6 border-b border-border-soft">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex-1 max-w-190 min-w-70">
            <div className="eyebrow mb-3">Intelligence · Vigilância</div>
            <h1 className="font-display m-0 text-ink" style={{ fontSize: 34, lineHeight: 1.1 }}>
              Alertas
            </h1>
            <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-150">
              O que suas regras viram enquanto você não estava olhando.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportCsv}
              disabled={eventItems.length === 0}
              title="Exporta os disparos já carregados no histórico."
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
            <MarkAllButton unreadCount={unreadCount} />
            <RoleGate minRole="Manager">
              <button
                onClick={() => setEditing("new")}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nova regra
              </button>
            </RoleGate>
          </div>
        </div>
      </section>

      {/* Faixa full-bleed separada por linhas, como nas outras telas — não
          cartões. Só os números que a API sustenta: o design pedia "tempo médio
          de resposta" e "taxa de falso positivo", que não têm carimbo de
          reconhecimento nem loop de feedback por trás. */}
      <StatBand
        items={[
          {
            // Leitura é por usuário (ADR-036) e o contador é do workspace, não
            // do recorte: um colega ler não abaixa este número, e filtrar marca
            // não o muda.
            label: "Não lidos por você",
            value: unreadCount,
            hint: unreadCount === 0 ? "tudo em dia" : "só a sua leitura conta",
          },
          {
            label: "Regras ativas",
            value: enabledCount,
            hint: `de ${ruleItems.length} ${ruleItems.length === 1 ? "configurada" : "configuradas"}`,
            tone: "accent",
          },
          {
            label: "Marcas cobertas",
            value: coveredNames.length,
            hint: coveredNames.length === 0 ? "nenhuma regra ligada" : coveredNames.join(", "),
            tone: coveredNames.length === 0 ? "warn" : undefined,
          },
        ]}
      />

      {/* Duas colunas, como no design: o que disparou à esquerda, as regras que
          disparam à direita. Em abas, ver um disparo e conferir a regra que o
          gerou custava duas trocas de contexto — e a pergunta é sempre a mesma. */}
      <section className="px-8 py-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-x-7 gap-y-9 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-4">
            {/* Sem contagem na aba: `unreadCount` é do workspace inteiro
                (ADR-036) e a lista está no recorte do switcher — o número
                brigaria com o que está logo abaixo dele. */}
            <Segmented
              items={[
                { key: "unread", label: "Não lidos" },
                { key: "all", label: "Todos" },
              ]}
              value={unreadOnly ? "unread" : "all"}
              onChange={(k) => setUnreadOnly(k === "unread")}
              ariaLabel="Recorte dos disparos"
            />
            <span className="ml-auto text-[12px] text-ink-muted">
              {brand.allBrands
                ? "Todas as marcas"
                : (brand.active?.displayName ?? brand.active?.brandName ?? "")}
            </span>
          </div>

          <EventFeed
            hasRules={ruleItems.length > 0}
            events={eventItems}
            isLoading={events.isLoading}
            error={events.isError ? events.error : null}
            unreadOnly={unreadOnly}
            hasNextPage={Boolean(events.hasNextPage)}
            isFetchingNextPage={events.isFetchingNextPage}
            onLoadMore={() => events.fetchNextPage()}
            onOpen={setSelectedEvent}
          />
        </div>

        <aside className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="eyebrow">Regras</div>
            <RoleGate minRole="Manager">
              <button
                onClick={() => setEditing("new")}
                className="text-[12px] font-medium text-teal-600 dark:text-teal-300 hover:underline cursor-pointer"
              >
                + Nova
              </button>
            </RoleGate>
          </div>

          <RulesPanel
            rules={visibleRules}
            isLoading={rules.isLoading}
            error={rules.isError ? rules.error : null}
            filtered={scopeBrandId !== null}
            onEdit={setEditing}
          />
        </aside>
      </section>

      <AlertEventDrawer
        event={selectedEvent}
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        onMarkRead={(id) => markReadFromDrawer.mutate(id, {
          onSuccess: () => setSelectedEvent((e) => (e ? { ...e, isRead: true } : e)),
          onError: (e) => notifyError(e, "Não foi possível marcar como lido."),
        })}
        isMarking={markReadFromDrawer.isPending}
      />

      {editing && (
        <RuleModal
          rule={editing === "new" ? null : editing}
          defaultBrandId={brand.brandId ?? brand.brands[0]?.brandId ?? ""}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}


function MarkAllButton({ unreadCount }: { unreadCount: number }) {
  const markAll = useMarkAllAlertsRead()
  return (
    <button
      onClick={() => markAll.mutate(undefined, {
        onSuccess: (r) =>
          notifySuccess(r.markedCount > 0 ? `${r.markedCount} alerta(s) marcado(s) como lido.` : "Nada a marcar."),
        onError: (e) => notifyError(e, "Não foi possível marcar."),
      })}
      disabled={unreadCount === 0 || markAll.isPending}
      title="Marca como lido só para você. O badge dos colegas não muda."
      className="h-9 px-3.5 rounded-lg border border-border-soft text-[12.5px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
    >
      <Check className="inline-block mr-1 w-3.5 h-3.5" />Marcar todos como lidos
    </button>
  )
}

// ── WS-F2 · Histórico ──────────────────────────────────────────────────────

function EventFeed({
  hasRules, events, isLoading, error, unreadOnly, hasNextPage, isFetchingNextPage, onLoadMore, onOpen,
}: {
  hasRules: boolean
  events: AlertEvent[]
  isLoading: boolean
  error: unknown
  unreadOnly: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  onOpen: (event: AlertEvent) => void
}) {
  const markRead = useMarkAlertRead()
  const groups = useMemo(() => groupByDay(events), [events])

  if (error) {
    return (
      <EmptyBlock
        className="py-16"
        message="Não foi possível carregar o histórico."
        hint={error instanceof ApiError ? error.message : undefined}
      />
    )
  }
  if (isLoading) return <RowsSkeleton />
  if (events.length === 0) {
    // Sem NENHUMA regra, "quando uma regra bater…" descreve um futuro que não vai
    // chegar: não há regra pra bater. O empty state precisa dizer o que falta
    // fazer, não o que aconteceria se algo existisse.
    if (!hasRules && !unreadOnly) {
      return (
        <EmptyBlock
          className="py-16"
          icon={<BellOff className="w-7 h-7" strokeWidth={1.5} />}
          message="Nenhuma regra configurada ainda"
          hint="Os disparos aparecem aqui depois que existir ao menos uma regra. Comece pelo painel ao lado."
        />
      )
    }
    return (
      <EmptyBlock
        className="py-16"
        icon={<Bell className="w-7 h-7" strokeWidth={1.5} />}
        message={unreadOnly ? "Nenhum alerta não lido" : "Nenhum alerta disparado ainda"}
        hint={
          unreadOnly
            ? "Tudo em dia por aqui."
            : "Quando uma regra ligada bater numa análise recém-processada, o disparo aparece aqui."
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="eyebrow mb-2.5">{g.label}</div>
          <div className="flex flex-col gap-2">
            {g.items.map(({ event, seq }) => {
              const videoTitle = alertEventVideoTitle(event)
              const origin = alertEventOrigin(event)
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3.5 rounded-[14px] border border-border-soft bg-inset hover:bg-hover transition-colors z-rise"
                  style={stagger(Math.min(seq, 12))}
                >
                  <SeverityIcon severity={event.severity} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Texto vindo do YouTube é renderizado como string, nunca
                          dangerouslySetInnerHTML (RN-I-069). */}
                      <span
                        className="text-[13.5px]"
                        style={{ fontWeight: event.isRead ? 500 : 600, color: event.isRead ? "var(--ink-muted)" : "var(--ink)" }}
                      >
                        {event.ruleName}
                      </span>
                      <span className={`${SEVERITY_CHIP_CLASS[event.severity]} text-[10px]`}>
                        {SEVERITY_LABEL[event.severity]}
                      </span>
                      <span className="chip text-[10px]">{event.brandName}</span>
                      {/* Origem (ADR-035 / D6): disparo no canal da própria marca é
                          indistinguível de crise de terceiro sem rótulo, e a ação do
                          usuário é OPOSTA nos dois casos. `null` (disparo anterior a
                          09/08, sem o campo no snapshot) não renderiza nada. */}
                      {origin === "owned" && (
                        <span className="chip text-[10px]" title="Vídeo publicado no canal oficial da própria marca">
                          canal próprio
                        </span>
                      )}
                    </div>

                    <div className="text-[12.5px] text-ink-muted mt-1.5">{describeAlertEvent(event)}</div>

                    <div className="flex items-center gap-3 flex-wrap mt-2">
                      {videoTitle && (
                        <a
                          href={`https://www.youtube.com/watch?v=${event.youtubeVideoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted-2 hover:text-ink transition-colors min-w-0"
                          title={videoTitle}
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-80">{videoTitle}</span>
                        </a>
                      )}
                      {event.emailNotified && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted-2">
                          <Mail className="w-3 h-3" /> e-mail enviado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-mono-zoe text-[10.5px] text-ink-muted-2 whitespace-nowrap">
                      {shortTime(event.triggeredAt)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {!event.isRead && (
                        <button
                          onClick={() => markRead.mutate(event.id, {
                            onError: (e) => notifyError(e, "Não foi possível marcar como lido."),
                          })}
                          disabled={markRead.isPending}
                          className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-tint cursor-pointer disabled:opacity-50"
                          aria-label="Marcar como lido"
                          title="Marcar como lido"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onOpen(event)}
                        className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-tint cursor-pointer"
                        aria-label={`Abrir detalhe de ${event.ruleName}`}
                        title="Ver detalhe"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {!event.isRead && (
                      <span
                        className="w-[7px] h-[7px] rounded-full"
                        style={{ background: "var(--color-ember)" }}
                        aria-label="Não lido"
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {hasNextPage && (
        <div className="flex justify-center pt-1">
          <button
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="px-4 h-9 rounded-lg border border-border-soft text-[13px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  )
}

// ── WS-F1 · Regras ─────────────────────────────────────────────────────────

function RulesPanel({
  rules, isLoading, error, filtered, onEdit,
}: {
  rules: AlertRule[]
  isLoading: boolean
  error: unknown
  /** Recorte por marca ativo: muda o vazio de "não existe" para "não tem nesta marca". */
  filtered: boolean
  onEdit: (r: AlertRule) => void
}) {
  const update = useUpdateAlertRule()
  const remove = useDeleteAlertRule()
  const confirm = useConfirm()

  const toggleEnabled = (rule: AlertRule) => {
    update.mutate(
      { ruleId: rule.id, input: { ...toUpdatePayload(ruleToForm(rule)), isEnabled: !rule.isEnabled } },
      {
        onSuccess: () => notifySuccess(rule.isEnabled ? "Regra pausada." : "Regra reativada."),
        onError: (e) => notifyError(e, "Não foi possível alterar a regra."),
      },
    )
  }

  const confirmRemove = async (rule: AlertRule) => {
    // O backend apaga o histórico de disparos junto — vale avisar antes.
    const ok = await confirm({
      title: `Excluir “${rule.name}”?`,
      description: "O histórico de disparos dela também será removido.",
      confirmLabel: "Excluir",
      tone: "danger",
    })
    if (!ok) return
    remove.mutate(rule.id, {
      onSuccess: () => notifySuccess("Regra excluída."),
      onError: (e) => notifyError(e, "Não foi possível excluir."),
    })
  }

  if (error) {
    return (
      <EmptyBlock
        className="py-10"
        message="Não foi possível carregar as regras."
        hint={error instanceof ApiError ? error.message : undefined}
      />
    )
  }
  if (isLoading) return <RowsSkeleton rows={3} />
  if (rules.length === 0) {
    return (
      <EmptyBlock
        className="py-10"
        icon={<BellOff className="w-7 h-7" strokeWidth={1.5} />}
        message={filtered ? "Nenhuma regra para esta marca" : "Nenhuma regra configurada"}
        hint={
          filtered
            ? "Outras marcas podem ter regras. Troque o recorte ou crie uma para esta."
            : "Crie uma regra para ser avisada quando o sentimento cair, o volume de menções subir ou uma palavra-chave aparecer."
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {rules.map((rule, i) => (
        <div
          key={rule.id}
          className={`p-3.5 rounded-[14px] border border-border-soft bg-inset z-rise ${rule.isEnabled ? "" : "opacity-65"}`}
          style={stagger(Math.min(i, 12))}
        >
          <div className="flex items-start gap-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                {rule.name}
              </div>
              <div className="text-[12px] text-ink-muted mt-1">{describeRuleCondition(rule)}</div>
            </div>

            <RoleGate
              minRole="Manager"
              fallback={
                <span
                  className="relative w-[34px] h-5 rounded-full block shrink-0"
                  style={{ background: rule.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
                  aria-label={rule.isEnabled ? "Regra ativa" : "Regra pausada"}
                />
              }
            >
              <button
                onClick={() => toggleEnabled(rule)}
                disabled={update.isPending}
                aria-label={rule.isEnabled ? "Pausar regra" : "Ativar regra"}
                aria-pressed={rule.isEnabled}
                className="relative w-[34px] h-5 rounded-full transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                style={{ background: rule.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: rule.isEnabled ? 16 : 2 }}
                />
              </button>
            </RoleGate>
          </div>

          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className={`${SEVERITY_CHIP_CLASS[rule.severity]} text-[10px]`}>
              {SEVERITY_LABEL[rule.severity]}
            </span>
            {/* Qual marca a regra vigia: duas regras de mesmo nome em marcas
                diferentes ficariam indistinguíveis na coluna. */}
            <span className="chip text-[10px] truncate max-w-40">{rule.brandName}</span>
            {rule.channels.map((c) => (
              <span key={c} className="chip text-[10px]">{describeChannelShort(c)}</span>
            ))}

            <RoleGate minRole="Manager" fallback={null}>
              <div className="flex items-center gap-0.5 ml-auto">
                <button
                  onClick={() => onEdit(rule)}
                  className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-tint cursor-pointer"
                  aria-label={`Editar ${rule.name}`}
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => confirmRemove(rule)}
                  disabled={remove.isPending}
                  className="p-1 rounded-md text-ink-muted hover:text-neg hover:bg-tint cursor-pointer disabled:opacity-50"
                  aria-label={`Excluir ${rule.name}`}
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </RoleGate>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Ícone de cada gatilho nos cartões — a âncora visual do "o que vigiar". */
const RULE_TYPE_ICON: Record<AlertRuleType, typeof Activity> = {
  SentimentBelow: Activity,
  MentionVolumeAbove: BarChart3,
  KeywordMatch: Hash,
}

/** Subtítulo de cada gatilho no seletor — o "desc" dos cartões do design. */
const RULE_TYPE_HINT: Record<AlertRuleType, string> = {
  SentimentBelow: "Uma menção nova fica abaixo do score que você definir.",
  MentionVolumeAbove: `A marca passa de um número de menções em ${MENTION_VOLUME_WINDOW_LABEL}.`,
  KeywordMatch: "A menção cita uma palavra que você quer vigiar.",
}

/** Ponto de partida de cada gatilho, nas unidades dele. */
const DEFAULT_THRESHOLD: Record<AlertRuleType, string> = {
  SentimentBelow: "0,40",
  MentionVolumeAbove: "20",
  KeywordMatch: "",
}

/** Nome sugerido a partir do gatilho e da marca — "Queda de sentimento · Itaú". */
function suggestName(type: AlertRuleType, brandName: string): string {
  const base =
    type === "SentimentBelow" ? "Queda de sentimento"
      : type === "MentionVolumeAbove" ? "Pico de menções"
        : "Palavra-chave"
  return brandName ? `${base} · ${brandName}` : base
}

function RuleModal({
  rule, defaultBrandId, onClose,
}: { rule: AlertRule | null; defaultBrandId: string; onClose: () => void }) {
  const { brands } = useActiveBrand()
  const create = useCreateAlertRule()
  const update = useUpdateAlertRule()

  /**
   * Ponto de partida do formulário. `emptyRuleForm` nasce com nome e limiar
   * vazios — ela é a factory do domínio e outras chamadas dependem disso. Aqui
   * a tela preenche os dois: sem limiar o slider abriria em 0,00 (que reprova na
   * validação), e sem nome a dica "sugerido a partir do que você escolheu"
   * seria mentira na primeira olhada.
   */
  const [form, setForm] = useState<AlertRuleForm>(() => {
    if (rule) return ruleToForm(rule)
    const base = emptyRuleForm(defaultBrandId)
    const b = brands.find((x) => x.brandId === defaultBrandId)
    return {
      ...base,
      threshold: DEFAULT_THRESHOLD[base.type],
      name: suggestName(base.type, b?.displayName ?? b?.brandName ?? ""),
    }
  })
  const [submitted, setSubmitted] = useState(false)
  // Enquanto ninguém digitou, o nome acompanha o gatilho e a marca. Depois do
  // primeiro toque ele é da pessoa e a sugestão para de mexer nele.
  const [nameTouched, setNameTouched] = useState(rule !== null)

  const errors = validateAlertRuleForm(form)
  const showError = (field: keyof typeof errors) => (submitted ? errors[field] : undefined)
  const pending = create.isPending || update.isPending

  const brandName = rule
    ? rule.brandName
    : (brands.find((b) => b.brandId === form.brandId)?.displayName
      ?? brands.find((b) => b.brandId === form.brandId)?.brandName
      ?? "")

  const set = <K extends keyof AlertRuleForm>(key: K, value: AlertRuleForm[K]) =>
    setForm((f) => {
      const next = { ...f, [key]: value }
      // Trocar de gatilho troca a UNIDADE do limiar: 0,40 de score não é 0,40
      // menções. Carregar o valor antigo para o tipo novo é pior que recomeçar.
      if (key === "type" && value !== f.type) {
        next.threshold = DEFAULT_THRESHOLD[value as AlertRuleType]
      }
      if (!nameTouched && (key === "type" || key === "brandId")) {
        const nome = brands.find((b) => b.brandId === next.brandId)
        next.name = suggestName(next.type, nome?.displayName ?? nome?.brandName ?? "")
      }
      return next
    })

  // Escape fecha: um diálogo que só sai no clique fora prende quem usa teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const submit = () => {
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return

    const onError = (e: unknown) =>
      notifyError(e, "Não foi possível salvar a regra.")

    if (rule) {
      update.mutate({ ruleId: rule.id, input: toUpdatePayload(form) }, {
        onSuccess: () => { notifySuccess("Regra atualizada."); onClose() },
        onError,
      })
    } else {
      create.mutate(toCreatePayload(form), {
        onSuccess: () => { notifySuccess("Regra criada."); onClose() },
        onError,
      })
    }
  }

  const fieldClass = (invalid?: string) =>
    `w-full h-9.5 px-3 text-[13.5px] rounded-[11px] border bg-transparent outline-none transition-colors focus:border-teal-500 ${
      invalid ? "border-[color:var(--color-neg)]" : "border-border-soft"
    }`

  const limiar = Number(form.threshold.replace(",", ".")) || 0
  const canais = form.emailEnabled ? "no app e por e-mail" : "no app"
  const marca = brandName || "a marca"
  const resumo =
    form.type === "SentimentBelow"
      ? `Quando uma menção nova de ${marca} ficar abaixo de ${formatScore(limiar)} de score, você recebe um alerta ${SEVERITY_LABEL[form.severity].toLowerCase()} ${canais}.`
      : form.type === "MentionVolumeAbove"
        ? `Quando ${marca} passar de ${form.threshold || "N"} menções em ${MENTION_VOLUME_WINDOW_LABEL}, você recebe um alerta ${SEVERITY_LABEL[form.severity].toLowerCase()} ${canais}.`
        : `Quando uma menção nova de ${marca} citar “${form.keyword.trim() || "…"}”, você recebe um alerta ${SEVERITY_LABEL[form.severity].toLowerCase()} ${canais}.`

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] rounded-[20px] border border-border-soft shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label={rule ? "Editar regra de alerta" : "Nova regra de alerta"}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-4 px-6 pt-5 pb-4 border-b border-border-soft shrink-0">
          <div className="flex-1 min-w-0">
            <div className="eyebrow mb-2">Alertas</div>
            <h2 className="font-display m-0" style={{ fontSize: 23, lineHeight: 1.1, color: "var(--ink)" }}>
              {rule ? "Editar regra" : "Nova regra de alerta"}
            </h2>
            <p className="text-[13px] text-ink-muted mt-2 mb-0">
              A regra vigia as menções novas da marca escolhida. O histórico já analisado não dispara de novo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-full border border-border-soft flex items-center justify-center text-ink-muted hover:text-ink hover:bg-tint cursor-pointer shrink-0"
            aria-label="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-5">

          {/* O que vigiar — três cartões, os três gatilhos que o backend avalia.
              Os cinco do mock antigo (pico negativo, influenciador, tópico, SoV,
              logo) pressupõem sinais que não chegam na ingestão. */}
          <div>
            <div className="eyebrow mb-3">O que vigiar</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="O que vigiar">
              {RULE_TYPES.map((t) => {
                const active = form.type === t
                const Icon = RULE_TYPE_ICON[t]
                return (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("type", t)}
                    className="p-3.5 rounded-[14px] text-left transition-colors cursor-pointer"
                    style={{
                      border: `1px solid ${active ? "var(--color-teal-500)" : "var(--border-soft)"}`,
                      background: active ? "var(--teal-bg)" : "transparent",
                    }}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className="w-7 h-7 rounded-[9px] flex items-center justify-center"
                        style={{
                          background: active ? "var(--color-teal-500)" : "var(--tint)",
                          color: active ? "#fff" : "var(--ink-muted)",
                        }}
                      >
                        <Icon className="w-[15px] h-[15px]" />
                      </span>
                      <span
                        className="w-[15px] h-[15px] rounded-full flex items-center justify-center"
                        style={{ border: `1.5px solid ${active ? "var(--color-teal-500)" : "var(--border-soft)"}` }}
                      >
                        {active && (
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-teal-500)" }} />
                        )}
                      </span>
                    </span>
                    <span className="block text-[13px] font-semibold mt-2.5" style={{ color: "var(--ink)" }}>
                      {RULE_TYPE_LABEL[t]}
                    </span>
                    <span className="block text-[11.5px] leading-snug text-ink-muted mt-1.5">
                      {RULE_TYPE_HINT[t]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Configuração do gatilho escolhido */}
          <div className="p-4 rounded-[15px] border border-border-soft bg-inset">
            {form.type === "SentimentBelow" && (
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-4">
                  <label htmlFor="limiar" className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                    Disparar quando o score ficar abaixo de
                  </label>
                  <span className="font-mono-zoe font-display" style={{ fontSize: 20, color: scoreColor(limiar) }}>
                    {formatScore(limiar)}
                  </span>
                </div>
                {/* Trilho colorido com o range por cima, transparente: a escala se
                    lê de relance e o controle continua sendo um input de verdade,
                    alcançável por teclado. */}
                <div className="relative h-[18px] flex items-center">
                  <span
                    className="block w-full h-1.5 rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--color-neg), var(--ink-muted-2) 50%, var(--color-pos))" }}
                  />
                  <span
                    className="absolute w-[18px] h-[18px] rounded-full pointer-events-none"
                    style={{
                      left: `calc(${limiar * 100}% - 9px)`,
                      background: "var(--surface)",
                      border: `2px solid ${scoreColor(limiar)}`,
                    }}
                  />
                  <input
                    id="limiar"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={limiar}
                    onChange={(e) => set("threshold", formatScore(Number(e.target.value)))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Limite de sentimento"
                  />
                </div>
                <div className="flex justify-between font-mono-zoe text-[10px] text-ink-muted-2 mt-3">
                  <span>0,00 · totalmente negativo</span>
                  <span>0,50 · neutro</span>
                  <span>1,00 · totalmente positivo</span>
                </div>
              </div>
            )}

            {form.type === "MentionVolumeAbove" && (
              <div className="flex items-center gap-3 flex-wrap">
                <label htmlFor="volume" className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                  Disparar acima de
                </label>
                <input
                  id="volume"
                  value={form.threshold}
                  onChange={(e) => set("threshold", e.target.value)}
                  inputMode="numeric"
                  placeholder="20"
                  className={`w-20 h-9.5 px-3 text-[13.5px] font-mono-zoe rounded-[11px] border bg-transparent outline-none transition-colors focus:border-teal-500 ${
                    showError("threshold") ? "border-[color:var(--color-neg)]" : "border-border-soft"
                  }`}
                />
                <span className="text-[13px]" style={{ color: "var(--ink)" }}>
                  menções em {MENTION_VOLUME_WINDOW_LABEL}
                </span>
                {/* A janela é fixa no backend: um seletor aqui seria ignorado. */}
                <span className="chip text-[10.5px] ml-auto">janela fixa</span>
              </div>
            )}

            {form.type === "KeywordMatch" && (
              <div>
                <label htmlFor="kw" className="block text-[13px] font-medium mb-2.5" style={{ color: "var(--ink)" }}>
                  Palavra ou expressão
                </label>
                <input
                  id="kw"
                  value={form.keyword}
                  onChange={(e) => set("keyword", e.target.value)}
                  maxLength={KEYWORD_MAX_LENGTH}
                  placeholder="ex.: recall, processo, alergia"
                  className={fieldClass(showError("keyword"))}
                />
                <p className="text-[11.5px] text-ink-muted mt-2 mb-0">
                  Busca por trecho, sem diferenciar maiúsculas — “itaú” encontra “Banco Itaú S.A.”. Até{" "}
                  {KEYWORD_MAX_LENGTH} caracteres.
                </p>
              </div>
            )}

            {showError("threshold") && <p className="text-[11.5px] text-neg mt-2 mb-0">{errors.threshold}</p>}
            {showError("keyword") && <p className="text-[11.5px] text-neg mt-2 mb-0">{errors.keyword}</p>}
          </div>

          {/* Marca + gravidade */}
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3.5">
            <div>
              <label htmlFor="marca" className="block text-[12.5px] font-medium text-ink-2 mb-2">Marca</label>
              {rule ? (
                // A marca não muda na edição: o PUT do backend não a aceita. Um
                // select editável aqui prometeria algo que a API descarta em silêncio.
                <div className="h-9.5 px-3 flex items-center text-[13px] rounded-[11px] border border-border-soft text-ink-muted">
                  {rule.brandName} <span className="text-[11.5px] ml-1.5">· não editável</span>
                </div>
              ) : (
                <SelectField
                  id="marca"
                  value={form.brandId}
                  onChange={(v) => set("brandId", v)}
                  invalid={showError("brandId")}
                  options={brands.map((b) => ({
                    key: b.brandId,
                    label: b.displayName ?? b.brandName,
                  }))}
                />
              )}
              {showError("brandId") && <p className="text-[11.5px] text-neg mt-1 mb-0">{errors.brandId}</p>}
            </div>

            <div>
              <span className="block text-[12.5px] font-medium text-ink-2 mb-2">Gravidade</span>
              <div className="flex gap-0.5 p-0.5 rounded-[11px] border border-border-soft bg-inset">
                {SEVERITIES.map((sev) => {
                  const active = form.severity === sev
                  return (
                    <button
                      key={sev}
                      onClick={() => set("severity", sev)}
                      aria-pressed={active}
                      className="flex-1 h-8 rounded-[9px] text-[12.5px] font-medium text-center transition-colors cursor-pointer"
                      style={active
                        ? { background: `color-mix(in srgb, ${SEVERITY_COLOR[sev]} 16%, transparent)`, color: SEVERITY_COLOR[sev] }
                        : { color: "var(--ink-muted)" }}
                    >
                      {SEVERITY_LABEL[sev]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label htmlFor="nome" className="block text-[12.5px] font-medium text-ink-2 mb-2">Nome da regra</label>
            <input
              id="nome"
              value={form.name}
              onChange={(e) => { setNameTouched(true); set("name", e.target.value) }}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Ex.: Queda de sentimento · Itaú"
              className={fieldClass(showError("name"))}
            />
            {showError("name")
              ? <p className="text-[11.5px] text-neg mt-2 mb-0">{errors.name}</p>
              : (
                <p className="text-[11.5px] text-ink-muted mt-2 mb-0">
                  Sugerido a partir do que você escolheu — é assim que o alerta aparece no feed e no e-mail.
                </p>
              )}
          </div>

          {/* Onde avisar */}
          <div>
            <span className="block text-[12.5px] font-medium text-ink-2 mb-2.5">Onde avisar</span>
            <div className="flex flex-col gap-2">
              {/* InApp é obrigatório: a factory do domínio o força de volta.
                  Deixá-lo desmarcável criaria a expectativa falsa de silenciar o
                  histórico — por isso é um selo, não um interruptor. */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border-soft bg-inset">
                <Bell className="w-4 h-4 text-ink-muted shrink-0" />
                <span className="flex-1 text-[13px]" style={{ color: "var(--ink)" }}>No app</span>
                <span className="chip chip-primary text-[10.5px] inline-flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> sempre
                </span>
              </div>

              <button
                onClick={() => set("emailEnabled", !form.emailEnabled)}
                aria-pressed={form.emailEnabled}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border-soft bg-inset text-left cursor-pointer hover:bg-hover transition-colors"
              >
                <Mail className="w-4 h-4 text-ink-muted shrink-0" />
                <span className="flex-1 text-[13px]" style={{ color: "var(--ink)" }}>
                  E-mail para quem tem acesso à marca
                </span>
                <span
                  className="relative w-[34px] h-5 rounded-full transition-colors shrink-0"
                  style={{ background: form.emailEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: form.emailEnabled ? 16 : 2 }}
                  />
                </span>
              </button>

              <button
                onClick={() => set("isEnabled", !form.isEnabled)}
                aria-pressed={form.isEnabled}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border-soft bg-inset text-left cursor-pointer hover:bg-hover transition-colors"
              >
                <Activity className="w-4 h-4 text-ink-muted shrink-0" />
                <span className="flex-1 text-[13px]" style={{ color: "var(--ink)" }}>
                  Começar vigiando agora
                </span>
                <span
                  className="relative w-[34px] h-5 rounded-full transition-colors shrink-0"
                  style={{ background: form.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: form.isEnabled ? 16 : 2 }}
                  />
                </span>
              </button>
            </div>
          </div>

          {/* Resumo: a frase que a pessoa confere antes de salvar. */}
          <div
            className="p-4 rounded-[14px] border"
            style={{ borderColor: "var(--color-teal-500)", background: "var(--teal-bg)" }}
          >
            <div className="eyebrow" style={{ color: "var(--color-teal-500)" }}>Resumo</div>
            <p className="text-[13.5px] leading-relaxed mt-2.5 mb-0" style={{ color: "var(--ink)" }}>
              {resumo}
              {!form.isEnabled && " A regra é criada pausada."}
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center gap-2.5 px-6 py-4 border-t border-border-soft shrink-0 bg-inset">
          <span className="flex-1 text-[11.5px] text-ink-muted">
            Você pode desligar a regra depois sem perder o histórico.
          </span>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border-soft text-[13px] font-medium text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg text-[13px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 cursor-pointer"
          >
            {pending ? "Salvando…" : rule ? "Salvar alterações" : "Criar regra"}
          </button>
        </div>
      </div>
    </div>
  )
}
