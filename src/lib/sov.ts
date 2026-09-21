import { formatScore } from "@/lib/score"
import type { SovBrand, SovTopic, SovTopicShare } from "@/lib/api/dashboard"

// Regras de leitura do Share of Voice. Ficam fora da tela porque quase todas são
// afirmações sobre o dado ("quem lidera", "onde você está abaixo da sua média") que
// precisam ser verdadeiras — e isso se prova em teste, não no olho.

/** Cor por marca: a escolhida pelo tenant, ou uma derivada determinística do id. */
export function brandColor(id: string, color: string | null): string {
  if (color) return color
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return `hsl(${Math.abs(h) % 360}, 55%, 55%)`
}

/** Escala do domínio: [0,1] com o neutro em 0,5. Os cortes são os do resto do app. */
export const SENTIMENT_POSITIVE = 0.6
export const SENTIMENT_NEGATIVE = 0.4

export type SentimentTone = "pos" | "neg" | "neutral" | "unknown"

export type SentimentReading = {
  tone: SentimentTone
  /** "positivo" · "neutro" · "negativo" · "sem leitura" */
  label: string
  color: string
  /** "0,61 · positivo" — o número sozinho não diz se é bom. */
  text: string
}

// Reexportado para não quebrar quem já importa daqui; a fonte é `lib/score`.
export { formatScore }

export function readSentiment(score: number | null): SentimentReading {
  if (score == null) {
    return { tone: "unknown", label: "sem leitura", color: "var(--ink-muted-2)", text: "—" }
  }
  const tone: SentimentTone =
    score >= SENTIMENT_POSITIVE ? "pos" : score <= SENTIMENT_NEGATIVE ? "neg" : "neutral"
  const label = tone === "pos" ? "positivo" : tone === "neg" ? "negativo" : "neutro"
  const color =
    tone === "pos" ? "var(--color-pos)" : tone === "neg" ? "var(--color-neg)" : "var(--color-warn)"
  return { tone, label, color, text: `${formatScore(score)} · ${label}` }
}

// ── Ranking ───────────────────────────────────────────────────────────────

export type RankedBrand = SovBrand & { rank: number }

/**
 * Ordena por share e carimba a posição. Empate desempata por menções: duas marcas com
 * 25% arredondado não estão necessariamente empatadas, e mostrar a de menor volume à
 * frente seria um artefato do arredondamento.
 */
export function rankBrands(brands: SovBrand[]): RankedBrand[] {
  const sorted = [...brands].sort((a, b) => b.sharePct - a.sharePct || b.mentions - a.mentions)
  // Posição de competição (1, 1, 3): mesmo share E mesmas menções é empate de
  // verdade, e as duas marcas dividem o lugar. Dar #2 a uma delas seria dizer que
  // ela está atrás por causa da ordem em que a lista chegou.
  return sorted.map((b) => ({
    ...b,
    rank: sorted.findIndex((o) => o.sharePct === b.sharePct && o.mentions === b.mentions) + 1,
  }))
}

/** "Nubank", "Nubank e Inter", "Nubank, Inter e C6". */
function listaNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ""
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
}

/**
 * A leitura que o ranking não dá em número: onde você está e para onde foi.
 * Derivada dos próprios dados — nenhuma narrativa gerada, nada que a API não afirme.
 */
export function positionSummary(ranked: RankedBrand[]): string | null {
  const you = ranked.find((b) => b.isYou)
  if (!you) return null

  const empatados = ranked.filter((b) => !b.isYou && b.rank === you.rank)
  const nomes = listaNomes(empatados.map((b) => b.brandName))

  let lugar: string
  if (empatados.length > 0) {
    lugar = you.rank === 1
      ? `Você divide a liderança com ${nomes}, com ${you.sharePct}% de share`
      : `Você divide o ${you.rank}º lugar com ${nomes}, com ${you.sharePct}% de share`
  } else {
    lugar = you.rank === 1
      ? `Você lidera as conversas do setor com ${you.sharePct}% de share`
      : `Você está em ${you.rank}º entre ${ranked.length} marcas, com ${you.sharePct}% de share`
  }

  // Mesmo share com posições diferentes é desempate por menções — "0pp atrás" leria
  // como erro, então a frase diz o que de fato separa as duas.
  let distancia = ""
  if (you.rank === 1) {
    const proximo = ranked.find((b) => b.rank > 1)
    if (proximo) {
      const gap = you.sharePct - proximo.sharePct
      distancia = gap === 0
        ? `, com o mesmo share de ${proximo.brandName} e mais menções`
        : `, ${gap}pp à frente de ${proximo.brandName}`
    }
  } else {
    const lider = ranked[0]
    const gap = lider.sharePct - you.sharePct
    distancia = gap === 0
      ? `, com o mesmo share de ${lider.brandName} e menos menções`
      : `, ${gap}pp atrás de ${lider.brandName}`
  }

  const movimento = you.deltaPp === 0
    ? ""
    : you.deltaPp > 0
      ? `. Ganhou ${you.deltaPp}pp em relação ao período anterior`
      : `. Perdeu ${Math.abs(you.deltaPp)}pp em relação ao período anterior`

  return `${lugar}${distancia}${movimento}.`
}

/**
 * O concorrente que faz sentido comparar primeiro: quem está logo acima de você (é
 * quem você precisa passar) ou, se você lidera, o segundo (é quem pode te passar).
 */
export function nearestRival(ranked: RankedBrand[]): RankedBrand | null {
  // Pelo índice, não pela posição: com empate, a posição deixa de ser índice + 1.
  const i = ranked.findIndex((b) => b.isYou)
  if (i < 0) return null
  const alvo = i === 0 ? ranked[1] : ranked[i - 1]
  return alvo && !alvo.isYou ? alvo : null
}

// ── Espaços não ocupados ──────────────────────────────────────────────────

export type TopicGap = {
  topic: SovTopic
  /** Seu share NESTE tópico. */
  mine: number
  leader: SovTopicShare
}

/**
 * Tópicos com conversa no setor em que o seu share está abaixo da sua média geral e
 * outra marca lidera.
 *
 * O corte é a sua própria média, não um número fixo: "share baixo" só significa algo
 * em relação ao quanto você costuma ocupar.
 */
export function findTopicGaps(topics: SovTopic[], yourShare: number, limit = 4): TopicGap[] {
  return topics
    .map((topic) => {
      const mine = topic.shares.find((s) => s.isYou)?.sharePct ?? 0
      const leader = leaderOf(topic)
      return { topic, mine, leader }
    })
    // Volume mínimo: "100pp atrás do líder" em 3 menções é ruído com cara de conclusão.
    .filter((g): g is TopicGap =>
      !isLowVolume(g.topic) && g.leader != null && !g.leader.isYou && g.mine < yourShare)
    .sort((a, b) => b.topic.volume - a.topic.volume)
    .slice(0, limit)
}

/**
 * Quem lidera o tópico — ou null, se o topo está empatado. Empate não tem líder: com
 * 50% a 50%, dizer "líder: X" é só a ordem em que a lista chegou.
 */
export function leaderOf(topic: SovTopic): SovTopicShare | null {
  const max = Math.max(0, ...topic.shares.map((s) => s.sharePct))
  if (max === 0) return null
  const topo = topic.shares.filter((s) => s.sharePct === max)
  return topo.length === 1 ? topo[0] : null
}

/**
 * Abaixo disto o share do tópico é acaso: com 2 menções, 50% ou 100% não diz nada sobre
 * posição. A tela mostra o tópico esmaecido e ele não vira "espaço não ocupado".
 */
export const MIN_TOPIC_VOLUME = 5

export function isLowVolume(topic: SovTopic): boolean {
  return topic.volume < MIN_TOPIC_VOLUME
}

// ── Comparação direta ─────────────────────────────────────────────────────

export type TopicDuel = {
  topic: string
  volume: number
  yours: number
  theirs: number
  /** Diferença em pontos percentuais, positiva quando você está à frente. */
  gap: number
}

export type Matchup = {
  /** Tópicos em que você está à frente, do maior gap para o menor. */
  youLead: TopicDuel[]
  /** Tópicos em que o concorrente está à frente. */
  theyLead: TopicDuel[]
  /** Diferença ≤ 3pp: o arredondamento do share já é de 1pp, então "empate" é uma faixa. */
  contested: TopicDuel[]
}

export const CONTESTED_MARGIN = 3

/**
 * Duelo tópico a tópico entre você e um concorrente.
 *
 * Só entram tópicos em que pelo menos um dos dois aparece: um tópico onde nenhum dos
 * dois tem share é conversa de terceiros, e listá-lo como "empate em 0%" encheria a
 * tela de linhas que não dizem nada sobre o par.
 */
export function matchup(topics: SovTopic[], rivalBrandId: string): Matchup {
  const duels: TopicDuel[] = topics
    .map((t) => {
      const yours = t.shares.find((s) => s.isYou)?.sharePct ?? 0
      const theirs = t.shares.find((s) => s.brandId === rivalBrandId)?.sharePct ?? 0
      return { topic: t.topic, volume: t.volume, yours, theirs, gap: yours - theirs }
    })
    .filter((d) => d.yours > 0 || d.theirs > 0)

  const porGap = (a: TopicDuel, b: TopicDuel) => Math.abs(b.gap) - Math.abs(a.gap) || b.volume - a.volume
  return {
    youLead: duels.filter((d) => d.gap > CONTESTED_MARGIN).sort(porGap),
    theyLead: duels.filter((d) => d.gap < -CONTESTED_MARGIN).sort(porGap),
    contested: duels.filter((d) => Math.abs(d.gap) <= CONTESTED_MARGIN).sort((a, b) => b.volume - a.volume),
  }
}

// ── Glossário ─────────────────────────────────────────────────────────────

/**
 * O que cada número significa. Fica aqui, e não solto na tela, porque a mesma
 * definição aparece em vários lugares e definição duplicada vira definição divergente.
 */
export const GLOSSARY = {
  sov:
    "Sua fatia das menções analisadas no conjunto competitivo desta marca. O denominador " +
    "é a soma das menções de todas as marcas do conjunto — a sua e os concorrentes que " +
    "você declarou —, não o setor inteiro.",
  mentions:
    "Cada menção é um vídeo analisado em que a marca aparece. O mesmo vídeo citando duas " +
    "marcas do conjunto conta uma vez para cada.",
  earned:
    "Só entra vídeo de terceiros (earned). O conteúdo publicado no canal oficial da marca " +
    "fica de fora — ele infla o share sem dizer nada sobre a conversa espontânea.",
  pp:
    "Pontos percentuais de diferença para o período anterior de mesma duração. Ganhar 2pp " +
    "é passar de 20% para 22% de share, não crescer 2%.",
  sentiment:
    "Média do sentimento das análises do período, de 0 a 1, com o neutro em 0,5. Acima de " +
    "0,6 é positivo; abaixo de 0,4, negativo. Análise sem score não entra na média.",
  scope:
    "A Zoe analisa vídeo do YouTube. O share é sobre essa conversa, não sobre todas as redes.",
  topics:
    "Os tópicos vêm da análise de IA de cada vídeo. O share num tópico é a sua fatia das " +
    "menções daquele assunto entre as marcas do conjunto — por isso você pode ter 20% no " +
    "geral e 45% num tópico. Um vídeo que trata de dois assuntos conta nos dois.",
  trend:
    "Share semana a semana, com o mesmo denominador do share geral. Semana em que nenhuma " +
    "marca do conjunto teve menção aparece como vazia, não como 0%.",
} as const
