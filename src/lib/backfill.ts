import type { BackfillCheckout, BackfillOffer, BrandCoverage } from "@/lib/api/backfill"

// Regras de cobertura e backfill (ADR-054, WS-F8). A tela nunca esconde que há
// análise fora da cobertura: diz quantas e de quando, nunca o que são (D1).

/** RN-I-084: a mídia bruta expira em 30 dias. Backfill mais antigo vem sem ela (D7). */
export const RAW_MEDIA_RETENTION_DAYS = 30

const DAY_MS = 86_400_000
const int = (v: number) => Math.round(v).toLocaleString("pt-BR")

export const videoCountLabel = (n: number) => `${int(n)} ${n === 1 ? "vídeo" : "vídeos"}`

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })

/** As datas são de análise, não de publicação: é quando a Zoe coletou sem o seu direito. */
export function describeBlocked(
  c: Pick<BrandCoverage, "blockedCount" | "blockedFrom" | "blockedTo">,
): string | null {
  if (c.blockedCount <= 0) return null
  let range = ""
  if (c.blockedFrom && c.blockedTo) {
    const from = shortDate(c.blockedFrom)
    const to = shortDate(c.blockedTo)
    range = from === to ? ` analisados em ${from}` : ` analisados entre ${from} e ${to}`
  }
  return `${videoCountLabel(c.blockedCount)}${range} ${c.blockedCount === 1 ? "está" : "estão"} fora da sua cobertura.`
}

export function describeOfferUnavailable(o: Pick<BackfillOffer, "reason" | "windowDays">): string {
  switch (o.reason) {
    case "brand_not_active":
      return "O desbloqueio vale só para marca ativa. Reative a marca para ver a oferta."
    case "subscription_required":
      return "O desbloqueio exige uma assinatura ativa."
    case "nothing_to_unlock":
      return `Nada a desbloquear nos últimos ${o.windowDays} dias, a janela de histórico do seu plano. ` +
        "O que ficou de fora é mais antigo que isso ou está na fila de vídeos longos."
    default:
      return "O desbloqueio não está disponível para esta marca agora."
  }
}

/** O que mexeu no preço, para a tela não mostrar um número sem explicação. */
export function offerNotes(o: Pick<BackfillOffer, "ownedCount" | "floorApplied" | "ceilingApplied">): string[] {
  const notes: string[] = []
  if (o.ownedCount > 0) {
    notes.push(`${videoCountLabel(o.ownedCount)} do seu próprio canal ${o.ownedCount === 1 ? "entra" : "entram"} sem custo.`)
  }
  if (o.floorApplied) notes.push("O valor inclui o mínimo por compra.")
  if (o.ceilingApplied) notes.push("O valor foi limitado ao da sua mensalidade.")
  return notes
}

/** Bloqueados que a oferta não cobre: fora da janela do tier ou na fila de vídeo longo. */
export function outsideOffer(blockedCount: number, offerVideoCount: number): number {
  return Math.max(0, blockedCount - offerVideoCount)
}

export function reachesPastRawRetention(windowStart: string | null, now: Date): boolean {
  if (!windowStart) return false
  return now.getTime() - new Date(windowStart).getTime() > RAW_MEDIA_RETENTION_DAYS * DAY_MS
}

export type CheckoutStep =
  | { kind: "redirect"; url: string }
  | { kind: "granted"; count: number }
  | { kind: "retry" }

export function nextCheckoutStep(
  res: Pick<BackfillCheckout, "status" | "checkoutUrl" | "grantedCount">,
): CheckoutStep {
  if (res.status === "completed") return { kind: "granted", count: res.grantedCount }
  if (res.status === "checkout" && res.checkoutUrl) return { kind: "redirect", url: res.checkoutUrl }
  return { kind: "retry" }
}

export type SyncResult = { kind: "granted" | "pending" | "expired"; title: string; detail: string }

export function describeSyncResult(res: Pick<BackfillCheckout, "status" | "grantedCount">): SyncResult {
  if (res.status === "completed") {
    return {
      kind: "granted",
      title: `Análises liberadas: ${videoCountLabel(res.grantedCount)}.`,
      detail: "Elas já aparecem nos painéis da marca.",
    }
  }
  if (res.status === "checkout") {
    return {
      kind: "pending",
      title: "Pagamento ainda não confirmado.",
      detail: "Com cartão a confirmação é imediata; boleto e Pix podem levar alguns dias úteis. " +
        "As análises são liberadas assim que o pagamento compensar.",
    }
  }
  return {
    kind: "expired",
    title: "O pagamento não foi concluído.",
    detail: "A sessão de pagamento venceu e nada foi cobrado. Dá para gerar outra em Marcas.",
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type BackfillReturn = { outcome: "success" | "cancel"; tenantBrandId: string }

/** Volta do Stripe: `?backfill=success|cancel&tenantBrandId=…` (AppLinks da api). */
export function parseBackfillReturn(params: URLSearchParams): BackfillReturn | null {
  const outcome = params.get("backfill")
  const tenantBrandId = params.get("tenantBrandId")
  if (outcome !== "success" && outcome !== "cancel") return null
  if (!tenantBrandId || !UUID.test(tenantBrandId)) return null
  return { outcome, tenantBrandId }
}
