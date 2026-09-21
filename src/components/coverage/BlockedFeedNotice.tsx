import { Link } from "react-router-dom"
import { Lock } from "lucide-react"
import { useAuth } from "@/features/auth/context"
import { videoCountLabel } from "@/lib/backfill"

/**
 * O feed de quem tem lacuna de cobertura não pode simplesmente começar mais tarde:
 * isso é bloqueio silencioso (ADR-054 D1). A contagem respeita o período, não os
 * filtros de conteúdo — dizer quantos negativos estão bloqueados já seria conteúdo.
 */
export function BlockedFeedNotice({ blockedCount, tenantBrandId }: { blockedCount: number; tenantBrandId: string }) {
  const { role } = useAuth()
  const canBuy = role === "Owner" || role === "Admin"

  return (
    <div className="mx-8 mt-4 flex items-start gap-3 flex-wrap rounded-[14px] border border-border-soft px-4 py-3.5 bg-inset">
      <Lock className="w-4 h-4 shrink-0 mt-0.5 text-ink-muted" />
      <div className="flex-1 min-w-60 text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
        <strong>
          {videoCountLabel(blockedCount)} deste período {blockedCount === 1 ? "está" : "estão"} fora da sua cobertura.
        </strong>{" "}
        Foram analisados antes da sua assinatura, ou enquanto a coleta estava pausada ou a marca arquivada.
      </div>
      {canBuy ? (
        <Link
          to={`/brands?marca=${tenantBrandId}`}
          className="shrink-0 text-[12.5px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
        >
          Ver como desbloquear →
        </Link>
      ) : (
        <span className="shrink-0 text-[12px] text-ink-muted-2">Owner ou Admin podem desbloquear em Marcas.</span>
      )}
    </div>
  )
}
