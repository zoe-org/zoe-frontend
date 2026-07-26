import { createContext, useContext } from "react"
import type { TenantBrandSummary } from "@/lib/api/brands"

/**
 * Marca ativa GLOBAL (antes vivia na URL `?brand=`). Virou estado de app porque
 * agora o seletor mora no header, acima das rotas — não pode depender do query
 * param de cada página (navegar pela sidebar perderia a marca). Persiste em
 * localStorage por tenant; trocar de tenant re-resolve pra 1ª marca daquele.
 */
export type BrandContextValue = {
  brands: TenantBrandSummary[]
  brandId: string | null
  active: TenantBrandSummary | null
  setBrand: (id: string) => void
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export const BrandContext = createContext<BrandContextValue | null>(null)

/**
 * Marca ativa compartilhada por Dashboard / Monitoramento / Sentimento. O
 * seletor no header (BrandSwitcher) é quem muda; as páginas só leem.
 */
export function useActiveBrand(): BrandContextValue {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error("useActiveBrand precisa estar dentro de <BrandProvider>.")
  return ctx
}
