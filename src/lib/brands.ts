import type { TenantBrandSummary } from "@/lib/api/brands"

type BrandStatusRow = Pick<TenantBrandSummary, "status">

/** "Deixar de monitorar" arquiva: a linha fica, a coleta para e a vaga do plano volta. */
export function isArchived(b: BrandStatusRow): boolean {
  return b.status === "Archived"
}

/** Ativas e pausadas: as que ocupam vaga e aparecem no seletor. */
export function monitoredBrands<T extends BrandStatusRow>(items: T[]): T[] {
  return items.filter((b) => !isArchived(b))
}

/** Só ativas: é o que a API aceita em atribuição de membro e convite. */
export function assignableBrands<T extends BrandStatusRow>(items: T[]): T[] {
  return items.filter((b) => b.status === "Active")
}

/** Lista da tela de Marcas: a busca vale para as duas seções. */
export function partitionBrands<T extends BrandStatusRow & Pick<TenantBrandSummary, "displayName" | "brandName">>(
  items: T[],
  query: string,
): { monitored: T[]; archived: T[] } {
  const q = query.trim().toLowerCase()
  const matches = q ? items.filter((b) => (b.displayName ?? b.brandName).toLowerCase().includes(q)) : items
  return {
    monitored: matches.filter((b) => !isArchived(b)),
    archived: matches.filter(isArchived),
  }
}
