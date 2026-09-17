import type { BillingPlans, PlanSelection, Subscription } from "@/lib/api/billing"

// Regras puras da tela de planos. A classificação espelha a da API
// (SubscriptionChangePlanner): aqui ela só escolhe o rótulo do botão — quem decide o que
// acontece é a prévia que o modal busca antes de confirmar.

/** Parâmetro de URL que abre a tela de planos numa aba (`intelligence`, `operations`, `pacote`). */
export const PLAN_TAB_PARAM = "plano"

export const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  max: "Max",
  enterprise: "Enterprise",
  operations_starter: "Operations Starter",
  operations_pro: "Operations Pro",
}

export const planName = (slug: string | null | undefined) => (slug ? (PLAN_NAMES[slug] ?? slug) : "—")

export const FEATURE_LABELS: Record<string, string> = {
  sov: "Share of Voice",
  reports: "Relatórios",
  custom_contracts: "Cláusulas próprias no contrato",
  auto_invoice: "Nota fiscal automática da taxa",
  unlimited_campaigns: "Campanhas ilimitadas",
}

const INTELLIGENCE_LADDER = ["starter", "pro", "max", "enterprise"]
const OPERATIONS_LADDER = ["operations_starter", "operations_pro"]

export function currentSelection(data: BillingPlans): PlanSelection {
  return {
    planSlug: data.currentPlanSlug,
    operationsPlanSlug: data.currentOperationsPlanSlug,
    extraBrandSlots: data.currentExtraBrandSlots,
  }
}

export function selectionFromSubscription(sub: Subscription): PlanSelection {
  return {
    planSlug: sub.planSlug,
    operationsPlanSlug: sub.operationsPlanSlug,
    extraBrandSlots: sub.extraBrandSlots,
  }
}

export const sameSelection = (a: PlanSelection, b: PlanSelection) =>
  a.planSlug === b.planSlug &&
  a.operationsPlanSlug === b.operationsPlanSlug &&
  a.extraBrandSlots === b.extraBrandSlots

/** "Pro + Operations Pro", "Operations Starter". */
export function describeSelection(sel: Pick<PlanSelection, "planSlug" | "operationsPlanSlug">): string {
  const parts = [sel.planSlug, sel.operationsPlanSlug].filter(Boolean).map((s) => planName(s))
  return parts.length > 0 ? parts.join(" + ") : "Nenhum plano"
}

/** Mensalidade de tabela, sem desconto. Null quando falta preço de alguma linha. */
export function recurringCents(sel: PlanSelection, data: BillingPlans): number | null {
  let total = 0

  if (sel.planSlug) {
    const price = data.plans.find((p) => p.slug === sel.planSlug)?.priceCents
    if (price == null) return null
    total += price
  }

  if (sel.operationsPlanSlug) {
    const price = data.operationsPlans.find((p) => p.slug === sel.operationsPlanSlug)?.priceCents
    if (price == null) return null
    total += price
  }

  if (sel.extraBrandSlots > 0) {
    if (data.extraBrandSlotPriceCents == null) return null
    total += data.extraBrandSlotPriceCents * sel.extraBrandSlots
  }

  return total
}

/** Upgrade é pagar mais por mês; sem preço, qualquer subida na escada é upgrade. */
export function classify(current: PlanSelection, target: PlanSelection, data: BillingPlans): "upgrade" | "downgrade" {
  const from = recurringCents(current, data)
  const to = recurringCents(target, data)
  if (from != null && to != null && from !== to) return to > from ? "upgrade" : "downgrade"

  const rank = (ladder: string[], slug: string | null) => (slug ? ladder.indexOf(slug) + 1 : 0)
  const subiu =
    rank(INTELLIGENCE_LADDER, target.planSlug) > rank(INTELLIGENCE_LADDER, current.planSlug) ||
    rank(OPERATIONS_LADDER, target.operationsPlanSlug) > rank(OPERATIONS_LADDER, current.operationsPlanSlug) ||
    target.extraBrandSlots > current.extraBrandSlots

  return subiu ? "upgrade" : "downgrade"
}

/** Pacote Full Platform: Intelligence pago + Operations Pro. */
export const qualifiesForBundle = (sel: Pick<PlanSelection, "planSlug" | "operationsPlanSlug">, data: BillingPlans) =>
  sel.planSlug != null &&
  data.bundle.eligiblePlanSlugs.includes(sel.planSlug) &&
  sel.operationsPlanSlug === data.bundle.operationsPlanSlug

/** Mensalidade estimada com o desconto do pacote. O valor exato vem da prévia do provedor. */
export function bundleEstimateCents(sel: PlanSelection, data: BillingPlans): number | null {
  const total = recurringCents(sel, data)
  if (total == null) return null
  if (!qualifiesForBundle(sel, data) || data.bundle.percentOff == null) return total
  return Math.round(total * (1 - data.bundle.percentOff / 100))
}

/** Prazo de primeira resposta em linguagem de cliente. */
export function supportLabel(businessHours: number): string {
  if (businessHours <= 4) return "até 4h úteis"
  if (businessHours <= 8) return "até 1 dia útil"
  return `até ${Math.ceil(businessHours / 8)} dias úteis`
}

export const percentLabel = (bps: number) =>
  `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
