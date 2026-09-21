import { useState, useEffect, useRef } from "react"
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard, Activity, Smile, ChartPie, Users, Bell, Gauge, Megaphone, UsersRound,
  FileText, Package, Vault, Tag, FileChartColumn, Settings, UserCog,
  PanelLeftClose, PanelLeftOpen, ChevronsUpDown, UserRound, Palette, CreditCard,
  Sun, Moon, LogOut, Check, Plus, ShieldCheck, AlertCircle,
  type LucideIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/context"
import { useFeature } from "@/features/auth/useFeature"
import { useSwitchWorkspace } from "@/features/auth/useSwitchWorkspace"
import { useAlertUnreadCount } from "@/lib/api/alerts"
import { useSubscription } from "@/lib/api/billing"
import { useRealtimeConnection } from "@/lib/realtime"
import { useScrollToTop } from "@/lib/useScrollToTop"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { BrandSwitcher } from "@/components/layout/BrandSwitcher"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { SettingsDialog } from "@/components/settings/SettingsDialog"
import { UpgradeDialog } from "@/components/UpgradeDialog"
import { BackfillReturn } from "@/components/coverage/BackfillReturn"
import { useOpenSettings } from "@/components/settings/useSettings"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

const STORAGE_SIDEBAR_KEY = "zoe_sidebar_open"

function getInitialOpenState(key: string): boolean {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? true : stored === "true"
  } catch {
    return true
  }
}


/**
 * Contador real de alertas não lidos (WS-F2) — era um "3" fixo do mock.
 * Silencioso por design: enquanto carrega, ou se a chamada falhar, não renderiza
 * nada. Um badge de erro na sidebar chamaria atenção para um problema que o
 * usuário não pode resolver dali.
 */
const AlertsBadge = () => {
  const { data } = useAlertUnreadCount()
  if (!data) return null
  return (
    <span className="bg-ember text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
      {data > 99 ? "99+" : data}
    </span>
  )
}

/**
 * Item da sidebar. Ativo: fundo tingido, ícone teal e uma régua reta na borda
 * esquerda — a mesma linha que separa os blocos das páginas.
 */
const NavItem = ({ to, icon: Icon, children, badge, end, collapsed }: {
  to: string
  icon: LucideIcon
  children: string
  badge?: React.ReactNode
  /** Rota raiz de uma seção: sem `end`, ficaria ativa em todas as subpáginas. */
  end?: boolean
  collapsed: boolean
}) => (
  <NavLink
    to={to}
    end={end}
    title={collapsed ? children : undefined}
    className={({ isActive }) =>
      `group relative flex items-center gap-2.5 h-8 rounded-md text-[13.5px] transition-colors ${collapsed ? "justify-center px-2" : "px-2.5"} ${isActive
        ? "bg-tint text-ink font-medium"
        : "text-ink-muted hover:text-ink hover:bg-hover"
      }`
    }
  >
    {({ isActive }) => (
      <>
        <span
          className={`absolute -left-2 top-1.5 bottom-1.5 w-[2px] rounded-full bg-teal-500 transition-transform duration-300 ${isActive ? "scale-y-100" : "scale-y-0"}`}
        />
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-teal-500 dark:text-teal-300" : "text-ink-muted-2 group-hover:text-ink-muted"}`}
          strokeWidth={2}
        />
        {!collapsed && <span className="flex-1 truncate">{children}</span>}
        {!collapsed && badge}
      </>
    )}
  </NavLink>
)

const NavSection = ({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    {collapsed ? (
      <div className="mx-auto my-2.5 h-px w-5 bg-border-soft" />
    ) : (
      <div className="font-mono-zoe text-[10px] uppercase tracking-[0.14em] text-ink-muted-2 px-2.5 pt-4 pb-1.5">
        {label}
      </div>
    )}
    {children}
  </div>
)

/** Hash determinístico → cor consistente por tenant (bolinha do workspace). */
const TENANT_PALETTE = [
  "#820AD1", "#00A799", "#F97316", "#0EA5E9",
  "#DC2626", "#16A34A", "#D97706", "#7C3AED",
]
function tenantColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return TENANT_PALETTE[Math.abs(h) % TENANT_PALETTE.length]
}

/**
 * Seletor de workspace no topo da sidebar. Trocar aqui recarrega o contexto
 * inteiro (marcas, features, cobrança), então ele fica visível — e não escondido
 * dentro do menu do usuário, onde ninguém procurava por ele.
 */
function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { activeTenantId, memberships, role } = useAuth()
  const switchWorkspace = useSwitchWorkspace()
  const openSettings = useOpenSettings()

  const atual = memberships.find((m) => m.tenantId === activeTenantId)
  if (!atual) return null

  const cor = tenantColor(atual.tenantId)
  const inicial = atual.tenantName.charAt(0).toUpperCase()

  return (
    <div className={collapsed ? "px-2 pb-2" : "px-3 pb-3"}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Trocar de workspace"
            title={collapsed ? atual.tenantName : undefined}
            className={`w-full flex items-center rounded-lg border border-border-soft bg-surface hover:bg-hover transition-colors cursor-pointer ${collapsed ? "justify-center p-1.5" : "gap-2.5 p-2"}`}
          >
            <span
              className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
              style={{ backgroundColor: cor }}
            >
              {inicial}
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[13px] font-semibold text-ink truncate">{atual.tenantName}</span>
                  <span className="block text-[11px] text-ink-muted truncate">{role ?? atual.role}</span>
                </span>
                <ChevronsUpDown className="w-3.5 h-3.5 text-ink-muted-2 shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-60">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold">
            Workspaces
          </DropdownMenuLabel>
          {memberships.map((m) => {
            const isActive = m.tenantId === activeTenantId
            return (
              <DropdownMenuItem
                key={m.tenantId}
                onSelect={() => { if (!isActive) switchWorkspace(m.tenantId) }}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <span
                  className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ backgroundColor: tenantColor(m.tenantId) }}
                >
                  {m.tenantName.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{m.tenantName}</div>
                  <div className="text-[11px] text-ink-muted truncate">{m.role}</div>
                </div>
                {isActive && <Check className="w-4 h-4 text-teal-500 shrink-0" />}
              </DropdownMenuItem>
            )
          })}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-sm cursor-pointer"
            onSelect={() => openSettings("workspace")}
          >
            <Settings className="w-4 h-4 text-ink-muted" /> Gerenciar workspace
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/onboarding/tenant" className="flex items-center gap-2 text-sm cursor-pointer">
              <Plus className="w-4 h-4 text-ink-muted" /> Criar novo workspace
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function AppShell() {
  const { user, role, signOut, isZoeAdmin } = useAuth()
  // WS-F3 — mantém a conexão de tempo real viva pro app inteiro logado (não só
  // Alertas: é daqui que o badge da sidebar recebe o "novo" sem precisar navegar).
  useRealtimeConnection()
  const hasIntelligence = useFeature("intelligence")
  const hasOperations = useFeature("operations")
  const hasSov = useFeature("sov")
  // Relatórios é add-on cross-módulo: o item some sem a feature (a rota segue
  // montada e a própria página mostra o upsell, como no SoV).
  const hasReports = useFeature("reports")
  // Linha de contexto do usuário: módulos do tenant (os dois quando houver) e a role.
  const planLabel = [hasIntelligence && "Intelligence", hasOperations && "Operations"]
    .filter(Boolean).join(" + ") || null
  const userContext = [planLabel, role].filter(Boolean).join(" · ")
  const location = useLocation()
  const navigate = useNavigate()
  const openSettings = useOpenSettings()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const mainRef = useRef<HTMLElement>(null)
  useScrollToTop(mainRef)

  const [sidebarOpen, setSidebarOpen] = useState(() => getInitialOpenState(STORAGE_SIDEBAR_KEY))
  const collapsed = !sidebarOpen

  useEffect(() => {
    try { localStorage.setItem(STORAGE_SIDEBAR_KEY, String(sidebarOpen)) } catch { /* storage indisponível */ }
  }, [sidebarOpen])

  return (
    // Altura travada na viewport: quem rola é o <main>, e só ele. Com
    // `min-h-screen` o documento também rolava, e qualquer transbordo
    // dentro do <main> (as animações de entrada empurram o conteúdo 10px
    // pra baixo) abria uma segunda barra de rolagem por alguns segundos.
    <div className="h-screen overflow-hidden flex text-ink bg-surface">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-14"} transition-[width] duration-300 ease-[cubic-bezier(0.2,0.7,0.1,1)] h-dvh border-r sticky top-0 bg-canvas text-ink-muted border-border-soft flex flex-col overflow-hidden shrink-0`}>
        {/* Logo */}
        <div className={`h-fit flex items-center my-4 ${sidebarOpen ? "px-4 justify-between" : "justify-center"}`}>
          {sidebarOpen && <ZoeLogo className="w-12 h-full text-teal-500" />}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}
            className="cursor-pointer text-ink-muted-2 hover:text-ink transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose className="h-5" /> : <PanelLeftOpen className="h-5" />}
          </button>
        </div>

        {/* Workspace: quem você é dentro da conta. Fica ACIMA da navegação porque
            troca o conteúdo de todas as telas abaixo dele. */}
        <WorkspaceSwitcher collapsed={collapsed} />

        {sidebarOpen && <TrialBadge />}

        {/* Navegação: seções planas, sempre abertas. */}
        <nav className={`flex-1 pb-3 overflow-y-auto ${sidebarOpen ? "px-3" : "px-2"}`}>
          <NavItem to="/dashboard" icon={LayoutDashboard} collapsed={collapsed}>Dashboard</NavItem>

          {hasIntelligence && (
            <NavSection label="Intelligence" collapsed={collapsed}>
              <NavItem to="/intelligence/monitoring" icon={Activity} collapsed={collapsed}>Monitoramento</NavItem>
              <NavItem to="/intelligence/sentiment" icon={Smile} collapsed={collapsed}>Sentimento</NavItem>
              {hasSov && <NavItem to="/intelligence/sov" icon={ChartPie} collapsed={collapsed}>Share of Voice</NavItem>}
              <NavItem to="/intelligence/influencers" icon={Users} collapsed={collapsed}>Influenciadores</NavItem>
              <NavItem to="/alerts" icon={Bell} collapsed={collapsed} badge={<AlertsBadge />}>Alertas</NavItem>
            </NavSection>
          )}

          {hasOperations && (
            <NavSection label="Operations" collapsed={collapsed}>
              {/* A ordem do menu é a ordem do fluxo: campanha → elenco →
                  contrato → entrega → custódia. */}
              <NavItem to="/operations" end icon={Gauge} collapsed={collapsed}>Painel</NavItem>
              <NavItem to="/operations/campaigns" icon={Megaphone} collapsed={collapsed}>Campanhas</NavItem>
              <NavItem to="/operations/influencers" icon={UsersRound} collapsed={collapsed}>Elenco</NavItem>
              <NavItem to="/operations/contracts" icon={FileText} collapsed={collapsed}>Contratos</NavItem>
              <NavItem to="/operations/deliveries" icon={Package} collapsed={collapsed}>Entregas</NavItem>
              <NavItem to="/operations/escrow" icon={Vault} collapsed={collapsed}>Custódia</NavItem>
            </NavSection>
          )}

          {(hasOperations || hasIntelligence) && (
            <NavSection label="Gestão" collapsed={collapsed}>
              {hasIntelligence && <NavItem to="/brands" icon={Tag} collapsed={collapsed}>Marcas</NavItem>}
              {hasReports && <NavItem to="/reports" icon={FileChartColumn} collapsed={collapsed}>Relatórios</NavItem>}
              {/* Consumo e Plano vivem no diálogo de configurações, não no menu. */}
              <NavItem to="/users" icon={UserCog} collapsed={collapsed}>Usuários</NavItem>
            </NavSection>
          )}

          {/* Admin Zoe — curadoria de brands (ADR-021). Só aparece pro grupo
              `zoe-admin`; a autoridade real é a policy ZoeAdmin no backend. */}
          {isZoeAdmin && (
            <NavSection label="Zoe" collapsed={collapsed}>
              <NavItem to="/admin/brands" icon={ShieldCheck} collapsed={collapsed}>Curadoria</NavItem>
            </NavSection>
          )}
        </nav>

        {/* Rodapé: a PESSOA. O workspace mudou para o topo da sidebar. */}
        <div className="border-t border-border-soft p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Menu do usuário"
                className={`w-full p-1.5 flex items-center rounded-lg hover:bg-tint cursor-pointer transition-colors ${sidebarOpen ? "gap-2.5" : "justify-center"}`}
              >
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-teal-500 text-white text-[13px] font-semibold">
                    {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[13px] font-medium text-ink truncate">{user?.name ?? "User"}</div>
                      <div className="text-[11px] text-ink-muted truncate">{user?.email}</div>
                    </div>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-ink-muted-2 shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-60">
              <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-teal-500 text-white text-[13px] font-semibold">
                    {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold truncate">{user?.name ?? "User"}</span>
                  <span className="block text-[11px] font-normal text-ink-muted truncate">{userContext || user?.email}</span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="flex items-center gap-2 text-sm cursor-pointer"
                onSelect={() => openSettings("perfil")}
              >
                <UserRound className="w-4 h-4 text-ink-muted" /> Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 text-sm cursor-pointer"
                onSelect={() => openSettings("aparencia")}
              >
                <Palette className="w-4 h-4 text-ink-muted" /> Aparência
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 text-sm cursor-pointer"
                onSelect={() => openSettings("plano")}
              >
                <CreditCard className="w-4 h-4 text-ink-muted" /> Plano e consumo
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer text-neg focus:text-neg"
                onSelect={async () => { await signOut(); navigate("/login", { replace: true }) }}
              >
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-15 sticky top-0 bg-surface border-b border-border-soft px-6 flex items-center gap-2 shrink-0 z-20">
          <Breadcrumb />
          <div className="flex-1" />
          {/* A busca saiu daqui: o campo não fazia nada. Volta quando existir busca de verdade. */}
          {/* Só Alertas lê várias marcas de uma vez (a API de disparos
              aceita `brandId` nulo). Ver `allBrands` no BrandContext. */}
          <BrandSwitcher allowAll={location.pathname.startsWith("/alerts")} />
          <button
            type="button"
            aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-tint transition-colors cursor-pointer"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <NotificationBell />
        </header>

        {/* Content */}
        {/* O <main> não tem padding de propósito: ele é só o scrollport. Com
            `p-6` aqui, a caixa de conteúdo começava 24px abaixo da borda e as
            barras `sticky top-0` das telas grudavam nesse recuo em vez de
            encostar no header. O respiro mudou pro wrapper de rota, então as 14
            telas full-bleed seguem cancelando com o mesmo `-m-6`.

            `scrollbar-gutter: stable` reserva a calha desde o primeiro quadro:
            sem isso o conteúdo pula alguns pixels na horizontal quando a barra
            aparece. */}
        <main
          ref={mainRef}
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ scrollbarGutter: "stable" }}
        >
          {/* `empty:hidden`: os dois avisos somem na maior parte do tempo, e sem
              isso o padding deles deixava uma faixa morta no topo. */}
          <div className="px-6 pt-6 empty:hidden">
            <BillingStateBanner />
            <TrialBanner />
          </div>
          {/* Remonta por rota: cada tela entra com o mesmo movimento curto. */}
          <div key={location.pathname} className="z-rise p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Fora do <main>: o diálogo é da aplicação, não da rota — e é o que permite
          abrir Plano por cima de qualquer tela sem perder o lugar. */}
      <SettingsDialog />
      <UpgradeDialog />
      {/* Volta do Stripe do backfill: vale para qualquer rota, então mora no shell. */}
      <BackfillReturn />
    </div>
  )
}

// ── Período de teste ───────────────────────────────────────────────────────

/**
 * Dias até o fim do teste, ou null fora dele. Conta contra o `asOf` da resposta — o
 * relógio do servidor —, não contra o do navegador: render puro e sem depender da
 * hora local estar certa.
 */
function useTrialDaysLeft(): number | null {
  const { data } = useSubscription()
  if (!data || data.status !== "Trialing" || !data.trialEndsAt) return null

  const ms = new Date(data.trialEndsAt).getTime() - new Date(data.asOf).getTime()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

function TrialBadge() {
  const days = useTrialDaysLeft()
  const openSettings = useOpenSettings()
  if (days === null) return null

  return (
    <button
      onClick={() => openSettings("plano")}
      className="mx-3 mb-1 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors hover:opacity-80"
      style={{ background: "var(--teal-bg)", color: "var(--teal-fg)" }}
    >
      <span className="font-medium">Período de teste</span>
      <span className="font-mono-zoe">{days === 1 ? "1 dia" : `${days} dias`}</span>
    </button>
  )
}

/**
 * Cobrança em estado ruim: pagamento pendente ou acesso já degradado (RN-I-012).
 *
 * <p><b>Permanente de propósito</b>, ao contrário do aviso de teste. Ali o prazo faz
 * o trabalho e faixa fixa viraria ruído; aqui não há prazo — o estado só sai quando
 * o cliente age, e escondê-lo faria o produto degradar sem explicar por quê.</p>
 *
 * <p>O texto diz explicitamente que <b>o histórico continua acessível e exportável</b>.
 * Cliente que acha que perdeu o dado não volta, e é justamente nesse momento que ele
 * decide se paga ou vai embora.</p>
 */
function BillingStateBanner() {
  const { data } = useSubscription()
  const openSettings = useOpenSettings()

  if (!data) return null
  const pendente = data.status === "PastDue"
  if (!pendente && !data.readOnly) return null

  const tom = pendente
    ? { bg: "#FFFBEB", border: "rgba(217,119,6,.32)", color: "var(--color-warn)" }
    : { bg: "#FEF2F2", border: "rgba(220,38,38,.32)", color: "var(--color-neg)" }

  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-[14px] border px-4 py-3.5"
      style={{ background: tom.bg, borderColor: tom.border }}
    >
      <AlertCircle className="w-[17px] h-[17px] shrink-0 mt-0.5" style={{ color: tom.color }} />
      <div className="flex-1">
        <div className="text-[14px] font-semibold" style={{ color: tom.color }}>
          {pendente
            ? "Pagamento pendente"
            : "Assinatura encerrada — acesso somente leitura"}
        </div>
        <div className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {pendente ? (
            <>
              A última cobrança não foi concluída. O acesso segue completo enquanto o
              provedor tenta de novo; se as tentativas se esgotarem, o workspace fica
              somente leitura.
            </>
          ) : (
            <>
              A coleta de vídeos novos está pausada.{" "}
              <strong>Nenhum dado foi apagado</strong> — marcas, análises, histórico e
              relatórios continuam acessíveis e exportáveis, e voltam a receber coleta
              assim que a assinatura for reativada.
            </>
          )}
        </div>
      </div>
      <button
        onClick={() => openSettings("plano")}
        className="shrink-0 h-8 px-3 inline-flex items-center rounded-lg text-[12.5px] font-medium text-white"
        style={{ background: "var(--color-teal-500)" }}
      >
        {pendente ? "Revisar cobrança" : "Reativar assinatura"}
      </button>
    </div>
  )
}

/** Só nos últimos dias: faixa permanente vira ruído e para de ser lida. */
function TrialBanner() {
  const days = useTrialDaysLeft()
  const openSettings = useOpenSettings()
  if (days === null || days > 3) return null

  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-[14px] border px-4 py-3.5"
      style={{ background: "#FFFBEB", borderColor: "rgba(217,119,6,.32)" }}
    >
      <AlertCircle className="w-[17px] h-[17px] shrink-0 mt-0.5" style={{ color: "var(--color-warn)" }} />
      <div className="flex-1">
        <div className="text-[14px] font-semibold" style={{ color: "var(--color-warn)" }}>
          {days === 0
            ? "Seu período de teste termina hoje"
            : `Seu período de teste termina em ${days === 1 ? "1 dia" : `${days} dias`}`}
        </div>
        <div className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Sem um método de pagamento, a assinatura é cancelada e o acesso fica somente
          leitura. Nenhum dado é apagado.
        </div>
      </div>
      <button
        onClick={() => openSettings("plano")}
        className="shrink-0 h-8 px-3 inline-flex items-center rounded-lg text-[12.5px] font-medium text-white"
        style={{ background: "var(--color-teal-500)" }}
      >
        Escolher plano
      </button>
    </div>
  )
}
