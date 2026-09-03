import { useMemo } from "react"
import { Sparkles } from "lucide-react"
import { EmptyBlock } from "@/components/ui/empty-block"
import { useAuth } from "@/features/auth/context"
import { useFeatureCatalog } from "@/lib/api/features"

// Add-ons contratados. Leitura: o que está ativo vem da assinatura (D7), e ligar
// um daqui seria uma segunda porta para a mesma cobrança.

export function AddOnsPanel({ onGoToPlan }: { onGoToPlan: () => void }) {
  const { hasFeature } = useAuth()
  const catalog = useFeatureCatalog()

  const addons = useMemo(
    () => (catalog.data ?? []).filter((f) => f.kind === "SubscriptionAddOn"),
    [catalog.data],
  )

  if (catalog.isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[0, 1].map((i) => <div key={i} className="h-20 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
      </div>
    )
  }

  if (addons.length === 0) return <EmptyBlock message="Nenhum add-on disponível no catálogo." />

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-muted leading-relaxed max-w-165">
        O que está ativo vem do seu plano. Para incluir ou remover um add-on, mude a
        assinatura — a alteração reflete aqui em seguida.
      </p>

      <div className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
        {addons.map((f, i) => {
          const active = hasFeature(f.code)
          return (
            <div
              key={f.code}
              className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-border-soft" : ""}`}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: active ? "var(--color-teal-50)" : "#F3F4F6" }}
              >
                <Sparkles className="w-4 h-4" style={{ color: active ? "var(--color-teal-500)" : "#9AA1AE" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{f.name}</span>
                  {active && <span className="chip chip-pos text-[10px]">ativo</span>}
                </div>
                <div className="text-[12.5px] text-ink-muted mt-0.5">{f.description}</div>
              </div>
              <span className="text-[12px] text-ink-muted-2 shrink-0">
                {active ? "no plano" : "fora do plano"}
              </span>
            </div>
          )
        })}
      </div>

      <button
        onClick={onGoToPlan}
        className="h-9 px-3.5 inline-flex items-center rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
        style={{ color: "var(--ink)" }}
      >
        Ver planos e assinatura
      </button>
    </div>
  )
}
