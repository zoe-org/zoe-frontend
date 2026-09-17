import type { DeliverySummary } from "@/lib/api/operations"

/**
 * Um contrato na fila de entregas: a tentativa mais recente e as anteriores, para o reenvio não duplicar a linha.
 */
export type DeliveryGroup = { current: DeliverySummary; previous: DeliverySummary[] }

/** Estados em que a entrega espera decisão de quem revisa. */
export const PENDING_STATUSES: ReadonlySet<string> = new Set(["Submitted", "UnderReview"])

export function groupByContract(items: readonly DeliverySummary[]): DeliveryGroup[] {
  const byContract = new Map<string, DeliverySummary[]>()
  for (const d of items) {
    const list = byContract.get(d.contractId)
    if (list) list.push(d)
    else byContract.set(d.contractId, [d])
  }

  return [...byContract.values()].map((list) => {
    const sorted = [...list].sort((a, b) =>
      b.submissionAttempt - a.submissionAttempt
      || Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
    return { current: sorted[0], previous: sorted.slice(1) }
  })
}

/**
 * Esperando decisão: prazo vencido primeiro, depois quem chegou antes. Nas outras abas, o mais recente no topo.
 */
export function sortQueue(groups: readonly DeliveryGroup[], pendingFirst: boolean): DeliveryGroup[] {
  return [...groups].sort((a, b) => {
    if (pendingFirst) {
      if (a.current.isReviewOverdue !== b.current.isReviewOverdue) return a.current.isReviewOverdue ? -1 : 1
      return Date.parse(a.current.submittedAt) - Date.parse(b.current.submittedAt)
    }
    return Date.parse(b.current.submittedAt) - Date.parse(a.current.submittedAt)
  })
}
