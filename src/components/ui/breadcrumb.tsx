import { Link, useLocation } from "react-router-dom"

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/intelligence/monitoring": "Monitoramento",
  "/intelligence/sentiment": "Sentimento",
  "/intelligence/influencers": "Influenciadores",
  "/intelligence/sov": "Share of Voice",
  "/operations": "Painel",
  "/operations/campaigns": "Campanhas",
  "/operations/contracts": "Contratos",
  // "Elenco", como na sidebar e no eyebrow da própria tela. Dizia
  // "Influenciadores" — o mesmo nome da tela de Intelligence, em outro módulo.
  "/operations/influencers": "Elenco",
  "/operations/deliveries": "Entregas",
  "/operations/escrow": "Custódia",
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
  "/operations": "Operations",
  "/operations/campaigns": "Operations",
  "/operations/contracts": "Operations",
  "/operations/influencers": "Operations",
  "/operations/deliveries": "Operations",
  "/operations/escrow": "Operations",
  "/alerts": "Intelligence",
  "/brands": "Gestão",
  "/reports": "Gestão",
  "/users": "Gestão",
  "/admin/brands": "Administração",
}

const Separator = () => (
  <span style={{ color: "var(--ink-muted)" }} className="select-none mx-2">/</span>
)

export function Breadcrumb() {
  const { pathname } = useLocation()

  const currentLabel = routeLabels[pathname]

  /**
   * Rota de detalhe (`/operations/contracts/<id>`): casa o prefixo conhecido
   * mais longo e mostra a LISTA como link.
   *
   * Antes o breadcrumb simplesmente sumia nessas telas — ele só casava caminho
   * exato —, e cada página de detalhe resolvia sozinha com um "← Voltar" no
   * corpo. O caminho de volta é navegação, e navegação mora no cabeçalho.
   */
  const parentPath = currentLabel
    ? null
    : Object.keys(routeLabels)
      .filter((p) => pathname.startsWith(`${p}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null

  if (!currentLabel && !parentPath) return null

  const group = parentGroups[currentLabel ? pathname : parentPath!]

  return (
    <nav className="flex items-center gap-1.5 font-mono-zoe text-xs" aria-label="Você está em">
      {group && (
        <>
          <span style={{ color: "var(--ink-muted)" }}>{group}</span>
          <Separator />
        </>
      )}
      {currentLabel ? (
        <span style={{ color: "var(--ink)" }}>{currentLabel}</span>
      ) : (
        // A folha é o título da própria página, logo abaixo: repeti-la aqui
        // seria dizer duas vezes o nome de quem você já está olhando.
        <Link
          to={parentPath!}
          className="hover:underline"
          style={{ color: "var(--ink)" }}
        >
          {routeLabels[parentPath!]}
        </Link>
      )}
    </nav>
  )
}
