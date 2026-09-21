/**
 * Score do domínio na escala [0,1], escrito em pt-BR: "0,64".
 *
 * Mora aqui, e não junto de uma tela, porque o mesmo número aparece no Dashboard,
 * no Monitoramento, no drawer e no SoV — e meia dúzia de `toFixed(2)` espalhados
 * fazia a mesma métrica sair com ponto numa tela e vírgula na outra.
 */
export function formatScore(score: number | null | undefined): string {
  return score == null ? "—" : score.toFixed(2).replace(".", ",")
}

/** Com sinal explícito, para variação ("+0,12" / "−0,08"). */
export function formatScoreDelta(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${formatScore(delta)}`
}

/**
 * Cor do score na escala do domínio [0,1] — o neutro é 0,5, não zero.
 * Mesma régua do `readSentiment` do SoV, aqui só como cor.
 */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "var(--ink-muted-2)"
  if (score >= 0.6) return "var(--color-pos)"
  if (score <= 0.4) return "var(--color-neg)"
  return "var(--ink-muted)"
}
