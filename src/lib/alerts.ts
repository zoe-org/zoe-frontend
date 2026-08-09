import type {
  AlertChannel, AlertEvent, AlertRule, AlertRuleType, AlertSeverity,
  CreateAlertRuleInput, UpdateAlertRuleInput,
} from "@/lib/api/alerts"

/**
 * Lógica pura da tela de Alertas — descrição de regra, validação do formulário e
 * leitura do snapshot do disparo. Fora do componente porque é o que dá pra testar
 * sem jsdom (o repo ainda não tem), e porque a validação aqui precisa espelhar o
 * `CreateAlertRuleCommandValidator` do backend campo a campo.
 */

/** Espelham as constantes do domínio (`AlertRule`). Divergir daqui gera 400 na tela. */
export const NAME_MAX_LENGTH = 120
export const KEYWORD_MAX_LENGTH = 120
export const MENTION_VOLUME_MAX = 100_000

/** Janela do MentionVolumeAbove: FIXA em 24h no MVP — o backend ignora qualquer outra. */
export const MENTION_VOLUME_WINDOW_LABEL = "24h"

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  Info: "Informativo",
  Warning: "Atenção",
  Critical: "Crítico",
}

/** Cor por severidade, nos tokens de sentimento do design (globals.css). */
export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  Info: "var(--color-teal-500, #00A799)",
  Warning: "var(--color-warn, #D97706)",
  Critical: "var(--color-neg, #DC2626)",
}

export const RULE_TYPE_LABEL: Record<AlertRuleType, string> = {
  SentimentBelow: "Sentimento abaixo de",
  MentionVolumeAbove: "Volume de menções acima de",
  KeywordMatch: "Palavra-chave citada",
}

const nf = new Intl.NumberFormat("pt-BR")
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Aceita vírgula como separador decimal — o usuário é pt-BR e vai digitar "0,5".
 * Devolve `null` quando não é número, pra validação diferenciar "vazio" de "inválido".
 */
export function parseDecimalPtBr(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const normalized = trimmed.replace(",", ".")
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Frase legível da condição — substitui o campo `condition` que o mock tinha fixo. */
export function describeRuleCondition(rule: Pick<AlertRule, "type" | "threshold" | "keyword">): string {
  switch (rule.type) {
    case "SentimentBelow":
      return rule.threshold === null
        ? "Sentimento abaixo do limite"
        : `Sentimento abaixo de ${nf2.format(rule.threshold)}`
    case "MentionVolumeAbove":
      return rule.threshold === null
        ? `Volume de menções acima do limite em ${MENTION_VOLUME_WINDOW_LABEL}`
        : `Mais de ${nf.format(rule.threshold)} menções em ${MENTION_VOLUME_WINDOW_LABEL}`
    case "KeywordMatch":
      return rule.keyword ? `Menção citando “${rule.keyword}”` : "Menção citando a palavra-chave"
  }
}

/** Canais em texto. InApp é sempre garantido pelo backend, então nunca vem vazio na prática. */
export function describeChannels(channels: readonly AlertChannel[]): string {
  const labels: Record<AlertChannel, string> = { InApp: "No app", Email: "E-mail" }
  const named = channels.map((c) => labels[c] ?? c)
  return named.length > 0 ? named.join(" + ") : "No app"
}

// ── Snapshot do disparo ────────────────────────────────────────────────────

/**
 * O que o evaluator congelou no momento do disparo (`AlertEvaluator.BuildSnapshot`).
 * `reason` já vem como frase pt-BR pronta — o backend a monta porque só ele conhece
 * o limiar que valia naquele instante.
 */
export type AlertSnapshot = {
  reason?: string
  score?: number | null
  classification?: string | null
  views?: number | null
  videoTitle?: string | null
  pipelinePath?: string | null
}

/**
 * Nunca lança: snapshot é jsonb livre e um disparo antigo pode ter forma diferente.
 * O histórico é mais importante que a riqueza do detalhe — se não parsear, a linha
 * ainda aparece com regra, marca e data.
 */
export function parseAlertSnapshot(raw: string | null): AlertSnapshot | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return parsed as AlertSnapshot
  } catch {
    return null
  }
}

/** Descrição do disparo para a timeline: o `reason` do backend, com fallback estrutural. */
export function describeAlertEvent(event: Pick<AlertEvent, "snapshot" | "ruleName">): string {
  const reason = parseAlertSnapshot(event.snapshot)?.reason?.trim()
  if (reason) return reason.charAt(0).toUpperCase() + reason.slice(1)
  return `A regra “${event.ruleName}” disparou.`
}

/** Título do vídeo quando o snapshot o carrega — vira o contexto secundário da linha. */
export function alertEventVideoTitle(event: Pick<AlertEvent, "snapshot">): string | null {
  const title = parseAlertSnapshot(event.snapshot)?.videoTitle
  return typeof title === "string" && title.trim() !== "" ? title.trim() : null
}

// ── Formulário ─────────────────────────────────────────────────────────────

export type AlertRuleForm = {
  name: string
  brandId: string
  type: AlertRuleType
  severity: AlertSeverity
  /** InApp não entra: é obrigatório e o backend o força de volta. */
  emailEnabled: boolean
  isEnabled: boolean
  /** String porque vem de `<input>`; convertido só na validação/serialização. */
  threshold: string
  keyword: string
}

export function emptyRuleForm(brandId: string): AlertRuleForm {
  return {
    name: "",
    brandId,
    type: "SentimentBelow",
    severity: "Warning",
    emailEnabled: false,
    isEnabled: true,
    threshold: "",
    keyword: "",
  }
}

export function ruleToForm(rule: AlertRule): AlertRuleForm {
  return {
    name: rule.name,
    brandId: rule.brandId,
    type: rule.type,
    severity: rule.severity,
    emailEnabled: rule.channels.includes("Email"),
    isEnabled: rule.isEnabled,
    // Formata sem separador de milhar: o valor volta pra um input numérico.
    threshold: rule.threshold === null ? "" : String(rule.threshold),
    keyword: rule.keyword ?? "",
  }
}

export type AlertRuleFormErrors = Partial<Record<"name" | "brandId" | "threshold" | "keyword", string>>

/**
 * Espelha o `CreateAlertRuleCommandValidator`. Validar aqui não substitui o
 * backend — evita o round-trip pro erro óbvio e dá mensagem em pt-BR no campo.
 */
export function validateAlertRuleForm(form: AlertRuleForm): AlertRuleFormErrors {
  const errors: AlertRuleFormErrors = {}

  const name = form.name.trim()
  if (name === "") errors.name = "Dê um nome à regra."
  else if (name.length > NAME_MAX_LENGTH) errors.name = `No máximo ${NAME_MAX_LENGTH} caracteres.`

  if (!form.brandId) errors.brandId = "Escolha a marca monitorada."

  if (form.type === "SentimentBelow") {
    const value = parseDecimalPtBr(form.threshold)
    if (value === null) errors.threshold = "Informe o limite de sentimento."
    else if (value < 0 || value > 1) {
      // A escala do domínio é [0,1] — 0 = pior, 1 = melhor. O mock antigo dizia
      // "< -0,3", que o backend recusa com 400.
      errors.threshold = "O sentimento vai de 0 (pior) a 1 (melhor)."
    }
  }

  if (form.type === "MentionVolumeAbove") {
    const value = parseDecimalPtBr(form.threshold)
    if (value === null) errors.threshold = "Informe o número de menções."
    else if (value < 1 || value > MENTION_VOLUME_MAX) {
      errors.threshold = `Use um número entre 1 e ${nf.format(MENTION_VOLUME_MAX)}.`
    }
  }

  if (form.type === "KeywordMatch") {
    const keyword = form.keyword.trim()
    if (keyword === "") errors.keyword = "Informe a palavra-chave."
    else if (keyword.length > KEYWORD_MAX_LENGTH) errors.keyword = `No máximo ${KEYWORD_MAX_LENGTH} caracteres.`
  }

  return errors
}

/**
 * Serializa mandando **só o campo do tipo escolhido**. Enviar um `keyword`
 * remanescente junto de `SentimentBelow` faria a regra guardar lixo que reaparece
 * ao trocar o tipo na edição.
 */
export function toCreatePayload(form: AlertRuleForm): CreateAlertRuleInput {
  return { brandId: form.brandId, ...toUpdatePayload(form) }
}

export function toUpdatePayload(form: AlertRuleForm): UpdateAlertRuleInput {
  const isKeyword = form.type === "KeywordMatch"
  return {
    name: form.name.trim(),
    type: form.type,
    severity: form.severity,
    // Só os canais EXTRAS — InApp é implícito no domínio.
    channels: form.emailEnabled ? ["Email"] : [],
    threshold: isKeyword ? null : parseDecimalPtBr(form.threshold),
    keyword: isKeyword ? form.keyword.trim() : null,
    isEnabled: form.isEnabled,
  }
}
