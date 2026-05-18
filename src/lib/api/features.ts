import { apiClient } from "@/lib/api"

export type FeatureCatalog = {
  id: string
  code: string
  name: string
  description: string
  pricingUnit: string
}

export const featuresApi = {
  catalog: () => apiClient.get<FeatureCatalog[]>("/api/features", { noTenant: true }),
}
