// i18n dos enums do domínio (ADR-023): o domínio fala inglês (Positive, Full,
// comments_only), a UI localiza. Estrutura por LOCALE (pronta pra `es` no Ano 2),
// nunca hard-coded na tela. Fallback SEMPRE pro valor cru — um enum novo ainda
// não traduzido não pode crashar a UI.

export type EnumKind =
  | "classification"
  | "sentiment"
  | "nerMode"
  | "pipelinePath"
  | "channelRelation"
  | "transcriptionSource"
  | "kycStatus"
  | "relationshipStatus"
  | "rosterStatus"
  | "contractModality"
  | "campaignStatus"
  | "contractStatus"
  | "escrowState"
  | "auditCriterion"
  | "briefingSentiment"
  | "deliveryStatus"

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
      // ADR-046: áudio-only é o caminho PADRÃO, não uma degradação. Sem esta
      // entrada a coluna "Cobertura" do CSV exportava a string crua "AudioOnly".
      AudioOnly: "Análise completa",
      CaptionFallback: "Legenda + comentários",
      CommentsOnly: "Apenas comentários",
      // ADR-035. Rótulos escolhidos pra não colidir com os degradados acima:
      // "Apenas comentários" (CommentsOnly) é falha de download; estes são
      // POLÍTICA. Mesmo número de confiança, significados opostos (doc 05 §4).
      OwnedComments: "Conteúdo próprio",
      OwnedNoSignal: "Comentários desativados",
    },
    channelRelation: {
      Owned: "Conteúdo próprio",
      ThirdParty: "Terceiros",
    },
    // De onde veio o texto da transcrição (ADR-027: áudio-first, legenda é fallback).
    transcriptionSource: {
      Whisper: "Áudio",
      Caption: "Legenda",
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
    // Estado derivado do relacionamento com o criador. Mistura ciclo do convite,
    // existência de contrato e status no elenco — por isso não espelha um enum só.
    relationshipStatus: {
      Convidado: "Convidado",
      Aceito: "Aceito",
      Contratado: "Contratado",
      ConviteExpirado: "Convite expirado",
      Active: "No elenco",
      Paused: "Pausado",
      Archived: "Arquivado",
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
    // Critérios da auditoria (RN-O-059). Cada um deriva de um item do briefing.
    auditCriterion: {
      BrandMention: "Menção à marca",
      RequiredHashtags: "Hashtags obrigatórias",
      LogoVisibility: "Logo visível",
      SentimentAlignment: "Tom alinhado",
      AdDisclosure: "Identificação de publicidade",
      AudienceQuality: "Qualidade da audiência",
    },
    // Piso de sentimento exigido no briefing. "Qualquer" é opção legítima: campanha que
    // pede review honesta não pode exigir tom positivo.
    briefingSentiment: {
      Any: "Qualquer",
      Neutral: "Neutro ou melhor",
      Positive: "Só positivo",
    },
    // Entrega e custódia compartilham o rótulo "Em revisão" de propósito: para o
    // usuário é o mesmo momento. O que difere é o que está sendo revisado — o vídeo
    // aqui, o dinheiro lá.
    deliveryStatus: {
      Submitted: "Aguardando revisão",
      UnderReview: "Em revisão",
      Approved: "Aprovada",
      ReworkRequested: "Precisa correção",
      Rejected: "Recusada",
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
