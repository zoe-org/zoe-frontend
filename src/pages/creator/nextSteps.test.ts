import { describe, expect, it } from "vitest"
import type { CreatorDelivery, CreatorEngagement, CreatorWorkspace } from "@/lib/api/creator"
import { proximosPassos } from "./nextSteps"

const trabalho = (p: Partial<CreatorEngagement>): CreatorEngagement => ({
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

const entrega = (p: Partial<CreatorDelivery>) => ({ submissionAttempt: 1, status: "Submitted", decisionNotes: null, ...p }) as CreatorDelivery

const titulos = (w: CreatorWorkspace) => proximosPassos(w).map((p) => p.titulo)

describe("proximosPassos", () => {
  it("contrato enviado pede a assinatura, na aba de contratos", () => {
    const passos = proximosPassos(area([trabalho({ contractStatus: "SentForSignature", canSubmitDelivery: false })]))
    expect(passos.map((p) => p.titulo)).toEqual(["Assinar o contrato"])
    expect(passos[0].destino).toEqual({ aba: "contratos", contractId: "c1" })
  })

  it("segue a ordem do processo: corte, refazer, publicar, corrigir", () => {
    expect(titulos(area([trabalho({})]))).toEqual(["Enviar o corte para aprovação"])
    expect(titulos(area([trabalho({ draft: { status: "ChangesRequested", decisionNotes: "cortar o início" } as CreatorEngagement["draft"] })])))
      .toEqual(["Refazer o corte"])
    expect(titulos(area([trabalho({ draft: { status: "Approved" } as CreatorEngagement["draft"] })])))
      .toEqual(["Publicar e mandar o link"])
    expect(titulos(area([trabalho({
      draft: { status: "Approved" } as CreatorEngagement["draft"],
      deliveries: [entrega({ submissionAttempt: 1, status: "ReworkRequested" })],
    })]))).toEqual(["Corrigir a publicação e reenviar o link"])
  })

  it("o que é da marca não vira passo do criador", () => {
    expect(titulos(area([
      trabalho({ contractId: "a", draft: { status: "AwaitingReview" } as CreatorEngagement["draft"] }),
      trabalho({ contractId: "b", requiresDraftApproval: false, deliveries: [entrega({ status: "Submitted" })] }),
      trabalho({ contractId: "c", contractStatus: "Draft", canSubmitDelivery: false }),
    ]))).toEqual([])
  })

  it("documento e conta de recebimento entram no fim", () => {
    expect(titulos(area([], {
      taxId: null, kycStatus: "NotStarted", canReceivePayout: false, payoutBlockedReason: "Conta não conectada",
    }))).toEqual(["Informar seu CPF ou CNPJ", "Conectar a conta de recebimento"])
  })

  it("conta de recebimento: o título segue o estado, e o motivo vem da API", () => {
    const bloqueada = (kycStatus: string) => proximosPassos(area([], {
      kycStatus, canReceivePayout: false, payoutBlockedReason: `motivo ${kycStatus}`,
    }))[0]

    expect(bloqueada("Pending").titulo).toBe("Conta de recebimento em verificação")
    expect(bloqueada("Pending").detalhe).toBe("motivo Pending")
    expect(bloqueada("Rejected").titulo).toBe("Revisar os dados da conta de recebimento")
  })
})
