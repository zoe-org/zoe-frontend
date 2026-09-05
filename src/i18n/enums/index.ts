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
