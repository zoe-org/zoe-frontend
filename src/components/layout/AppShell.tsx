import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  House, Brain, Settings, Bell,
  ChevronDown, ChevronUp, Search, PanelLeftClose, PanelLeftOpen, ChevronsUpDown,
  Sun, Moon, LogOut,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/AuthContext"
import { useFeature } from "@/features/auth/useFeature"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { TenantSwitcher } from "@/components/layout/TenantSwitcher"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

const STORAGE_INTEL_KEY = "zoe_sidebar_intel_open"
const STORAGE_GESTAO_KEY = "zoe_sidebar_gestao_open"
const STORAGE_SIDEBAR_KEY = "zoe_sidebar_open"

function getInitialOpenState(key: string): boolean {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? true : stored === "true"
  } catch {
    return true
  }
}


const SubNavItem = ({ to, children, badge }: { to: string, children: React.ReactNode, badge?: React.ReactNode }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `relative flex items-center font-medium justify-between py-1.5 pl-4 text-[13.5px] transition-colors ${isActive
        ? "text-teal-500 dark:text-teal-300"
        : "text-[#697788] dark:text-[#8A91A3] hover:text-[--color-midnight] dark:hover:text-[#E6E8EF]"
      }`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span className="absolute -left-[1.5px] top-1/2 -translate-y-1/2 w-[1.5px] h-5 bg-teal-500 rounded-full" />
        )}
        <span>{children}</span>
        {badge}
      </>
    )}
  </NavLink>
)

export function AppShell() {
  const { user, role, signOut, activeTenantId } = useAuth()
  const queryClient = useQueryClient()
  const hasIntelligence = useFeature("intelligence")
  const hasOperations = useFeature("operations")
  const hasSov = useFeature("sov")
  const location = useLocation()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const [sidebarOpen, setSidebarOpen] = useState(() => getInitialOpenState(STORAGE_SIDEBAR_KEY))
  const [intelOpen, setIntelOpen] = useState(() => getInitialOpenState(STORAGE_INTEL_KEY))
  const [gestaoOpen, setGestaoOpen] = useState(() => getInitialOpenState(STORAGE_GESTAO_KEY))

  // Troca de tenant: descarta o cache do tenant anterior. O tenantId nas query
  // keys já impede servir dado de outro tenant; isto libera memória e força um
  // refetch limpo. Isolamento é preocupação de frontend também.
  useEffect(() => {
    queryClient.clear()
  }, [activeTenantId, queryClient])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_SIDEBAR_KEY, String(sidebarOpen)) } catch { }
  }, [sidebarOpen])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_INTEL_KEY, String(intelOpen)) } catch { }
  }, [intelOpen])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_GESTAO_KEY, String(gestaoOpen)) } catch { }
  }, [gestaoOpen])

  useEffect(() => {
    if (
      location.pathname.startsWith("/intelligence") ||
      location.pathname === "/alerts"
    ) {
      setIntelOpen(true)
    }
    if (
      location.pathname === "/brands" ||
      location.pathname === "/reports" ||
      location.pathname === "/users"
    ) {
      setGestaoOpen(true)
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen flex text-midnight position-relative bg-surface  dark:text-[#E6E8EF]">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-14"} transition-[width] duration-200 h-dvh border-r sticky top-0 text-[#697788] dark:text-[#8A91A3] border-[#E5E7EB] dark:border-[#1C1F2E] flex flex-col overflow-hidden shrink-0`}>
        {/* Logo */}
        <div className={`h-fit flex items-center my-4 ${sidebarOpen ? "px-4 justify-between" : "justify-center"}`}>
          {sidebarOpen && <ZoeLogo className="w-12 h-full text-teal-500" />}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="cursor-pointer dark:text-[#8A91A3] hover:text-ink dark:hover:text-[#E6E8EF] transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose className="h-5" /> : <PanelLeftOpen className="h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-2 space-y-1 overflow-y-auto ${sidebarOpen ? "pl-2 pr-4" : "px-2"}`}>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-2 py-2 font-medium text-[14px] transition-colors rounded-md ${sidebarOpen ? "px-3" : "justify-center px-2"} ${isActive
                ? "text-[#00A799] dark:text-teal-300"
                : "text-[#697788] dark:text-[#8A91A3] hover:text-[--color-midnight] dark:hover:text-[#E6E8EF]"
              }`
            }
          >
            <House className="w-[18px] h-[18px] shrink-0" strokeWidth={2.5} />
            {sidebarOpen && <span>Dashboard</span>}
          </NavLink>

          {hasIntelligence && (
            <>
              <button
                onClick={() => sidebarOpen ? setIntelOpen(!intelOpen) : setSidebarOpen(true)}
                className={`w-full flex items-center py-2 rounded-md text-[14px] font-medium transition-colors text-[#697788] dark:text-[#8A91A3] ${sidebarOpen ? "pl-3 justify-between" : "justify-center px-2"}`}
              >
                <span className={`flex items-center ${sidebarOpen ? "gap-2" : ""}`}>
                  <Brain className="w-[18px] h-[18px] shrink-0" strokeWidth={2.5} />
                  {sidebarOpen && <span>Intelligence</span>}
                </span>
                {sidebarOpen && (intelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
              </button>

              {sidebarOpen && intelOpen && (
                <div className="ml-[21px] border-l-2 border-[#E5E7EB] dark:border-[#1C1F2E] flex flex-col mt-0 mb-2">
                  <SubNavItem to="/intelligence/monitoring">Monitoramento</SubNavItem>
                  <SubNavItem to="/intelligence/sentiment">Sentimento</SubNavItem>
                  {hasSov && <SubNavItem to="/intelligence/sov">Share of Voice</SubNavItem>}
                  <SubNavItem to="/intelligence/influencers">Influenciadores</SubNavItem>
                  <SubNavItem to="/alerts" badge={<span className="bg-ember text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>}>Alertas</SubNavItem>
                </div>
              )}
            </>
          )}

          {(hasOperations || hasIntelligence) && (
            <>
              <button
                onClick={() => sidebarOpen ? setGestaoOpen(!gestaoOpen) : setSidebarOpen(true)}
                className={`w-full flex items-center py-2 rounded-md text-[14px] font-medium transition-colors text-[#697788] dark:text-[#8A91A3] ${sidebarOpen ? "pl-3 justify-between" : "justify-center px-2"}`}
              >
                <span className={`flex items-center ${sidebarOpen ? "gap-2" : ""}`}>
                  <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={2.5} />
                  {sidebarOpen && <span>Gestão</span>}
                </span>
                {sidebarOpen && (gestaoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
              </button>

              {sidebarOpen && gestaoOpen && (
                <div className="ml-[21px] border-l-2 border-[#E5E7EB] dark:border-[#1C1F2E] flex flex-col mt-0 mb-2">
                  {hasIntelligence && <SubNavItem to="/brands">Marcas</SubNavItem>}
                  <SubNavItem to="/reports">Relatórios</SubNavItem>
                  <SubNavItem to="/users">Usuários</SubNavItem>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-[#E5E7EB] dark:border-[#1C1F2E]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Menu do usuário"
                className={`w-[calc(100%-1rem)] p-2 m-2 flex items-center rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] cursor-pointer transition-colors text-[#697788] dark:text-[#8A91A3] ${sidebarOpen ? "gap-3" : "justify-center"}`}
              >
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback className="bg-teal-500 text-white text-sm font-semibold">
                    {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <>
                    <div className="flex-1 min-w-0 text-[13px] text-left">
                      <div className="font-semibold text-[#111827] dark:text-[#E6E8EF] truncate">{user?.name ?? "User"}</div>
                      <div className="text-[#6B7280] dark:text-[#8A91A3] text-xs truncate">{role ?? "—"}</div>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-[#6B7280] dark:text-[#8A91A3]" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="text-xs">
                <div className="font-semibold truncate">{user?.name ?? "User"}</div>
                <div className="text-[#6B7280] font-normal truncate">{user?.email}</div>
              </DropdownMenuLabel>
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
        <header className="h-15 sticky top-0 bg-surface border-b border-[#E5E7EB] dark:border-[#1C1F2E] px-6 flex items-center gap-2 shrink-0 z-20">
          <Breadcrumb />
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Buscar menções, influenciadores, marcas..."
              className="w-75 h-8 pl-8 pr-3 text-xs  border border-[#E5E7EB] dark:border-[#262A3A] dark:text-[#E6E8EF] rounded-md outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <TenantSwitcher />
          <button
            type="button"
            aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="text-[#6B7280] p-2 rounded-md hover:text-ink hover:bg-muted dark:hover:text-[#E6E8EF] transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button className=" text-[#6B7280] p-2 rounded-md hover:text-ink hover:bg-muted dark:hover:text-[#E6E8EF] transition-colors cursor-pointer">
            <div className="relative">
              <span className="absolute -top-1 -right-0.5 w-1.5 h-1.5 bg-[#DC2626] rounded-full" />
            </div>
            <Bell className="w-4 h-4" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}


