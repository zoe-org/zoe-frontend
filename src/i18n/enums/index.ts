// i18n dos enums do domínio (ADR-023): o domínio fala inglês (Positive, Full,
// comments_only), a UI localiza. Estrutura por LOCALE (pronta pra `es` no Ano 2),
// nunca hard-coded na tela. Fallback SEMPRE pro valor cru — um enum novo ainda
// não traduzido não pode crashar a UI.

export type EnumKind =
  | "classification" | "sentiment" | "nerMode" | "pipelinePath"
  | "kycStatus" | "rosterStatus"
  | "contractModality" | "contractStatus" | "escrowState" | "campaignStatus"

type LocaleDictionaries = Record<EnumKind, Record<string, string>>

const dictionaries: Record<string, LocaleDictionaries> = {
  "pt-BR": {
    classification: {
      Positive: "Positivo",
      Negative: "Negativo",
      Neutral: "Neutro",
      Inconclusive: "Indeterminado",
    },
    sentiment: {
      Positive: "Positivo",
      Negative: "Negativo",
      Neutral: "Neutro",
      Mixed: "Misto",
    },
    nerMode: {
      Full: "Completo",
      Conservative: "Conservador",
    },
    // O read-API serializa os enums pelo nome C# (PascalCase), inclusive
    // pipeline_path ("CommentsOnly", não o "comments_only" do contrato de pipeline).
    // Casamos com o que a API devolve; o fallback cobre qualquer valor cru.
    pipelinePath: {
      Full: "Análise completa",
      VideoCaption: "Análise completa",
      CaptionFallback: "Legenda + comentários",
      CommentsOnly: "Apenas comentários",
    },
    // Operations. KYC é do domínio do criador (InfluencerKycStatus) e vale na
    // plataforma toda; o status do elenco (TenantInfluencerStatus) é do vínculo
    // com ESTE workspace. São coisas diferentes de propósito.
    kycStatus: {
      NotStarted: "Não iniciado",
      Pending: "Em análise",
      Verified: "Verificado",
      Rejected: "Recusado",
    },
    rosterStatus: {
      Active: "Ativo",
      Paused: "Pausado",
      Archived: "Arquivado",
    },
    contractModality: {
      Publipost: "Publipost",
      Ambassador: "Embaixador",
      Barter: "Permuta",
      Affiliate: "Afiliado",
      License: "Licenciamento",
      Ugc: "UGC",
      Events: "Eventos",
      Cocreation: "Cocriação",
      SocialManagement: "Gestão de redes",
      Exclusivity: "Exclusividade",
    },
    campaignStatus: {
      Draft: "Rascunho",
      Active: "Ativa",
      Completed: "Concluída",
      Cancelled: "Cancelada",
    },
    contractStatus: {
      Draft: "Rascunho",
      SentForSignature: "Aguardando assinatura",
      Signed: "Assinado",
      Cancelled: "Cancelado",
    },
    // Estados da custódia. "Releasable" é liberável, não liberado — a diferença
    // entre os dois é a aprovação humana, então os rótulos não podem se confundir.
    escrowState: {
      PendingDeposit: "Aguardando depósito",
      Funded: "Fundos reservados",
      InProduction: "Em produção",
      Delivered: "Entregue",
      UnderReview: "Em revisão",
      Releasable: "Liberável",
      Released: "Liberado",
      Disputed: "Em disputa",
      Refunded: "Devolvido",
    },
  },
}

export const DEFAULT_LOCALE = "pt-BR"

/**
 * Traduz um valor de enum do domínio para o locale. Fallback: o próprio valor
 * cru (nunca lança, nunca some da tela) — cobre enums novos ainda sem tradução.
 */
export function tEnum(
  kind: EnumKind,
  value: string | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (value == null || value === "") return ""
  return dictionaries[locale]?.[kind]?.[value] ?? value
}
