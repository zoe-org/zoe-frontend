import { useQuery } from "@tanstack/react-query"
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

export const billingApi = {
  /**
   * Null quando o tenant ainda não assinou. A API responde 204 nesse caso, e o
   * cliente devolve `undefined` — que o react-query recusa como dado de query.
   */
  subscription: (opts?: { signal?: AbortSignal }): Promise<Subscription | null> =>
    apiClient
      .get<Subscription | undefined>("/api/billing/subscription", { signal: opts?.signal })
      .then((s) => s ?? null),
}

export function useSubscription() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["billing-subscription", activeTenantId],
    queryFn: ({ signal }) => billingApi.subscription({ signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 5 * 60_000,
  })
}
