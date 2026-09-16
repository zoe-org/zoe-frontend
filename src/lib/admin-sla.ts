import type { BrandSlaStatus, PendingSummary } from "@/lib/api/admin"

/**
 * Lógica pura do SLA de verificação de marca (WS-F4, espelha
 * `Zoe.Application.Features.Admin.Brands.BrandVerificationSla`).
 *
 * **Nada aqui usa o relógio do cliente.** O backend manda `slaStatus` e
 * `pendingForHours` já calculados com o relógio dele, justamente porque a
 * máquina do admin pode estar dessincronizada — e um cronômetro que discorda do
 * badge ao lado destrói a confiança na fila inteira. Derivar o tempo restante de
 * `pendingForHours` (e não de `new Date(slaDeadline) - Date.now()`) garante que
 * badge e cronômetro venham do MESMO instante de referência.
 */

/** Prazo total do MVP. Espelha `BrandVerificationSla.Window`. */
export const SLA_WINDOW_HOURS = 72

/** Folga a partir da qual a marca entra em "vencendo". Espelha `DueSoonThreshold`. */
export const SLA_DUE_SOON_HOURS = 24

export const SLA_LABEL: Record<BrandSlaStatus, string> = {
  Ok: "no prazo",
  DueSoon: "vencendo",
  Breached: "vencida",
}

/**
 * Classe do chip por status — reusa os tokens de sentimento do design
 * (`globals.css`), os mesmos que o resto do app usa para positivo/atenção/negativo.
 */
export const SLA_CHIP_CLASS: Record<BrandSlaStatus, string> = {
  Ok: "chip chip-pos",
  DueSoon: "chip chip-warn",
  Breached: "chip chip-neg",
}

/** Horas que faltam para o prazo. Negativo = já estourou. */
export function slaHoursRemaining(pendingForHours: number): number {
  return SLA_WINDOW_HOURS - pendingForHours
}

function formatSpan(hoursAbs: number): string {
  if (hoursAbs < 1) {
    const minutes = Math.round(hoursAbs * 60)
    return `${minutes}min`
  }
  if (hoursAbs < 24) return `${Math.round(hoursAbs)}h`

  const days = Math.floor(hoursAbs / 24)
  const hours = Math.round(hoursAbs % 24)
  // 47,7h arredondaria para "1d 24h" — normaliza para "2d".
  if (hours === 24) return `${days + 1}d`
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`
}

/**
 * Cronômetro relativo da linha, na forma do design (`src-admin/curadoria.jsx`):
 * "8h restantes" / "3h fora do SLA".
 *
 * Não fica contando em tempo real de propósito: a granularidade útil é hora, e
 * a fila revalida sozinha (`staleTime` da query). Um timer por linha só gastaria
 * render para mudar um número que ninguém acompanha ao vivo.
 */
export function describeSlaCountdown(pendingForHours: number): string {
  const remaining = slaHoursRemaining(pendingForHours)
  const span = formatSpan(Math.abs(remaining))

  if (remaining > 0) return `${span} restantes`
  // Exatamente no limite (ou a segundos dele): "0min fora do SLA" seria ruído.
  if (Math.round(Math.abs(remaining) * 60) === 0) return "vence agora"
  return `${span} fora do SLA`
}

/** Texto de impacto — verificar uma marca com 12 assinantes destrava 12 clientes. */
export function describeSubscribers(count: number): string {
  if (count <= 0) return "sem assinantes"
  return count === 1 ? "1 tenant assinando" : `${count} tenants assinando`
}

/**
 * Resumo do cabeçalho. Vem do endpoint `pending/summary` — contar o que voltou
 * na página mentiria sobre o backlog real, porque a fila é limitada (50 por
 * padrão). Quando o summary não carrega, o cabeçalho cai para a contagem da
 * página, que é honesta sobre o que está à vista mas não sobre o total.
 */
export function describeQueueHeadline(
  summary: PendingSummary | undefined,
  loadedCount: number,
): string {
  const total = summary?.total ?? loadedCount
  if (total === 0) return "Nenhuma marca aguardando verificação."
  return total === 1 ? "1 marca aguardando" : `${total} marcas aguardando`
}
