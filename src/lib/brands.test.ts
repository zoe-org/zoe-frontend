import { describe, expect, it } from "vitest"
import { assignableBrands, isArchived, monitoredBrands, partitionBrands } from "@/lib/brands"

const row = (brandName: string, status: string, displayName: string | null = null) =>
  ({ brandName, displayName, status })

const items = [
  row("Nubank", "Active"),
  row("Itaú", "Paused"),
  row("Caio Andres", "Archived"),
  row("Natura", "Archived", "Natura Cosméticos"),
]

describe("isArchived", () => {
  it("pausada não é arquivada: continua ocupando vaga", () => {
    expect(isArchived(row("x", "Paused"))).toBe(false)
    expect(isArchived(row("x", "Archived"))).toBe(true)
  })
})

describe("monitoredBrands / assignableBrands", () => {
  it("o seletor mostra ativas e pausadas", () => {
    expect(monitoredBrands(items).map((b) => b.brandName)).toEqual(["Nubank", "Itaú"])
  })

  it("atribuição e convite só aceitam ativas", () => {
    expect(assignableBrands(items).map((b) => b.brandName)).toEqual(["Nubank"])
  })
})

describe("partitionBrands", () => {
  it("separa as arquivadas das monitoradas", () => {
    const { monitored, archived } = partitionBrands(items, "")
    expect(monitored.map((b) => b.brandName)).toEqual(["Nubank", "Itaú"])
    expect(archived.map((b) => b.brandName)).toEqual(["Caio Andres", "Natura"])
  })

  it("a busca vale para as duas seções e usa o nome de exibição", () => {
    expect(partitionBrands(items, "cosm").archived.map((b) => b.brandName)).toEqual(["Natura"])
    expect(partitionBrands(items, "  NUB ").monitored.map((b) => b.brandName)).toEqual(["Nubank"])
    expect(partitionBrands(items, "zzz")).toEqual({ monitored: [], archived: [] })
  })
})
