import { useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { useBackfillMutations } from "@/lib/api/backfill"
import { parseBackfillReturn } from "@/lib/backfill"
import { notifyError, notifyInfo } from "@/lib/feedback"
import { announceSyncResult } from "@/components/coverage/announce"

/**
 * Volta do Stripe da compra de backfill, em qualquer rota. Confere no provedor em vez
 * de esperar o webhook: é o que cobre o webhook que não chega, quando o cliente já pagou.
 */
export function BackfillReturn() {
  const [params, setParams] = useSearchParams()
  const { sync } = useBackfillMutations()
  const fired = useRef<string | null>(null)

  const ret = parseBackfillReturn(params)
  const key = ret ? `${ret.outcome}:${ret.tenantBrandId}` : null

  useEffect(() => {
    if (!ret || !key || fired.current === key) return
    fired.current = key

    const clean = () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete("backfill")
        next.delete("tenantBrandId")
        return next
      }, { replace: true })

    if (ret.outcome === "cancel") {
      notifyInfo(
        "Pagamento não concluído. Nada foi cobrado.",
        "A tela de pagamento fica aberta por até 1 hora e pode ser retomada em Marcas.",
      )
      clean()
      return
    }

    sync.mutate(ret.tenantBrandId, {
      onSuccess: announceSyncResult,
      onError: (e) => notifyError(
        e,
        "Não foi possível confirmar o pagamento agora. Se ele foi concluído, as análises são liberadas assim que o Stripe avisar.",
        { terminal: true },
      ),
      onSettled: clean,
    })
    // `sync`, `ret` e `setParams` mudam a cada render; o ref garante uma chamada por retorno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return null
}
