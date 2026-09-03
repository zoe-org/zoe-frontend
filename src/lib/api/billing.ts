import { useCallback, useEffect, useRef, useState } from "react"
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
  /**
   * Fim do acesso por cancelamento já agendado. Null = sem saída marcada.
   *
   * Separado de `readOnly` de propósito: aqui o cliente pediu para sair e AINDA tem
   * tudo. O status segue "Active" até a data chegar, então este é o único campo que
   * distingue "cancelei" de "não aconteceu nada".
   */
  cancelAt: string | null
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
  /**
   * Chave da tentativa, gerada no clique. O provedor cacheia o resultado por 24h,
   * inclusive erro: sem chave nova, uma falha já corrigida volta do cache.
   */
  idempotencyKey?: string
}

/** Uma por clique. Reenvio da mesma tentativa reusa; clique novo gera outra. */
export const newAttemptKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Código de erro do D8: o usuário já consumiu o período de teste. */
export const TRIAL_ALREADY_USED = "trial_already_used"

/** Assinatura paga recusada por falta de cartão. */
export const PAYMENT_METHOD_REQUIRED = "payment_method_required"

/** `hasPaymentMethod` null = não deu para saber (sem provedor ou provedor fora do ar). */
export type PaymentMethodStatus = {
  hasCustomer: boolean
  hasPaymentMethod: boolean | null
}

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
  paymentMethod: (opts?: { signal?: AbortSignal }): Promise<PaymentMethodStatus> =>
    apiClient.get("/api/billing/payment-method", { signal: opts?.signal }),
  /** Plano pago: devolve a URL da tela de pagamento do provedor. */
  checkout: (input: ChangeSubscriptionInput): Promise<{ url: string }> =>
    apiClient.post("/api/billing/checkout", input),
  /** Puxa a assinatura do provedor quando o webhook não chegou. */
  sync: (): Promise<{ synced: boolean; planSlug: string | null }> =>
    apiClient.post("/api/billing/sync"),
  /**
   * Null quando o tenant ainda não assinou. A API responde 204 nesse caso, e o
   * cliente devolve `undefined` — que o react-query recusa como dado de query.
   */
  subscription: (opts?: { signal?: AbortSignal }): Promise<Subscription | null> =>
    apiClient
      .get<Subscription | undefined>("/api/billing/subscription", { signal: opts?.signal })
      .then((s) => s ?? null),
}

/**
 * Pedido feito ao provedor e ainda não confirmado pelo webhook.
 *
 * Carrega `extraBrandSlots` porque comprar marca extra não muda o plano: comparar só
 * o slug dava a espera por encerrada no primeiro refetch, e o número de marcas na
 * tela continuava o antigo.
 */
export type PendingProjection = { planSlug: string; extraBrandSlots: number; since: number }

/** Janela de espera antes de desistir do repique. */
export const PROJECTION_TIMEOUT_MS = 45_000
const PROJECTION_POLL_MS = 2_000

/** Prazo do socorro: se o provedor foi consultado e nada chegou, a espera virou falha. */
const SYNC_GRACE_MS = 8_000

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
      (d) =>
        d?.currentPlanSlug === pending?.planSlug &&
        d?.currentExtraBrandSlots === pending?.extraBrandSlots,
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
    checkout: useMutation({ mutationFn: billingApi.checkout }),
    sync: useMutation({ mutationFn: billingApi.sync, onSuccess: invalidate }),
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
      (d) =>
        d?.planSlug === pending?.planSlug &&
        d?.extraBrandSlots === pending?.extraBrandSlots &&
        !d?.readOnly,
    ),
  })
}

/**
 * Em que ponto está a espera pela projeção.
 * `syncing` = o webhook não chegou a tempo e estamos perguntando ao provedor.
 * `stale` = nem o provedor resolveu; a espera acabou e vira erro com saída.
 */
export type ProjectionPhase = "waiting" | "syncing" | "stale"

/**
 * Dá fim à espera pela projeção.
 *
 * <p>O webhook continua sendo o caminho normal. Isto existe porque ele é entrega de
 * rede: quando não chega, a tela ficava girando para sempre e o cliente concluía que
 * o botão não funciona — foi exatamente o que aconteceu com upgrade e downgrade.
 * No estouro puxamos do provedor (o mesmo socorro do retorno do checkout) e, se nem
 * assim vier, o cliente vê um erro com botão em vez de um spinner eterno.</p>
 */
export function useProjectionWatch(awaiting: PendingProjection | null, arrived: boolean) {
  const { sync } = useSubscriptionMutations()

  /**
   * Socorro em curso, carimbado com o `since` do pedido que o motivou.
   *
   * Escrito só de callback assíncrono — timer ou desfecho da mutação —, nunca do corpo
   * de um efeito. E é o carimbo que dispensa um efeito de reset: pedido novo tem
   * `since` novo, então a fase volta a "waiting" por derivação, sem render extra.
   */
  const [rescue, setRescue] = useState<{ since: number; phase: "syncing" | "stale" } | null>(null)

  const since = awaiting?.since ?? null
  const esperado = awaiting?.planSlug ?? null
  const phase: ProjectionPhase = rescue != null && rescue.since === since ? rescue.phase : "waiting"

  // A identidade da mutação muda a cada render; o timer abaixo depende só do relógio
  // do pedido, e reagendá-lo a cada render nunca deixaria o prazo vencer.
  const syncRef = useRef(sync)
  useEffect(() => {
    syncRef.current = sync
  })

  const puxarDoProvedor = useCallback(() => {
    if (since == null) return
    setRescue({ since, phase: "syncing" })
    syncRef.current.mutate(undefined, {
      // O provedor devolve o plano que ELE tem. Bateu com o pedido: a projeção acabou
      // de ser escrita e o refetch já vem com ela — acusar falha aqui seria mentira.
      onSuccess: (res) => {
        if (!res.synced || res.planSlug !== esperado) setRescue({ since, phase: "stale" })
      },
      onError: () => setRescue({ since, phase: "stale" }),
    })
  }, [since, esperado])

  useEffect(() => {
    if (since == null || arrived) return
    const restante = Math.max(0, PROJECTION_TIMEOUT_MS - (Date.now() - since))
    const timer = setTimeout(puxarDoProvedor, restante)
    return () => clearTimeout(timer)
  }, [since, arrived, puxarDoProvedor])

  // Rede de segurança: o provedor respondeu o que esperávamos e a projeção ainda não
  // apareceu. Sem isto, a espera trocaria um spinner eterno por outro.
  useEffect(() => {
    if (since == null || arrived || phase !== "syncing") return
    const timer = setTimeout(() => setRescue({ since, phase: "stale" }), SYNC_GRACE_MS)
    return () => clearTimeout(timer)
  }, [since, arrived, phase])

  return { phase, retry: puxarDoProvedor }
}

/**
 * Sem repique: o cliente volta do portal por navegação, então o refetch de foco do
 * react-query já traz o estado novo.
 */
export function usePaymentMethod() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["billing-payment-method", activeTenantId],
    queryFn: ({ signal }) => billingApi.paymentMethod({ signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 30_000,
  })
}
