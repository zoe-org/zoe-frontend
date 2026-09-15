import { describe, expect, it } from "vitest"
import type { DeliverySummary } from "@/lib/api/operations"
import { agruparPorContrato, ordenarFila } from "./deliveryQueue"
import { esperaLabel } from "./queueNavigation"

const entrega = (p: Partial<DeliverySummary>): DeliverySummary => ({
  deliveryId: "d",
  contractId: "c",
  campaignId: null,
  campaignName: null,
  influencerName: "Criadora",
  submittedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  youtubeVideoId: "dQw4w9WgXcQ",
  platform: "YouTube",
  status: "Submitted",
  submissionAttempt: 1,
  submittedAt: "2026-09-10T12:00:00Z",
  reviewDueAt: null,
  isReviewOverdue: false,
  decidedByUserId: null,
  decisionNotes: null,
  auditType: null,
  escrowState: null,
  escrowAmountCents: null,
  audit: null,
  paymentFollowsApproval: false,
  creatorPayoutReady: false,
  ...p,
})

describe("agruparPorContrato", () => {
  it("junta as tentativas do mesmo contrato e decide pela mais recente", () => {
    const grupos = agruparPorContrato([
      entrega({ deliveryId: "1", contractId: "A", submissionAttempt: 1, status: "ReworkRequested" }),
      entrega({ deliveryId: "2", contractId: "A", submissionAttempt: 2, status: "Submitted" }),
      entrega({ deliveryId: "3", contractId: "B", submissionAttempt: 1 }),
    ])

    expect(grupos).toHaveLength(2)
    const a = grupos.find((g) => g.current.contractId === "A")!
    expect(a.current.deliveryId).toBe("2")
    expect(a.previous.map((p) => p.deliveryId)).toEqual(["1"])
  })
})

describe("ordenarFila", () => {
  const grupos = agruparPorContrato([
    entrega({ deliveryId: "velha", contractId: "A", submittedAt: "2026-09-01T00:00:00Z" }),
    entrega({ deliveryId: "nova", contractId: "B", submittedAt: "2026-09-12T00:00:00Z" }),
    entrega({ deliveryId: "vencida", contractId: "C", submittedAt: "2026-09-11T00:00:00Z", isReviewOverdue: true }),
  ])

  it("pendentes: prazo vencido primeiro, depois quem chegou antes", () => {
    expect(ordenarFila(grupos, true).map((g) => g.current.deliveryId)).toEqual(["vencida", "velha", "nova"])
  })

  it("demais abas: mais recente no topo", () => {
    expect(ordenarFila(grupos, false).map((g) => g.current.deliveryId)).toEqual(["nova", "vencida", "velha"])
  })
})

describe("esperaLabel", () => {
  const agora = Date.parse("2026-09-15T12:00:00Z")

  it.each([
    ["2026-09-15T11:59:30Z", "agora"],
    ["2026-09-15T11:20:00Z", "há 40 min"],
    ["2026-09-15T07:00:00Z", "há 5 h"],
    ["2026-09-14T10:00:00Z", "há 1 dia"],
    ["2026-09-11T12:00:00Z", "há 4 dias"],
  ])("%s → %s", (iso, esperado) => {
    expect(esperaLabel(iso, agora)).toBe(esperado)
  })
})
