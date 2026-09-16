import { describe, expect, it } from "vitest"
import {
  COVERAGE_BY_PATH,
  coverageConfig,
  coverageSaysOwnedContent,
} from "@/components/ui/coverage-labels"

describe("cobertura — áudio-only é o caminho padrão, não uma degradação", () => {
  it("rotula AudioOnly como análise completa, igual a Full", () => {
    // ADR-046: a camada visual não entra por POLÍTICA. Como o áudio-only virou o
    // padrão, marcá-lo como reduzido diria ao cliente que quase todo vídeo dele
    // foi mal analisado.
    expect(coverageConfig("AudioOnly", false).label).toBe("Análise completa")
    expect(coverageConfig("AudioOnly", false).className)
      .toBe(coverageConfig("Full", false).className)
  })

  it("não põe tooltip de ressalva no caminho padrão", () => {
    // Um (i) em toda linha da listagem é ruído, e ressalva onde nada deu errado
    // ensina o cliente a desconfiar do número certo.
    expect(coverageConfig("AudioOnly", false).tip).toBeUndefined()
  })

  it("mantém a ressalva onde ela significa algo", () => {
    expect(coverageConfig("CommentsOnly", false).tip).toBeDefined()
    expect(coverageConfig("CaptionFallback", false).label).toBe("Legenda + comentários")
  })

  it("todo path do contrato tem rótulo — path cru na tela é bug visível", () => {
    for (const path of [
      "Full", "AudioOnly", "VideoCaption", "CaptionFallback",
      "CommentsOnly", "OwnedComments", "OwnedNoSignal",
    ]) {
      expect(COVERAGE_BY_PATH[path], `falta rótulo para ${path}`).toBeDefined()
    }
  })

  it("path desconhecido mostra o valor cru em vez de inventar rótulo", () => {
    expect(coverageConfig("PathQueNaoExiste", false).label).toBe("PathQueNaoExiste")
  })
})

describe("cobertura x origem — a etiqueta não pode aparecer duas vezes", () => {
  it("acusa quando o selo de cobertura já disse 'Conteúdo próprio'", () => {
    // São dois selos com perguntas diferentes que caíam no mesmo texto.
    expect(coverageSaysOwnedContent("OwnedComments", false)).toBe(true)
    expect(coverageSaysOwnedContent("Full", true)).toBe(true)
  })

  it("não acusa quando a cobertura fala de outra coisa", () => {
    // Aqui os dois selos coexistem e cada um informa algo: o vídeo é do canal da
    // marca (origem) E só tinha comentários para ler (cobertura).
    expect(coverageSaysOwnedContent("CommentsOnly", false)).toBe(false)
    expect(coverageSaysOwnedContent("OwnedNoSignal", false)).toBe(false)
    expect(coverageSaysOwnedContent("AudioOnly", false)).toBe(false)
  })

  it("sem path não há o que comparar", () => {
    expect(coverageSaysOwnedContent(null, false)).toBe(false)
    expect(coverageSaysOwnedContent(undefined, false)).toBe(false)
  })
})
