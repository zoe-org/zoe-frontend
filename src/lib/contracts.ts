import type { ContractSummary } from "@/lib/api/operations"

// Leituras do contrato que a tela afirma em número. Ficam fora dela porque são
// afirmações sobre o dado ("isto está travado") que precisam ser verdadeiras —
// e isso se prova em teste, não no olho.

/**
 * Contrato assinado que previa custódia e não tem conta aberta.
 *
 * É a única pendência do fluxo em que o dinheiro fica parado sem ninguém ser
 * avisado: o contrato já obriga as duas partes, a marca acha que reservou o
 * valor, e a tela de Custódia não mostra o que não existe. Antes da assinatura
 * não ter custódia é o normal — a conta nasce do contrato assinado —, por isso
 * o estado importa tanto quanto a flag.
 *
 * `escrowState` nulo é o que o backend usa para "ainda não aberta"; conferimos
 * também o `escrowAccountId` porque conta sem estado seria dado inconsistente,
 * e nesse caso a tela não deve acusar pendência sem saber o que aconteceu.
 */
export function isEscrowMissing(c: ContractSummary): boolean {
  return c.status === "Signed"
    && c.usesEscrow
    && c.escrowState === null
    && c.escrowAccountId === null
}

/** Os contratos assinados esperando a custódia que deveriam ter. */
export function escrowMissing(items: readonly ContractSummary[]): ContractSummary[] {
  return items.filter(isEscrowMissing)
}
