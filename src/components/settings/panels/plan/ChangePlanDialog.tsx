import { useMemo, useState } from "react"
import { AlertCircle, ArrowRight, Loader2, Sparkles, X } from "lucide-react"
import { ApiError } from "@/lib/api"
import { notifySuccess } from "@/lib/feedback"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { useTenantBrands } from "@/lib/api/brands"
import {
  PAYMENT_METHOD_REQUIRED,
  pendingConversion,
  useChangePreview,
  usePaymentMethod,
  useSubscriptionMutations,
  type BillingPlans,
  type ChangePreview,
  type ChangeWarning,
  type InvoiceEstimate,
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
  onRetarget,
}: {
  target: PlanSelection
  data: BillingPlans
  sub: Subscription
  onClose: () => void
  onRequested: (r: PendingProjection) => void
  /** Trocar a combinação sem fechar o modal (comprar slot em vez de arquivar marca). */
  onRetarget: (t: PlanSelection) => void
}) {
  useEscapeKey(onClose)
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const preview = useChangePreview(target)
  const { change, setupPaymentMethod } = useSubscriptionMutations()
  const payment = usePaymentMethod()
  const [error, setError] = useState<string | null>(null)

  const p = preview.data
  const current = selectionFromSubscription(sub)
  const currency = p?.currency ?? data.currency
  const conversao = p?.kind === "TrialConversion"

  // O teste é sem cartão e a conversão cobra na hora. Sabendo antes, o botão já leva ao
  // cadastro em vez de deixar o cliente confirmar e só então receber a recusa.
  const semCartao = conversao && payment.data?.hasPaymentMethod === false

  const overflow = p?.warnings.find((w) => w.code === "brands_over_limit")
  const brands = useBrandChoice(overflow, Boolean(p))

  /** Vai ao provedor cadastrar o cartão; a escolha volta junto e reabre este modal. */
  const cadastrarCartao = () => {
    setError(null)
    pendingConversion.save(target)
    setupPaymentMethod.mutate(undefined, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : "Não foi possível abrir o cadastro de cartão."),
    })
  }

  const confirm = () => {
    if (semCartao) return cadastrarCartao()
    setError(null)
    change.mutate({ ...target, keepBrandIds: overflow ? brands.keep : undefined }, {
      onSuccess: (res) => {
        const mode =
          res.kind === "Downgrade" ? "scheduled"
          : res.kind === "ReleaseScheduled" ? "release"
          : res.kind === "TrialConversion" ? "conversion"
          : "immediate"
        onRequested({ ...target, mode, since: Date.now() })
        notifySuccess(
          res.kind === "Downgrade"
            ? `Downgrade agendado para ${day(res.effectiveAt)}.`
            : res.kind === "ReleaseScheduled"
              ? "Troca agendada desfeita. O plano atual continua."
              : res.kind === "TrialConversion"
                ? "Assinatura confirmada. O período de teste terminou."
                : "Troca confirmada. Aguardando a confirmação do provedor.",
        )
        onClose()
      },
      onError: (e) => {
        if (e instanceof ApiError && e.problem?.code === PAYMENT_METHOD_REQUIRED) return cadastrarCartao()
        setError(e instanceof ApiError ? e.message : "Não foi possível concluir a troca. Tente de novo.")
      },
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
          {sub.status === "Trialing" ? (
            // Teste não é plano: o "de" é o teste, e não a combinação usada para montá-lo.
            <div className="min-w-0">
              <div className="text-[11.5px] text-ink-muted">Hoje</div>
              <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Período de teste</div>
            </div>
          ) : (
            <SelectionLabel caption="Hoje" selection={current} />
          )}
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

            {p.kind === "TrialConversion" && (
              <div className="mt-4 rounded-[12px] border border-border-soft divide-y divide-border-soft text-[13px]">
                <InvoiceBreakdown label="Primeira mensalidade, cobrada agora" estimate={p.dueNow} currency={currency} />
                <MoneyRow
                  label="Próximas mensalidades"
                  hint={p.nextInvoiceAt ? `Todo mês, a partir de ${day(p.nextInvoiceAt)}` : "Todo mês"}
                  value={p.next ? money(p.next.subtotalCents - p.next.discountCents, currency) : "—"}
                />
              </div>
            )}

            {p.kind === "Upgrade" || p.kind === "Downgrade" ? (
              <div className="mt-4 rounded-[12px] border border-border-soft divide-y divide-border-soft text-[13px]">
                <MoneyRow
                  label="Cobrado agora"
                  hint={
                    p.kind === "Upgrade"
                      ? `Diferença proporcional até ${day(sub.currentPeriodEnd)}`
                      : "O plano atual segue pago até a data da troca"
                  }
                  value={money(p.dueNow?.amountDueCents ?? 0, currency)}
                  strong={p.kind === "Upgrade"}
                />
                <InvoiceBreakdown
                  label={p.nextInvoiceAt ? `Fatura de ${day(p.nextInvoiceAt)}` : "Próxima fatura"}
                  estimate={p.next}
                  currency={currency}
                />
              </div>
            ) : null}

            {semCartao && (
              <Notice tone="warn">
                Não há cartão cadastrado. Você vai para a tela segura do Stripe cadastrar um e volta
                aqui para confirmar a assinatura — nada é cobrado no cadastro.
              </Notice>
            )}

            {p.bundleDiscountApplies && data.bundle.percentOff != null && (
              <div className="flex items-center gap-2 mt-3 text-[12.5px]" style={{ color: "var(--color-teal-500)" }}>
                <Sparkles className="w-3.5 h-3.5" />
                Desconto Full Platform de {data.bundle.percentOff}% já incluído acima.
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

            {overflow && (
              <BrandPicker
                choice={brands}
                allowed={overflow.allowed ?? 0}
                used={overflow.used ?? 0}
                effectiveAt={p.kind === "Downgrade" ? p.effectiveAt : null}
                extraSlotOffer={extraSlotOffer(target, data, current, overflow.used ?? 0)}
                currency={currency}
                onBuySlots={(slots) => onRetarget({ ...target, extraBrandSlots: slots })}
              />
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
            disabled={!p || change.isPending || setupPaymentMethod.isPending || (Boolean(overflow) && !brands.ready)}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {(change.isPending || setupPaymentMethod.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {semCartao ? "Cadastrar cartão e assinar" : confirmLabel(p, currency)}
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
    case "TrialConversion":
      return "Assinar e encerrar o teste"
    case "ReleaseScheduled":
      return "Manter o plano atual"
    default:
      return "Trocar de plano"
  }
}

function confirmLabel(p: ChangePreview | undefined, currency: string | null) {
  switch (p?.kind) {
    case "Upgrade":
      return p.dueNow?.amountDueCents
        ? `Confirmar e pagar ${money(p.dueNow.amountDueCents, currency)}`
        : "Confirmar upgrade"
    case "Downgrade":
      return "Agendar downgrade"
    case "ReleaseScheduled":
      return "Desfazer troca agendada"
    case "TrialConversion":
      return p.dueNow?.amountDueCents
        ? `Assinar e pagar ${money(p.dueNow.amountDueCents, currency)}`
        : "Assinar"
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
    case "TrialConversion":
      return "O período de teste termina agora e a assinatura começa hoje, com a cota e as marcas cheias do plano. A primeira mensalidade é cobrada no ato."
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
      return `Você tem ${int(w.used ?? 0)} marcas e o plano novo inclui ${int(w.allowed ?? 0)} — escolha abaixo quais continuam.`
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

/**
 * A fatura aberta em parcelas. O total a pagar não é o preço de tabela: o provedor abate
 * desconto e o crédito que sobrou de uma troca anterior no meio do ciclo. Mostrar só o total
 * fazia a tela parecer errada — R$ 3.247,74 onde o plano diz R$ 3.300,00, sem explicação.
 */
function InvoiceBreakdown({
  label,
  estimate,
  currency,
}: {
  label: string
  estimate: InvoiceEstimate | null
  currency: string | null
}) {
  if (!estimate) {
    return <MoneyRow label={label} hint="Mensalidade com os planos novos" value="—" />
  }

  const detalhado = estimate.discountCents > 0 || estimate.creditCents > 0

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span style={{ color: "var(--ink)" }}>{label}</span>
        <span className="font-mono-zoe text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          {money(estimate.amountDueCents, currency)}
        </span>
      </div>

      {detalhado && (
        <dl className="mt-2 space-y-1 text-[12px] text-ink-muted">
          <BreakdownLine label="Mensalidade dos planos" value={money(estimate.subtotalCents, currency)} />
          {estimate.discountCents > 0 && (
            <BreakdownLine label="Desconto" value={`− ${money(estimate.discountCents, currency)}`} />
          )}
          {estimate.creditCents > 0 && (
            <BreakdownLine
              label="Crédito do seu saldo"
              value={`− ${money(estimate.creditCents, currency)}`}
              hint="sobra de uma troca anterior no meio do ciclo"
            />
          )}
        </dl>
      )}
    </div>
  )
}

function BreakdownLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="m-0">
        {label}
        {hint && <span className="text-ink-muted-2"> · {hint}</span>}
      </dt>
      <dd className="m-0 font-mono-zoe shrink-0">{value}</dd>
    </div>
  )
}

/**
 * Marcas extras que cobririam o excedente — só onde o tier vende slot (Pro). Some quando
 * "manter todas" daria na assinatura de hoje: aí não é alternativa, é desistir da troca.
 */
function extraSlotOffer(target: PlanSelection, data: BillingPlans, current: PlanSelection, used: number) {
  const plan = data.plans.find((p) => p.slug === target.planSlug)
  if (!plan?.sellsExtraBrandSlots || data.extraBrandSlotPriceCents == null) return null

  const slots = Math.max(0, used - plan.brandSlots)
  if (slots <= 0) return null

  const voltaAoAtual =
    current.planSlug === target.planSlug &&
    current.operationsPlanSlug === target.operationsPlanSlug &&
    current.extraBrandSlots === slots
  if (voltaAoAtual) return null

  return { slots, priceCents: data.extraBrandSlotPriceCents * slots }
}

type BrandChoice = ReturnType<typeof useBrandChoice>

/**
 * Quais marcas sobrevivem ao plano menor. Pré-seleciona as mais antigas: é a operação que
 * já está de pé, e o cliente troca o que quiser antes de confirmar.
 */
function useBrandChoice(overflow: ChangeWarning | undefined, previewReady: boolean) {
  const allowed = overflow?.allowed ?? 0
  const brands = useTenantBrands()
  const [chosen, setChosen] = useState<string[] | null>(null)

  const elegiveis = useMemo(
    () =>
      (brands.data?.items ?? [])
        .filter((b) => b.status !== "Archived")
        .slice()
        .sort((a, b) => a.subscribedAt.localeCompare(b.subscribedAt)),
    [brands.data],
  )

  const keep = chosen ?? elegiveis.slice(0, allowed).map((b) => b.tenantBrandId)

  return {
    brands: elegiveis,
    loading: brands.isLoading,
    keep,
    ready: !previewReady || !overflow || (keep.length > 0 && keep.length <= allowed),
    toggle: (id: string) =>
      setChosen(keep.includes(id) ? keep.filter((k) => k !== id) : [...keep, id]),
  }
}

function BrandPicker({
  choice,
  allowed,
  used,
  effectiveAt,
  extraSlotOffer,
  currency,
  onBuySlots,
}: {
  choice: BrandChoice
  allowed: number
  used: number
  effectiveAt: string | null
  extraSlotOffer: { slots: number; priceCents: number } | null
  currency: string | null
  onBuySlots: (slots: number) => void
}) {
  const excedente = Math.max(0, used - allowed)

  return (
    <div className="mt-4 rounded-[12px] border border-border-soft">
      <div className="px-4 py-3 border-b border-border-soft">
        <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
          Escolha as {int(allowed)} marcas que continuam
        </div>
        <div className="text-[12.5px] text-ink-muted mt-0.5 leading-relaxed">
          {excedente === 1 ? "A outra é arquivada" : `As outras ${int(excedente)} são arquivadas`}
          {effectiveAt ? ` em ${day(effectiveAt)}` : ""}.
          O histórico fica salvo; para reativar uma delas depois é preciso ter slot livre.
        </div>
      </div>

      {extraSlotOffer && (
        <button
          onClick={() => onBuySlots(extraSlotOffer.slots)}
          className="w-full text-left px-4 py-3 border-b border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
        >
          <div className="text-[13px]" style={{ color: "var(--color-teal-500)" }}>
            Manter todas as {int(used)} marcas
          </div>
          <div className="text-[12.5px] text-ink-muted mt-0.5">
            Acrescenta {int(extraSlotOffer.slots)} marca(s) extra por{" "}
            {money(extraSlotOffer.priceCents, currency)}/mês. Nenhuma marca é arquivada.
          </div>
        </button>
      )}

      <div className="max-h-52 overflow-y-auto">
        {choice.loading && <div className="px-4 py-3 text-[12.5px] text-ink-muted">Carregando marcas…</div>}
        {choice.brands.map((b) => {
          const marcada = choice.keep.includes(b.tenantBrandId)
          const cheio = !marcada && choice.keep.length >= allowed
          return (
            <label
              key={b.tenantBrandId}
              className={`flex items-center gap-2.5 px-4 py-2 text-[13px] ${cheio ? "opacity-50" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={marcada}
                disabled={cheio}
                onChange={() => choice.toggle(b.tenantBrandId)}
                className="w-4 h-4"
                style={{ accentColor: "var(--color-teal-500)" }}
              />
              <span className="flex-1 truncate" style={{ color: "var(--ink)" }}>
                {b.displayName ?? b.brandName}
              </span>
              <span className="text-[12px] text-ink-muted shrink-0">
                {b.status === "Paused" ? "pausada" : `${int(b.videoCount30d)} vídeos/30d`}
              </span>
            </label>
          )
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-border-soft text-[12.5px] text-ink-muted">
        {choice.keep.length} de {allowed} selecionadas
      </div>
    </div>
  )
}

function MoneyRow({ label, hint, value, strong }: { label: string; hint: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <div style={{ color: "var(--ink)" }}>{label}</div>
        <div className="text-[12px] text-ink-muted mt-0.5">{hint}</div>
      </div>
      <span className={`font-mono-zoe ${strong ? "text-[15px] font-semibold" : ""}`} style={{ color: "var(--ink)" }}>
        {value}
      </span>
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
