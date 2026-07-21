import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"

/**
 * Curadoria admin de brands (`/api/admin/brands/*`). Endpoints são `[NoTenant]`
 * + policy `ZoeAdmin` no backend — daí `noTenant: true` em todas as chamadas
 * (não faz sentido mandar X-Tenant-Id numa operação cross-tenant).
 *
 * As query keys NÃO levam tenantId de propósito: este dado é global, não do
 * tenant ativo. Trocar de workspace não deve invalidar a fila de curadoria.
 */

// Espelha PendingBrandSummary
export type PendingBrand = {
  brandId: string
  name: string
  slug: string
  officialChannelIds: string[]
  createdByTenantId: string
  createdByTenantName: string | null
  createdByUserId: string
  createdAt: string
  suggestedAliasesCount: number
  videosCollectedCount: number
}
export type PendingBrandsResponse = { items: PendingBrand[] }

// Espelha GetBrandVerificationDetailResponse
export type TenantAliasSuggestion = {
  keyword: string
  tenantId: string
  tenantName: string | null
  occurrences: number
}
export type RecentAnalysis = {
  analysisId: string
  videoId: string
  videoTitle: string
  status: string
  classification: string | null
  score: number | null
  processedAt: string | null
  nerMode: string
}
export type SimilarBrand = {
  brandId: string
  name: string
  slug: string
  matchType: string
  verified: boolean
}
export type BrandVerificationDetail = {
  brandId: string
  name: string
  slug: string
  canonicalAliases: string[]
  officialChannelIds: string[]
  status: string
  createdAt: string
  createdByTenantId: string
  createdByTenantName: string | null
  createdByUserId: string
  suggestedAliases: TenantAliasSuggestion[]
  videosCollectedCount: number
  recentAnalyses: RecentAnalysis[]
  similarBrands: SimilarBrand[]
  verificationNotes: string | null
}

export type VerifyPayload = {
  canonicalAliases: string[]
  officialChannelIds: string[]
  notes?: string | null
  /** Re-roda as análises feitas em modo Conservative com os aliases confirmados. */
  reprocessExisting?: boolean
}

/** Espelha MergeAnalysesPolicy do domínio. */
export type MergeAnalysesPolicy = "PreferTarget" | "Reprocessed"

const opts = { noTenant: true } as const

export const adminApi = {
  pending: (signal?: AbortSignal) =>
    apiClient.get<PendingBrandsResponse>("/api/admin/brands/pending", { ...opts, signal }),

  detail: (brandId: string, signal?: AbortSignal) =>
    apiClient.get<BrandVerificationDetail>(`/api/admin/brands/${brandId}/verification`, { ...opts, signal }),

  verify: (brandId: string, body: VerifyPayload) =>
    apiClient.post(`/api/admin/brands/${brandId}/verify`, body, opts),

  reject: (brandId: string, reason: string) =>
    apiClient.post(`/api/admin/brands/${brandId}/reject`, { reason }, opts),

  reprocess: (brandId: string) =>
    apiClient.post(`/api/admin/brands/${brandId}/reprocess`, {}, opts),

  merge: (sourceId: string, targetId: string, analysesPolicy: MergeAnalysesPolicy, notes?: string) =>
    apiClient.post(
      `/api/admin/brands/${sourceId}/merge?targetId=${encodeURIComponent(targetId)}`,
      { analysesPolicy, notes },
      opts,
    ),
}

// ── hooks ──────────────────────────────────────────────────────────────

export function usePendingBrands(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-pending-brands"],
    queryFn: ({ signal }) => adminApi.pending(signal),
    enabled,
    staleTime: 30_000,
  })
}

export function useBrandVerification(brandId: string | null) {
  return useQuery({
    queryKey: ["admin-brand-verification", brandId],
    queryFn: ({ signal }) => adminApi.detail(brandId!, signal),
    enabled: Boolean(brandId),
    staleTime: 30_000,
  })
}

/**
 * Mutações de curadoria. Toda ação que muda o status da brand invalida a fila
 * (`admin-pending-brands`) e o detalhe — a brand sai da fila ao ser
 * verificada/rejeitada/mesclada.
 */
export function useCurationMutations(brandId: string | null) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-pending-brands"] })
    if (brandId) void qc.invalidateQueries({ queryKey: ["admin-brand-verification", brandId] })
  }

  return {
    verify: useMutation({
      mutationFn: (body: VerifyPayload) => adminApi.verify(brandId!, body),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: (reason: string) => adminApi.reject(brandId!, reason),
      onSuccess: invalidate,
    }),
    reprocess: useMutation({
      mutationFn: () => adminApi.reprocess(brandId!),
      onSuccess: invalidate,
    }),
    merge: useMutation({
      mutationFn: (v: { targetId: string; policy: MergeAnalysesPolicy; notes?: string }) =>
        adminApi.merge(brandId!, v.targetId, v.policy, v.notes),
      onSuccess: invalidate,
    }),
  }
}
