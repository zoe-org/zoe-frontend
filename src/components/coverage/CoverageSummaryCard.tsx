import { Link } from "react-router-dom"
import { Lock } from "lucide-react"
import { useAuth } from "@/features/auth/context"
import { useActiveBrand } from "@/features/brands/context"
import { useBrandCoverages } from "@/lib/api/backfill"
import { describeCoverageSummary, summarizeCoverage, videoCountLabel } from "@/lib/backfill"

/**
 * Cobertura no Consumo (ADR-054 D1). O medidor conta o que foi cobrado; isto conta
 * o que existe e o tenant não pode ver. São números de naturezas diferentes e por
 * isso ficam em cards separados — somá-los diria que bloqueado é consumo.
 *
 * Ponto de ENTRADA, não superfície de compra: preço e pagamento moram em Marcas,
 * onde a oferta é por marca. Duas telas vendendo a mesma coisa é duas cópias da
 * regra de preço.
 */
export function CoverageSummaryCard() {
  const { brands } = useActiveBrand()
  const { role } = useAuth()
  const canManage = role === "Owner" || role === "Admin"

  // A ordem das respostas acompanha a das marcas (useQueries).
  const coverages = useBrandCoverages(brands.map((b) => b.tenantBrandId))
  const summary = summarizeCoverage(brands.map((b, i) => ({
    tenantBrandId: b.tenantBrandId,
    brandName: b.displayName ?? b.brandName,
    blockedCount: coverages[i]?.data?.blockedCount ?? 0,
  })))

  const headline = describeCoverageSummary(summary)
  if (!headline) return null

  return (
    <div className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-ink-muted" />
          <div className="min-w-0">
            <div className="eyebrow mb-1.5">Fora da sua cobertura</div>
            <div className="text-[13.5px]" style={{ color: "var(--ink)" }}>{headline}</div>
            <div className="text-[13px] text-ink-muted mt-2 max-w-165 leading-relaxed">
              São análises que a Zoe já fez para essas marcas antes da sua assinatura, ou enquanto a
              coleta estava pausada. Elas não entram nos painéis nem neste consumo — e desbloqueá-las
              é pagamento único, fora da cota de minutos.
            </div>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 list-none p-0">
          {summary.brands.map((b) => (
            <li key={b.tenantBrandId} className="flex items-center justify-between gap-4 text-[13px]">
              <span className="min-w-0 truncate" style={{ color: "var(--ink-2)" }}>{b.brandName}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-ink-muted">{videoCountLabel(b.blockedCount)}</span>
                {canManage && (
                  <Link
                    to={`/brands?marca=${b.tenantBrandId}`}
                    className="text-[12.5px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                  >
                    Desbloquear →
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>

        {!canManage && (
          <div className="text-[12px] text-ink-muted-2 mt-3">
            Owner ou Admin do workspace podem desbloquear essas análises em Marcas.
          </div>
        )}
      </div>
    </div>
  )
}
