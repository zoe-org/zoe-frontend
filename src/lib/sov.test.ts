import { describe, expect, it } from "vitest"
import type { SovBrand, SovTopic } from "@/lib/api/dashboard"
import {
  CONTESTED_MARGIN, findTopicGaps, formatScore, matchup, nearestRival, positionSummary, rankBrands,
  readSentiment,
} from "@/lib/sov"

const brand = (brandName: string, sharePct: number, over: Partial<SovBrand> = {}): SovBrand => ({
  brandId: brandName.toLowerCase(),
  brandName,
  mentions: sharePct * 10,
  sharePct,
  isYou: false,
  deltaPp: 0,
  color: null,
  avgScore: null,
  ...over,
})

const topic = (name: string, volume: number, shares: [string, number, boolean?][]): SovTopic => ({
  topic: name,
  volume,
  shares: shares.map(([n, pct, isYou]) => ({
    brandId: n.toLowerCase(), brandName: n, isYou: Boolean(isYou), color: null, sharePct: pct,
  })),
})

describe("readSentiment", () => {
  it("diz o que o número significa, na escala do domínio (neutro em 0,5)", () => {
    expect(readSentiment(0.61).text).toBe("0,61 · positivo")
    expect(readSentiment(0.5).label).toBe("neutro")
    expect(readSentiment(0.22).label).toBe("negativo")
  })

  it("os cortes são os do resto do app: 0,6 já é positivo e 0,4 já é negativo", () => {
    expect(readSentiment(0.6).tone).toBe("pos")
    expect(readSentiment(0.4).tone).toBe("neg")
  })

  it("sem score não é neutro — é ausência de leitura", () => {
    expect(readSentiment(null)).toMatchObject({ tone: "unknown", text: "—" })
  })

  it("vírgula decimal", () => {
    expect(formatScore(0.5)).toBe("0,50")
    expect(formatScore(null)).toBe("—")
  })
})

describe("rankBrands", () => {
  it("ordena por share e carimba a posição", () => {
    const ranked = rankBrands([brand("Inter", 18), brand("Nubank", 34), brand("Itaú", 24)])
    expect(ranked.map((b) => [b.brandName, b.rank])).toEqual([["Nubank", 1], ["Itaú", 2], ["Inter", 3]])
  })

  it("empate no share arredondado desempata por menções", () => {
    const ranked = rankBrands([
      brand("A", 25, { mentions: 90 }),
      brand("B", 25, { mentions: 110 }),
    ])
    expect(ranked[0].brandName).toBe("B")
  })
})

describe("positionSummary", () => {
  it("líder: diz a distância para o segundo", () => {
    const text = positionSummary(rankBrands([
      brand("Nubank", 34, { isYou: true, deltaPp: 6 }), brand("Itaú", 24),
    ]))
    expect(text).toBe(
      "Você lidera as conversas do setor com 34% de share, 10pp à frente de Itaú. " +
      "Ganhou 6pp em relação ao período anterior.",
    )
  })

  it("fora da liderança: diz a posição e a distância para o líder", () => {
    const text = positionSummary(rankBrands([
      brand("Nubank", 34), brand("Itaú", 24, { isYou: true, deltaPp: -2 }), brand("Inter", 18),
    ]))
    expect(text).toBe(
      "Você está em 2º entre 3 marcas, com 24% de share, 10pp atrás de Nubank. " +
      "Perdeu 2pp em relação ao período anterior.",
    )
  })

  it("sem variação não inventa movimento", () => {
    const text = positionSummary(rankBrands([brand("Nubank", 60, { isYou: true }), brand("Itaú", 40)]))
    expect(text).not.toContain("período anterior")
  })

  it("sem marca própria no recorte não há posição a descrever", () => {
    expect(positionSummary(rankBrands([brand("Itaú", 60), brand("Inter", 40)]))).toBeNull()
  })
})

describe("findTopicGaps", () => {
  const topics = [
    topic("Investimentos", 98, [["Inter", 30], ["Nubank", 19, true]]),
    topic("App", 120, [["Nubank", 42, true], ["Inter", 24]]),
    topic("Segurança", 52, [["Itaú", 34], ["Nubank", 21, true]]),
    topic("Pix", 40, [["Itaú", 50], ["Nubank", 40, true]]),
  ]

  it("pega onde você está abaixo da sua média e outra marca lidera, do maior volume para o menor", () => {
    const gaps = findTopicGaps(topics, 34)
    expect(gaps.map((g) => g.topic.topic)).toEqual(["Investimentos", "Segurança"])
    expect(gaps[0]).toMatchObject({ mine: 19, leader: { brandName: "Inter", sharePct: 30 } })
  })

  it("tópico que você lidera não é espaço vago, mesmo abaixo da média", () => {
    expect(findTopicGaps(topics, 50).map((g) => g.topic.topic)).not.toContain("App")
  })

  it("respeita o limite", () => {
    expect(findTopicGaps(topics, 60, 1)).toHaveLength(1)
  })
})

describe("matchup", () => {
  const topics = [
    topic("App", 120, [["Nubank", 42, true], ["Itaú", 18]]),
    topic("Atendimento", 90, [["Itaú", 33], ["Nubank", 22, true]]),
    topic("Cartão", 80, [["Itaú", 29], ["Nubank", 31, true]]),
    topic("Investimentos", 98, [["Inter", 60], ["Nubank", 40, true]]),
    topic("Cripto", 30, [["Inter", 100]]),
  ]

  it("separa onde você lidera, onde ele lidera e onde está disputado", () => {
    const m = matchup(topics, "itaú")
    expect(m.youLead.map((d) => d.topic)).toEqual(["Investimentos", "App"])
    expect(m.theyLead.map((d) => d.topic)).toEqual(["Atendimento"])
    expect(m.contested.map((d) => d.topic)).toEqual(["Cartão"])
  })

  it(`diferença de até ${CONTESTED_MARGIN}pp é disputa — o share já vem arredondado`, () => {
    const d = matchup(topics, "itaú").contested[0]
    expect(d).toMatchObject({ yours: 31, theirs: 29, gap: 2 })
  })

  it("concorrente ausente num tópico em que você aparece conta como zero", () => {
    const investimentos = matchup(topics, "itaú").youLead.find((d) => d.topic === "Investimentos")
    expect(investimentos).toMatchObject({ yours: 40, theirs: 0, gap: 40 })
  })

  it("tópico sem nenhum dos dois não entra — é conversa de terceiros", () => {
    const m = matchup(topics, "itaú")
    const todos = [...m.youLead, ...m.theyLead, ...m.contested].map((d) => d.topic)
    expect(todos).not.toContain("Cripto")
  })
})

describe("nearestRival", () => {
  it("fora da liderança: quem está logo acima — é quem você precisa passar", () => {
    const ranked = rankBrands([brand("Nubank", 34), brand("Itaú", 24), brand("Inter", 18, { isYou: true })])
    expect(nearestRival(ranked)?.brandName).toBe("Itaú")
  })

  it("liderando: o segundo — é quem pode te passar", () => {
    const ranked = rankBrands([brand("Nubank", 34, { isYou: true }), brand("Itaú", 24), brand("Inter", 18)])
    expect(nearestRival(ranked)?.brandName).toBe("Itaú")
  })

  it("sem marca própria, ou sozinha no conjunto, não há com quem comparar", () => {
    expect(nearestRival(rankBrands([brand("Itaú", 60), brand("Inter", 40)]))).toBeNull()
    expect(nearestRival(rankBrands([brand("Nubank", 100, { isYou: true })]))).toBeNull()
  })
})
