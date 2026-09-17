import { describe, expect, it } from "vitest"
import { centsToBRLInput, parseBRLToCents } from "./money"

describe("parseBRLToCents", () => {
  it.each([
    ["1.500,00", 150_000],
    ["1500,5", 150_050],
    ["R$ 15.000,00", 1_500_000],
    ["1.234.567,89", 123_456_789],
    ["1.500", 150_000],
    ["1500", 150_000],
    ["1500.50", 150_050],
    ["0,20", 20],
    ["0", 0],
  ])("%s → %i centavos", (text, cents) => {
    expect(parseBRLToCents(text)).toBe(cents)
  })

  it.each(["", "   ", "a combinar", "1,500,00", "1.50.0", "-10", "12,345"])("%s não é valor", (text) => {
    expect(parseBRLToCents(text)).toBeNull()
  })
})

describe("centsToBRLInput", () => {
  it("volta no formato que o campo lê", () => {
    expect(centsToBRLInput(1_500_050)).toBe("15.000,50")
    expect(parseBRLToCents(centsToBRLInput(1_500_050))).toBe(1_500_050)
  })
})
