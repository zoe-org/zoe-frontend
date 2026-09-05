/**
 * Classe de chip por classificação de sentimento.
 *
 * <p>Existe porque o mesmo mapeamento estava escrito à mão em quatro lugares —
 * Dashboard, Monitoramento, MentionDrawer e o `SentimentBadge` — sempre com hex
 * fixo (`text-[#16A34A] bg-[#F0FDF4]`). Hex fixo não tem modo escuro: o chip
 * continuava um adesivo claro sobre a superfície escura, e o neutro
 * (`#6B7280` sobre `#F3F4F6`) ficava perto do limite de contraste até no claro.</p>
 *
 * <p>As classes `.chip-*` do design system JÁ resolvem os dois temas — elas saem de
 * `--pos-bg`/`--neg-bg`, que o bloco `.dark` redefine. O bug não era falta de
 * sistema: era as telas terem passado por fora dele.</p>
 */
export function classificationChip(classification: string | null | undefined): string {
  switch (classification) {
    case "Positive":
      return "chip chip-pos"
    case "Negative":
      return "chip chip-neg"
    // Indeterminado tem chip próprio no vocabulário? Não: ele é ausência de sinal,
    // e o neutro cinza é exatamente o que ele deve parecer.
    default:
      return "chip"
  }
}

/** Mesma regra para um delta numérico: positivo é ganho, negativo é perda. */
export function deltaChip(delta: number): string {
  return delta >= 0 ? "chip chip-pos" : "chip chip-neg"
}
