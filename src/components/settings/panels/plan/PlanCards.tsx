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

type Badge = { label: string; tone: "current" | "muted" }

/** Selo e botão de um card, decididos juntos para não se contradizerem. */
type CardState = { badge: Badge | null; highlight: boolean; action: Action }

/** Em teste, a assinatura não é um plano: todo card é uma escolha de assinatura. */
const isTrial = (sub: Subscription | null) => sub?.status === "Trialing" && !sub.readOnly

/**
 * Selo e rótulo do botão. Classifica como a API: pagar mais por mês é upgrade. A decisão
 * real (inclusive a data em que vale) vem da prévia do modal.
 *
 * <p>Cada aba assina o que mostra: um card do Intelligence leva a "só Intelligence", e a
 * combinação dos dois módulos mora na aba Full Platform. Antes o card mantinha o outro
 * módulo, e quem trocava de aba acabava com os dois sem ter pedido.</p>
 *
 * @param partOfCurrent o tier do card faz parte da assinatura, junto com outro módulo.
 */
function cardFor(ctx: CardContext, target: PlanSelection, partOfCurrent: boolean): CardState {
  const { data, sub, reativando } = ctx
  const assinar = { label: "Assinar", kind: "primary" as const, target }

  if (reativando)
    return {
      badge: partOfCurrent ? { label: "Plano anterior", tone: "muted" } : null,
      highlight: false,
      action: { ...assinar, label: partOfCurrent ? "Reativar" : "Assinar" },
    }
  if (!sub || isTrial(sub)) return { badge: null, highlight: false, action: assinar }

  const current = currentSelection(data)
  const scheduled = sub.scheduledChange

  if (sameSelection(current, target))
    return {
      badge: { label: "Plano atual", tone: "current" },
      highlight: true,
      // Com downgrade agendado, o card do plano atual é o caminho para desistir dele.
      action: scheduled
        ? { label: "Manter este plano", kind: "primary", target: current }
        : { label: "Plano atual", kind: "disabled", target },
    }

  const badge: Badge | null = partOfCurrent ? { label: "No seu plano atual", tone: "muted" } : null

  if (
    scheduled &&
    scheduled.planSlug === target.planSlug &&
    scheduled.operationsPlanSlug === target.operationsPlanSlug &&
    scheduled.extraBrandSlots === target.extraBrandSlots
  )
    return { badge, highlight: false, action: { label: `Agendado para ${day(scheduled.effectiveAt)}`, kind: "disabled", target } }

  // Sai um módulo que a assinatura tem: não é subir nem descer no mesmo trilho, é trocar.
  const saiModulo =
    (current.planSlug != null && target.planSlug == null) ||
    (current.operationsPlanSlug != null && target.operationsPlanSlug == null)

  const upgrade = classify(current, target, data) === "upgrade"
  const label = saiModulo ? "Trocar para este" : upgrade ? "Fazer upgrade" : "Fazer downgrade"

  return { badge, highlight: false, action: { label, kind: upgrade ? "primary" : "ghost", target } }
}

// ── Intelligence ─────────────────────────────────────────────────────────

export function IntelligenceGrid({ ctx }: { ctx: CardContext }) {
  const { data } = ctx

  return (
    <div className="grid gap-4 @md:grid-cols-2 @4xl:grid-cols-4">
      {data.plans.map((plan) => {
        const assinado = Boolean(ctx.sub) && !ctx.reativando && !isTrial(ctx.sub)
        // Só Intelligence: a combinação com Operations é escolha da aba Full Platform.
        const target: PlanSelection = {
          planSlug: plan.slug,
          operationsPlanSlug: null,
          extraBrandSlots: plan.sellsExtraBrandSlots && assinado ? data.currentExtraBrandSlots : 0,
        }
        const state = cardFor(ctx, target, plan.isCurrent)

        return (
          <PlanShell
            key={plan.slug}
            name={planName(plan.slug)}
            pitch={INTELLIGENCE_PITCH[plan.slug] ?? ""}
            priceCents={plan.priceCents}
            currency={data.currency}
            badge={state.badge}
            highlight={state.highlight}
            footer={
              plan.slug === "enterprise" ? (
                <SalesButton subject="Plano Enterprise" />
              ) : (
                <ActionButton
                  ctx={ctx}
                  action={state.action}
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
          // Só Operations: a combinação com Intelligence é escolha da aba Full Platform.
          const target: PlanSelection = { planSlug: null, operationsPlanSlug: plan.slug, extraBrandSlots: 0 }
          const state = cardFor(ctx, target, plan.isCurrent)

          return (
            <PlanShell
              key={plan.slug}
              name={planName(plan.slug)}
              pitch={OPERATIONS_PITCH[plan.slug] ?? ""}
              priceCents={plan.priceCents}
              currency={data.currency}
              badge={state.badge}
              highlight={state.highlight}
              footer={
                <ActionButton
                  ctx={ctx}
                  action={state.action}
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
          badge={null}
          highlight={false}
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
          const assinado = Boolean(ctx.sub) && !ctx.reativando && !isTrial(ctx.sub)
          const selection: PlanSelection = {
            planSlug,
            operationsPlanSlug: opsSlug,
            extraBrandSlots: planSlug === "pro" && assinado ? data.currentExtraBrandSlots : 0,
          }
          const full = recurringCents(selection, data)
          const estimate = bundleEstimateCents(selection, data)
          const state = cardFor(
            ctx, selection,
            data.currentPlanSlug === planSlug && data.currentOperationsPlanSlug === opsSlug)

          return (
            <div
              key={planSlug}
              className={`flex items-center gap-4 px-6 py-4 flex-wrap ${i > 0 ? "border-t border-border-soft" : ""}`}
            >
              <div className="flex-1 min-w-[200px]">
                <div className="text-[14px] font-semibold flex items-center gap-2 flex-wrap" style={{ color: "var(--ink)" }}>
                  {planName(planSlug)} + {planName(opsSlug)}
                  {state.badge && <BadgeChip badge={state.badge} />}
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
                  action={state.action}
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
  badge,
  highlight,
  footer,
  children,
}: {
  name: string
  pitch: string
  priceCents: number | null
  currency: string | null
  badge: Badge | null
  highlight: boolean
  footer: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-[14px] border px-5 py-5 flex flex-col"
      style={{
        background: "var(--surface)",
        borderColor: highlight ? "var(--color-teal-500)" : "var(--border-soft)",
      }}
    >
      {badge && (
        <span className="self-start mb-2">
          <BadgeChip badge={badge} />
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

function BadgeChip({ badge }: { badge: Badge }) {
  return (
    <span
      className="inline-block text-[10px] font-semibold rounded-full px-2 py-0.5"
      style={
        badge.tone === "current"
          ? { background: "var(--teal-bg)", color: "var(--color-teal-500)" }
          : { background: "#F3F4F6", color: "#6B7280" }
      }
    >
      {badge.label}
    </span>
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
            : "border border-border-soft hover:bg-hover"
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
      className="w-full h-9 inline-flex items-center justify-center rounded-lg text-[13px] font-medium border border-border-soft hover:bg-hover transition-colors"
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
