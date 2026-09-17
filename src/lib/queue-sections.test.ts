import { describe, expect, it } from "vitest"
import { visibleItems, sectionsByCampaign, NO_CAMPAIGN_SECTION } from "./queue-sections"

type Item = { id: string; campaignId: string | null; campaignName: string | null; pending: boolean }

const item = (id: string, campaignId: string | null, pending = true): Item => ({
  id, campaignId, campaignName: campaignId ? `Campanha ${campaignId}` : null, pending,
})

const sections = (items: Item[]) => sectionsByCampaign(
  items,
  (i) => ({ id: i.campaignId, name: i.campaignName }),
  (i) => i.pending,
  (name) => name ?? "Sem campanha",
)

describe("secoesPorCampanha", () => {
  it("mantém a ordem da fila: a campanha do item mais urgente vem primeiro", () => {
    const s = sections([item("1", "b"), item("2", "a"), item("3", "b"), item("4", null)])

    expect(s.map((x) => x.key)).toEqual(["b", "a", NO_CAMPAIGN_SECTION])
    expect(s[0].items.map((x) => x.id)).toEqual(["1", "3"])
    expect(s[2].label).toBe("Sem campanha")
  })

  it("conta só o que espera decisão", () => {
    const [single] = sections([item("1", "a"), item("2", "a", false), item("3", "a")])
    expect(single).toMatchObject({ label: "Campanha a", pendingCount: 2 })
    expect(single.items).toHaveLength(3)
  })
})

describe("itensVisiveis", () => {
  it("percorre na ordem das seções e pula as recolhidas", () => {
    const s = sections([item("1", "b"), item("2", "a"), item("3", "b")])

    expect(visibleItems(s, new Set()).map((x) => x.id)).toEqual(["1", "3", "2"])
    expect(visibleItems(s, new Set(["b"])).map((x) => x.id)).toEqual(["2"])
  })
})
