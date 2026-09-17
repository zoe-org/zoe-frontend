import { describe, expect, it } from "vitest"
import { pollInterval, type ContractDetail } from "./operations"

const now = Date.parse("2026-09-15T12:00:00Z")

const contract = (p: Partial<ContractDetail>): ContractDetail => ({
  status: "Draft",
  usesEscrow: true,
  autoAdvanceEscrow: true,
  escrowAccountId: null,
  escrowState: null,
  signedAt: null,
  ...p,
}) as ContractDetail

describe("intervaloDeEspera", () => {
  it("rascunho não se atualiza sozinho", () => {
    expect(pollInterval(contract({ status: "Draft" }), now)).toBe(false)
  })

  it("aguardando assinatura consulta de tempos em tempos", () => {
    expect(pollInterval(contract({ status: "SentForSignature" }), now)).toBe(30_000)
  })

  it("assinado com pagamento automático acompanha a custódia abrindo", () => {
    const justSigned = contract({ status: "Signed", signedAt: "2026-09-15T11:58:00Z" })
    expect(pollInterval(justSigned, now)).toBe(4_000)
    expect(pollInterval({ ...justSigned, escrowAccountId: "e", escrowState: "PendingDeposit" }, now)).toBe(4_000)
  })

  it("para quando a custódia já foi reservada", () => {
    const reserved = contract({
      status: "Signed", signedAt: "2026-09-15T11:58:00Z", escrowAccountId: "e", escrowState: "Funded",
    })
    expect(pollInterval(reserved, now)).toBe(false)
  })

  it("para depois da janela — aí a tela oferece abrir à mão", () => {
    expect(pollInterval(contract({ status: "Signed", signedAt: "2026-09-15T11:30:00Z" }), now)).toBe(false)
  })

  it("sem pagamento automático não fica esperando", () => {
    expect(pollInterval(
      contract({ status: "Signed", autoAdvanceEscrow: false, signedAt: "2026-09-15T11:58:00Z" }), now,
    )).toBe(false)
  })
})
