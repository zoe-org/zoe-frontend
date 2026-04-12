import { useLocation } from "react-router-dom"
import { ChevronRight } from "lucide-react"

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/intelligence": "Intelligence",
  "/intelligence/monitoring": "Monitoramento",
  "/intelligence/sentiment": "Sentimento",
  "/intelligence/influencers": "Influenciadores",
  "/alerts": "Alertas",
  "/brands": "Marcas",
  "/reports": "Relatórios",
}

const parentGroups: Record<string, { label: string; path?: string }> = {
  "/intelligence/monitoring": { label: "Intelligence" },
  "/intelligence/sentiment": { label: "Intelligence" },
  "/intelligence/influencers": { label: "Intelligence" },
  "/alerts": { label: "Intelligence" },
  "/brands": { label: "Gestão" },
  "/reports": { label: "Gestão" },
}

export function Breadcrumb() {
  const { pathname } = useLocation()

  if (pathname === "/dashboard") return null

  const parent = parentGroups[pathname]
  const currentLabel = routeLabels[pathname]
  if (!currentLabel) return null

  return (
    <nav className="flex items-center gap-1 text-xs text-[#6B7280] mb-4">
      {parent && (
        <>
          <span>{parent.label}</span>
          <ChevronRight className="w-3 h-3" />
        </>
      )}
      <span className="text-[--color-midnight] font-medium">{currentLabel}</span>
    </nav>
  )
}
