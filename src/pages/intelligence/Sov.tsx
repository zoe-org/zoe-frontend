import { Lock, AlertCircle, Sparkles } from "lucide-react"
import { useFeature } from "@/features/auth/useFeature"
import { useShareOfVoice } from "@/lib/api/dashboard"
import { ApiError } from "@/lib/api"

export default function SovPage() {
  const hasSov = useFeature("sov")
  const sov = useShareOfVoice(hasSov)

  // Sem a feature → upsell. O backend também retorna 403; se a query falhar com
  // 403 (defesa: a UI não depende só de si), cai no mesmo upsell.
  const forbidden = sov.error instanceof ApiError && sov.error.status === 403
  if (!hasSov || forbidden) return <UpsellScreen />

  const brands = sov.data?.brands ?? []
  const maxPct = brands[0]?.sharePct ?? 100

  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      {/* Hero — mesmo padrão das outras telas */}
      <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex-1 max-w-160 min-w-70">
          <div className="eyebrow mb-3">Share of Voice · concorrentes</div>
          <h1 className="font-display m-0" style={{ fontSize: 36, lineHeight: 1.1, color: "var(--ink)" }}>
            Sua fatia de voz{" "}
            <span style={{ color: "var(--ink-muted-2)" }}>frente à concorrência no período.</span>
          </h1>
        </div>
      </section>

      {sov.isError && !forbidden ? (
        <ErrorState onRetry={() => sov.refetch()} />
      ) : sov.isLoading ? (
        <BarsSkeleton />
      ) : brands.length === 0 ? (
        <div className="px-8 py-16 text-center text-sm text-muted">
          Ainda não há dados de share of voice no período.
        </div>
      ) : (
        <section className="p-8">
          <div className="flex flex-col gap-4 max-w-3xl">
            {brands.map((b) => (
              <div key={b.brandId}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px]" style={{ fontWeight: b.isYou ? 600 : 400, color: "var(--ink)" }}>
                      {b.brandName}
                    </span>
                    {b.isYou && <span className="chip chip-primary text-[10px] py-[1px] px-1.5">VOCÊ</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono-zoe text-[12px] text-ink-muted">{b.mentions} menções</span>
                    <span className="font-mono-zoe text-[13px]" style={{ color: "var(--ink)" }}>{b.sharePct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-[#F3F4F6] dark:bg-[#1C1F2E] rounded-sm overflow-hidden">
                  <div
                    style={{
                      width: `${Math.round((b.sharePct / maxPct) * 100)}%`,
                      height: "100%",
                      background: b.isYou ? "var(--color-teal-500)" : "#9AA1AE",
                      transition: "width .5s",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Upsell (estado premium, não erro) ─────────────────────────────────────

function UpsellScreen() {
  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <div className="flex flex-col items-center justify-center text-center px-6 py-24 max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--color-teal-50)" }}>
          <Lock className="w-6 h-6" style={{ color: "var(--color-teal-500)" }} />
        </div>
        <div className="eyebrow mb-3">Recurso premium</div>
        <h1 className="font-display m-0 mb-3" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
          Share of Voice
        </h1>
        <p className="text-[14px] text-ink-muted mb-6 max-w-md">
          Compare a fatia de voz da sua marca com a dos concorrentes e acompanhe a evolução ao
          longo do tempo. Disponível nos planos com Share of Voice habilitado.
        </p>
        <a
          href="mailto:contato@heyzoe.com.br?subject=Habilitar%20Share%20of%20Voice"
          className="inline-flex items-center gap-1.5 h-10 px-5 text-[13.5px] font-medium rounded-md text-white transition-colors"
          style={{ background: "var(--color-ember)" }}
        >
          <Sparkles className="w-4 h-4" /> Falar com o time
        </a>
      </div>
    </div>
  )
}

function BarsSkeleton() {
  return (
    <section className="p-8 animate-pulse">
      <div className="flex flex-col gap-4 max-w-3xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 w-40 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
            <div className="h-2 w-full rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
          </div>
        ))}
      </div>
    </section>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
      <h3 className="text-lg font-semibold text-[--color-midnight] dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
