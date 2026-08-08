import { describe, expect, it } from "vitest"
import {
  canReceivePayout, payoutBlockReason,
  CONTRACT_MODALITIES, MODALITY_ESCROW, supportsEscrow, escrowRejectionReason,
  CAMPAIGN_MODALITIES, fmtCents, allowedCampaignTransitions,
  fieldInputKind, contractProgress, type ContractField,
} from "@/lib/api/operations"

const field = (over: Partial<ContractField>): ContractField => ({
  placeholder: "x", label: "X", dataType: "FreeText", kind: "Legal",
  isRequired: false, helpText: null, value: null, ...over,
})

// O KYC trava o RECEBIMENTO, não a produção (RN-O-012). Estes testes fixam essa
// assimetria: nenhum estado de KYC impede contratar, mas só um permite pagar.
describe("canReceivePayout", () => {
  it("libera só com KYC verificado E conta de recebimento", () => {
    expect(canReceivePayout({ kycStatus: "Verified", hasStripeAccount: true })).toBe(true)
  })

  it("bloqueia KYC verificado sem conta de recebimento", () => {
    expect(canReceivePayout({ kycStatus: "Verified", hasStripeAccount: false })).toBe(false)
  })

  it("bloqueia conta de recebimento sem KYC verificado", () => {
    for (const kycStatus of ["NotStarted", "Pending", "Rejected"]) {
      expect(canReceivePayout({ kycStatus, hasStripeAccount: true })).toBe(false)
    }
  })
})

describe("payoutBlockReason", () => {
  it("não dá motivo quando está liberado", () => {
    expect(payoutBlockReason({ kycStatus: "Verified", hasStripeAccount: true })).toBeNull()
  })

  it("distingue recusado de pendente — são conversas diferentes com o criador", () => {
    expect(payoutBlockReason({ kycStatus: "Rejected", hasStripeAccount: true })).toBe("KYC recusado")
    expect(payoutBlockReason({ kycStatus: "Pending", hasStripeAccount: true })).toBe("KYC pendente")
    expect(payoutBlockReason({ kycStatus: "NotStarted", hasStripeAccount: false })).toBe("KYC pendente")
  })

  it("aponta a conta quando o KYC já passou", () => {
    expect(payoutBlockReason({ kycStatus: "Verified", hasStripeAccount: false }))
      .toBe("sem conta de recebimento")
  })
})

// A matriz aqui é ESPELHO da do domínio (ContractModalityRules). O backend
// revalida e é a autoridade — estes testes existem para o espelho não deslizar
// em silêncio, que é o único jeito de a tela passar a mentir para o usuário.
describe("matriz modalidade × custódia", () => {
  it("cobre todas as modalidades, sem sobra nem falta", () => {
    expect(Object.keys(MODALITY_ESCROW).sort()).toEqual([...CONTRACT_MODALITIES].sort())
  })

  it("só Publipost, UGC e Eventos aceitam custódia no MVP", () => {
    const supported = CONTRACT_MODALITIES.filter(supportsEscrow)
    expect([...supported].sort()).toEqual(["Events", "Publipost", "Ugc"])
  })

  it("permuta é recusada por não ter dinheiro, não por falta de mecânica", () => {
    expect(escrowRejectionReason("Barter")).toContain("não tem fluxo financeiro")
    expect(escrowRejectionReason("Affiliate")).toContain("custódia por etapas")
  })

  it("modalidade suportada não tem motivo de recusa", () => {
    for (const m of ["Publipost", "Ugc", "Events"]) {
      expect(escrowRejectionReason(m)).toBeNull()
    }
  })
})

describe("modalidades oferecidas para campanha", () => {
  it("oferece todas as dez — a regra proíbe custódia, não o contrato", () => {
    expect([...CAMPAIGN_MODALITIES].sort()).toEqual([...CONTRACT_MODALITIES].sort())
  })

  it("toda modalidade sem custódia tem um motivo para mostrar na tela", () => {
    // A regra teme o silêncio, não a ausência de escrow: se não há proteção
    // financeira, a tela precisa ter o que dizer.
    for (const m of CAMPAIGN_MODALITIES) {
      if (supportsEscrow(m)) continue
      expect(escrowRejectionReason(m)).toBeTruthy()
    }
  })

  it("avisa que o pagamento sai da plataforma quando falta a custódia por etapas", () => {
    expect(escrowRejectionReason("Ambassador")).toContain("fora da Zoe")
    // Permuta não: lá não há pagamento nenhum a acontecer fora.
    expect(escrowRejectionReason("Barter")).not.toContain("fora da Zoe")
  })
})

describe("fmtCents", () => {
  // O Intl usa espaco nao-quebravel depois de "R$"; normalizamos para o teste nao
  // depender de qual espaco a runtime escolheu.
  const norm = (s: string) => s.replace(/\s/g, " ")

  it("formata centavos inteiros em reais", () => {
    expect(norm(fmtCents(500_000))).toBe("R$ 5.000")
    expect(norm(fmtCents(0))).toBe("R$ 0")
  })

  it("arredonda centavos quebrados em vez de exibir casas", () => {
    expect(norm(fmtCents(123_456))).toBe("R$ 1.235")
  })
})

describe("fieldInputKind", () => {
  it("mapeia os oito tipos do domínio sem deixar nenhum sem input", () => {
    expect(fieldInputKind("Date")).toBe("date")
    expect(fieldInputKind("Currency")).toBe("number")
    expect(fieldInputKind("Percentage")).toBe("number")
    expect(fieldInputKind("Boolean")).toBe("checkbox")
    expect(fieldInputKind("FreeText")).toBe("text")
    expect(fieldInputKind("Document")).toBe("text")
    // Enum e Attachment caem em texto porque a API ainda não manda opções nem
    // aceita upload — se um dia mandar, este teste é o lugar de mudar.
    expect(fieldInputKind("Enum")).toBe("text")
    expect(fieldInputKind("Attachment")).toBe("text")
  })

  it("tipo desconhecido vira texto em vez de quebrar a tela", () => {
    expect(fieldInputKind("AlgoNovo")).toBe("text")
  })
})

describe("contractProgress", () => {
  it("conta só os obrigatórios", () => {
    expect(contractProgress([
      field({ isRequired: true, value: "ok" }),
      field({ isRequired: true, value: null }),
      field({ isRequired: false, value: "ok" }),
    ])).toEqual({ required: 2, filled: 1 })
  })

  it("espaço em branco não conta como preenchido", () => {
    expect(contractProgress([field({ isRequired: true, value: "   " })]))
      .toEqual({ required: 1, filled: 0 })
  })

  it("contrato sem obrigatórios não divide por zero", () => {
    expect(contractProgress([field({ isRequired: false, value: null })]))
      .toEqual({ required: 0, filled: 0 })
  })
})

describe("allowedCampaignTransitions", () => {
  it("rascunho ativa ou cancela", () => {
    expect(allowedCampaignTransitions("Draft")).toEqual(["Activate", "Cancel"])
  })

  it("ativa conclui ou cancela — não volta para rascunho", () => {
    expect(allowedCampaignTransitions("Active")).toEqual(["Complete", "Cancel"])
  })

  it("encerrada não oferece nada: reabrir reescreveria o contexto de contratos assinados", () => {
    expect(allowedCampaignTransitions("Completed")).toEqual([])
    expect(allowedCampaignTransitions("Cancelled")).toEqual([])
  })

  it("status desconhecido não oferece transição em vez de chutar", () => {
    expect(allowedCampaignTransitions("AlgoNovo")).toEqual([])
  })
})
