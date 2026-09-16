import type { BackfillCheckout } from "@/lib/api/backfill"
import { describeSyncResult } from "@/lib/backfill"
import { notifyError, notifyInfo, notifySuccess } from "@/lib/feedback"

/** O mesmo aviso na volta do Stripe e no "Já paguei, conferir". */
export function announceSyncResult(res: Pick<BackfillCheckout, "status" | "grantedCount">) {
  const r = describeSyncResult(res)
  if (r.kind === "granted") notifySuccess(`${r.title} ${r.detail}`)
  else if (r.kind === "pending") notifyInfo(r.title, r.detail)
  else notifyError(null, `${r.title} ${r.detail}`, { terminal: true })
}
