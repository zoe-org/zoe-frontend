import { Link } from "react-router-dom"
import { Lock } from "lucide-react"
import { useAuth } from "@/features/auth/context"
import { useBrandCoverages } from "@/lib/api/backfill"
import { videoCountLabel } from "@/lib/backfill"

/**
 * Aviso de cobertura nas telas que agregam (ADR-054 D1). O filtro vive na api, mas
 * um agregado a menos é indistinguível de um agregado certo: sem esta linha,
 * dashboard, sentimento, SoV, influenciadores e relatório mostram um recorte
 * silencioso e o tenant não tem como saber.
 *
 * A contagem é das marcas inteiras, não do período da tela — a frase não promete
 * recorte que o endpoint não faz.
 */
export function CoverageNotice({ tenantBrandIds, scopeLabel = "desta marca", className = "" }: {
  tenantBrandIds: (string | null | undefined)[]
  /** Como a tela chama o próprio recorte: "desta marca", "deste conjunto competitivo". */
  scopeLabel?: string
  className?: string
}) {
  const { role } = useAuth()
  const ids = [...new Set(tenantBrandIds.filter((id): id is string => Boolean(id)))]
  const coverages = useBrandCoverages(ids)

  const blocked = coverages.reduce((sum, c) => sum + (c.data?.blockedCount ?? 0), 0)
  if (blocked <= 0) return null

  const one = blocked === 1
  const canBuy = role === "Owner" || role === "Admin"
  // Com uma marca só, o link leva direto a ela; com várias, à lista.
  const to = ids.length === 1 ? `/brands?marca=${ids[0]}` : "/brands"

  return (
    <div
      className={`flex items-start gap-2.5 flex-wrap rounded-[12px] border border-border-soft px-3.5 py-2.5 bg-inset ${className}`}
    >
      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-muted" />
      <div className="flex-1 min-w-60 text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
        {videoCountLabel(blocked)} {scopeLabel} {one ? "está" : "estão"} fora da sua cobertura e{" "}
        {one ? "não entra" : "não entram"} em nenhum número desta tela.
      </div>
      {canBuy && (
        <Link
          to={to}
          className="shrink-0 text-[12px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
        >
          Ver como desbloquear →
        </Link>
      )}
    </div>
  )
}
