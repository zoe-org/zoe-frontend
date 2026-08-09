import { describe, expect, it } from "vitest"
import {
  MENTION_VOLUME_MAX,
  alertEventVideoTitle, describeAlertEvent, describeChannels, describeRuleCondition,
  emptyRuleForm, parseAlertSnapshot, parseDecimalPtBr, ruleToForm,
  toCreatePayload, toUpdatePayload, validateAlertRuleForm,
  type AlertRuleForm,
} from "@/lib/alerts"
import type { AlertRule } from "@/lib/api/alerts"

function form(overrides: Partial<AlertRuleForm> = {}): AlertRuleForm {
  return { ...emptyRuleForm("brand-1"), name: "Regra", threshold: "0,4", ...overrides }
}

describe("parseDecimalPtBr", () => {
  it("aceita vírgula como separador decimal (o usuário é pt-BR)", () => {
    expect(parseDecimalPtBr("0,4")).toBe(0.4)
    expect(parseDecimalPtBr("0.4")).toBe(0.4)
  })

  it("distingue vazio de inválido — os dois viram null, mas por caminhos diferentes", () => {
    expect(parseDecimalPtBr("")).toBeNull()
    expect(parseDecimalPtBr("   ")).toBeNull()
    expect(parseDecimalPtBr("abc")).toBeNull()
    expect(parseDecimalPtBr("0,4,5")).toBeNull()
  })

  it("aceita inteiro e zero", () => {
    expect(parseDecimalPtBr("50")).toBe(50)
    expect(parseDecimalPtBr("0")).toBe(0)
  })
})

describe("validateAlertRuleForm", () => {
  it("exige nome e marca", () => {
    const errors = validateAlertRuleForm(form({ name: "  ", brandId: "" }))
    expect(errors.name).toBeDefined()
    expect(errors.brandId).toBeDefined()
  })

  it("recusa nome acima de 120 caracteres (limite do domínio)", () => {
    expect(validateAlertRuleForm(form({ name: "a".repeat(121) })).name).toBeDefined()
    expect(validateAlertRuleForm(form({ name: "a".repeat(120) })).name).toBeUndefined()
  })

  // O ponto central da tela: o mock antigo dizia "sentimento < -0,3", que o
  // backend recusa. A escala do domínio é [0,1].
  it("recusa sentimento negativo e aceita a escala [0,1]", () => {
    expect(validateAlertRuleForm(form({ type: "SentimentBelow", threshold: "-0,3" })).threshold).toBeDefined()
    expect(validateAlertRuleForm(form({ type: "SentimentBelow", threshold: "1,5" })).threshold).toBeDefined()
    expect(validateAlertRuleForm(form({ type: "SentimentBelow", threshold: "0" })).threshold).toBeUndefined()
    expect(validateAlertRuleForm(form({ type: "SentimentBelow", threshold: "1" })).threshold).toBeUndefined()
    expect(validateAlertRuleForm(form({ type: "SentimentBelow", threshold: "0,42" })).threshold).toBeUndefined()
  })

  it("exige threshold em SentimentBelow", () => {
    expect(validateAlertRuleForm(form({ type: "SentimentBelow", threshold: "" })).threshold).toBeDefined()
  })

  it("limita volume de menções a [1, 100000]", () => {
    const volume = (threshold: string) =>
      validateAlertRuleForm(form({ type: "MentionVolumeAbove", threshold })).threshold
    expect(volume("0")).toBeDefined()
    expect(volume(String(MENTION_VOLUME_MAX + 1))).toBeDefined()
    expect(volume("1")).toBeUndefined()
    expect(volume("50")).toBeUndefined()
  })

  it("exige keyword só em KeywordMatch, e ignora threshold nesse tipo", () => {
    expect(validateAlertRuleForm(form({ type: "KeywordMatch", keyword: "", threshold: "" })).keyword).toBeDefined()
    const ok = validateAlertRuleForm(form({ type: "KeywordMatch", keyword: "recall", threshold: "" }))
    expect(ok.keyword).toBeUndefined()
    expect(ok.threshold).toBeUndefined()
  })

  it("recusa keyword acima de 120 caracteres", () => {
    expect(validateAlertRuleForm(form({ type: "KeywordMatch", keyword: "k".repeat(121) })).keyword).toBeDefined()
  })
})

describe("serialização do formulário", () => {
  it("manda só o campo do tipo escolhido — nada de keyword órfã em SentimentBelow", () => {
    const payload = toUpdatePayload(form({ type: "SentimentBelow", threshold: "0,4", keyword: "sobrou" }))
    expect(payload.threshold).toBe(0.4)
    expect(payload.keyword).toBeNull()
  })

  it("zera o threshold em KeywordMatch", () => {
    const payload = toUpdatePayload(form({ type: "KeywordMatch", keyword: " recall ", threshold: "0,4" }))
    expect(payload.keyword).toBe("recall")
    expect(payload.threshold).toBeNull()
  })

  // InApp é obrigatório e implícito no domínio: mandá-lo seria redundante, e o
  // backend o força de volta de qualquer forma.
  it("envia só os canais EXTRAS, nunca InApp", () => {
    expect(toUpdatePayload(form({ emailEnabled: false })).channels).toEqual([])
    expect(toUpdatePayload(form({ emailEnabled: true })).channels).toEqual(["Email"])
  })

  it("apara o nome", () => {
    expect(toUpdatePayload(form({ name: "  Queda  " })).name).toBe("Queda")
  })

  it("toCreatePayload acrescenta a marca ao payload de update", () => {
    const payload = toCreatePayload(form({ brandId: "brand-9" }))
    expect(payload.brandId).toBe("brand-9")
    expect(payload.name).toBe("Regra")
  })
})

describe("ruleToForm", () => {
  const rule: AlertRule = {
    id: "r1", brandId: "b1", brandName: "Marca", name: "Queda",
    type: "SentimentBelow", severity: "Critical", channels: ["InApp", "Email"],
    isEnabled: true, threshold: 0.4, keyword: null,
    createdAt: "2026-08-01T10:00:00Z", updatedAt: "2026-08-01T10:00:00Z",
  }

  it("deriva emailEnabled da lista de canais", () => {
    expect(ruleToForm(rule).emailEnabled).toBe(true)
    expect(ruleToForm({ ...rule, channels: ["InApp"] }).emailEnabled).toBe(false)
  })

  it("faz round-trip do threshold sem perder o valor", () => {
    expect(toUpdatePayload(ruleToForm(rule)).threshold).toBe(0.4)
  })

  it("converte threshold nulo em campo vazio, não em 'null'", () => {
    expect(ruleToForm({ ...rule, type: "KeywordMatch", threshold: null, keyword: "x" }).threshold).toBe("")
  })
})

describe("describeRuleCondition", () => {
  it("descreve cada tipo em pt-BR", () => {
    expect(describeRuleCondition({ type: "SentimentBelow", threshold: 0.4, keyword: null }))
      .toBe("Sentimento abaixo de 0,40")
    expect(describeRuleCondition({ type: "MentionVolumeAbove", threshold: 1500, keyword: null }))
      .toBe("Mais de 1.500 menções em 24h")
    expect(describeRuleCondition({ type: "KeywordMatch", threshold: null, keyword: "recall" }))
      .toContain("recall")
  })

  it("não quebra com threshold ausente", () => {
    expect(describeRuleCondition({ type: "SentimentBelow", threshold: null, keyword: null })).toBeTruthy()
    expect(describeRuleCondition({ type: "KeywordMatch", threshold: null, keyword: null })).toBeTruthy()
  })
})

describe("describeChannels", () => {
  it("traduz e junta", () => {
    expect(describeChannels(["InApp", "Email"])).toBe("no app + e-mail")
  })

  it("cai em 'No app' se vier vazio — InApp é garantido pelo domínio", () => {
    expect(describeChannels([])).toBe("no app")
  })
})

describe("snapshot do disparo", () => {
  const snapshot = JSON.stringify({
    reason: "o sentimento ficou em 0,32, abaixo do limite de 0,50",
    score: 0.32,
    videoTitle: "Análise do produto",
  })

  it("usa o reason do backend, capitalizado", () => {
    expect(describeAlertEvent({ snapshot, ruleName: "Queda" }))
      .toBe("O sentimento ficou em 0,32, abaixo do limite de 0,50")
  })

  it("extrai o título do vídeo", () => {
    expect(alertEventVideoTitle({ snapshot })).toBe("Análise do produto")
  })

  // O histórico importa mais que a riqueza do detalhe: um snapshot antigo com
  // outra forma não pode sumir com a linha.
  it("nunca lança e cai no fallback com JSON inválido, nulo ou de forma inesperada", () => {
    expect(parseAlertSnapshot(null)).toBeNull()
    expect(parseAlertSnapshot("{quebrado")).toBeNull()
    expect(parseAlertSnapshot("[1,2]")).toBeNull()
    expect(describeAlertEvent({ snapshot: "{quebrado", ruleName: "Queda" })).toContain("Queda")
    expect(describeAlertEvent({ snapshot: null, ruleName: "Queda" })).toContain("Queda")
    expect(alertEventVideoTitle({ snapshot: "{}" })).toBeNull()
    expect(alertEventVideoTitle({ snapshot: JSON.stringify({ videoTitle: "  " }) })).toBeNull()
  })
})
