/**
 * Valor em reais digitado por gente, em centavos.
 *
 * <p>Aceita o jeito brasileiro ("1.500,00", "1500,5", "R$ 1.500") e o de máquina ("1500.50").
 * Devolve <c>null</c> quando não é um valor legível — quem chama decide o que dizer. O campo de
 * número do navegador fazia pior: "1.500,00" virava vazio, e o orçamento ia como zero sem aviso.</p>
 *
 * <p>Ponto sem vírgula é ambíguo; vale a leitura brasileira quando o formato é de milhar
 * ("1.500" = mil e quinhentos) e a decimal nos demais casos ("1.50" = um e cinquenta).</p>
 */
export function parseBRLToCents(input: string): number | null {
  const s = input.replace(/R\$/gi, "").replace(/\s/g, "")
  if (!s) return null

  let normalizado: string
  if (s.includes(",")) {
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(s)) return null
    normalizado = s.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalizado = s.replace(/\./g, "")
  } else if (/^\d+(\.\d{1,2})?$/.test(s)) {
    normalizado = s
  } else {
    return null
  }

  const valor = Number(normalizado)
  return Number.isFinite(valor) ? Math.round(valor * 100) : null
}

/** Centavos no formato que o campo mostra e que {@link parseBRLToCents} lê de volta. */
export function centsToBRLInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
