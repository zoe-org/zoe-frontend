import { useState } from "react"
import { AlertCircle, ArrowRight, Loader2, Sparkles, X } from "lucide-react"
import { ApiError } from "@/lib/api"
import { notifySuccess } from "@/lib/feedback"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"
import {
  useChangePreview,
  useSubscriptionMutations,
  type BillingPlans,
  type ChangePreview,
  type ChangeWarning,
  type PendingProjection,
  type PlanSelection,
  type Subscription,
} from "@/lib/api/billing"
import { describeSelection, FEATURE_LABELS, selectionFromSubscription } from "@/lib/plans"
import { day, int, money } from "./format"

/**
 * Confirmação de toda troca de plano. Antes, clicar em upgrade ou downgrade já trocava —
 * sem dizer quando valia nem quanto custava. Os números vêm da prévia do provedor: a
 * tela não calcula proporcional por conta própria.
 */
export function ChangePlanDialog({
  target,
  data,
  sub,
  onClose,
  onRequested,
}: {
  target: PlanSelection
  data: BillingPlans
  sub: Subscription
  onClose: () => void
  onRequested: (r: PendingProjection) => void
}) {
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const preview = useChangePreview(target)
  const { change } = useSubscriptionMutations()
  const [error, setError] = useState<string | null>(null)

  const p = preview.data
  const current = selectionFromSubscription(sub)
  const currency = p?.currency ?? data.currency

  const confirm = () => {
    setError(null)
    change.mutate(target, {
      onSuccess: (res) => {
        const mode =
          res.kind === "Downgrade" ? "scheduled" : res.kind === "ReleaseScheduled" ? "release" : "immediate"
        onRequested({ ...target, mode, since: Date.now() })
        notifySuccess(
          res.kind === "Downgrade"
            ? `Downgrade agendado para ${day(res.effectiveAt)}.`
            : res.kind === "ReleaseScheduled"
              ? "Troca agendada desfeita. O plano atual continua."
              : "Troca confirmada. Aguardando a confirmação do provedor.",
        )
        onClose()
      },
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : "Não foi possível concluir a troca. Tente de novo."),
    })
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar troca de plano"
        className="relative w-full max-w-[540px] rounded-[14px] border border-border-soft px-6 py-6 shadow-xl max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Plano</div>
            <h2 className="font-display mt-2 mb-0" style={{ fontSize: 20, color: "var(--ink)" }}>
              {titleFor(p)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-tint"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap rounded-[12px] border border-border-soft px-4 py-3">
          <SelectionLabel caption="Hoje" selection={current} />
          <ArrowRight className="w-4 h-4 text-ink-muted shrink-0" />
          <SelectionLabel caption={p?.kind === "Downgrade" ? `A partir de ${day(p.effectiveAt)}` : "Depois"} selection={target} />
        </div>

        {preview.isLoading && (
          <div className="mt-4 space-y-2 animate-pulse">
            <div className="h-4 rounded bg-tint w-3/4" />
            <div className="h-16 rounded-[12px] bg-tint" />
          </div>
        )}

        {preview.error && (
          <Notice tone="neg">
            {preview.error instanceof ApiError
              ? preview.error.message
              : "Não foi possível calcular a troca agora. Feche e tente de novo."}
          </Notice>
        )}

        {p && (
          <>
            <p className="text-[13.5px] text-ink-muted mt-4 mb-0 leading-relaxed">{whenText(p, sub)}</p>

            {p.kind !== "ReleaseScheduled" && (
              <dl className="mt-4 rounded-[12px] border border-border-soft divide-y divide-border-soft text-[13px]">
                <MoneyRow
                  label="Cobrado agora"
                  hint={
                    p.kind === "Upgrade"
                      ? `Diferença proporcional até ${day(sub.currentPeriodEnd)}`
                      : p.kind === "TrialChange"
                        ? "Nada é cobrado durante o teste"
                        : "O plano atual segue pago até a data da troca"
                  }
                  value={p.kind === "Upgrade" && p.amountDueNowCents != null ? money(p.amountDueNowCents, currency) : money(0, currency)}
                  strong={p.kind === "Upgrade"}
                />
                <MoneyRow
                  label={
                    p.kind === "TrialChange"
                      ? "Quando o teste acabar"
                      : p.nextInvoiceAt
                        ? `Fatura de ${day(p.nextInvoiceAt)}`
                        : "Próxima fatura"
                  }
                  hint="Mensalidade com os planos novos"
                  value={p.nextInvoiceCents != null ? money(p.nextInvoiceCents, currency) : "—"}
                />
              </dl>
            )}

            {p.bundleDiscountApplies && data.bundle.percentOff != null && (
              <div className="flex items-center gap-2 mt-3 text-[12.5px]" style={{ color: "var(--color-teal-500)" }}>
                <Sparkles className="w-3.5 h-3.5" />
                Desconto Full Platform de {data.bundle.percentOff}% incluído na mensalidade.
              </div>
            )}

            {p.warnings.length > 0 && (
              <Notice tone="warn">
                <ul className="m-0 pl-4 space-y-1.5">
                  {p.warnings.map((w) => (
                    <li key={w.code}>{warningText(w, p)}</li>
                  ))}
                </ul>
              </Notice>
            )}
          </>
        )}

        {error && <Notice tone="neg">{error}</Notice>}

        <div className="flex items-center justify-between gap-3 mt-6">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-ink-muted hover:bg-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={!p || change.isPending}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {change.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel(p, currency)}
          </button>
        </div>
      </div>
    </div>
  )
}

function titleFor(p: ChangePreview | undefined) {
  switch (p?.kind) {
    case "Upgrade":
      return "Confirmar upgrade"
    case "Downgrade":
      return "Agendar downgrade"
    case "TrialChange":
      return "Trocar o plano do teste"
    case "ReleaseScheduled":
      return "Manter o plano atual"
    default:
      return "Trocar de plano"
  }
}

function confirmLabel(p: ChangePreview | undefined, currency: string | null) {
  switch (p?.kind) {
    case "Upgrade":
      return p.amountDueNowCents ? `Confirmar e pagar ${money(p.amountDueNowCents, currency)}` : "Confirmar upgrade"
    case "Downgrade":
      return "Agendar downgrade"
    case "ReleaseScheduled":
      return "Desfazer troca agendada"
    default:
      return "Confirmar troca"
  }
}

function whenText(p: ChangePreview, sub: Subscription) {
  switch (p.kind) {
    case "Upgrade":
      return "Vale assim que o pagamento da diferença for aprovado. A cota e os recursos novos entram na hora, sem esperar o próximo ciclo."
    case "Downgrade":
      return `Vale em ${day(p.effectiveAt)}, quando termina o período já pago. Até lá nada muda — cota, marcas e módulos seguem como estão — e o tempo restante não é devolvido.`
    case "TrialChange":
      return "No teste a troca vale na hora. A cota e as marcas do teste continuam as mesmas; o plano escolhido define a primeira fatura."
    case "ReleaseScheduled":
      return sub.scheduledChange
        ? `A troca agendada para ${day(sub.scheduledChange.effectiveAt)} é cancelada e o plano atual continua depois dessa data.`
        : "A troca agendada é cancelada e o plano atual continua."
  }
}

function warningText(w: ChangeWarning, p: ChangePreview) {
  const quando = p.kind === "Downgrade" ? ` a partir de ${day(p.effectiveAt)}` : ""
  switch (w.code) {
    case "brands_over_limit":
      return `Você tem ${int(w.used ?? 0)} marcas e o plano novo inclui ${int(w.allowed ?? 0)}. Nenhuma é apagada, mas não dá para incluir outra até ficar dentro do limite.`
    case "features_lost":
      return `Deixam de valer${quando}: ${(w.features ?? []).map((f) => FEATURE_LABELS[f] ?? f).join(", ")}.`
    case "intelligence_removed":
      return `O monitoramento de marcas para de coletar${quando}. Análises e histórico continuam disponíveis para leitura.`
    case "operations_removed":
      return `Não será possível criar campanhas novas${quando}. Contratos e custódias em andamento seguem até o fim.`
    case "replaces_scheduled_change":
      return "Isto substitui a troca que já estava agendada."
  }
}

function SelectionLabel({ caption, selection }: { caption: string; selection: PlanSelection }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-ink-muted">{caption}</div>
      <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
        {describeSelection(selection)}
        {selection.extraBrandSlots > 0 && (
          <span className="text-ink-muted font-normal"> · {selection.extraBrandSlots} marca(s) extra</span>
        )}
      </div>
    </div>
  )
}

function MoneyRow({ label, hint, value, strong }: { label: string; hint: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <dt style={{ color: "var(--ink)" }}>{label}</dt>
        <div className="text-[12px] text-ink-muted mt-0.5">{hint}</div>
      </div>
      <dd className={`font-mono-zoe m-0 ${strong ? "text-[15px] font-semibold" : ""}`} style={{ color: "var(--ink)" }}>
        {value}
      </dd>
    </div>
  )
}

function Notice({ tone, children }: { tone: "warn" | "neg"; children: React.ReactNode }) {
  const style =
    tone === "warn"
      ? { bg: "var(--warn-bg)", border: "rgba(217,119,6,.32)", color: "var(--color-warn)" }
      : { bg: "var(--neg-bg)", border: "rgba(220,38,38,.32)", color: "var(--color-neg)" }

  return (
    <div
      className="flex items-start gap-3 rounded-[12px] border px-4 py-3 mt-4"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: style.color }} />
      <div className="text-[13px] leading-relaxed flex-1" style={{ color: "var(--ink-2)" }}>
        {children}
      </div>
    </div>
  )
}
