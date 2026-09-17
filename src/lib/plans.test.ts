import { describe, expect, it } from "vitest"
import type { BillingPlans, PlanOption, OperationsPlanOption } from "@/lib/api/billing"
import {
  bundleEstimateCents,
  classify,
  describeSelection,
  qualifiesForBundle,
  recurringCents,
  supportLabel,
} from "./plans"

const plan = (slug: string, priceCents: number | null): PlanOption => ({
  slug,
  priceCents,
  quotaMinutes: 0,
  brandSlots: 0,
  tierCeilingMinutes: null,
  overageCentsPerMinute: 3.4,
  tierFeatures: [],
  sellsExtraBrandSlots: slug === "pro",
  isCurrent: false,
  historyWindowDays: 30,
  brandVerificationSlaHours: 72,
  supportResponseBusinessHours: 8,
  assistedOnboarding: false,
})

const ops = (slug: string, priceCents: number | null): OperationsPlanOption => ({
  slug,
  priceCents,
  monthlyCampaignLimit: null,
  takeRateBps: 400,
  features: [],
  supportResponseBusinessHours: 8,
  isCurrent: false,
})

const data: BillingPlans = {
  plans: [plan("starter", 125_000), plan("pro", 330_000), plan("max", 590_000), plan("enterprise", null)],
  operationsPlans: [ops("operations_starter", 149_000), ops("operations_pro", 299_000)],
  extraBrandSlotPriceCents: 12_900,
  currency: "brl",
  billingEnabled: true,
  currentPlanSlug: "pro",
  currentOperationsPlanSlug: null,
  currentExtraBrandSlots: 0,
  bundle: { percentOff: 5, eligiblePlanSlugs: ["starter", "pro", "max"], operationsPlanSlug: "operations_pro", isCurrent: false },
}

const sel = (planSlug: string | null, operationsPlanSlug: string | null = null, extraBrandSlots = 0) => ({
  planSlug,
  operationsPlanSlug,
  extraBrandSlots,
})

describe("recurringCents", () => {
  it("soma tier, Operations e marcas extras", () => {
    expect(recurringCents(sel("pro", "operations_pro", 2), data)).toBe(330_000 + 299_000 + 2 * 12_900)
  })

  it("sem preço de alguma linha não inventa total", () => {
    expect(recurringCents(sel("enterprise"), data)).toBeNull()
  })
})

describe("classify", () => {
  it("subir de tier é upgrade e descer é downgrade", () => {
    expect(classify(sel("pro"), sel("max"), data)).toBe("upgrade")
    expect(classify(sel("max"), sel("pro"), data)).toBe("downgrade")
  })

  it("acrescentar Operations é upgrade; tirar é downgrade", () => {
    expect(classify(sel("pro"), sel("pro", "operations_starter"), data)).toBe("upgrade")
    expect(classify(sel("pro", "operations_pro"), sel("pro"), data)).toBe("downgrade")
  })

  it("troca mista decide pela mensalidade", () => {
    // Desce de Max para Starter (-4.650) e sobe para Operations Pro (+2.990): paga menos.
    expect(classify(sel("max"), sel("starter", "operations_pro"), data)).toBe("downgrade")
  })

  it("sem preço usa a escada", () => {
    expect(classify(sel("max"), sel("enterprise"), data)).toBe("upgrade")
    expect(classify(sel("enterprise"), sel("max"), data)).toBe("downgrade")
  })
})

describe("pacote Full Platform", () => {
  it("vale para Intelligence pago com Operations Pro", () => {
    expect(qualifiesForBundle(sel("starter", "operations_pro"), data)).toBe(true)
    expect(qualifiesForBundle(sel("pro", "operations_starter"), data)).toBe(false)
    expect(qualifiesForBundle(sel(null, "operations_pro"), data)).toBe(false)
  })

  it("estimativa aplica o percentual do cupom", () => {
    expect(bundleEstimateCents(sel("pro", "operations_pro"), data)).toBe(Math.round(629_000 * 0.95))
    expect(bundleEstimateCents(sel("pro"), data)).toBe(330_000)
  })
})

describe("rótulos", () => {
  it("descreve a combinação", () => {
    expect(describeSelection(sel("pro", "operations_pro"))).toBe("Pro + Operations Pro")
    expect(describeSelection(sel(null, "operations_starter"))).toBe("Operations Starter")
  })

  it("prazo de suporte", () => {
    expect(supportLabel(4)).toBe("até 4h úteis")
    expect(supportLabel(8)).toBe("até 1 dia útil")
    expect(supportLabel(16)).toBe("até 2 dias úteis")
  })
})
