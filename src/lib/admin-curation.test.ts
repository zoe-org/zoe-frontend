import { describe, expect, it } from "vitest"
import {
  containsAlias, describeCurationDiff, diffCuration, looksMisconfigured,
  needsChannelRemovalConfirmation, normalizeAliasInput,
} from "@/lib/admin-curation"

const CHANNEL_A = "UCaaaaaaaaaaaaaaaaaaaaaa"
const CHANNEL_B = "UCbbbbbbbbbbbbbbbbbbbbbb"

function curation(aliases: string[], channels: string[]) {
  return { canonicalAliases: aliases, officialChannelIds: channels }
}

describe("diffCuration", () => {
  it("não acusa mudança quando nada mudou", () => {
    const diff = diffCuration(curation(["Itaú"], [CHANNEL_A]), curation(["Itaú"], [CHANNEL_A]))
    expect(diff.hasChanges).toBe(false)
  })

  it("separa adicionados de removidos nas duas listas", () => {
    const diff = diffCuration(
      curation(["antigo"], [CHANNEL_A]),
      curation(["novo"], [CHANNEL_B]),
    )
    expect(diff.aliasesAdded).toEqual(["novo"])
    expect(diff.aliasesRemoved).toEqual(["antigo"])
    expect(diff.channelsAdded).toEqual([CHANNEL_B])
    expect(diff.channelsRemoved).toEqual([CHANNEL_A])
    expect(diff.hasChanges).toBe(true)
  })

  // O backend deduplica alias com OrdinalIgnoreCase: trocar a caixa é no-op lá.
  // Mostrar "removeu ITAÚ, adicionou itaú" seria mentira sobre o que vai acontecer.
  it("trata alias como case-insensitive, igual ao domínio", () => {
    const diff = diffCuration(curation(["Itaú"], []), curation(["ITAÚ"], []))
    expect(diff.hasChanges).toBe(false)
  })

  // Channel id é Ordinal no domínio — caixa diferente é OUTRO canal.
  it("trata channel id como case-sensitive, igual ao domínio", () => {
    const diff = diffCuration(curation([], [CHANNEL_A]), curation([], [CHANNEL_A.toUpperCase()]))
    expect(diff.hasChanges).toBe(true)
  })

  it("enxerga remoção total de canais", () => {
    const diff = diffCuration(curation([], [CHANNEL_A, CHANNEL_B]), curation([], []))
    expect(diff.channelsRemoved).toEqual([CHANNEL_A, CHANNEL_B])
    expect(diff.channelsAdded).toEqual([])
  })
})

describe("describeCurationDiff", () => {
  it("descreve o que vai acontecer, com singular e plural certos", () => {
    const diff = diffCuration(
      curation(["a", "b"], [CHANNEL_A]),
      curation(["a", "c", "d"], []),
    )
    expect(describeCurationDiff(diff))
      .toBe("2 aliases adicionados · 1 alias removido · 1 canal removido")
  })

  it("estado sem mudança tem frase própria", () => {
    expect(describeCurationDiff(diffCuration(curation([], []), curation([], []))))
      .toBe("Nenhuma alteração")
  })
})

describe("needsChannelRemovalConfirmation", () => {
  it("pede confirmação só ao remover canal — adicionar apenas promove", () => {
    const removendo = diffCuration(curation([], [CHANNEL_A]), curation([], []))
    const adicionando = diffCuration(curation([], []), curation([], [CHANNEL_A]))

    expect(needsChannelRemovalConfirmation(removendo)).toBe(true)
    expect(needsChannelRemovalConfirmation(adicionando)).toBe(false)
  })
})

describe("looksMisconfigured", () => {
  // Mesmo predicado do ChannelRelationReclassification.LooksMisconfigured.
  it("acusa canal declarado com análise e zero owned", () => {
    expect(looksMisconfigured({
      officialChannelIds: [CHANNEL_A], analysesCount: 10, ownedAnalysesCount: 0,
    })).toBe(true)
  })

  it("não acusa marca sem canal declarado", () => {
    expect(looksMisconfigured({
      officialChannelIds: [], analysesCount: 10, ownedAnalysesCount: 0,
    })).toBe(false)
  })

  it("não acusa marca recém-verificada, ainda sem análise", () => {
    expect(looksMisconfigured({
      officialChannelIds: [CHANNEL_A], analysesCount: 0, ownedAnalysesCount: 0,
    })).toBe(false)
  })

  it("não acusa quando alguma análise ficou owned", () => {
    expect(looksMisconfigured({
      officialChannelIds: [CHANNEL_A], analysesCount: 10, ownedAnalysesCount: 3,
    })).toBe(false)
  })
})

describe("entrada de alias", () => {
  it("descarta vazio e só-espaço", () => {
    expect(normalizeAliasInput("   ")).toBeNull()
    expect(normalizeAliasInput("")).toBeNull()
    expect(normalizeAliasInput("  Itaú BBA ")).toBe("Itaú BBA")
  })

  it("detecta duplicata ignorando caixa", () => {
    expect(containsAlias(["Itaú"], "itaú")).toBe(true)
    expect(containsAlias(["Itaú"], "Bradesco")).toBe(false)
  })
})
