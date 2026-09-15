import { describe, expect, it } from "vitest"
import type {
  CampaignContract, CampaignDelivery, CampaignDetail, CampaignInvite,
} from "@/lib/api/operations"
import { funilDaCampanha } from "./campaignFunnel"

const contrato = (p: Partial<CampaignContract>) => ({
  contractId: "k1", influencerId: "i1", influencerName: "Ana", status: "Signed", usesEscrow: true,
  escrowAmountCents: null, escrowState: null, signedAt: null, ...p,
}) as CampaignContract

const entrega = (p: Partial<CampaignDelivery>) => ({
  deliveryId: "d1", contractId: "k1", influencerName: "Ana", submittedUrl: "", status: "Submitted",
  submissionAttempt: 1, submittedAt: "2026-09-10T00:00:00Z", reviewDueAt: null, isReviewOverdue: false, ...p,
}) as CampaignDelivery

const convite = (p: Partial<CampaignInvite>) => ({
  inviteId: "v1", influencerId: "i1", influencerName: "Ana", email: "ana@x.com", accepted: false,
  expired: false, createdAt: "2026-09-01T00:00:00Z", feeCents: null, expectedDeliverables: null,
  deliveryDeadline: null, ...p,
}) as CampaignInvite

const campanha = (p: Partial<CampaignDetail>) => ({
  campaignId: "c1", contracts: [], deliveries: [], invites: [], ...p,
}) as unknown as CampaignDetail

const etapa = (d: CampaignDetail) => funilDaCampanha(d).map((l) => l.etapa)

describe("funilDaCampanha", () => {
  it("convite sem contrato: enviado, vencido ou aceito", () => {
    expect(etapa(campanha({ invites: [convite({})] }))).toEqual(["Convite enviado"])
    expect(etapa(campanha({ invites: [convite({ expired: true })] }))).toEqual(["Convite vencido"])
    expect(funilDaCampanha(campanha({ invites: [convite({ accepted: true })] }))[0].acao?.label).toBe("Criar contrato")
  })

  it("contrato: rascunho, assinatura e custódia", () => {
    expect(etapa(campanha({ contracts: [contrato({ status: "Draft" })] }))).toEqual(["Rascunho do contrato"])
    expect(etapa(campanha({ contracts: [contrato({ status: "SentForSignature" })] }))).toEqual(["Aguardando assinatura"])
    expect(etapa(campanha({ contracts: [contrato({})] }))).toEqual(["Assinado — custódia não aberta"])
    expect(etapa(campanha({ contracts: [contrato({ escrowState: "InProduction" })] }))).toEqual(["Em produção"])
  })

  it("sem entrega, o corte diz a etapa — e o que espera aprovação vai para a fila de cortes", () => {
    const [linha] = funilDaCampanha(campanha({ contracts: [contrato({ escrowState: "InProduction", draftStatus: "AwaitingReview" })] }))
    expect(linha).toMatchObject({ etapa: "Corte esperando aprovação", tom: "atencao" })
    expect(linha.acao?.to).toBe("/operations/deliveries?etapa=cortes")
    expect(etapa(campanha({ contracts: [contrato({ escrowState: "InProduction", draftStatus: "ChangesRequested" })] })))
      .toEqual(["Correção no corte — vez do criador"])
  })

  it("entrega: a última tentativa decide, e revisar leva à fila no contrato", () => {
    const d = campanha({
      contracts: [contrato({ escrowState: "Delivered" })],
      deliveries: [
        entrega({ deliveryId: "a", submissionAttempt: 1, status: "ReworkRequested" }),
        entrega({ deliveryId: "b", submissionAttempt: 2, status: "Submitted" }),
      ],
    })
    const [linha] = funilDaCampanha(d)
    expect(linha.etapa).toBe("Entrega esperando revisão")
    expect(linha.acao?.to).toBe("/operations/deliveries?campanha=c1&contrato=k1")
  })

  it("liberável com a conta do criador não pronta não é pendência da marca", () => {
    const d = campanha({
      contracts: [contrato({ escrowState: "Releasable" })],
      deliveries: [entrega({ status: "Approved" })],
    })

    expect(funilDaCampanha(d)[0]).toMatchObject({ etapa: "Aprovada — pagamento liberável", tom: "atencao" })
    expect(funilDaCampanha(d, new Set(["i1"]))[0]).toMatchObject({
      etapa: "Aprovada — pagamento esperando a conta do criador",
      tom: "neutro",
      acao: { label: "Ver criador", to: "/operations/influencers?criador=i1" },
    })
  })

  it("contrato cancelado não esconde o trabalho atual do mesmo criador", () => {
    expect(etapa(campanha({
      contracts: [contrato({ contractId: "velho", status: "Cancelled" }), contrato({ contractId: "novo", status: "Draft" })],
    }))).toEqual(["Rascunho do contrato"])
  })

  it("vários trabalhos do mesmo criador: a linha mostra o que precisa da marca e conta os outros", () => {
    const d = campanha({
      contracts: [
        contrato({ contractId: "k1", escrowState: "Delivered" }),
        contrato({ contractId: "k2", status: "Draft" }),
        contrato({ contractId: "k3", escrowState: "Released" }),
        contrato({ contractId: "k4", status: "Cancelled" }),
      ],
      deliveries: [entrega({ contractId: "k1" })],
    })
    const linhas = funilDaCampanha(d)
    expect(linhas).toHaveLength(1)
    // Empate em "atenção" entre a entrega e o rascunho: vale o mais antigo, esperando há mais tempo.
    expect(linhas[0]).toMatchObject({ etapa: "Entrega esperando revisão", outrosContratos: 2 })
  })

  it("o pago antigo não esconde o trabalho novo em andamento", () => {
    const d = campanha({
      contracts: [
        contrato({ contractId: "velho", escrowState: "Released" }),
        contrato({ contractId: "novo", escrowState: "InProduction" }),
      ],
    })
    expect(funilDaCampanha(d)[0]).toMatchObject({ etapa: "Em produção", outrosContratos: 1 })
  })

  it("quem precisa da marca sobe; o que terminou desce", () => {
    const d = campanha({
      contracts: [
        contrato({ contractId: "k1", influencerId: "pago", influencerName: "Pago", escrowState: "Released" }),
        contrato({ contractId: "k2", influencerId: "rev", influencerName: "Revisar", escrowState: "Delivered" }),
        contrato({ contractId: "k3", influencerId: "disp", influencerName: "Disputa", escrowState: "Disputed" }),
      ],
      deliveries: [entrega({ contractId: "k2" })],
    })
    expect(funilDaCampanha(d).map((l) => l.nome)).toEqual(["Disputa", "Revisar", "Pago"])
  })
})
