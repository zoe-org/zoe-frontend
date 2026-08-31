import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

// Assinatura projetada do Stripe (D7: lá é a verdade, aqui é projeção). Só leitura:
// trocar de plano acontece no Stripe, e o webhook projeta de volta.

export type SubscriptionStatus = "Trialing" | "Active" | "PastDue" | "Canceled"

export type Subscription = {
  planSlug: string
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  quotaMinutes: number
  brandSlots: number
  extraBrandSlots: number
  /** Preço do minuto excedente DESTA assinatura — não uma constante (grandfathering). */
  overageCentsPerMinute: number
  /** Null = sem teto estrutural (Enterprise). */
  tierCeilingMinutes: number | null
  trialEndsAt: string | null
  /** Acesso degradado por cancelamento. O dado continua de pé. */
  readOnly: boolean
  asOf: string
}

/** Zero em `brandSlots` e `quotaMinutes` significa ILIMITADO / pay-as-you-go, não vazio. */
export type PlanOption = {
  slug: string
  quotaMinutes: number
  brandSlots: number
  tierCeilingMinutes: number | null
  overageCentsPerMinute: number
  tierFeatures: string[]
  /** Null = sob consulta (Enterprise) ou ambiente sem Stripe. Nunca zero para "sem preço". */
  priceCents: number | null
  sellsExtraBrandSlots: boolean
  isCurrent: boolean
}

export type BillingPlans = {
  plans: PlanOption[]
  extraBrandSlotPriceCents: number | null
  currency: string | null
  /** Falso = sem Stripe neste ambiente. Os planos aparecem, a troca não. */
  billingEnabled: boolean
  currentPlanSlug: string | null
  currentExtraBrandSlots: number
}

export type ChangeSubscriptionInput = {
  planSlug: string
  extraBrandSlots?: number
  /** Só na assinatura inicial. Omitido = com teste; a API recusa o segundo trial do mesmo usuário. */
  withTrial?: boolean
}

/** Código de erro do D8: o usuário já consumiu o período de teste. */
export const TRIAL_ALREADY_USED = "trial_already_used"

export const billingApi = {
  /** Preço vem daqui, nunca de constante no frontend — ver GetBillingPlansQuery. */
  plans: (opts?: { signal?: AbortSignal }): Promise<BillingPlans> =>
    apiClient.get("/api/billing/plans", { signal: opts?.signal }),
  start: (input: ChangeSubscriptionInput): Promise<{ subscriptionId: string; status: string }> =>
    apiClient.post("/api/billing/subscription", input),
  change: (input: ChangeSubscriptionInput): Promise<{ subscriptionId: string; status: string }> =>
    apiClient.put("/api/billing/subscription", input),
  portal: (returnUrl: string): Promise<{ url: string }> =>
    apiClient.post("/api/billing/portal", { returnUrl }),
  /**
   * Null quando o tenant ainda não assinou. A API responde 204 nesse caso, e o
   * cliente devolve `undefined` — que o react-query recusa como dado de query.
   */
  subscription: (opts?: { signal?: AbortSignal }): Promise<Subscription | null> =>
    apiClient
      .get<Subscription | undefined>("/api/billing/subscription", { signal: opts?.signal })
      .then((s) => s ?? null),
}

/** Pedido feito ao provedor e ainda não confirmado pelo webhook. */
export type PendingProjection = { planSlug: string; since: number }

/** Janela de espera antes de desistir do repique. */
export const PROJECTION_TIMEOUT_MS = 45_000
const PROJECTION_POLL_MS = 2_000

/**
 * Intervalo de repique como FUNÇÃO: ela roda no agendamento da query, fora do render,
 * onde consultar o relógio é legítimo. Calculado em render seria impuro — e o
 * intervalo passaria a depender do dado que ele mesmo busca.
 */
function pollWhilePending<T>(
  pending: PendingProjection | null | undefined,
  arrived: (data: T | undefined) => boolean,
) {
  if (!pending) return false as const

  return (query: { state: { data?: T } }) => {
    if (arrived(query.state.data)) return false as const
    if (Date.now() - pending.since > PROJECTION_TIMEOUT_MS) return false as const
    return PROJECTION_POLL_MS
  }
}

/**
 * A projeção é assíncrona: o endpoint responde quando o STRIPE aceita, e a linha só
 * existe aqui quando o webhook chega. Invalidar uma vez, no retorno da mutação, refaz
 * a busca cedo demais e a tela congela no estado antigo.
 */
export function useBillingPlans(pending?: PendingProjection | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["billing-plans", activeTenantId],
    queryFn: ({ signal }) => billingApi.plans({ signal }),
    enabled: Boolean(activeTenantId),
    staleTime: pending ? 0 : 5 * 60_000,
    refetchInterval: pollWhilePending<BillingPlans>(
      pending,
      (d) => d?.currentPlanSlug === pending?.planSlug,
    ),
  })
}

/**
 * Assinar e trocar de plano. A resposta é o Stripe falando; a projeção chega pelo
 * webhook (D7), então invalidamos e deixamos o refetch mostrar o estado real em vez
 * de escrever um otimista que pode não se confirmar.
 */
export function useSubscriptionMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["billing-subscription", activeTenantId] })
    qc.invalidateQueries({ queryKey: ["billing-plans", activeTenantId] })
    qc.invalidateQueries({ queryKey: ["usage-meter", activeTenantId] })
  }
  return {
    start: useMutation({ mutationFn: billingApi.start, onSuccess: invalidate }),
    change: useMutation({ mutationFn: billingApi.change, onSuccess: invalidate }),
    portal: useMutation({ mutationFn: billingApi.portal }),
  }
}

export function useSubscription(pending?: PendingProjection | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["billing-subscription", activeTenantId],
    queryFn: ({ signal }) => billingApi.subscription({ signal }),
    enabled: Boolean(activeTenantId),
    staleTime: pending ? 0 : 5 * 60_000,
    refetchInterval: pollWhilePending<Subscription | null>(
      pending,
      (d) => d?.planSlug === pending?.planSlug && !d?.readOnly,
    ),
  })
}
