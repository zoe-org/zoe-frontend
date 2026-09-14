import type {
  DecideLongVideosResponse, LongVideoAction, LongVideoDecision, UsageMeter,
} from "@/lib/api/usage"

// Regras da fila de vídeo longo (WS-F10). Aprovação em lote pode ser parcial:
// o que não cabe no teto volta `skipped` sem cobrar, e a tela precisa dizer o que
// entrou e o que ficou — nem sucesso nem erro únicos.

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const SKIP_REASON: Record<string, [one: string, many: string]> = {
  exceeds_spend_cap: ["não cabe no teto de gasto", "não cabem no teto de gasto"],
  brand_budget_exhausted: ["passaria do teto de minutos da marca", "passariam do teto de minutos da marca"],
  already_decided: ["já tinha sido decidido", "já tinham sido decididos"],
  not_found: ["não está mais na fila", "não estão mais na fila"],
}
const SKIP_FALLBACK: [string, string] = ["não foi processado", "não foram processados"]

export type SkipGroup = { reason: string; count: number; minutes: number }

export type DecisionSummary = {
  action: LongVideoAction
  requested: number
  /** Aprovado e cobrado agora (vídeo já coletado). */
  approvedNow: number
  /** Aprovado sem coleta: entra no próximo ciclo e é cobrado quando a análise chega. */
  awaitingCollection: number
  /** Estimativa dos aguardando coleta, que fica reservada no teto de gasto. */
  reservedMinutes: number
  dismissed: number
  skipped: SkipGroup[]
  debitedMinutes: number
  /** Minutos recusados pelo teto de gasto: o quanto elevar o teto resolveria. */
  spendCapShortMinutes: number
}

/** `items` é a lista de onde a seleção saiu; dá os minutos de cada id. */
export function summarizeDecision(
  action: LongVideoAction,
  response: DecideLongVideosResponse,
  items: Pick<LongVideoDecision, "id" | "estimatedMinutes">[],
): DecisionSummary {
  const minutesOf = new Map(items.map((i) => [i.id, i.estimatedMinutes]))
  const skipped = new Map<string, SkipGroup>()
  let approvedNow = 0
  let awaitingCollection = 0
  let reservedMinutes = 0
  let dismissed = 0

  for (const o of response.items) {
    const minutes = minutesOf.get(o.id) ?? 0
    if (o.result === "approved") {
      if (o.reason === "awaiting_collection") {
        awaitingCollection++
        reservedMinutes += minutes
      } else {
        approvedNow++
      }
    } else if (o.result === "dismissed") {
      dismissed++
    } else {
      const reason = o.reason ?? "unknown"
      const group = skipped.get(reason) ?? { reason, count: 0, minutes: 0 }
      group.count++
      group.minutes += minutes
      skipped.set(reason, group)
    }
  }

  return {
    action,
    requested: response.items.length,
    approvedNow,
    awaitingCollection,
    reservedMinutes,
    dismissed,
    skipped: [...skipped.values()],
    debitedMinutes: response.debitedMinutes,
    spendCapShortMinutes: skipped.get("exceeds_spend_cap")?.minutes ?? 0,
  }
}

export type DecisionMessage = {
  /** partial = entrou uma parte; failure = nada entrou. */
  tone: "success" | "partial" | "failure"
  title: string
  detail?: string
}

function describeSkips(skipped: SkipGroup[]): string[] {
  return skipped.map((g) => {
    const [one, many] = SKIP_REASON[g.reason] ?? SKIP_FALLBACK
    return `${g.count} ${g.count === 1 ? "ficou" : "ficaram"} de fora: ${g.count === 1 ? one : many}.`
  })
}

export function describeDecision(s: DecisionSummary): DecisionMessage {
  const skips = describeSkips(s.skipped)
  const done = s.action === "Approve" ? s.approvedNow + s.awaitingCollection : s.dismissed
  const verb = s.action === "Approve" ? ["aprovado", "aprovados"] : ["descartado", "descartados"]

  if (done === 0) {
    return {
      tone: "failure",
      title: s.action === "Approve" ? "Nenhum vídeo aprovado." : "Nenhum vídeo descartado.",
      detail: skips.join(" ") || undefined,
    }
  }

  const title = done === s.requested
    ? `${plural(done, `vídeo ${verb[0]}`, `vídeos ${verb[1]}`)}.`
    : `${done} de ${s.requested} vídeos ${verb[1]}.`

  const parts: string[] = []
  if (s.action === "Approve") {
    if (s.debitedMinutes > 0) parts.push(`${s.debitedMinutes} min debitados agora.`)
    if (s.awaitingCollection > 0) {
      parts.push(
        s.awaitingCollection === 1
          ? `1 entra na próxima coleta e é cobrado quando a análise chegar (${s.reservedMinutes} min reservados no teto de gasto).`
          : `${s.awaitingCollection} entram na próxima coleta e são cobrados quando a análise chegar (${s.reservedMinutes} min reservados no teto de gasto).`,
      )
    }
  }
  parts.push(...skips)

  return {
    tone: s.skipped.length > 0 ? "partial" : "success",
    title,
    detail: parts.join(" ") || undefined,
  }
}

/** O que a seleção atual custaria, antes de aprovar. */
export function selectionTotals(
  items: Pick<LongVideoDecision, "id" | "estimatedMinutes" | "collected">[],
  selected: ReadonlySet<string>,
): { count: number; minutes: number; notCollected: number } {
  let count = 0
  let minutes = 0
  let notCollected = 0
  for (const i of items) {
    if (!selected.has(i.id)) continue
    count++
    minutes += i.estimatedMinutes
    if (!i.collected) notCollected++
  }
  return { count, minutes, notCollected }
}

export type QuotaImpact = {
  billedAfter: number
  quotaMinutes: number
  /** Excedente que ESTA aprovação acrescenta. */
  overageAddedMinutes: number
  entersOverage: boolean
}

/**
 * Efeito estimado na cota. Só minutos: o valor em R$ é do domínio, e uma segunda
 * conta na tela divergiria da fatura. Null quando a cota não é conhecida.
 */
export function quotaImpact(
  meter: Pick<UsageMeter, "billedMinutes" | "quotaMinutes">,
  minutes: number,
): QuotaImpact | null {
  if (meter.quotaMinutes <= 0) return null
  const before = Math.max(0, meter.billedMinutes - meter.quotaMinutes)
  const billedAfter = meter.billedMinutes + minutes
  const after = Math.max(0, billedAfter - meter.quotaMinutes)
  return {
    billedAfter,
    quotaMinutes: meter.quotaMinutes,
    overageAddedMinutes: after - before,
    entersOverage: before === 0 && after > 0,
  }
}

/** 11520 → "3h 12min"; 5400 → "1h 30min"; 3600 → "1h". */
export function formatDuration(seconds: number): string {
  const total = Math.max(1, Math.round(seconds / 60))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}min`
}
