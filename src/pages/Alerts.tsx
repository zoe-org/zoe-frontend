import { useMemo, useState } from "react"
import { Bell, BellOff, Check, Download, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/ui/page-header"
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
  RULE_TYPE_LABEL, SEVERITY_COLOR, SEVERITY_LABEL,
  alertEventVideoTitle, describeAlertEvent, describeChannels, describeRuleCondition,
  emptyRuleForm, ruleToForm, toCreatePayload, toUpdatePayload, validateAlertRuleForm,
  type AlertRuleForm,
} from "@/lib/alerts"

/**
 * Alertas (Etapa 5, WS-F1/WS-F2). Última tela mock do Intelligence a virar real.
 *
 * Duas coisas que o mock ensinava errado e que a tela agora respeita:
 * 1. A escala de sentimento é **[0,1]** (0 = pior, 1 = melhor), não [-1,1]. O mock
 *    dizia "Sentimento < -0.5"; o backend recusa negativo com 400.
 * 2. A janela do volume de menções é **fixa em 24h** no MVP — não existe seletor,
 *    porque o backend ignoraria qualquer outro valor.
 */

type Tab = "config" | "history"

const RULE_TYPES: AlertRuleType[] = ["SentimentBelow", "MentionVolumeAbove", "KeywordMatch"]
const SEVERITIES: AlertSeverity[] = ["Info", "Warning", "Critical"]

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export default function AlertsPage() {
  const [tab, setTab] = useState<Tab>("config")
  const brand = useActiveBrand()

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
    <div className="space-y-4">
      <PageHeader title="Alertas" subtitle="Regras de alerta e histórico de notificações." />

      <div className="flex gap-1 border-b border-border-soft">
        {([
          { key: "config" as Tab, label: "Configuração" },
          { key: "history" as Tab, label: "Histórico" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? "border-teal-500 text-teal-500"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "config" ? <RulesTab /> : <HistoryTab />}
    </div>
  )
}

// ── WS-F1 · Configuração ───────────────────────────────────────────────────

function RulesTab() {
  const rules = useAlertRules()
  const { brands, brandId } = useActiveBrand()
  const [editing, setEditing] = useState<AlertRule | "new" | null>(null)

  const items = rules.data?.items ?? []
  const enabledCount = items.filter((r) => r.isEnabled).length

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
          {rules.isLoading ? "Carregando regras…" : `Regras ativas (${enabledCount})`}
        </span>
        <RoleGate minRole="Manager">
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 bg-ember hover:bg-ember/90 text-white text-xs font-medium h-8 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Nova regra
          </button>
        </RoleGate>
      </div>

      {rules.isError && (
        <EmptyBlock
          message="Não foi possível carregar as regras."
          hint={rules.error instanceof ApiError ? rules.error.message : undefined}
        />
      )}

      {!rules.isLoading && !rules.isError && items.length === 0 && (
        <div className="rounded-xl border border-border-soft" style={{ background: "var(--surface)" }}>
          <EmptyBlock
            icon={<BellOff className="w-7 h-7" strokeWidth={1.5} />}
            message="Nenhuma regra configurada"
            hint="Crie uma regra para ser avisada quando o sentimento cair, o volume de menções subir ou uma palavra-chave aparecer."
          />
        </div>
      )}

      <div className="space-y-3">
        {items.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-lg border border-l-4 border-border-soft p-4 transition-opacity ${rule.isEnabled ? "" : "opacity-55"}`}
            style={{ background: "var(--surface)", borderLeftColor: SEVERITY_COLOR[rule.severity] }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <RoleGate
                  minRole="Manager"
                  fallback={
                    <span
                      className="relative mt-0.5 w-8 h-4.5 rounded-full shrink-0"
                      style={{ background: rule.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
                      aria-label={rule.isEnabled ? "Regra ativa" : "Regra pausada"}
                    />
                  }
                >
                  <button
                    onClick={() => toggleEnabled(rule)}
                    disabled={update.isPending}
                    aria-label={rule.isEnabled ? "Pausar regra" : "Ativar regra"}
                    className="relative mt-0.5 w-8 h-4.5 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    style={{ background: rule.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
                  >
                    <span
                      className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${rule.isEnabled ? "left-4" : "left-0.5"}`}
                    />
                  </button>
                </RoleGate>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{rule.name}</h3>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ color: SEVERITY_COLOR[rule.severity], background: "var(--border-soft)" }}
                    >
                      {SEVERITY_LABEL[rule.severity]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">{describeRuleCondition(rule)}</p>
                  <p className="text-xs text-ink-muted mt-1">
                    {rule.brandName} · Notificar via: {describeChannels(rule.channels)}
                  </p>
                </div>
              </div>

              <RoleGate minRole="Manager">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditing(rule)}
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
          </div>
        ))}
      </div>

      {editing && (
        <RuleModal
          rule={editing === "new" ? null : editing}
          defaultBrandId={brandId ?? brands[0]?.brandId ?? ""}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
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
              <div className="eyebrow mb-1.5">Intelligence · Alertas</div>
              <h2 className="font-display m-0" style={{ fontSize: 24, color: "var(--ink)" }}>
                {rule ? "Editar regra" : "Nova regra"}
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

          <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">Condição</label>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value as AlertRuleType)}
            className={inputClass()}
          >
            {RULE_TYPES.map((t) => <option key={t} value={t}>{RULE_TYPE_LABEL[t]}</option>)}
          </select>

          {form.type === "SentimentBelow" && (
            <>
              <label className="block text-[13px] font-semibold text-ink-2 mt-4 mb-1.5">Limite de sentimento</label>
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
              <label className="block text-[13px] font-semibold text-ink-2 mt-4 mb-1.5">Número de menções</label>
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
              <label className="block text-[13px] font-semibold text-ink-2 mt-4 mb-1.5">Palavra-chave</label>
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
                  className="flex-1 px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors cursor-pointer"
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

          <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">Notificar via</label>
          <div className="space-y-1">
            {/* InApp é obrigatório: a factory do domínio o força de volta. Deixar
                desmarcável criaria a expectativa falsa de silenciar o histórico. */}
            <div className="flex items-center gap-3 px-2.5 py-2 rounded-md opacity-70">
              <span
                className="w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center shrink-0"
                style={{ borderColor: "var(--color-teal-500)", background: "var(--color-teal-500)" }}
              >
                <Check className="w-3 h-3 text-white" />
              </span>
              <span className="text-[13px]" style={{ color: "var(--ink)" }}>
                No app <span className="text-ink-muted text-[11.5px]">· sempre ativo</span>
              </span>
            </div>
            <button
              onClick={() => set("emailEnabled", !form.emailEnabled)}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors cursor-pointer"
            >
              <span
                className="w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors"
                style={{
                  borderColor: form.emailEnabled ? "var(--color-teal-500)" : "var(--border-soft)",
                  background: form.emailEnabled ? "var(--color-teal-500)" : "transparent",
                }}
              >
                {form.emailEnabled && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="text-[13px]" style={{ color: "var(--ink)" }}>E-mail</span>
            </button>
          </div>

          <button
            onClick={() => set("isEnabled", !form.isEnabled)}
            className="w-full flex items-center gap-3 px-2.5 py-2 mt-4 mb-2 rounded-md text-left hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors cursor-pointer"
          >
            <span
              className="relative w-8 h-4.5 rounded-full transition-colors shrink-0"
              style={{ background: form.isEnabled ? "var(--color-teal-500)" : "var(--border-soft)" }}
            >
              <span
                className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${form.isEnabled ? "left-4" : "left-0.5"}`}
              />
            </span>
            <span className="text-[13px]" style={{ color: "var(--ink)" }}>
              Regra ativa <span className="text-ink-muted text-[11.5px]">· desligue para pausar sem excluir</span>
            </span>
          </button>
        </div>

        <div className="flex justify-end items-center gap-2 px-7 py-4 border-t border-border-soft shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="px-3.5 py-2 rounded-lg text-[13px] font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 cursor-pointer"
          >
            {pending ? "Salvando…" : rule ? "Salvar alterações" : "Criar regra"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── WS-F2 · Histórico ──────────────────────────────────────────────────────

function HistoryTab() {
  const { brands } = useActiveBrand()
  const [brandFilter, setBrandFilter] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)

  const events = useAlertEvents({ brandId: brandFilter || null, unreadOnly })
  const markRead = useMarkAlertRead()
  const markAll = useMarkAllAlertsRead()

  const items = useMemo(
    () => events.data?.pages.flatMap((p) => p.items) ?? [],
    [events.data],
  )
  // Contador do TENANT (não do filtro) — vem igual em toda página.
  const unreadCount = events.data?.pages[0]?.unreadCount ?? 0

  const brandOptions = useMemo(
    () => [
      { key: "", label: "Todas as marcas" },
      ...brands.map((b) => ({ key: b.brandId, label: b.displayName ?? b.brandName })),
    ],
    [brands],
  )

  /**
   * Exporta o que já foi carregado (paginação por cursor), não dispara refetch de
   * todas as páginas. Descrição e título vêm do snapshot — texto do YouTube, input
   * hostil — então tudo passa pelo `toCsv`, que desarma formula injection (RN-I-070).
   */
  const exportCsv = () => {
    if (items.length === 0) return
    const csv = toCsv(items, [
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <SelectFilterChip
            value={brandFilter}
            onChange={setBrandFilter}
            options={brandOptions}
            placeholder="Todas as marcas"
          />
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors cursor-pointer"
            style={{
              borderColor: unreadOnly ? "var(--color-teal-500)" : "var(--border-soft)",
              color: unreadOnly ? "var(--color-teal-500)" : "var(--ink-muted)",
            }}
          >
            <Bell className="w-3.5 h-3.5" />
            Só não lidos{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={items.length === 0}
            title="Exporta os disparos já carregados na lista."
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-soft text-[12px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => markAll.mutate(undefined, {
              onSuccess: (r) => toast.success(r.markedCount > 0 ? `${r.markedCount} alerta(s) marcado(s) como lido.` : "Nada a marcar."),
              onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível marcar."),
            })}
            disabled={unreadCount === 0 || markAll.isPending}
            className="px-3 py-1.5 rounded-lg border border-border-soft text-[12px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            Marcar todos como lidos
          </button>
        </div>
      </div>

      {events.isError && (
        <EmptyBlock
          message="Não foi possível carregar o histórico."
          hint={events.error instanceof ApiError ? events.error.message : undefined}
        />
      )}

      {events.isLoading && <div className="py-10 text-center text-ink-muted text-[13px]">Carregando…</div>}

      {!events.isLoading && !events.isError && items.length === 0 && (
        <div className="rounded-xl border border-border-soft" style={{ background: "var(--surface)" }}>
          <EmptyBlock
            icon={<Bell className="w-7 h-7" strokeWidth={1.5} />}
            message={unreadOnly ? "Nenhum alerta não lido" : "Nenhum alerta disparado ainda"}
            hint={
              unreadOnly
                ? "Tudo em dia por aqui."
                : "Quando uma regra bater numa análise recém-processada, o disparo aparece nesta linha do tempo."
            }
          />
        </div>
      )}

      <div className="space-y-3">
        {items.map((event) => (
          <AlertEventRow
            key={event.id}
            event={event}
            onMarkRead={() => markRead.mutate(event.id, {
              onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível marcar como lido."),
            })}
            marking={markRead.isPending}
          />
        ))}
      </div>

      {events.hasNextPage && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => events.fetchNextPage()}
            disabled={events.isFetchingNextPage}
            className="px-4 py-2 rounded-lg border border-border-soft text-[13px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            {events.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  )
}

function AlertEventRow({
  event, onMarkRead, marking,
}: { event: AlertEvent; onMarkRead: () => void; marking: boolean }) {
  const videoTitle = alertEventVideoTitle(event)

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-border-soft p-4"
      style={{ background: "var(--surface)" }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
        style={{ background: SEVERITY_COLOR[event.severity], opacity: event.isRead ? 0.4 : 1 }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${event.isRead ? "text-ink-muted" : "font-medium"}`}
          style={event.isRead ? undefined : { color: "var(--ink)" }}
        >
          {/* Texto do YouTube chega como string e é renderizado como string —
              nunca dangerouslySetInnerHTML (RN-I-069). */}
          {describeAlertEvent(event)}
        </p>
        {videoTitle && <p className="text-xs text-ink-muted mt-1 truncate">{videoTitle}</p>}
        <p className="text-xs text-ink-muted mt-1">
          {event.ruleName} · {event.brandName} · {formatDateTime(event.triggeredAt)}
          {event.emailNotified && " · e-mail enviado"}
        </p>
        <a
          href={`https://www.youtube.com/watch?v=${event.youtubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-teal-500 hover:underline mt-1.5"
        >
          Ver vídeo <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {!event.isRead && (
        <button
          onClick={onMarkRead}
          disabled={marking}
          className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] shrink-0 cursor-pointer disabled:opacity-50"
          aria-label="Marcar como lido"
          title="Marcar como lido"
        >
          <Check className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
