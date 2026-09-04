import { useLocation } from "react-router-dom"

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/intelligence/monitoring": "Monitoramento",
  "/intelligence/sentiment": "Sentimento",
  "/intelligence/influencers": "Influenciadores",
  "/intelligence/sov": "Share of Voice",
  "/alerts": "Alertas",
  "/brands": "Marcas",
  "/reports": "Relatórios",
  "/users": "Usuários",
  "/admin/brands": "Curadoria",
}

const parentGroups: Record<string, string> = {
  "/intelligence/monitoring": "Intelligence",
  "/intelligence/sentiment": "Intelligence",
  "/intelligence/influencers": "Intelligence",
  "/intelligence/sov": "Intelligence",
  "/alerts": "Intelligence",
  "/brands": "Gestão",
  "/reports": "Gestão",
  "/users": "Gestão",
  "/admin/brands": "Administração",
}

export function Breadcrumb() {
  const { pathname } = useLocation()

  const currentLabel = routeLabels[pathname]
  if (!currentLabel) return null

  const parent = parentGroups[pathname]

  return (
    <nav className="flex items-center gap-1.5 font-mono-zoe text-xs">
      {parent && (
        <>
          <span style={{ color: "var(--ink-muted)" }}>{parent}</span>
          <span style={{ color: "var(--ink-muted)" }} className="select-none mx-2">/</span>
        </>
      )}
      <span style={{ color: "var(--ink)" }} className="">{currentLabel}</span>
    </nav>
  )
}
