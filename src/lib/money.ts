/**
 * Valor em reais digitado em centavos, no formato brasileiro ou de máquina; <code>null</code> quando ilegível. Ponto com três casas é milhar.
 */
export function parseBRLToCents(input: string): number | null {
  const s = input.replace(/R\$/gi, "").replace(/\s/g, "")
  if (!s) return null

  let normalized: string
  if (s.includes(",")) {
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(s)) return null
    normalized = s.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, "")
  } else if (/^\d+(\.\d{1,2})?$/.test(s)) {
    normalized = s
  } else {
    return null
  }

  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) : null
}

/** Centavos no formato que o campo mostra e que {@link parseBRLToCents} lê de volta. */
export function centsToBRLInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
