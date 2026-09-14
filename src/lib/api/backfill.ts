import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

// Cobertura e backfill (ADR-054, WS-4 da api). A contagem de bloqueados é para
// todos; preço e compra, só Owner/Admin.

export type BrandCoverage = {
  tenantBrandId: string
  brandId: string
  visibleCount: number
  blockedCount: number
  blockedFrom: string | null
  blockedTo: string | null
}

export type BackfillOpenCheckout = {
  purchaseId: string
  checkoutUrl: string
  amountCents: number
  createdAt: string
}

export type BackfillOffer = {
  tenantBrandId: string
  brandId: string
  available: boolean
  /** `brand_not_active` · `subscription_required` · `nothing_to_unlock`. */
  reason: string | null
  /** Janela de histórico do tier: a oferta nunca passa dela (D2). */
  windowDays: number
  windowStart: string | null
  windowEnd: string | null
  videoCount: number
  /** Do canal oficial: entram sem custo. */
  ownedCount: number
  billedMinutes: number
  amountCents: number
  currency: string
  floorApplied: boolean
  ceilingApplied: boolean
  /** Pagamento já aberto para a marca: comprar de novo retoma este. */
  openCheckout: BackfillOpenCheckout | null
}

/**
 * `checkout`: redirecionar (ou, no sync, ainda sem confirmação). `completed`: liberado.
 * `expired`: a chave repetida era de compra que não se concluiu.
 */
export type BackfillPurchaseStatus = "checkout" | "completed" | "expired"

export type BackfillCheckout = {
  purchaseId: string
  status: BackfillPurchaseStatus
  checkoutUrl: string | null
  amountCents: number
  videoCount: number
  grantedCount: number
}

export const backfillApi = {
  coverage: (tenantBrandId: string, opts?: { signal?: AbortSignal }): Promise<BrandCoverage> =>
    apiClient.get(`/api/me/brands/${tenantBrandId}/coverage`, { signal: opts?.signal }),
  offer: (tenantBrandId: string, opts?: { signal?: AbortSignal }): Promise<BackfillOffer> =>
    apiClient.get(`/api/me/brands/${tenantBrandId}/backfill`, { signal: opts?.signal }),
  checkout: (tenantBrandId: string, idempotencyKey: string): Promise<BackfillCheckout> =>
    apiClient.post(`/api/me/brands/${tenantBrandId}/backfill/checkout`, { idempotencyKey }),
  /** Confere no provedor as compras pendentes da marca; devolve a mais recente. */
  sync: (tenantBrandId: string): Promise<BackfillCheckout> =>
    apiClient.post(`/api/me/brands/${tenantBrandId}/backfill/sync`, {}),
}

export function useBrandCoverage(tenantBrandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["brand-coverage", activeTenantId, tenantBrandId],
    queryFn: ({ signal }) => backfillApi.coverage(tenantBrandId!, { signal }),
    enabled: Boolean(activeTenantId && tenantBrandId),
    staleTime: 60_000,
  })
}

/** Owner/Admin: para os demais a api responde 403, então nem pergunta. */
export function useBackfillOffer(tenantBrandId: string | null, enabled: boolean) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["backfill-offer", activeTenantId, tenantBrandId],
    queryFn: ({ signal }) => backfillApi.offer(tenantBrandId!, { signal }),
    enabled: Boolean(activeTenantId && tenantBrandId && enabled),
    staleTime: 30_000,
    retry: false,
  })
}

export function useBackfillMutations() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()

  const refresh = (res: BackfillCheckout, tenantBrandId: string) => {
    // Liberou: há análise nova em todas as telas (feed, dashboard, sentimento, SoV).
    if (res.status === "completed") {
      void qc.invalidateQueries()
      return
    }
    void qc.invalidateQueries({ queryKey: ["backfill-offer", activeTenantId, tenantBrandId] })
    void qc.invalidateQueries({ queryKey: ["brand-coverage", activeTenantId, tenantBrandId] })
  }

  return {
    checkout: useMutation({
      mutationFn: ({ tenantBrandId, idempotencyKey }: { tenantBrandId: string; idempotencyKey: string }) =>
        backfillApi.checkout(tenantBrandId, idempotencyKey),
      // `checkout` sai da página para o Stripe: não há o que atualizar.
      onSuccess: (res, v) => { if (res.status !== "checkout") refresh(res, v.tenantBrandId) },
    }),
    sync: useMutation({
      mutationFn: (tenantBrandId: string) => backfillApi.sync(tenantBrandId),
      onSuccess: (res, tenantBrandId) => refresh(res, tenantBrandId),
    }),
  }
}
