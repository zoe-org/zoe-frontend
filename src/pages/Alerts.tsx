import { useMemo, useState } from "react"
import { Bell, BellOff, Check, Download, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { EmptyBlock } from "@/components/ui/empty-block"
import { EmptyState } from "@/components/ui/empty-state"
import { SelectFilterChip } from "@/components/ui/select-filter-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { useActiveBrand } from "@/features/brands/context"
import { ApiError } from "@/lib/api"
import { toCsv, downloadCsv } from "@/lib/csv"
import {
  useAlertEvents, useAlertRules, useCreateAlertRule, useDeleteAlertRule,
  useMarkAlertRead, useMarkAllAlertsRead, useUpdateAlertRule,
  type AlertEvent, type AlertRule, type AlertRuleType, type AlertSeverity,
} from "@/lib/api/alerts"
import {
  KEYWORD_MAX_LENGTH, MENTION_VOLUME_WINDOW_LABEL, NAME_MAX_LENGTH,
  RULE_TYPE_LABEL, SEVERITY_CHIP_CLASS, SEVERITY_COLOR, SEVERITY_LABEL,
  alertEventVideoTitle, describeAlertEvent, describeChannelShort, describeRuleCondition,
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

type Tab = "history" | "rules"

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
function ReadPill({ isRead }: { isRead: boolean }) {
  return (
    <span className={`${isRead ? "chip" : "chip chip-primary"} text-[10.5px]`}>
      {isRead ? "Lido" : "Novo"}
    </span>
  )
}

export default function AlertsPage() {
  // Histórico primeiro: a pergunta que traz o usuário aqui é "o que disparou?".
  const [tab, setTab] = useState<Tab>("history")
  const brand = useActiveBrand()

  const rules = useAlertRules()
  const ruleItems = useMemo(() => rules.data?.items ?? [], [rules.data])
  const enabledCount = ruleItems.filter((r) => r.isEnabled).length

  const [brandFilter, setBrandFilter] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const events = useAlertEvents({ brandId: brandFilter || null, unreadOnly })
  const eventItems = useMemo(() => events.data?.pages.flatMap((p) => p.items) ?? [], [events.data])
  const unreadCount = events.data?.pages[0]?.unreadCount ?? 0

  const [editing, setEditing] = useState<AlertRule | "new" | null>(null)

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
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      {/* Hero */}
      <section className="px-8 pt-7 pb-5 border-b border-border-soft">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-160 min-w-70">
            <div className="eyebrow mb-2.5">Intelligence · Automação</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Alertas
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              Regras automáticas para não perder nada.{" "}
              <span className="font-mono-zoe">{enabledCount}</span>{" "}
              {enabledCount === 1 ? "regra ativa" : "regras ativas"} ·{" "}
              <span className="font-mono-zoe">{unreadCount}</span>{" "}
              {unreadCount === 1 ? "disparo não lido" : "disparos não lidos"}.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={eventItems.length === 0}
              title="Exporta os disparos já carregados no histórico."
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Exportar histórico
            </button>
            <RoleGate minRole="Manager">
              <button
                onClick={() => setEditing("new")}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nova regra
              </button>
            </RoleGate>
          </div>
        </div>
      </section>

      {/* KPIs — só os três que a API sustenta. O design pedia "tempo médio de
          resposta" e "taxa de falso positivo": não há carimbo de reconhecimento
          nem loop de feedback, então seriam números inventados. */}
      <section className="grid grid-cols-3 border-b border-border-soft">
        {[
          {
            label: "Regras ativas",
            value: enabledCount,
            sub: `de ${ruleItems.length} ${ruleItems.length === 1 ? "configurada" : "configuradas"}`,
            accent: true,
          },
          {
            label: "Disparos não lidos",
            value: unreadCount,
            sub: unreadCount === 0 ? "tudo em dia" : "no workspace inteiro",
          },
          {
            label: "Marcas monitoradas",
            value: brand.brands.length,
            sub: "toda regra é de uma marca",
          },
        ].map((k, i) => (
          <div key={k.label} className={`px-6 py-5 ${i < 2 ? "border-r border-border-soft" : ""}`}>
            <div className="eyebrow">{k.label}</div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span
                className="font-display"
                style={{ fontSize: 40, lineHeight: 1, color: k.accent ? "var(--color-teal-500)" : "var(--ink)" }}
              >
                {k.value}
              </span>
            </div>
            <div className="text-[11.5px] text-ink-muted mt-2">{k.sub}</div>
          </div>
        ))}
      </section>

      {/* Tabs + filtros do histórico na mesma faixa */}
      <section className="px-8 py-4 border-b border-border-soft flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <TabPill active={tab === "history"} onClick={() => setTab("history")} label="Histórico" badge={unreadCount} />
          <TabPill active={tab === "rules"} onClick={() => setTab("rules")} label="Regras" count={ruleItems.length} />
        </div>

        {tab === "history" && (
          <div className="flex items-center gap-2">
            <SelectFilterChip
              value={brandFilter}
              onChange={setBrandFilter}
              options={[
                { key: "", label: "Todas as marcas" },
                ...brand.brands.map((b) => ({ key: b.brandId, label: b.displayName ?? b.brandName })),
              ]}
              placeholder="Todas as marcas"
            />
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] font-medium transition-colors cursor-pointer"
              style={{
                borderColor: unreadOnly ? "var(--color-teal-500)" : "var(--border-soft)",
                color: unreadOnly ? "var(--color-teal-500)" : "var(--ink-muted)",
              }}
            >
              <Bell className="w-3.5 h-3.5" /> Só não lidos
            </button>
            <MarkAllButton unreadCount={unreadCount} />
          </div>
        )}
      </section>

      {tab === "history" ? (
        <HistoryList
          events={eventItems}
          isLoading={events.isLoading}
          error={events.isError ? events.error : null}
          unreadOnly={unreadOnly}
          hasNextPage={Boolean(events.hasNextPage)}
          isFetchingNextPage={events.isFetchingNextPage}
          onLoadMore={() => events.fetchNextPage()}
        />
      ) : (
        <RulesList
          rules={ruleItems}
          isLoading={rules.isLoading}
          error={rules.isError ? rules.error : null}
          onEdit={setEditing}
        />
      )}

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

function TabPill({
  active, onClick, label, count, badge,
}: { active: boolean; onClick: () => void; label: string; count?: number; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-[13.5px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
      style={{
        background: active ? "var(--color-teal-500)" : "transparent",
        color: active ? "#fff" : "var(--ink-muted)",
      }}
    >
      {label}
      {count !== undefined && (
        <span className="font-medium" style={{ opacity: active ? 0.8 : 0.6 }}>({count})</span>
      )}
      {/* Badge só quando há o que ver — um "(0)" permanente vira ruído. */}
      {badge !== undefined && badge > 0 && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: active ? "rgba(255,255,255,0.25)" : "var(--color-ember)", color: "#fff" }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
}

function MarkAllButton({ unreadCount }: { unreadCount: number }) {
  const markAll = useMarkAllAlertsRead()
  return (
    <button
      onClick={() => markAll.mutate(undefined, {
        onSuccess: (r) =>
          toast.success(r.markedCount > 0 ? `${r.markedCount} alerta(s) marcado(s) como lido.` : "Nada a marcar."),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível marcar."),
      })}
      disabled={unreadCount === 0 || markAll.isPending}
      className="h-8 px-3 rounded-md border border-border-soft text-[12.5px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
    >
      Marcar todos como lidos
    </button>
  )
}

// ── WS-F2 · Histórico ──────────────────────────────────────────────────────

function HistoryList({
  events, isLoading, error, unreadOnly, hasNextPage, isFetchingNextPage, onLoadMore,
}: {
  events: AlertEvent[]
  isLoading: boolean
  error: unknown
  unreadOnly: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}) {
  const markRead = useMarkAlertRead()

  if (error) {
    return (
      <EmptyBlock
        className="py-16"
        message="Não foi possível carregar o histórico."
        hint={error instanceof ApiError ? error.message : undefined}
      />
    )
  }
  if (isLoading) return <div className="py-16 text-center text-ink-muted text-[13px]">Carregando…</div>
  if (events.length === 0) {
    return (
      <EmptyBlock
        className="py-16"
        icon={<Bell className="w-7 h-7" strokeWidth={1.5} />}
        message={unreadOnly ? "Nenhum alerta não lido" : "Nenhum alerta disparado ainda"}
        hint={
          unreadOnly
            ? "Tudo em dia por aqui."
            : "Quando uma regra bater numa análise recém-processada, o disparo aparece nesta linha do tempo."
        }
      />
    )
  }

  return (
    <>
      {events.map((event) => {
        const videoTitle = alertEventVideoTitle(event)
        return (
          <div
            key={event.id}
            className="grid gap-4 px-8 py-4 border-b border-border-soft items-center"
            style={{ gridTemplateColumns: "24px 1fr 150px 76px" }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: SEVERITY_COLOR[event.severity], opacity: event.isRead ? 0.4 : 1 }}
              aria-hidden
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {/* Texto vindo do YouTube é renderizado como string, nunca
                    dangerouslySetInnerHTML (RN-I-069). */}
                <span
                  className="text-[14px]"
                  style={{ fontWeight: event.isRead ? 400 : 600, color: event.isRead ? "var(--ink-muted)" : "var(--ink)" }}
                >
                  {describeAlertEvent(event)}
                </span>
                <ReadPill isRead={event.isRead} />
              </div>
              {videoTitle && <div className="text-[12.5px] text-ink-muted mb-1 truncate">{videoTitle}</div>}
              <div className="flex items-center gap-2 text-[11px] text-ink-muted-2 flex-wrap">
                <span className="font-mono-zoe">regra: {event.ruleName}</span>
                <span>·</span>
                <span className="font-mono-zoe">{event.brandName}</span>
                <span>·</span>
                <span>{SEVERITY_LABEL[event.severity]}</span>
                {event.emailNotified && (<><span>·</span><span>e-mail enviado</span></>)}
              </div>
            </div>

            <span className="font-mono-zoe text-[12px] text-ink-muted">{formatDateTime(event.triggeredAt)}</span>

            <div className="flex items-center gap-1 justify-self-end">
              <a
                href={`https://www.youtube.com/watch?v=${event.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D]"
                aria-label="Ver vídeo no YouTube"
                title="Ver vídeo no YouTube"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              {!event.isRead && (
                <button
                  onClick={() => markRead.mutate(event.id, {
                    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível marcar como lido."),
                  })}
                  disabled={markRead.isPending}
                  className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] cursor-pointer disabled:opacity-50"
                  aria-label="Marcar como lido"
                  title="Marcar como lido"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {hasNextPage && (
        <div className="flex justify-center py-5">
          <button
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="px-4 py-2 rounded-lg border border-border-soft text-[13px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </>
  )
}

// ── WS-F1 · Regras ─────────────────────────────────────────────────────────

function RulesList({
  rules, isLoading, error, onEdit,
}: { rules: AlertRule[]; isLoading: boolean; error: unknown; onEdit: (r: AlertRule) => void }) {
  const remove = useDeleteAlertRule()
  const update = useUpdateAlertRule()

  const toggleEnabled = (rule: AlertRule) => {
    update.mutate(
      { ruleId: rule.id, input: { ...toUpdatePayload(ruleToForm(rule)), isEnabled: !rule.isEnabled } },
      {
        onSuccess: () => toast.success(rule.isEnabled ? "Regra pausada." : "Regra reativada."),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível alterar a regra."),
      },
    )
  }

  const confirmRemove = (rule: AlertRule) => {
    // O backend apaga o histórico de disparos junto — vale avisar antes.
    if (!window.confirm(`Excluir “${rule.name}”? O histórico de disparos dela também será removido.`)) return
    remove.mutate(rule.id, {
      onSuccess: () => toast.success("Regra excluída."),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível excluir."),
    })
  }

  if (error) {
    return (
      <EmptyBlock
        className="py-16"
        message="Não foi possível carregar as regras."
        hint={error instanceof ApiError ? error.message : undefined}
      />
    )
  }
  if (isLoading) return <div className="py-16 text-center text-ink-muted text-[13px]">Carregando…</div>
  if (rules.length === 0) {
    return (
      <EmptyBlock
        className="py-16"
        icon={<BellOff className="w-7 h-7" strokeWidth={1.5} />}
        message="Nenhuma regra configurada"
        hint="Crie uma regra para ser avisada quando o sentimento cair, o volume de menções subir ou uma palavra-chave aparecer."
      />
    )
  }

  return (
    <>
      {rules.map((rule) => (
        <div
          key={rule.id}
          className={`grid gap-4 px-8 py-4 border-b border-border-soft items-center ${rule.isEnabled ? "" : "opacity-60"}`}
          style={{ gridTemplateColumns: "44px 1fr 170px 120px 76px" }}
        >
          <RoleGate
            minRole="Manager"
            fallback={
              <span
                className="relative w-9 h-5 rounded-full block"
                style={{ background: rule.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
                aria-label={rule.isEnabled ? "Regra ativa" : "Regra pausada"}
              />
            }
          >
            <button
              onClick={() => toggleEnabled(rule)}
              disabled={update.isPending}
              aria-label={rule.isEnabled ? "Pausar regra" : "Ativar regra"}
              className="relative w-9 h-5 rounded-full transition-colors cursor-pointer disabled:opacity-50"
              style={{ background: rule.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: rule.isEnabled ? 18 : 2 }}
              />
            </button>
          </RoleGate>

          <div className="min-w-0">
            <div className="text-[14px] font-semibold mb-0.5 truncate" style={{ color: "var(--ink)" }}>
              {rule.name}
            </div>
            <div className="text-[12.5px] text-ink-muted">{describeRuleCondition(rule)}</div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {rule.channels.map((c) => (
              <span key={c} className="chip text-[10.5px]">{describeChannelShort(c)}</span>
            ))}
          </div>

          <span className={`${SEVERITY_CHIP_CLASS[rule.severity]} text-[10.5px] justify-self-start`}>
            {SEVERITY_LABEL[rule.severity]}
          </span>

          <RoleGate minRole="Manager" fallback={<div />}>
            <div className="flex items-center gap-1 justify-self-end">
              <button
                onClick={() => onEdit(rule)}
                className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] cursor-pointer"
                aria-label={`Editar ${rule.name}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => confirmRemove(rule)}
                disabled={remove.isPending}
                className="p-1.5 rounded-md text-ink-muted hover:text-[color:var(--color-neg)] hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] cursor-pointer disabled:opacity-50"
                aria-label={`Excluir ${rule.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </RoleGate>
        </div>
      ))}
    </>
  )
}

function RuleModal({
  rule, defaultBrandId, onClose,
}: { rule: AlertRule | null; defaultBrandId: string; onClose: () => void }) {
  const { brands } = useActiveBrand()
  const create = useCreateAlertRule()
  const update = useUpdateAlertRule()

  const [form, setForm] = useState<AlertRuleForm>(() => (rule ? ruleToForm(rule) : emptyRuleForm(defaultBrandId)))
  const [submitted, setSubmitted] = useState(false)

  const errors = validateAlertRuleForm(form)
  const showError = (field: keyof typeof errors) => (submitted ? errors[field] : undefined)
  const pending = create.isPending || update.isPending

  const set = <K extends keyof AlertRuleForm>(key: K, value: AlertRuleForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = () => {
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return

    const onError = (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar a regra.")

    if (rule) {
      update.mutate({ ruleId: rule.id, input: toUpdatePayload(form) }, {
        onSuccess: () => { toast.success("Regra atualizada."); onClose() },
        onError,
      })
    } else {
      create.mutate(toCreatePayload(form), {
        onSuccess: () => { toast.success("Regra criada."); onClose() },
        onError,
      })
    }
  }

  const inputClass = (invalid?: string) =>
    `w-full px-3 py-2.5 text-[13px] rounded-lg border bg-transparent outline-none focus:border-teal-500 ${
      invalid ? "border-[color:var(--color-neg)]" : "border-border-soft"
    }`

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border-soft shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label={rule ? "Editar regra de alerta" : "Nova regra de alerta"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-4 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow mb-1.5">Automação</div>
              <h2 className="font-display m-0" style={{ fontSize: 24, color: "var(--ink)" }}>
                {rule ? "Editar regra" : "Nova regra de alerta"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        <div className="px-7 pb-2 overflow-y-auto">
          <label className="block text-[13px] font-semibold text-ink-2 mb-1.5">Nome da regra</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Ex.: Queda de sentimento em vídeo grande"
            className={inputClass(showError("name"))}
          />
          {showError("name") && <p className="text-[11.5px] text-[color:var(--color-neg)] mt-1">{errors.name}</p>}

          <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">Marca monitorada</label>
          {rule ? (
            // A marca não muda na edição: o PUT do backend não a aceita. Mostrar um
            // select editável aqui prometeria algo que a API descarta em silêncio.
            <div className="px-3 py-2.5 text-[13px] rounded-lg border border-border-soft text-ink-muted">
              {rule.brandName} <span className="text-[11.5px]">· não editável</span>
            </div>
          ) : (
            <select
              value={form.brandId}
              onChange={(e) => set("brandId", e.target.value)}
              className={inputClass(showError("brandId"))}
            >
              {brands.map((b) => (
                <option key={b.brandId} value={b.brandId}>{b.displayName ?? b.brandName}</option>
              ))}
            </select>
          )}
          {showError("brandId") && <p className="text-[11.5px] text-[color:var(--color-neg)] mt-1">{errors.brandId}</p>}

          {/* Gatilho como cards (design), mas com os 3 tipos que o backend avalia —
              os 5 do design (pico negativo, influenciador, tópico, SoV, logo)
              pressupõem sinais que não chegam na ingestão. */}
          <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">O que dispara essa regra?</label>
          <div className="flex flex-col gap-2">
            {RULE_TYPES.map((t) => {
              const active = form.type === t
              return (
                <button
                  key={t}
                  onClick={() => set("type", t)}
                  className="flex items-center gap-3 px-4 py-3 rounded-[10px] text-left transition-colors cursor-pointer"
                  style={{
                    border: `1.5px solid ${active ? "var(--color-teal-500)" : "var(--border-soft)"}`,
                    background: active ? "rgba(0, 167, 153, 0.08)" : "transparent",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                      {RULE_TYPE_LABEL[t]}
                    </div>
                    <div className="text-[12px] text-ink-muted">{RULE_TYPE_HINT[t]}</div>
                  </div>
                  {active && <Check className="w-4 h-4 shrink-0" style={{ color: "var(--color-teal-500)" }} strokeWidth={2.5} />}
                </button>
              )
            })}
          </div>

          {form.type === "SentimentBelow" && (
            <>
              <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">Limite de sentimento</label>
              <input
                value={form.threshold}
                onChange={(e) => set("threshold", e.target.value)}
                inputMode="decimal"
                placeholder="0,40"
                className={inputClass(showError("threshold"))}
              />
              <p className="text-[11.5px] text-ink-muted mt-1.5">
                A escala vai de <strong>0 (pior)</strong> a <strong>1 (melhor)</strong>, com 0,5 neutro. Dispara quando o
                sentimento do vídeo fica <em>abaixo</em> deste valor.
              </p>
            </>
          )}

          {form.type === "MentionVolumeAbove" && (
            <>
              <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">Número de menções</label>
              <input
                value={form.threshold}
                onChange={(e) => set("threshold", e.target.value)}
                inputMode="numeric"
                placeholder="50"
                className={inputClass(showError("threshold"))}
              />
              <p className="text-[11.5px] text-ink-muted mt-1.5">
                Dispara quando a marca passa deste número de menções nas últimas{" "}
                <strong>{MENTION_VOLUME_WINDOW_LABEL}</strong>. A janela é fixa nesta versão.
              </p>
            </>
          )}

          {form.type === "KeywordMatch" && (
            <>
              <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">Palavra-chave</label>
              <input
                value={form.keyword}
                onChange={(e) => set("keyword", e.target.value)}
                maxLength={KEYWORD_MAX_LENGTH}
                placeholder="Ex.: recall"
                className={inputClass(showError("keyword"))}
              />
              <p className="text-[11.5px] text-ink-muted mt-1.5">
                Busca por trecho, sem diferenciar maiúsculas — “itaú” encontra “Banco Itaú S.A.”.
              </p>
            </>
          )}
          {showError("threshold") && <p className="text-[11.5px] text-[color:var(--color-neg)] mt-1">{errors.threshold}</p>}
          {showError("keyword") && <p className="text-[11.5px] text-[color:var(--color-neg)] mt-1">{errors.keyword}</p>}

          <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">Gravidade</label>
          <div className="flex gap-2">
            {SEVERITIES.map((s) => {
              const active = form.severity === s
              return (
                <button
                  key={s}
                  onClick={() => set("severity", s)}
                  className="flex-1 px-3 py-2 rounded-lg border text-[13px] font-semibold transition-colors cursor-pointer"
                  style={{
                    borderColor: active ? SEVERITY_COLOR[s] : "var(--border-soft)",
                    color: active ? SEVERITY_COLOR[s] : "var(--ink-muted)",
                  }}
                >
                  {SEVERITY_LABEL[s]}
                </button>
              )
            })}
          </div>

          <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">Onde você quer ser avisada</label>
          <div>
            {/* InApp é obrigatório: a factory do domínio o força de volta. Deixá-lo
                desmarcável criaria a expectativa falsa de silenciar o histórico. */}
            <div className="flex items-center gap-3 py-3 border-b border-border-soft opacity-70">
              <Bell className="w-4 h-4 text-ink-muted shrink-0" />
              <span className="text-[13.5px] flex-1" style={{ color: "var(--ink)" }}>
                No app <span className="text-ink-muted text-[11.5px]">· sempre ativo</span>
              </span>
              <span className="relative w-9 h-5 rounded-full block" style={{ background: "var(--color-teal-500)" }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow" style={{ left: 18 }} />
              </span>
            </div>
            <div className="flex items-center gap-3 py-3">
              <span className="text-[13.5px] flex-1 pl-7" style={{ color: "var(--ink)" }}>E-mail</span>
              <button
                onClick={() => set("emailEnabled", !form.emailEnabled)}
                aria-label="Notificar por e-mail"
                className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                style={{ background: form.emailEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: form.emailEnabled ? 18 : 2 }}
                />
              </button>
            </div>
          </div>

          {/* Resumo (design): a frase que a pessoa confere antes de salvar. */}
          <div className="mt-4 mb-2 p-3.5 rounded-[10px] border border-border-soft bg-[#FAFBFC] dark:bg-[#181B28]">
            <div className="eyebrow mb-2">Resumo</div>
            <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {describeRuleCondition({
                type: form.type,
                threshold: form.type === "KeywordMatch" ? null : Number(form.threshold.replace(",", ".")) || null,
                keyword: form.keyword.trim() || null,
              })}
              {" · avisa "}
              {form.emailEnabled ? "no app e por e-mail" : "no app"}
              {form.isEnabled ? "" : " · criada pausada"}.
            </div>
          </div>

          <button
            onClick={() => set("isEnabled", !form.isEnabled)}
            className="w-full flex items-center gap-3 py-2 mb-2 text-left cursor-pointer"
          >
            <span
              className="relative w-9 h-5 rounded-full transition-colors shrink-0"
              style={{ background: form.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: form.isEnabled ? 18 : 2 }}
              />
            </span>
            <span className="text-[13px]" style={{ color: "var(--ink)" }}>
              Regra ativa <span className="text-ink-muted text-[11.5px]">· desligue para pausar sem excluir</span>
            </span>
          </button>
        </div>

        <div className="flex justify-between items-center gap-2 px-7 py-4 border-t border-border-soft shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-[13px] font-medium text-ink-muted hover:text-ink cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            {pending ? "Salvando…" : rule ? "Salvar alterações" : "Criar regra"}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Subtítulo de cada gatilho no seletor — o "desc" dos cards do design. */
const RULE_TYPE_HINT: Record<AlertRuleType, string> = {
  SentimentBelow: "O sentimento de um vídeo fica abaixo do limite",
  MentionVolumeAbove: `A marca passa de N menções em ${MENTION_VOLUME_WINDOW_LABEL}`,
  KeywordMatch: "Uma palavra aparece nas menções, temas ou keywords",
}
