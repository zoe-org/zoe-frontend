import { describe, expect, it } from "vitest"
import type { ContractSummary } from "@/lib/api/operations"
import { escrowMissing, isEscrowMissing } from "@/lib/contracts"

const contract = (over: Partial<ContractSummary> = {}): ContractSummary => ({
  contractId: "c1",
  influencerId: "i1",
  influencerName: "Ana",
  campaignId: null,
  campaignName: null,
  modality: "Publipost",
  hybridCode: null,
  status: "Signed",
  usesEscrow: true,
  templateVersion: 1,
  templateLegalReviewed: true,
  signedAt: "2026-09-01T12:00:00Z",
  escrowAccountId: null,
  escrowState: null,
  createdAt: "2026-08-20T12:00:00Z",
  ...over,
})

describe("isEscrowMissing", () => {
  it("acusa o assinado que previa custódia e não tem conta aberta", () => {
    expect(isEscrowMissing(contract())).toBe(true)
  })

  it("não acusa antes da assinatura: a conta nasce do contrato assinado", () => {
    expect(isEscrowMissing(contract({ status: "Draft" }))).toBe(false)
    expect(isEscrowMissing(contract({ status: "SentForSignature" }))).toBe(false)
  })

  it("não acusa contrato cancelado: não há o que reservar", () => {
    expect(isEscrowMissing(contract({ status: "Cancelled" }))).toBe(false)
  })

  it("não acusa quem não previa custódia — permuta não reserva dinheiro", () => {
    expect(isEscrowMissing(contract({ usesEscrow: false }))).toBe(false)
  })

  it("não acusa quando a custódia já foi aberta", () => {
    expect(isEscrowMissing(contract({ escrowAccountId: "e1", escrowState: "Held" }))).toBe(false)
  })

  it("cala diante de dado inconsistente: conta sem estado não é pendência conhecida", () => {
    expect(isEscrowMissing(contract({ escrowAccountId: "e1", escrowState: null }))).toBe(false)
  })
})

describe("escrowMissing", () => {
  it("devolve só os travados, preservando a ordem recebida", () => {
    const items = [
      contract({ contractId: "a" }),
      contract({ contractId: "b", status: "Draft" }),
      contract({ contractId: "c" }),
    ]
    expect(escrowMissing(items).map((c) => c.contractId)).toEqual(["a", "c"])
  })

  it("lista vazia não inventa pendência", () => {
    expect(escrowMissing([])).toEqual([])
  })
})
