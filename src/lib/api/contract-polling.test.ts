import { describe, expect, it } from "vitest"
import { intervaloDeEspera, type ContractDetail } from "./operations"

const agora = Date.parse("2026-09-15T12:00:00Z")

const contrato = (p: Partial<ContractDetail>): ContractDetail => ({
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
    expect(intervaloDeEspera(contrato({ status: "Draft" }), agora)).toBe(false)
  })

  it("aguardando assinatura consulta de tempos em tempos", () => {
    expect(intervaloDeEspera(contrato({ status: "SentForSignature" }), agora)).toBe(30_000)
  })

  it("assinado com pagamento automático acompanha a custódia abrindo", () => {
    const recem = contrato({ status: "Signed", signedAt: "2026-09-15T11:58:00Z" })
    expect(intervaloDeEspera(recem, agora)).toBe(4_000)
    expect(intervaloDeEspera({ ...recem, escrowAccountId: "e", escrowState: "PendingDeposit" }, agora)).toBe(4_000)
  })

  it("para quando a custódia já foi reservada", () => {
    const reservada = contrato({
      status: "Signed", signedAt: "2026-09-15T11:58:00Z", escrowAccountId: "e", escrowState: "Funded",
    })
    expect(intervaloDeEspera(reservada, agora)).toBe(false)
  })

  it("para depois da janela — aí a tela oferece abrir à mão", () => {
    expect(intervaloDeEspera(contrato({ status: "Signed", signedAt: "2026-09-15T11:30:00Z" }), agora)).toBe(false)
  })

  it("sem pagamento automático não fica esperando", () => {
    expect(intervaloDeEspera(
      contrato({ status: "Signed", autoAdvanceEscrow: false, signedAt: "2026-09-15T11:58:00Z" }), agora,
    )).toBe(false)
  })
})
