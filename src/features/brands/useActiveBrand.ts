import { useSearchParams } from "react-router-dom"
import { useTenantBrands, type TenantBrandSummary } from "@/lib/api/brands"

/**
 * Resolve a marca ativa a partir da URL (`?brand=`), caindo na 1ª assinada.
 * Compartilhado por Monitoramento/Sentimento/Dashboard — a marca vive na URL
 * (deep-link) e o cache é isolado por tenant nas query keys.
 */
export function useActiveBrand() {
  const [params, setParams] = useSearchParams()
  const brands = useTenantBrands()
  const list: TenantBrandSummary[] = brands.data?.items ?? []

  const urlBrand = params.get("brand")
  const brandId = urlBrand && list.some((b) => b.brandId === urlBrand)
    ? urlBrand
    : list[0]?.brandId ?? null
  const active = list.find((b) => b.brandId === brandId) ?? null

  const setBrand = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("brand", id)
      return next
    }, { replace: true })

  return {
    brands: list,
    brandId,
    active,
    setBrand,
    isLoading: brands.isLoading,
    isError: brands.isError,
    refetch: brands.refetch,
  }
}
