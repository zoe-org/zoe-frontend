/**
 * Seções da fila de revisão por campanha, na ordem de urgência em que cada campanha aparece. Cada seção recolhe.
 */
export type CampaignSection<T> = {
  key: string
  label: string
  items: T[]
  /** Quantos itens da seção esperam decisão. */
  pendingCount: number
}

/** Chave da seção de contratos sem campanha. */
export const NO_CAMPAIGN_SECTION = "avulso"

export function sectionsByCampaign<T>(
  items: readonly T[],
  campaignOf: (item: T) => { id: string | null; name: string | null },
  isPending: (item: T) => boolean,
  label: (name: string | null) => string,
): CampaignSection<T>[] {
  const byKey = new Map<string, CampaignSection<T>>()
  for (const item of items) {
    const { id, name } = campaignOf(item)
    const key = id ?? NO_CAMPAIGN_SECTION
    let section = byKey.get(key)
    if (!section) {
      section = { key, label: label(name), items: [], pendingCount: 0 }
      byKey.set(key, section)
    }
    section.items.push(item)
    if (isPending(item)) section.pendingCount++
  }
  return [...byKey.values()]
}

/** Itens na ordem da tela sem os das seções recolhidas: é o que o teclado percorre. */
export function visibleItems<T>(sections: readonly CampaignSection<T>[], collapsed: ReadonlySet<string>): T[] {
  return sections.flatMap((s) => (collapsed.has(s.key) ? [] : s.items))
}
