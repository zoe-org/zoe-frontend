import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/AuthContext"

// Espelha ListTenantBrandsResponse do zoe-api (GET /api/me/brands). camelCase
// porque o read-API serializa assim (mesma convenção de me.ts/tenants.ts).
export type TenantBrandSummary = {
  tenantBrandId: string
  brandId: string
  brandName: string
  brandSlug: string
  displayName: string | null
  /** Cor escolhida pelo tenant (hex). null → derivar do slug. */
  color: string | null
  /** Segmento global da brand. null quando não informado. */
  category: string | null
  relationship: string
  status: string
  brandVerified: boolean
  subscribedAt: string
  videoCount30d: number
}

export type ListTenantBrandsResponse = { items: TenantBrandSummary[] }

export type KeywordItem = {
  id: string
  keyword: string
  matchType: string
  isNegative: boolean
  source: string
  createdAt: string
}
export type ListKeywordsResponse = { items: KeywordItem[] }

export type BrandCandidate = {
  brandId: string
  name: string
  slug: string
  matchType: string
  verified: boolean
}
export type ResolveBrandResponse = {
  // Com o JsonStringEnumConverter (Program.cs) chega como STRING ("AutoLink").
  // Mantemos a union tolerando número porque essa API já serializou como
  // 0/1/2 — o helper resolveOutcome normaliza os dois.
  outcome: number | string
  autoLinkBrandId: string | null
  candidates: BrandCandidate[]
}

export type ResolveChannelResponse = {
  channelId: string | null
  title: string | null
  subscriberCount: number
  /** false + channelId != null = aceito sem confirmar na API do YouTube. */
  verified: boolean
  reason: string | null
}

/** Normaliza o outcome do resolve (número ou string) num literal estável. */
export function resolveOutcome(o: number | string): "AutoLink" | "Candidates" | "NoMatch" {
  if (typeof o === "string") return o as "AutoLink" | "Candidates" | "NoMatch"
  return o === 0 ? "AutoLink" : o === 1 ? "Candidates" : "NoMatch"
}

export const brandsApi = {
  listMine: (opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListTenantBrandsResponse>("/api/me/brands", { signal: opts?.signal }),

  keywords: (tenantBrandId: string, opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListKeywordsResponse>(`/api/me/brands/${tenantBrandId}/keywords`, { signal: opts?.signal }),
  addKeyword: (tenantBrandId: string, keyword: string) =>
    apiClient.post(`/api/me/brands/${tenantBrandId}/keywords`, { keyword }),
  removeKeyword: (tenantBrandId: string, keywordId: string) =>
    apiClient.delete(`/api/me/brands/${tenantBrandId}/keywords/${keywordId}`),

  update: (tenantBrandId: string, body: { displayName?: string | null; relationship?: string; status?: string; color?: string }) =>
    apiClient.put(`/api/me/brands/${tenantBrandId}`, body),
  unsubscribe: (tenantBrandId: string) =>
    apiClient.delete(`/api/me/brands/${tenantBrandId}`),

  // Fluxo de assinatura em 2 passos (resolve não muta estado). Link/Create
  // aceitam relationship + monitoredKeywords, então o modal coleta tudo e
  // assina numa tacada só.
  // officialChannelIds é o sinal MAIS FORTE do resolver: com ele o auto-link é
  // determinístico (não depende de fuzzy match por nome) — é o que impede marca
  // duplicada quando dois tenants escrevem o nome de formas diferentes.
  resolve: (name: string, officialChannelIds?: string[]) =>
    apiClient.post<ResolveBrandResponse>("/api/me/brands/resolve", { name, officialChannelIds }),

  // Traduz o que o usuário cola (link do "Compartilhar", @handle ou o UC...) no
  // ID canônico. O domínio só aceita UC..., mas ninguém tem esse ID em mãos.
  resolveChannel: (input: string) =>
    apiClient.post<ResolveChannelResponse>("/api/me/brands/resolve-channel", { input }),
  link: (brandId: string, body?: SubscribePayload) =>
    apiClient.post("/api/me/brands/link", { brandId, ...body }),
  create: (name: string, body?: SubscribePayload) =>
    apiClient.post("/api/me/brands", { name, ...body }),
}

export type SubscribePayload = {
  relationship?: string
  monitoredKeywords?: string[]
  /** Só no create: categoria é da Brand global (quem só assina não redefine). */
  category?: string
  color?: string
  /** Só no create: canais oficiais da marca (viram Brand.OfficialChannelIds). */
  officialChannelIds?: string[]
}

/** Brands assinadas pelo tenant ativo. `tenantId` na key isola o cache por tenant. */
export function useTenantBrands() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["tenant-brands", activeTenantId],
    queryFn: ({ signal }) => brandsApi.listMine({ signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 60_000,
  })
}

export function useBrandKeywords(tenantBrandId: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["brand-keywords", activeTenantId, tenantBrandId],
    queryFn: ({ signal }) => brandsApi.keywords(tenantBrandId!, { signal }),
    enabled: Boolean(activeTenantId && tenantBrandId),
    staleTime: 60_000,
  })
}

/** Mutações da assinatura — invalidam as queries afetadas ao concluir. */
export function useBrandMutations(tenantBrandId: string | null) {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  const invalidateKeywords = () =>
    qc.invalidateQueries({ queryKey: ["brand-keywords", activeTenantId, tenantBrandId] })
  const invalidateBrands = () =>
    qc.invalidateQueries({ queryKey: ["tenant-brands", activeTenantId] })

  return {
    addKeyword: useMutation({
      mutationFn: (keyword: string) => brandsApi.addKeyword(tenantBrandId!, keyword),
      onSuccess: invalidateKeywords,
    }),
    removeKeyword: useMutation({
      mutationFn: (keywordId: string) => brandsApi.removeKeyword(tenantBrandId!, keywordId),
      onSuccess: invalidateKeywords,
    }),
    update: useMutation({
      mutationFn: (body: { displayName?: string | null; relationship?: string; status?: string; color?: string }) =>
        brandsApi.update(tenantBrandId!, body),
      onSuccess: invalidateBrands,
    }),
    unsubscribe: useMutation({
      mutationFn: () => brandsApi.unsubscribe(tenantBrandId!),
      onSuccess: invalidateBrands,
    }),
  }
}

/** Fluxo "Nova marca": resolve → link (existente) | create (nova). */
export function useSubscribeFlow() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ["tenant-brands", activeTenantId] })
  return {
    resolve: useMutation({
      mutationFn: (v: { name: string; officialChannelIds?: string[] }) =>
        brandsApi.resolve(v.name, v.officialChannelIds),
    }),
    link: useMutation({
      mutationFn: (v: { brandId: string } & SubscribePayload) =>
        brandsApi.link(v.brandId, { relationship: v.relationship, monitoredKeywords: v.monitoredKeywords, color: v.color }),
      onSuccess: done,
    }),
    create: useMutation({
      mutationFn: (v: { name: string } & SubscribePayload) =>
        brandsApi.create(v.name, { relationship: v.relationship, monitoredKeywords: v.monitoredKeywords, category: v.category, color: v.color, officialChannelIds: v.officialChannelIds }),
      onSuccess: done,
    }),
  }
}
