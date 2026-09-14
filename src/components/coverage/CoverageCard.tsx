import { useState } from "react"
import { AlertCircle, ExternalLink, Loader2, Lock, RotateCcw } from "lucide-react"
import { useConfirm } from "@/features/confirm/context"
import { apiMessage } from "@/lib/api-error"
import { newAttemptKey } from "@/lib/api/billing"
import {
  useBackfillMutations, useBackfillOffer, useBrandCoverage, type BackfillOffer,
} from "@/lib/api/backfill"
import {
  brl, describeBlocked, describeOfferUnavailable, nextCheckoutStep, offerNotes, outsideOffer,
  reachesPastRawRetention, shortDate, videoCountLabel,
} from "@/lib/backfill"
import { notifyError } from "@/lib/feedback"
import { announceSyncResult } from "@/components/coverage/announce"

/**
 * Cobertura da marca (ADR-054). Todos veem quantas análises estão fora da cobertura;
 * Owner/Admin veem o preço e compram. Sem bloqueado e sem pagamento em aberto, o card
 * não aparece: não há o que dizer.
 */
export function CoverageCard({ tenantBrandId, brandName, canManage }: {
  tenantBrandId: string
  brandName: string
  canManage: boolean
}) {
  const coverage = useBrandCoverage(tenantBrandId)
  const offer = useBackfillOffer(tenantBrandId, canManage)

  const c = coverage.data
  const blocked = c ? describeBlocked(c) : null
  const open = offer.data?.openCheckout ?? null
  if (!c || (!blocked && !open)) return null

  return (
    <div className="border border-border-soft rounded-xl p-5 mt-5">
      <div className="flex items-start gap-3">
        <Lock className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" />
        <div className="flex-1 min-w-0">
          <div className="eyebrow mb-1.5">Cobertura</div>
          {blocked && <p className="text-[13.5px] m-0" style={{ color: "var(--ink)" }}>{blocked}</p>}
          <p className="text-[12.5px] text-ink-muted mt-1.5 max-w-140 leading-relaxed">
            As análises do dia em que você assinou a marca pela primeira vez já aparecem. As
            anteriores, e as de quando a coleta estava pausada ou a marca arquivada, ficam fora dos
            painéis: existem, só não aparecem até serem desbloqueadas.
          </p>
        </div>
      </div>

      {canManage ? (
        <OfferSection
          tenantBrandId={tenantBrandId}
          brandName={brandName}
          blockedCount={c.blockedCount}
          data={offer.data}
          loading={offer.isLoading}
          error={offer.error}
        />
      ) : (
        <p className="text-[12px] text-ink-muted-2 mt-3 pl-7">
          Owner ou Admin do workspace podem desbloquear essas análises.
        </p>
      )}
    </div>
  )
}

function OfferSection({ tenantBrandId, brandName, blockedCount, data, loading, error }: {
  tenantBrandId: string
  brandName: string
  blockedCount: number
  data: BackfillOffer | undefined
  loading: boolean
  error: unknown
}) {
  const { checkout, sync } = useBackfillMutations()
  const confirm = useConfirm()
  const [now] = useState(() => new Date())

  if (loading) return <div className="h-16 mt-4 rounded-lg bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
  if (error || !data) {
    return (
      <p className="text-[12.5px] text-ink-muted mt-3 pl-7">
        {apiMessage(error, "Não foi possível carregar a oferta de desbloqueio.")}
      </p>
    )
  }

  // Chave nova a cada clique (ADR-050): o provedor guarda o resultado, inclusive erro.
  function start(retrying: boolean) {
    checkout.mutate({ tenantBrandId, idempotencyKey: newAttemptKey() }, {
      onSuccess: (res) => {
        const step = nextCheckoutStep(res)
        if (step.kind === "redirect") window.location.assign(step.url)
        else if (step.kind === "granted") announceSyncResult({ status: "completed", grantedCount: step.count })
        // Compra anterior que não se concluiu: tenta uma vez com chave nova.
        else if (!retrying) start(true)
        else notifyError(null, "Não foi possível abrir o pagamento. Tente de novo em instantes.", { terminal: true })
      },
      onError: (e) => notifyError(e, "Não foi possível abrir o pagamento.", { terminal: true }),
    })
  }

  const free = data.amountCents === 0
  const notes = offerNotes(data)

  const buy = async () => {
    const ok = await confirm({
      title: `Desbloquear ${videoCountLabel(data.videoCount)} de ${brandName}?`,
      description: free
        ? "São só vídeos do seu próprio canal: a liberação é imediata e sem custo."
        : `${brl(data.amountCents)} em pagamento único, pelo Stripe. ${notes.join(" ")} ` +
          "As análises são liberadas quando o pagamento for confirmado.",
      confirmLabel: free ? "Desbloquear" : "Ir para o pagamento",
    })
    if (ok) start(false)
  }

  const check = () =>
    sync.mutate(tenantBrandId, {
      onSuccess: announceSyncResult,
      onError: (e) => notifyError(e, "Não foi possível conferir o pagamento agora.", { terminal: true }),
    })

  const open = data.openCheckout
  const outside = outsideOffer(blockedCount, data.videoCount)
  const range = data.windowStart && data.windowEnd
    ? ` (${shortDate(data.windowStart)} a ${shortDate(data.windowEnd)})`
    : ""

  return (
    <div className="mt-4 space-y-3">
      {open && (
        <div
          className="flex items-center gap-3 flex-wrap rounded-lg border px-4 py-3"
          style={{ background: "#FFFBEB", borderColor: "rgba(217,119,6,.32)" }}
        >
          <div className="flex-1 min-w-60 text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            <strong>Pagamento em aberto</strong> de {brl(open.amountCents)}, iniciado em{" "}
            {shortDate(open.createdAt)}. Uma nova compra retoma este mesmo pagamento.
          </div>
          <a
            href={open.checkoutUrl}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium text-white"
            style={{ background: "var(--color-teal-500)" }}
          >
            Retomar pagamento <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={check}
            disabled={sync.isPending}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-[12.5px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
          >
            {sync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Já paguei, conferir
          </button>
        </div>
      )}

      {!data.available ? (
        <p className="text-[12.5px] text-ink-muted pl-7">{describeOfferUnavailable(data)}</p>
      ) : !open && (
        <div className="flex items-end justify-between gap-4 flex-wrap rounded-lg border border-border-soft px-4 py-4">
          <div className="min-w-0 max-w-130">
            {/* Mesma frase para tenant novo e para quem voltou (D4). */}
            <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
              Desbloquear análises anteriores à sua cobertura
            </div>
            <div className="text-[12.5px] text-ink-muted mt-1 leading-relaxed">
              {videoCountLabel(data.videoCount)} dos últimos {data.windowDays} dias{range}, calculado
              sobre {data.billedMinutes.toLocaleString("pt-BR")} minutos de vídeo.
            </div>
            {outside > 0 && (
              <div className="text-[12px] text-ink-muted-2 mt-1.5 leading-relaxed">
                {outside === 1 ? "O outro fica" : `Os outros ${outside} ficam`} fora da oferta: mais antigos que a
                janela de histórico do seu plano, ou na fila de vídeos longos.
              </div>
            )}
            {notes.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-[12px] text-ink-muted-2 list-none p-0">
                {notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
            {reachesPastRawRetention(data.windowStart, now) && (
              <div className="flex items-start gap-1.5 mt-2 text-[12px]" style={{ color: "var(--color-warn)" }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Parte desses vídeos tem mais de 30 dias: a análise vem completa, mas sem o arquivo de
                  mídia original.
                </span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="font-display" style={{ fontSize: 22, lineHeight: 1, color: "var(--ink)" }}>
              {free ? "Sem custo" : brl(data.amountCents)}
            </div>
            <div className="text-[11.5px] text-ink-muted mt-1">{free ? "só conteúdo próprio" : "pagamento único"}</div>
            <button
              onClick={buy}
              disabled={checkout.isPending}
              className="mt-2.5 h-9 px-4 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--color-teal-500)" }}
            >
              {checkout.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Desbloquear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
