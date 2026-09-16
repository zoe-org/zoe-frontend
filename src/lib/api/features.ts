import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"

export type FeatureCatalog = {
  id: string
  code: string
  name: string
  description: string
  pricingUnit: string
  /** `BaseModule` | `SubscriptionAddOn` | `InternalFlag` — quem manda no estado. */
  kind: string
}

export const featuresApi = {
  catalog: () => apiClient.get<FeatureCatalog[]>("/api/features", { noTenant: true }),
}

export function useFeatureCatalog() {
  return useQuery({
    queryKey: ["feature-catalog"],
    queryFn: () => featuresApi.catalog(),
    staleTime: 5 * 60_000,
  })
}
