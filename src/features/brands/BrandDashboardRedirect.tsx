import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useActiveBrand } from "@/features/brands/context"

/**
 * Rota antiga do drill-down competitivo (`/intelligence/competitive/:brandId`). A tela
 * saiu (ADR-063): o concorrente se lê no Dashboard, com ele como marca ativa. Link
 * salvo e favorito continuam funcionando — chegam no Dashboard com a marca certa.
 */
export function BrandDashboardRedirect() {
  const { brandId } = useParams<{ brandId: string }>()
  const { brands, setBrand, isLoading } = useActiveBrand()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    // Marca que o tenant não assina não vira ativa: o Dashboard ficaria sem marca.
    if (brandId && brands.some((b) => b.brandId === brandId)) setBrand(brandId)
    navigate("/dashboard", { replace: true })
  }, [brandId, brands, isLoading, navigate, setBrand])

  return null
}
