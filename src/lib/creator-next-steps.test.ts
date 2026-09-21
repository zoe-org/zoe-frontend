import { describe, expect, it } from "vitest"
import type { CreatorDelivery, CreatorEngagement, CreatorWorkspace } from "@/lib/api/creator"
import { nextSteps } from "./creator-next-steps"

const engagement = (p: Partial<CreatorEngagement>): CreatorEngagement => ({
  contractId: "c1",
  campaignId: "camp",
  campaignName: "Verão",
  brandName: "Nubank",
  modality: "Publipost",
  contractStatus: "Signed",
  amountCents: null,
  netToInfluencerCents: null,
  escrowState: null,
  canSubmitDelivery: true,
  blockedReason: null,
  deliveries: [],
  draft: null,
  requiresDraftApproval: true,
  usesEscrow: true,
  ...p,
})

const area = (engagements: CreatorEngagement[], p: Partial<CreatorWorkspace> = {}): CreatorWorkspace => ({
  influencerId: "i",
  fullName: "Ana Souza",
  email: "ana@exemplo.com",
  kycStatus: "Verified",
  canReceivePayout: true,
  payoutBlockedReason: null,
  taxId: "***.456.789-**",
  profile: {} as CreatorWorkspace["profile"],
  engagements,
  ...p,
})

const delivery = (p: Partial<CreatorDelivery>) => ({ submissionAttempt: 1, status: "Submitted", decisionNotes: null, ...p }) as CreatorDelivery

const titles = (w: CreatorWorkspace) => nextSteps(w).map((p) => p.title)

describe("proximosPassos", () => {
  it("contrato enviado pede a assinatura, na aba de contratos", () => {
    const steps = nextSteps(area([engagement({ contractStatus: "SentForSignature", canSubmitDelivery: false })]))
    expect(steps.map((p) => p.title)).toEqual(["Assinar o contrato"])
    expect(steps[0].target).toEqual({ tab: "contracts", contractId: "c1" })
  })

  it("segue a ordem do processo: corte, refazer, publicar, corrigir", () => {
    expect(titles(area([engagement({})]))).toEqual(["Enviar o corte para aprovação"])
    expect(titles(area([engagement({ draft: { status: "ChangesRequested", decisionNotes: "cortar o início" } as CreatorEngagement["draft"] })])))
      .toEqual(["Refazer o corte"])
    expect(titles(area([engagement({ draft: { status: "Approved" } as CreatorEngagement["draft"] })])))
      .toEqual(["Publicar e mandar o link"])
    expect(titles(area([engagement({
      draft: { status: "Approved" } as CreatorEngagement["draft"],
      deliveries: [delivery({ submissionAttempt: 1, status: "ReworkRequested" })],
    })]))).toEqual(["Corrigir a publicação e reenviar o link"])
  })

  it("o que é da marca não vira passo do criador", () => {
    expect(titles(area([
      engagement({ contractId: "a", draft: { status: "AwaitingReview" } as CreatorEngagement["draft"] }),
      engagement({ contractId: "b", requiresDraftApproval: false, deliveries: [delivery({ status: "Submitted" })] }),
      engagement({ contractId: "c", contractStatus: "Draft", canSubmitDelivery: false }),
    ]))).toEqual([])
  })

  it("documento e conta de recebimento entram no fim", () => {
    expect(titles(area([], {
      taxId: null, kycStatus: "NotStarted", canReceivePayout: false, payoutBlockedReason: "Conta não conectada",
    }))).toEqual(["Informar seu CPF ou CNPJ", "Conectar a conta de recebimento"])
  })

  it("conta de recebimento: o título segue o estado, e o motivo vem da API", () => {
    const blocked = (kycStatus: string) => nextSteps(area([], {
      kycStatus, canReceivePayout: false, payoutBlockedReason: `motivo ${kycStatus}`,
    }))[0]

    // Pending não afirma "em verificação": esta camada não sabe se a bola está com o
    // criador ou com o provedor — só a tela de recebimento, que consulta na hora, sabe.
    expect(blocked("Pending").title).toBe("Conferir a conta de recebimento")
    expect(blocked("Pending").detail).toBe("motivo Pending")
    expect(blocked("Rejected").title).toBe("Revisar os dados da conta de recebimento")
  })
})
