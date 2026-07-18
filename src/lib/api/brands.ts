import { useQuery } from "@tanstack/react-query"
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
  relationship: string
  status: string
  brandVerified: boolean
  subscribedAt: string
  videoCount30d: number
}

export type ListTenantBrandsResponse = { items: TenantBrandSummary[] }

export const brandsApi = {
  listMine: (opts?: { signal?: AbortSignal }) =>
    apiClient.get<ListTenantBrandsResponse>("/api/me/brands", { signal: opts?.signal }),
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
