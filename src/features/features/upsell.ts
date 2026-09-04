import { ApiError } from "@/lib/api"

/**
 * Código do 403 de feature paga. Contrato com a API (`FeatureGate.Code`) — é ele,
 * e não o status, que distingue "não pagou" de "não pode".
 */
export const FEATURE_NOT_ENABLED = "feature_not_enabled"

/**
 * Slug da feature que faltou, quando o erro for o 403 de feature paga.
 *
 * Lê `details.feature`, nunca a mensagem: a mensagem é texto para humano e muda sem
 * aviso. Devolve null para qualquer outro erro — inclusive 403 de permissão, que é
 * outra conversa e não tem upsell.
 */
export function missingFeature(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== FEATURE_NOT_ENABLED) return null
  const details = err.problem?.details
  if (details && typeof details === "object" && "feature" in details) {
    const slug = (details as { feature?: unknown }).feature
    if (typeof slug === "string" && slug.length > 0) return slug
  }
  return null
}

/**
 * Copy por feature. Genérico não converte: quem bateu no limite do SoV precisa ler
 * sobre SoV, não sobre "recursos premium".
 */
export type UpsellCopy = { name: string; pitch: string }

const COPY: Record<string, UpsellCopy> = {
  sov: {
    name: "Share of Voice",
    pitch:
      "Compare a fatia de voz da sua marca com a do conjunto competitivo dela e acompanhe a evolução semana a semana.",
  },
  reports: {
    name: "Relatórios",
    pitch:
      "Gere relatórios executivos em PDF com o recorte e o período que você escolher, prontos para apresentar.",
  },
  competitive_analysis: {
    name: "Análise competitiva",
    pitch:
      "Abra o detalhe de cada concorrente com os painéis de conteúdo próprio e de terceiros separados.",
  },
}

export function upsellCopy(slug: string): UpsellCopy {
  return (
    COPY[slug] ?? {
      name: "Recurso premium",
      pitch: "Este recurso não está incluído no seu plano atual.",
    }
  )
}
