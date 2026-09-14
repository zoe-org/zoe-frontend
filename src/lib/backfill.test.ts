import { describe, expect, it } from "vitest"
import {
  brl, describeBlocked, describeOfferUnavailable, describeSyncResult, nextCheckoutStep,
  offerNotes, outsideOffer, parseBackfillReturn, reachesPastRawRetention,
} from "@/lib/backfill"

describe("describeBlocked", () => {
  it("diz quantos, nunca some em silêncio", () => {
    expect(describeBlocked({ blockedCount: 3, blockedFrom: null, blockedTo: null }))
      .toBe("3 vídeos estão fora da sua cobertura.")
    expect(describeBlocked({ blockedCount: 1, blockedFrom: null, blockedTo: null }))
      .toBe("1 vídeo está fora da sua cobertura.")
  })

  it("inclui o período de análise quando a api manda", () => {
    const text = describeBlocked({
      blockedCount: 2, blockedFrom: "2026-08-01T12:00:00Z", blockedTo: "2026-08-20T12:00:00Z",
    })
    expect(text).toContain("2 vídeos analisados entre ")
    expect(text).toContain("2026")
  })

  it("mesmo dia não vira 'entre X e X'", () => {
    const text = describeBlocked({
      blockedCount: 10, blockedFrom: "2026-09-13T10:00:00Z", blockedTo: "2026-09-13T15:00:00Z",
    })
    expect(text).toContain("10 vídeos analisados em ")
    expect(text).not.toContain("entre")
  })

  it("sem bloqueado não há frase", () => {
    expect(describeBlocked({ blockedCount: 0, blockedFrom: null, blockedTo: null })).toBeNull()
  })
})

describe("describeOfferUnavailable", () => {
  it("explica a janela do tier quando não há o que desbloquear", () => {
    const text = describeOfferUnavailable({ reason: "nothing_to_unlock", windowDays: 30 })
    expect(text).toContain("últimos 30 dias")
    expect(text).toContain("fila de vídeos longos")
  })

  it("motivo desconhecido não quebra", () => {
    expect(describeOfferUnavailable({ reason: "novo", windowDays: 7 })).toContain("não está disponível")
  })
})

describe("offerNotes", () => {
  it("lista o que mexeu no preço", () => {
    expect(offerNotes({ ownedCount: 2, floorApplied: true, ceilingApplied: false })).toEqual([
      "2 vídeos do seu próprio canal entram sem custo.",
      "O valor inclui o mínimo por compra.",
    ])
    expect(offerNotes({ ownedCount: 0, floorApplied: false, ceilingApplied: true }))
      .toEqual(["O valor foi limitado ao da sua mensalidade."])
  })
})

describe("outsideOffer", () => {
  it("é a diferença entre bloqueado e ofertado, nunca negativa", () => {
    expect(outsideOffer(10, 7)).toBe(3)
    expect(outsideOffer(5, 5)).toBe(0)
    expect(outsideOffer(2, 4)).toBe(0)
  })
})

describe("reachesPastRawRetention", () => {
  const now = new Date("2026-09-13T12:00:00Z")

  it("avisa quando a janela passa dos 30 dias da mídia bruta", () => {
    expect(reachesPastRawRetention("2026-07-15T00:00:00Z", now)).toBe(true)
    expect(reachesPastRawRetention("2026-09-01T00:00:00Z", now)).toBe(false)
    expect(reachesPastRawRetention(null, now)).toBe(false)
  })
})

describe("nextCheckoutStep", () => {
  it("redireciona, libera ou pede chave nova", () => {
    expect(nextCheckoutStep({ status: "checkout", checkoutUrl: "https://pay", grantedCount: 0 }))
      .toEqual({ kind: "redirect", url: "https://pay" })
    expect(nextCheckoutStep({ status: "completed", checkoutUrl: null, grantedCount: 4 }))
      .toEqual({ kind: "granted", count: 4 })
    expect(nextCheckoutStep({ status: "expired", checkoutUrl: null, grantedCount: 0 }))
      .toEqual({ kind: "retry" })
  })
})

describe("describeSyncResult", () => {
  it("distingue liberado, compensando e vencido", () => {
    expect(describeSyncResult({ status: "completed", grantedCount: 12 }).title)
      .toBe("Análises liberadas: 12 vídeos.")
    expect(describeSyncResult({ status: "checkout", grantedCount: 0 }).kind).toBe("pending")
    expect(describeSyncResult({ status: "expired", grantedCount: 0 }).detail).toContain("nada foi cobrado")
  })
})

describe("parseBackfillReturn", () => {
  const id = "5f0c7c1e-3b2a-4d7e-9a61-2f8b7c9d0e11"

  it("lê a volta do Stripe", () => {
    expect(parseBackfillReturn(new URLSearchParams(`backfill=success&tenantBrandId=${id}`)))
      .toEqual({ outcome: "success", tenantBrandId: id })
    expect(parseBackfillReturn(new URLSearchParams(`backfill=cancel&tenantBrandId=${id}`))?.outcome)
      .toBe("cancel")
  })

  it("ignora o que não é retorno válido", () => {
    expect(parseBackfillReturn(new URLSearchParams("settings=plano"))).toBeNull()
    expect(parseBackfillReturn(new URLSearchParams(`backfill=talvez&tenantBrandId=${id}`))).toBeNull()
    expect(parseBackfillReturn(new URLSearchParams("backfill=success&tenantBrandId=x"))).toBeNull()
  })
})

describe("brl", () => {
  it("formata centavos em reais", () => {
    expect(brl(4900)).toContain("49,00")
  })
})
