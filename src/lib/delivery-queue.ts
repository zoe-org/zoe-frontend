import type { DeliverySummary } from "@/lib/api/operations"

/**
 * Um contrato na fila de entregas: a tentativa mais recente e as anteriores.
 *
 * <p>Cada reenvio depois de uma correção é uma entrega nova no banco, e a fila mostrava as duas
 * lado a lado — mesmo vídeo, mesmo criador, mesmo valor, um card "Precisa correção" e outro
 * "Aguardando revisão". Com várias campanhas ao mesmo tempo cada correção duplicava o contrato
 * na tela. A decisão é sempre sobre a última tentativa; as outras são histórico.</p>
 */
export type DeliveryGroup = { current: DeliverySummary; previous: DeliverySummary[] }

/** Estados em que a entrega espera decisão de quem revisa. */
export const PENDENTE: ReadonlySet<string> = new Set(["Submitted", "UnderReview"])

export function agruparPorContrato(items: readonly DeliverySummary[]): DeliveryGroup[] {
  const porContrato = new Map<string, DeliverySummary[]>()
  for (const d of items) {
    const lista = porContrato.get(d.contractId)
    if (lista) lista.push(d)
    else porContrato.set(d.contractId, [d])
  }

  return [...porContrato.values()].map((lista) => {
    const ordenada = [...lista].sort((a, b) =>
      b.submissionAttempt - a.submissionAttempt
      || Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
    return { current: ordenada[0], previous: ordenada.slice(1) }
  })
}

/**
 * Ordem da fila. Esperando decisão: prazo vencido primeiro, depois quem chegou antes — é a
 * ordem em que alguém deveria trabalhar. Nas demais abas, o mais recente no topo.
 */
export function ordenarFila(groups: readonly DeliveryGroup[], pendentes: boolean): DeliveryGroup[] {
  return [...groups].sort((a, b) => {
    if (pendentes) {
      if (a.current.isReviewOverdue !== b.current.isReviewOverdue) return a.current.isReviewOverdue ? -1 : 1
      return Date.parse(a.current.submittedAt) - Date.parse(b.current.submittedAt)
    }
    return Date.parse(b.current.submittedAt) - Date.parse(a.current.submittedAt)
  })
}
