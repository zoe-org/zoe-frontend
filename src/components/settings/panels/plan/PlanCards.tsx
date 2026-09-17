import { Check, Info, Loader2, Sparkles } from "lucide-react"
import type { BillingPlans, OperationsPlanOption, PlanOption, PlanSelection, Subscription } from "@/lib/api/billing"
import {
  bundleEstimateCents,
  classify,
  currentSelection,
  percentLabel,
  planName,
  recurringCents,
  sameSelection,
  supportLabel,
} from "@/lib/plans"
import { day, int, money } from "./format"

// Cards das três abas da tela de planos. O que cada plano entrega vem da API
// (PlanCatalog/OperationsPlanCatalog); o preço, do Stripe. Aqui só moram o texto de
// posicionamento e a decisão de qual rótulo o botão mostra.

const INTELLIGENCE_PITCH: Record<string, string> = {
  starter: "Uma marca própria e um concorrente.",
  pro: "Operação de monitoramento com concorrência.",
  max: "Portfólio de marcas e agências, com atendimento prioritário.",
  enterprise: "Volume alto e contrato negociado.",
}

const OPERATIONS_PITCH: Record<string, string> = {
  operations_starter: "Agências começando a operar campanhas com contrato e custódia.",
  operations_pro: "Volume de campanhas, contrato sob medida e taxa menor.",
}

export type CardContext = {
  data: BillingPlans
  sub: Subscription | null
  /** Assinatura cancelada: todo card volta a ser assinável. */
  reativando: boolean
  disabled: boolean
  busyKey: string | null
  /** Sem assinatura (ou reativando): abre assinatura nova com esta combinação. */
  onStart: (selection: PlanSelection, key: string) => void
  /** Com assinatura: abre o modal de confirmação da troca. */
  onChange: (selection: PlanSelection) => void
}

type Action = { label: string; kind: "primary" | "ghost" | "disabled"; target: PlanSelection }

/**
 * Rótulo do botão. Classifica como a API: pagar mais por mês é upgrade. A decisão real
 * (inclusive a data em que vale) vem da prévia do modal.
 */
function actionFor(ctx: CardContext, target: PlanSelection, isCurrent: boolean, moduleMissing: boolean): Action {
  const { data, sub, reativando } = ctx

  if (reativando) return { label: isCurrent ? "Reativar" : "Assinar", kind: "primary", target }
  if (!sub) return { label: "Assinar", kind: "primary", target }

  const current = currentSelection(data)
  const scheduled = sub.scheduledChange

  if (isCurrent) {
    // Com downgrade agendado, o card do plano atual é o caminho para desistir dele.
    return scheduled
      ? { label: "Manter este plano", kind: "primary", target: current }
      : { label: "Plano atual", kind: "disabled", target }
  }

  if (
    scheduled &&
    scheduled.planSlug === target.planSlug &&
    scheduled.operationsPlanSlug === target.operationsPlanSlug
  )
    return { label: `Agendado para ${day(scheduled.effectiveAt)}`, kind: "disabled", target }

  if (sameSelection(current, target)) return { label: "Plano atual", kind: "disabled", target }

  return classify(current, target, data) === "upgrade"
    ? { label: moduleMissing ? "Adicionar ao plano" : "Fazer upgrade", kind: "primary", target }
    : { label: "Fazer downgrade", kind: "ghost", target }
}

// ── Intelligence ─────────────────────────────────────────────────────────

export function IntelligenceGrid({ ctx }: { ctx: CardContext }) {
  const { data } = ctx

  return (
    <div className="grid gap-4 @md:grid-cols-2 @4xl:grid-cols-4">
      {data.plans.map((plan) => {
        const isCurrent = plan.isCurrent
        const target: PlanSelection = {
          planSlug: plan.slug,
          operationsPlanSlug: ctx.sub && !ctx.reativando ? data.currentOperationsPlanSlug : null,
          extraBrandSlots: plan.sellsExtraBrandSlots && ctx.sub && !ctx.reativando ? data.currentExtraBrandSlots : 0,
        }

        return (
          <PlanShell
            key={plan.slug}
            name={planName(plan.slug)}
            pitch={INTELLIGENCE_PITCH[plan.slug] ?? ""}
            priceCents={plan.priceCents}
            currency={data.currency}
            isCurrent={isCurrent}
            reativando={ctx.reativando}
            footer={
              plan.slug === "enterprise" ? (
                <SalesButton subject="Plano Enterprise" />
              ) : (
                <ActionButton
                  ctx={ctx}
                  action={actionFor(ctx, target, isCurrent, data.currentPlanSlug == null)}
                  busy={ctx.busyKey === plan.slug}
                  busyKey={plan.slug}
                />
              )
            }
          >
            <IntelligenceRows plan={plan} />
          </PlanShell>
        )
      })}
    </div>
  )
}

function IntelligenceRows({ plan }: { plan: PlanOption }) {
  const has = (code: string) => plan.tierFeatures.includes(code)
  return (
    <>
      <Row label="Vídeo-minutos" value={plan.quotaMinutes > 0 ? int(plan.quotaMinutes) : "Pay-as-you-go"} />
      <Row label="Marcas" value={plan.brandSlots > 0 ? int(plan.brandSlots) : "Ilimitado"} />
      <Row label="Share of Voice" value={<Mark on={has("sov")} />} />
      <Row label="Relatórios" value={<Mark on={has("reports")} />} />
      <Row label="Janela de histórico" value={`${plan.historyWindowDays} dias`} />
      <Row label="Verificação de marca" value={`até ${plan.brandVerificationSlaHours}h`} />
      <Row label="Suporte" value={supportLabel(plan.supportResponseBusinessHours).replace("até ", "")} />
      <Row label="Onboarding assistido" value={<Mark on={plan.assistedOnboarding} />} />
    </>
  )
}

// ── Operations ───────────────────────────────────────────────────────────

export function OperationsGrid({ ctx }: { ctx: CardContext }) {
  const { data } = ctx

  return (
    <div className="space-y-4">
      <div className="grid gap-4 @md:grid-cols-2 @4xl:grid-cols-3">
        {data.operationsPlans.map((plan) => {
          const target: PlanSelection = {
            planSlug: ctx.sub && !ctx.reativando ? data.currentPlanSlug : null,
            operationsPlanSlug: plan.slug,
            extraBrandSlots: ctx.sub && !ctx.reativando ? data.currentExtraBrandSlots : 0,
          }

          return (
            <PlanShell
              key={plan.slug}
              name={planName(plan.slug)}
              pitch={OPERATIONS_PITCH[plan.slug] ?? ""}
              priceCents={plan.priceCents}
              currency={data.currency}
              isCurrent={plan.isCurrent}
              reativando={ctx.reativando}
              footer={
                <ActionButton
                  ctx={ctx}
                  action={actionFor(ctx, target, plan.isCurrent, data.currentOperationsPlanSlug == null)}
                  busy={ctx.busyKey === plan.slug}
                  busyKey={plan.slug}
                />
              }
            >
              <OperationsRows plan={plan} />
            </PlanShell>
          )
        })}

        <PlanShell
          name="Operations Enterprise"
          pitch="Volume alto, taxa e contrato negociados."
          priceCents={null}
          currency={data.currency}
          isCurrent={false}
          reativando={false}
          footer={<SalesButton subject="Operations Enterprise" />}
        >
          <Row label="Campanhas por mês" value="Ilimitadas" />
          <Row label="Taxa sobre a custódia" value="a partir de 3%" />
          <Row label="Cláusulas próprias" value={<Mark on />} />
          <Row label="NF automática da taxa" value={<Mark on />} />
          <Row label="Relatórios" value={<Mark on />} />
          <Row label="Suporte" value="4h úteis" />
        </PlanShell>
      </div>

      <div className="flex items-start gap-2.5 text-[12.5px] text-ink-muted leading-relaxed">
        <Info className="w-[15px] h-[15px] shrink-0 mt-0.5" style={{ color: "var(--color-teal-500)" }} />
        <span>
          A taxa incide sobre o valor que passa pela custódia e é paga pela marca, por fora do
          valor do criador. Ela fica gravada no contrato quando ele é criado: trocar de plano vale
          para os contratos seguintes, não para os que já existem.
        </span>
      </div>
    </div>
  )
}

function OperationsRows({ plan }: { plan: OperationsPlanOption }) {
  const has = (code: string) => plan.features.includes(code)
  return (
    <>
      <Row label="Campanhas por mês" value={plan.monthlyCampaignLimit == null ? "Ilimitadas" : int(plan.monthlyCampaignLimit)} />
      <Row label="Taxa sobre a custódia" value={percentLabel(plan.takeRateBps)} />
      <Row label="Cláusulas próprias" value={<Mark on={has("custom_contracts")} />} />
      <Row label="NF automática da taxa" value={<Mark on={has("auto_invoice")} />} />
      <Row label="Relatórios" value={<Mark on={has("reports")} />} />
      <Row label="Suporte" value={supportLabel(plan.supportResponseBusinessHours).replace("até ", "")} />
    </>
  )
}

// ── Full Platform ────────────────────────────────────────────────────────

/**
 * O pacote não é um plano: é Intelligence pago + Operations Pro na mesma assinatura, com
 * o cupom aplicado pelo provedor (ADR-045 D5). Por isso cada linha abre a troca daquela
 * combinação, e o valor exibido é estimativa — o exato vem da prévia.
 */
export function BundleGrid({ ctx }: { ctx: CardContext }) {
  const { data } = ctx
  const opsSlug = data.bundle.operationsPlanSlug
  const percent = data.bundle.percentOff

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-border-soft px-6 py-5" style={{ background: "var(--surface)" }}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />
          <div className="eyebrow">Full Platform</div>
        </div>
        <div className="font-display mt-2" style={{ fontSize: 22, color: "var(--ink)" }}>
          Intelligence e Operations na mesma assinatura
          {percent != null && <> com {percent}% de desconto</>}
        </div>
        <p className="text-[13px] text-ink-muted mt-2 mb-0 max-w-165 leading-relaxed">
          Vale para qualquer plano pago do Intelligence junto com o {planName(opsSlug)}. Uma fatura só,
          e o desconto é aplicado na mensalidade enquanto os dois estiverem na assinatura.
          {percent == null && " O cupom do pacote não está configurado neste ambiente."}
        </p>
      </div>

      <div className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
        {data.bundle.eligiblePlanSlugs.map((planSlug, i) => {
          const selection: PlanSelection = {
            planSlug,
            operationsPlanSlug: opsSlug,
            extraBrandSlots:
              planSlug === "pro" && ctx.sub && !ctx.reativando ? data.currentExtraBrandSlots : 0,
          }
          const full = recurringCents(selection, data)
          const estimate = bundleEstimateCents(selection, data)
          const isCurrent =
            !ctx.reativando && data.currentPlanSlug === planSlug && data.currentOperationsPlanSlug === opsSlug

          return (
            <div
              key={planSlug}
              className={`flex items-center gap-4 px-6 py-4 flex-wrap ${i > 0 ? "border-t border-border-soft" : ""}`}
            >
              <div className="flex-1 min-w-[200px]">
                <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                  {planName(planSlug)} + {planName(opsSlug)}
                </div>
                <div className="text-[12.5px] text-ink-muted mt-0.5">
                  {INTELLIGENCE_PITCH[planSlug]}
                </div>
              </div>
              <div className="text-right">
                {estimate != null ? (
                  <>
                    {full != null && full !== estimate && (
                      <div className="text-[12px] text-ink-muted line-through font-mono-zoe">
                        {money(full, data.currency)}
                      </div>
                    )}
                    <div className="font-display" style={{ fontSize: 18, color: "var(--ink)" }}>
                      {money(estimate, data.currency)}
                      <span className="text-[12px] text-ink-muted">/mês</span>
                    </div>
                  </>
                ) : (
                  <span className="text-[13px] text-ink-muted">Sob consulta</span>
                )}
              </div>
              <div className="w-full @md:w-48">
                <ActionButton
                  ctx={ctx}
                  action={actionFor(ctx, selection, isCurrent, false)}
                  busy={ctx.busyKey === `bundle-${planSlug}`}
                  busyKey={`bundle-${planSlug}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-[12px] text-ink-muted">
        Valores de tabela com o desconto estimado. O valor exato, com o proporcional do período, aparece
        na confirmação.
      </div>
    </div>
  )
}

// ── Peças ────────────────────────────────────────────────────────────────

function PlanShell({
  name,
  pitch,
  priceCents,
  currency,
  isCurrent,
  reativando,
  footer,
  children,
}: {
  name: string
  pitch: string
  priceCents: number | null
  currency: string | null
  isCurrent: boolean
  reativando: boolean
  footer: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-[14px] border px-5 py-5 flex flex-col"
      style={{
        background: "var(--surface)",
        borderColor: isCurrent && !reativando ? "var(--color-teal-500)" : "var(--border-soft)",
      }}
    >
      {isCurrent && (
        <span
          className="self-start text-[10px] font-semibold rounded-full px-2 py-0.5 mb-2"
          style={
            reativando
              ? { background: "#F3F4F6", color: "#6B7280" }
              : { background: "var(--teal-bg)", color: "var(--color-teal-500)" }
          }
        >
          {reativando ? "Plano anterior" : "Plano atual"}
        </span>
      )}

      <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
        {name}
      </div>
      <div className="text-[12.5px] text-ink-muted mt-1 min-h-[34px] leading-relaxed">{pitch}</div>

      <div className="font-display mt-3 mb-4" style={{ fontSize: 24, color: "var(--ink)" }}>
        {priceCents != null ? (
          <>
            {money(priceCents, currency)}
            <span className="text-[13px] text-ink-muted">/mês</span>
          </>
        ) : (
          // Nunca "R$ 0,00": Enterprise é negociado, e ambiente sem Stripe não tem preço.
          <span style={{ fontSize: 18 }} className="text-ink-muted">
            Sob consulta
          </span>
        )}
      </div>

      <dl className="text-[12.5px] space-y-1.5 mb-4">{children}</dl>

      <div className="mt-auto">{footer}</div>
    </div>
  )
}

function ActionButton({
  ctx,
  action,
  busy,
  busyKey,
}: {
  ctx: CardContext
  action: Action
  busy: boolean
  busyKey: string
}) {
  const onClick = () =>
    ctx.sub && !ctx.reativando ? ctx.onChange(action.target) : ctx.onStart(action.target, busyKey)

  return (
    <>
      <button
        onClick={onClick}
        disabled={action.kind === "disabled" || ctx.disabled || busy}
        className={`w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 ${
          action.kind === "primary"
            ? "text-white"
            : "border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"
        }`}
        style={action.kind === "primary" ? { background: "var(--color-teal-500)" } : undefined}
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {action.label}
      </button>
      {ctx.reativando && <div className="text-[11.5px] text-ink-muted mt-2 text-center">Reativa o acesso</div>}
    </>
  )
}

function SalesButton({ subject }: { subject: string }) {
  return (
    <a
      href={`mailto:comercial@zoe.com.br?subject=${encodeURIComponent(subject)}`}
      className="w-full h-9 inline-flex items-center justify-center rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
    >
      Falar com vendas
    </a>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono-zoe m-0 text-right" style={{ color: "var(--ink)" }}>
        {value}
      </dd>
    </div>
  )
}

function Mark({ on }: { on: boolean }) {
  return on ? (
    <Check className="w-3.5 h-3.5 inline" style={{ color: "var(--color-pos)" }} strokeWidth={2.6} />
  ) : (
    <span className="text-ink-muted-2">—</span>
  )
}
