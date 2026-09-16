import { describe, expect, it } from "vitest"
import {
  describeDecision, formatDuration, quotaImpact, selectionTotals, summarizeDecision,
} from "@/lib/long-videos"

const items = [
  { id: "a", estimatedMinutes: 120, collected: true },
  { id: "b", estimatedMinutes: 180, collected: false },
  { id: "c", estimatedMinutes: 95, collected: true },
  { id: "d", estimatedMinutes: 200, collected: true },
]

describe("summarizeDecision", () => {
  it("separa cobrado agora, aguardando coleta e o que ficou de fora", () => {
    const s = summarizeDecision("Approve", {
      items: [
        { id: "a", result: "approved", reason: null },
        { id: "b", result: "approved", reason: "awaiting_collection" },
        { id: "c", result: "skipped", reason: "exceeds_spend_cap" },
        { id: "d", result: "skipped", reason: "exceeds_spend_cap" },
      ],
      debitedMinutes: 120,
    }, items)

    expect(s.approvedNow).toBe(1)
    expect(s.awaitingCollection).toBe(1)
    expect(s.reservedMinutes).toBe(180)
    expect(s.skipped).toEqual([{ reason: "exceeds_spend_cap", count: 2, minutes: 295 }])
    expect(s.spendCapShortMinutes).toBe(295)
    expect(s.debitedMinutes).toBe(120)
  })
})

describe("describeDecision", () => {
  it("lote inteiro aprovado é sucesso e diz quanto debitou", () => {
    const s = summarizeDecision("Approve", {
      items: [{ id: "a", result: "approved", reason: null }, { id: "c", result: "approved", reason: null }],
      debitedMinutes: 215,
    }, items)
    expect(describeDecision(s)).toEqual({
      tone: "success",
      title: "2 vídeos aprovados.",
      detail: "215 min debitados agora.",
    })
  })

  it("lote parcial diz o que entrou e o que ficou, sem virar erro", () => {
    const s = summarizeDecision("Approve", {
      items: [
        { id: "a", result: "approved", reason: null },
        { id: "b", result: "approved", reason: "awaiting_collection" },
        { id: "d", result: "skipped", reason: "exceeds_spend_cap" },
      ],
      debitedMinutes: 120,
    }, items)
    const msg = describeDecision(s)
    expect(msg.tone).toBe("partial")
    expect(msg.title).toBe("2 de 3 vídeos aprovados.")
    expect(msg.detail).toContain("120 min debitados agora.")
    expect(msg.detail).toContain("1 entra na próxima coleta")
    expect(msg.detail).toContain("180 min reservados no teto de gasto")
    expect(msg.detail).toContain("1 ficou de fora: não cabe no teto de gasto.")
  })

  it("nada entrou é falha, com os motivos", () => {
    const s = summarizeDecision("Approve", {
      items: [
        { id: "c", result: "skipped", reason: "brand_budget_exhausted" },
        { id: "d", result: "skipped", reason: "already_decided" },
      ],
      debitedMinutes: 0,
    }, items)
    expect(describeDecision(s)).toEqual({
      tone: "failure",
      title: "Nenhum vídeo aprovado.",
      detail: "1 ficou de fora: passaria do teto de minutos da marca. 1 ficou de fora: já tinha sido decidido.",
    })
  })

  it("descarte não fala de minutos", () => {
    const s = summarizeDecision("Dismiss", {
      items: [{ id: "a", result: "dismissed", reason: null }],
      debitedMinutes: 0,
    }, items)
    expect(describeDecision(s)).toEqual({ tone: "success", title: "1 vídeo descartado.", detail: undefined })
  })

  it("motivo desconhecido não quebra a frase", () => {
    const s = summarizeDecision("Dismiss", {
      items: [{ id: "a", result: "dismissed", reason: null }, { id: "b", result: "skipped", reason: "novo_motivo" }],
      debitedMinutes: 0,
    }, items)
    expect(describeDecision(s).detail).toBe("1 ficou de fora: não foi processado.")
  })
})

describe("selectionTotals", () => {
  it("soma só o selecionado e conta os não coletados", () => {
    expect(selectionTotals(items, new Set(["a", "b"]))).toEqual({ count: 2, minutes: 300, notCollected: 1 })
    expect(selectionTotals(items, new Set())).toEqual({ count: 0, minutes: 0, notCollected: 0 })
  })
})

describe("quotaImpact", () => {
  it("sem cota conhecida não estima", () => {
    expect(quotaImpact({ billedMinutes: 100, quotaMinutes: 0 }, 50)).toBeNull()
  })

  it("mostra o excedente que esta aprovação acrescenta", () => {
    expect(quotaImpact({ billedMinutes: 900, quotaMinutes: 1000 }, 300)).toEqual({
      billedAfter: 1200, quotaMinutes: 1000, overageAddedMinutes: 200, entersOverage: true,
    })
    // Já no excedente: acrescenta tudo, mas não "entra" de novo.
    expect(quotaImpact({ billedMinutes: 1100, quotaMinutes: 1000 }, 50)).toEqual({
      billedAfter: 1150, quotaMinutes: 1000, overageAddedMinutes: 50, entersOverage: false,
    })
    expect(quotaImpact({ billedMinutes: 100, quotaMinutes: 1000 }, 50)?.overageAddedMinutes).toBe(0)
  })
})

describe("formatDuration", () => {
  it("formata horas e minutos", () => {
    expect(formatDuration(11520)).toBe("3h 12min")
    expect(formatDuration(5400)).toBe("1h 30min")
    expect(formatDuration(3600)).toBe("1h")
    expect(formatDuration(3000)).toBe("50min")
    expect(formatDuration(10)).toBe("1min")
  })
})
