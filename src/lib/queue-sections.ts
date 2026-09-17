/**
 * Seções da fila de revisão por campanha.
 *
 * <p>Com várias campanhas ao mesmo tempo, a fila era uma lista só — o filtro por campanha existia,
 * mas escondia as outras. Agrupar mostra tudo sem misturar: uma seção por campanha, com quantos
 * esperam decisão, e cada seção recolhe.</p>
 *
 * <p><b>A ordem não muda.</b> A fila já chega ordenada pela espera (vencidas primeiro); as seções
 * saem na ordem em que cada campanha aparece nela, então a campanha com o item mais urgente fica no
 * topo, e dentro de cada seção os itens mantêm a ordem que tinham.</p>
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

/**
 * Os itens na ordem da tela, sem os das seções recolhidas. É a lista que o teclado percorre e de onde
 * sai o "próximo" depois de decidir — senão a seleção pularia para um item escondido.
 */
export function visibleItems<T>(sections: readonly CampaignSection<T>[], collapsed: ReadonlySet<string>): T[] {
  return sections.flatMap((s) => (collapsed.has(s.key) ? [] : s.items))
}
