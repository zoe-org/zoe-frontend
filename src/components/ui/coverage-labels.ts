// Rótulos de COBERTURA do pipeline: como o vídeo foi analisado e o que o score
// significa. Fora do componente porque a listagem também precisa consultá-los para
// não repetir o que o selo já disse — e um `.ts` puro não esbarra na regra de fast
// refresh que proíbe exportar não-componentes ao lado de componentes.

export type CoverageConfig = { label: string; className: string; tip?: string }

const TEAL = "text-[#0F766E] bg-[#F0FDFA]"
const CINZA = "text-[#6B7280] bg-[#F3F4F6]"
const AMBAR = "text-[#B45309] bg-[#FFFBEB]"

/** Chaves em PascalCase = o que o read-API devolve (enum .ToString()). */
export const COVERAGE_BY_PATH: Record<string, CoverageConfig> = {
  Full: { label: "Análise completa", className: TEAL },
  VideoCaption: { label: "Análise completa", className: TEAL },

  // ADR-046: áudio-only é o caminho PADRÃO desde a Etapa 6 — transcrição da fala
  // pelo Whisper + comentários. A camada visual não entra por POLÍTICA, não por
  // falha, então o rótulo é o mesmo de `Full` e sem tooltip de ressalva.
  //
  // A confiança 0.80 coincide com a do `CaptionFallback` e o significado é oposto:
  // lá o áudio falhou e caiu na legenda; aqui o áudio foi transcrito e a análise
  // é a que o produto se propõe a fazer. Marcá-la como reduzida diria ao cliente
  // que quase todo vídeo dele foi mal analisado.
  AudioOnly: { label: "Análise completa", className: TEAL },

  CaptionFallback: { label: "Legenda + comentários", className: CINZA },
  CommentsOnly: {
    label: "Apenas comentários",
    className: AMBAR,
    tip: "Score baseado apenas nos comentários (sem áudio/vídeo) — confiança reduzida.",
  },

  // ADR-035. Mesma confiança numérica do CaptionFallback (0.80) e significado
  // OPOSTO: aquilo é degradação, isto é política. Por isso cor neutra-positiva e
  // não âmbar — âmbar comunica "algo deu errado", e aqui nada deu errado.
  OwnedComments: {
    label: "Conteúdo próprio",
    className: TEAL,
    tip:
      "Vídeo do canal oficial da marca. Medimos a reação da audiência nos " +
      "comentários — o roteiro é da própria marca e não entra no score.",
  },
  OwnedNoSignal: {
    label: "Comentários desativados",
    className: CINZA,
    tip:
      "A marca desativou os comentários deste vídeo. Não é falha de coleta — " +
      "não havia reação de audiência a medir.",
  },
}

/**
 * Vídeo owned analisado pelo path pesado (doc 05 §4.1). O score existe mas inclui
 * o roteiro da própria marca — não é leitura de audiência, e o selo normal diria
 * "análise completa, alta confiança".
 */
export const COVERAGE_SELF_MEASURED: CoverageConfig = {
  label: "Conteúdo próprio",
  className: AMBAR,
  tip:
    "Vídeo do canal oficial analisado pelo pipeline completo: o score inclui o " +
    "roteiro e a marca em quadro, então não mede reação da audiência.",
}

/** Path desconhecido não inventa rótulo: mostra o valor cru e some com a cor. */
const COVERAGE_FALLBACK: CoverageConfig = { label: "", className: CINZA }

export function coverageConfig(
  pipelinePath: string,
  selfMeasured: boolean,
): CoverageConfig {
  if (selfMeasured) return COVERAGE_SELF_MEASURED
  return COVERAGE_BY_PATH[pipelinePath] ?? { ...COVERAGE_FALLBACK, label: pipelinePath }
}

/**
 * O selo de cobertura já diz "Conteúdo próprio"?
 *
 * A listagem mostra DOIS selos que respondem perguntas diferentes — cobertura
 * ("como foi analisado") e origem ("de quem é o canal"). Em vídeo owned os dois
 * caíam no mesmo texto e a etiqueta aparecia repetida. Quem cede é a origem: o
 * selo de cobertura carrega o tooltip que explica o que o número significa.
 */
export function coverageSaysOwnedContent(
  pipelinePath: string | null | undefined,
  selfMeasured: boolean,
): boolean {
  if (!pipelinePath) return false
  return coverageConfig(pipelinePath, selfMeasured).label === "Conteúdo próprio"
}
