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
export type SecaoFila<T> = {
  chave: string
  rotulo: string
  itens: T[]
  /** Quantos itens da seção esperam decisão. */
  pendentes: number
}

/** Chave da seção de contratos sem campanha. */
export const SECAO_SEM_CAMPANHA = "avulso"

export function secoesPorCampanha<T>(
  itens: readonly T[],
  campanha: (item: T) => { id: string | null; nome: string | null },
  pendente: (item: T) => boolean,
  rotulo: (nome: string | null) => string,
): SecaoFila<T>[] {
  const porChave = new Map<string, SecaoFila<T>>()
  for (const item of itens) {
    const { id, nome } = campanha(item)
    const chave = id ?? SECAO_SEM_CAMPANHA
    let secao = porChave.get(chave)
    if (!secao) {
      secao = { chave, rotulo: rotulo(nome), itens: [], pendentes: 0 }
      porChave.set(chave, secao)
    }
    secao.itens.push(item)
    if (pendente(item)) secao.pendentes++
  }
  return [...porChave.values()]
}

/**
 * Os itens na ordem da tela, sem os das seções recolhidas. É a lista que o teclado percorre e de onde
 * sai o "próximo" depois de decidir — senão a seleção pularia para um item escondido.
 */
export function itensVisiveis<T>(secoes: readonly SecaoFila<T>[], recolhidas: ReadonlySet<string>): T[] {
  return secoes.flatMap((s) => (recolhidas.has(s.chave) ? [] : s.itens))
}
