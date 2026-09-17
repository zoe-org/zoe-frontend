import { describe, expect, it } from "vitest"
import type {
  CampaignContract, CampaignDelivery, CampaignDetail, CampaignInvite,
} from "@/lib/api/operations"
import { campaignFunnel } from "./campaign-funnel"

const contract = (p: Partial<CampaignContract>) => ({
  contractId: "k1", influencerId: "i1", influencerName: "Ana", status: "Signed", usesEscrow: true,
  escrowAmountCents: null, escrowState: null, signedAt: null, ...p,
}) as CampaignContract

const delivery = (p: Partial<CampaignDelivery>) => ({
  deliveryId: "d1", contractId: "k1", influencerName: "Ana", submittedUrl: "", status: "Submitted",
  submissionAttempt: 1, submittedAt: "2026-09-10T00:00:00Z", reviewDueAt: null, isReviewOverdue: false, ...p,
}) as CampaignDelivery

const invite = (p: Partial<CampaignInvite>) => ({
  inviteId: "v1", influencerId: "i1", influencerName: "Ana", email: "ana@x.com", accepted: false,
  expired: false, createdAt: "2026-09-01T00:00:00Z", feeCents: null, expectedDeliverables: null,
  deliveryDeadline: null, ...p,
}) as CampaignInvite

const campaign = (p: Partial<CampaignDetail>) => ({
  campaignId: "c1", contracts: [], deliveries: [], invites: [], ...p,
}) as unknown as CampaignDetail

const stages = (d: CampaignDetail) => campaignFunnel(d).map((l) => l.stage)

describe("funilDaCampanha", () => {
  it("convite sem contrato: enviado, vencido ou aceito", () => {
    expect(stages(campaign({ invites: [invite({})] }))).toEqual(["Convite enviado"])
    expect(stages(campaign({ invites: [invite({ expired: true })] }))).toEqual(["Convite vencido"])
    expect(campaignFunnel(campaign({ invites: [invite({ accepted: true })] }))[0].action?.label).toBe("Criar contrato")
  })

  it("contrato: rascunho, assinatura e custódia", () => {
    expect(stages(campaign({ contracts: [contract({ status: "Draft" })] }))).toEqual(["Rascunho do contrato"])
    expect(stages(campaign({ contracts: [contract({ status: "SentForSignature" })] }))).toEqual(["Aguardando assinatura"])
    expect(stages(campaign({ contracts: [contract({})] }))).toEqual(["Assinado — custódia não aberta"])
    expect(stages(campaign({ contracts: [contract({ escrowState: "InProduction" })] }))).toEqual(["Em produção"])
  })

  it("sem entrega, o corte diz a etapa — e o que espera aprovação vai para a fila de cortes", () => {
    const [row] = campaignFunnel(campaign({ contracts: [contract({ escrowState: "InProduction", draftStatus: "AwaitingReview" })] }))
    expect(row).toMatchObject({ stage: "Corte esperando aprovação", tone: "attention" })
    expect(row.action?.to).toBe("/operations/deliveries?stage=drafts")
    expect(stages(campaign({ contracts: [contract({ escrowState: "InProduction", draftStatus: "ChangesRequested" })] })))
      .toEqual(["Correção no corte — vez do criador"])
  })

  it("entrega: a última tentativa decide, e revisar leva à fila no contrato", () => {
    const d = campaign({
      contracts: [contract({ escrowState: "Delivered" })],
      deliveries: [
        delivery({ deliveryId: "a", submissionAttempt: 1, status: "ReworkRequested" }),
        delivery({ deliveryId: "b", submissionAttempt: 2, status: "Submitted" }),
      ],
    })
    const [row] = campaignFunnel(d)
    expect(row.stage).toBe("Entrega esperando revisão")
    expect(row.action?.to).toBe("/operations/deliveries?campaign=c1&contract=k1")
  })

  it("liberável com a conta do criador não pronta não é pendência da marca", () => {
    const d = campaign({
      contracts: [contract({ escrowState: "Releasable" })],
      deliveries: [delivery({ status: "Approved" })],
    })

    expect(campaignFunnel(d)[0]).toMatchObject({ stage: "Aprovada — pagamento liberável", tone: "attention" })
    expect(campaignFunnel(d, new Set(["i1"]))[0]).toMatchObject({
      stage: "Aprovada — pagamento esperando a conta do criador",
      tone: "neutral",
      action: { label: "Ver criador", to: "/operations/influencers?creator=i1" },
    })
  })

  it("contrato cancelado não esconde o trabalho atual do mesmo criador", () => {
    expect(stages(campaign({
      contracts: [contract({ contractId: "velho", status: "Cancelled" }), contract({ contractId: "novo", status: "Draft" })],
    }))).toEqual(["Rascunho do contrato"])
  })

  it("vários trabalhos do mesmo criador: a linha mostra o que precisa da marca e conta os outros", () => {
    const d = campaign({
      contracts: [
        contract({ contractId: "k1", escrowState: "Delivered" }),
        contract({ contractId: "k2", status: "Draft" }),
        contract({ contractId: "k3", escrowState: "Released" }),
        contract({ contractId: "k4", status: "Cancelled" }),
      ],
      deliveries: [delivery({ contractId: "k1" })],
    })
    const rows = campaignFunnel(d)
    expect(rows).toHaveLength(1)
    // Empate em "atenção" entre a entrega e o rascunho: vale o mais antigo, esperando há mais tempo.
    expect(rows[0]).toMatchObject({ stage: "Entrega esperando revisão", otherContracts: 2 })
  })

  it("o pago antigo não esconde o trabalho novo em andamento", () => {
    const d = campaign({
      contracts: [
        contract({ contractId: "velho", escrowState: "Released" }),
        contract({ contractId: "novo", escrowState: "InProduction" }),
      ],
    })
    expect(campaignFunnel(d)[0]).toMatchObject({ stage: "Em produção", otherContracts: 1 })
  })

  it("quem precisa da marca sobe; o que terminou desce", () => {
    const d = campaign({
      contracts: [
        contract({ contractId: "k1", influencerId: "pago", influencerName: "Pago", escrowState: "Released" }),
        contract({ contractId: "k2", influencerId: "rev", influencerName: "Revisar", escrowState: "Delivered" }),
        contract({ contractId: "k3", influencerId: "disp", influencerName: "Disputa", escrowState: "Disputed" }),
      ],
      deliveries: [delivery({ contractId: "k2" })],
    })
    expect(campaignFunnel(d).map((l) => l.creatorName)).toEqual(["Disputa", "Revisar", "Pago"])
  })
})
