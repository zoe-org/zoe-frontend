import type { TenantBrandSummary } from "@/lib/api/brands"

type BrandStatusRow = Pick<TenantBrandSummary, "status">

/** "Deixar de monitorar" arquiva: a linha fica, a coleta para e a vaga do plano volta. */
export function isArchived(b: BrandStatusRow): boolean {
  return b.status === "Archived"
}

/** Ativas e pausadas: ocupam vaga, mantêm o histórico e entram no seletor e na atribuição. */
export function monitoredBrands<T extends BrandStatusRow>(items: T[]): T[] {
  return items.filter((b) => !isArchived(b))
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
