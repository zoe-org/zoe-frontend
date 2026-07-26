import { useMutation, useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

export type FeatureCatalog = {
  id: string
  code: string
  name: string
  description: string
  pricingUnit: string
  /** Add-on gerenciável (aba Add-ons) vs. módulo base (intelligence/operations). */
  isAddOn: boolean
}

export const featuresApi = {
  catalog: () => apiClient.get<FeatureCatalog[]>("/api/features", { noTenant: true }),
  activate: (tenantId: string, code: string) =>
    apiClient.post(`/api/tenants/${tenantId}/features`, { code }, { tenantId }),
  deactivate: (tenantId: string, code: string) =>
    apiClient.delete(`/api/tenants/${tenantId}/features/${code}`, { tenantId }),
}

export function useFeatureCatalog() {
  return useQuery({
    queryKey: ["feature-catalog"],
    queryFn: () => featuresApi.catalog(),
    staleTime: 5 * 60_000,
  })
}

/**
 * Ativar/remover add-on. Em caso de sucesso chama `refresh()` do AuthContext, que
 * relê o contexto do tenant (as features vêm do backend, cache invalidado no
 * handler) — o gate por feature reflete na hora, sem reload.
 */
export function useFeatureMutations() {
  const { activeTenantId, refresh } = useAuth()
  return {
    activate: useMutation({
      mutationFn: (code: string) => featuresApi.activate(activeTenantId!, code),
      onSuccess: () => refresh(),
    }),
    deactivate: useMutation({
      mutationFn: (code: string) => featuresApi.deactivate(activeTenantId!, code),
      onSuccess: () => refresh(),
    }),
  }
}
