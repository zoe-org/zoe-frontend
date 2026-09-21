import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/features/auth/context"
import { useTenantBrands } from "@/lib/api/brands"
import { monitoredBrands } from "@/lib/brands"
import { BrandContext, type BrandContextValue } from "@/features/brands/context"

const LS_PREFIX = "zoe_active_brand:"
function readStored(tenantId: string): string | null {
  try { return localStorage.getItem(LS_PREFIX + tenantId) } catch { return null }
}
function writeStored(tenantId: string, brandId: string) {
  try { localStorage.setItem(LS_PREFIX + tenantId, brandId) } catch { /* ignore */ }
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { activeTenantId } = useAuth()
  const query = useTenantBrands()
  // Arquivada sai do seletor: a API não mostra dado de marca que não é mais monitorada.
  const list = useMemo(() => monitoredBrands(query.data?.items ?? []), [query.data])

  // Chave estável pro efeito não re-rodar a cada render (list é novo array sempre).
  const idsKey = useMemo(() => list.map((b) => b.brandId).join(","), [list])

  const [brandId, setBrandId] = useState<string | null>(null)

  // Re-resolve quando o tenant muda ou a lista de marcas chega/muda:
  // preferência salva → senão a 1ª assinada. Marca salva que sumiu (unsubscribe)
  // cai no padrão. Sem tenant/lista ainda → null.
  //
  // O padrão NUNCA é um concorrente (WS-F4): o dashboard fala "sua marca", e abrir
  // num concorrente só porque ele foi assinado primeiro enquadra o dado errado. A
  // superfície de concorrente é o drill-down competitivo (ADR-035 D6).
  useEffect(() => {
    if (!activeTenantId) { setBrandId(null); return }
    if (list.length === 0) { setBrandId(null); return }
    const stored = readStored(activeTenantId)
    const padrao = list.find((b) => b.relationship !== "Competitor") ?? list[0]
    const valid = stored && list.some((b) => b.brandId === stored) ? stored : padrao.brandId
    setBrandId(valid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, idsKey])

  // Não persiste: o recorte agregado vale para a sessão, e voltar dias depois
  // numa tela sem marca definida é pior que voltar na última marca usada.
  const [allBrands, setAllBrands] = useState(false)

  const setBrand = useCallback((id: string) => {
    setBrandId(id)
    // Escolher uma marca é sair do recorte agregado — são a mesma decisão.
    setAllBrands(false)
    if (activeTenantId) writeStored(activeTenantId, id)
  }, [activeTenantId])

  const value = useMemo<BrandContextValue>(() => ({
    brands: list,
    brandId,
    active: list.find((b) => b.brandId === brandId) ?? null,
    setBrand,
    allBrands,
    setAllBrands,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }), [list, brandId, setBrand, allBrands, query.isLoading, query.isError, query.refetch])

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}
