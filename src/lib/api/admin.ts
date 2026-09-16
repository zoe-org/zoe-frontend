import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import type { ResolveChannelResponse } from "@/lib/api/brands"

/**
 * Curadoria admin de brands (`/api/admin/brands/*`). Endpoints são `[NoTenant]`
 * + policy `ZoeAdmin` no backend — daí `noTenant: true` em todas as chamadas
 * (não faz sentido mandar X-Tenant-Id numa operação cross-tenant).
 *
 * As query keys NÃO levam tenantId de propósito: este dado é global, não do
 * tenant ativo. Trocar de workspace não deve invalidar a fila de curadoria.
 */

/** Espelha BrandVerificationSlaStatus. Chega como nome (JsonStringEnumConverter), não número. */
export type BrandSlaStatus = "Ok" | "DueSoon" | "Breached"

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
  /** `createdAt` + 72h. Derivado no servidor, nunca persistido. */
  slaDeadline: string
  slaStatus: BrandSlaStatus
  /** Idade da pendência em horas, calculada com o relógio do SERVIDOR (ver `lib/admin-sla.ts`). */
  pendingForHours: number
  /** Tenants que já assinam a marca — sinal de impacto da verificação. */
  subscriberTenantsCount: number
}
export type PendingBrandsResponse = { items: PendingBrand[] }

// Espelha PendingVerificationsSummaryResponse
export type PendingSummary = {
  total: number
  ok: number
  dueSoon: number
  breached: number
}

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

// Espelha AdminBrandSummary — catálogo da aba "Marcas verificadas".
export type AdminBrand = {
  brandId: string
  name: string
  slug: string
  status: string
  category: string | null
  canonicalAliases: string[]
  officialChannelIds: string[]
  verifiedAt: string | null
  subscriberTenantsCount: number
  analysesCount: number
  /** Análises classificadas como Owned. Zero com canal declarado = provável channel id errado. */
  ownedAnalysesCount: number
}
export type AdminBrandsResponse = { items: AdminBrand[] }

export type UpdateCurationPayload = {
  canonicalAliases: string[]
  officialChannelIds: string[]
  /** Omitir preserva as notas atuais — não é o mesmo que limpar. */
  notes?: string | null
  category?: string | null
  /** Re-analisa o histórico da marca. Custa Bedrock por análise — só com pedido explícito. */
  reprocessExisting?: boolean
}

export type UpdateCurationResult = {
  brandId: string
  canonicalAliases: string[]
  officialChannelIds: string[]
  /** Quantas análises mudaram de owned/earned por causa da edição. */
  reclassifiedAnalyses: number
  reprocessQueued: number
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

  pendingSummary: (signal?: AbortSignal) =>
    apiClient.get<PendingSummary>("/api/admin/brands/pending/summary", { ...opts, signal }),

  listBrands: (params: { status?: string; q?: string }, signal?: AbortSignal) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set("status", params.status)
    if (params.q?.trim()) qs.set("q", params.q.trim())
    return apiClient.get<AdminBrandsResponse>(`/api/admin/brands?${qs}`, { ...opts, signal })
  },

  updateCuration: (brandId: string, body: UpdateCurationPayload) =>
    apiClient.put<UpdateCurationResult>(`/api/admin/brands/${brandId}/curation`, body, opts),

  // Espelha brandsApi.resolveChannel, mas no endpoint ADMIN. O de `/api/me/brands`
  // exige ser Owner/Admin do tenant ativo — o admin da Zoe é cross-tenant e
  // tomava 403 ali, o que fazia o campo aceitar só o `UC...` na prática.
  resolveChannel: (input: string) =>
    apiClient.post<ResolveChannelResponse>("/api/admin/brands/resolve-channel", { input }, opts),

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

/**
 * Contadores do cabeçalho. Query separada da fila porque a fila é paginada
 * (`limit=50`): com backlog grande, contar o que voltou na página mentiria sobre
 * o tamanho real do problema — é a razão de o endpoint existir.
 */
export function usePendingSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-pending-summary"],
    queryFn: ({ signal }) => adminApi.pendingSummary(signal),
    enabled,
    staleTime: 30_000,
  })
}

/**
 * Catálogo de marcas verificadas (aba de edição). `enabled` recebe o gate de
 * admin **e** o de aba ativa: sem isso a busca dispararia enquanto o curador
 * ainda está na fila, gastando request numa lista que ninguém vai ver.
 */
export function useAdminBrands(params: { status?: string; q?: string }, enabled: boolean) {
  return useQuery({
    queryKey: ["admin-brands", params.status ?? "all", params.q?.trim() ?? ""],
    queryFn: ({ signal }) => adminApi.listBrands(params, signal),
    enabled,
    staleTime: 30_000,
  })
}

/**
 * Edição da curadoria de marca já verificada. Invalida o catálogo e o detalhe —
 * e também a fila, porque uma correção pode mudar contadores que ela mostra.
 */
export function useUpdateCuration(brandId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateCurationPayload) => adminApi.updateCuration(brandId!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-brands"] })
      void qc.invalidateQueries({ queryKey: ["admin-pending-brands"] })
      if (brandId) void qc.invalidateQueries({ queryKey: ["admin-brand-verification", brandId] })
    },
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
 *
 * O summary entra junto: se os contadores do cabeçalho não caírem com a fila,
 * a tela passa a mostrar "3 vencidas" com duas linhas na lista — e o cabeçalho
 * é justamente o que deveria ser confiável sobre o backlog.
 */
export function useCurationMutations(brandId: string | null) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-pending-brands"] })
    void qc.invalidateQueries({ queryKey: ["admin-pending-summary"] })
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
