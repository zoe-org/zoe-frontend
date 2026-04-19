import { useState, useEffect } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import {
  House, Brain, Settings, Bell,
  ChevronDown, ChevronUp, Search, PanelLeftClose, ChevronsUpDown
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/AuthContext"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

const STORAGE_INTEL_KEY = "zoe_sidebar_intel_open"
const STORAGE_GESTAO_KEY = "zoe_sidebar_gestao_open"

function getInitialOpenState(key: string): boolean {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? true : stored === "true"
  } catch {
    return true
  }
}

const navLinkClass = (isActive: boolean) =>
  `flex items-center gap-2 px-3 py-2 font-medium text-[14px] transition-colors ${
    isActive
      ? "text-[#00A799]"
      : "text-[#697788] hover:text-[--color-midnight]"
  }`

const SubNavItem = ({ to, children, badge }: { to: string, children: React.ReactNode, badge?: React.ReactNode }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `relative flex items-center font-medium justify-between py-1.5 pl-4 text-[13.5px] transition-colors ${
        isActive
          ? "text-teal-500"
          : "text-[#697788] hover:text-[--color-midnight]"
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
  const { user } = useAuth()
  const location = useLocation()
  
  const [intelOpen, setIntelOpen] = useState(() => getInitialOpenState(STORAGE_INTEL_KEY))
  const [gestaoOpen, setGestaoOpen] = useState(() => getInitialOpenState(STORAGE_GESTAO_KEY))

  useEffect(() => {
    try { localStorage.setItem(STORAGE_INTEL_KEY, String(intelOpen)) } catch {}
  }, [intelOpen])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_GESTAO_KEY, String(gestaoOpen)) } catch {}
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

  const pageTitle = getPageTitle(location.pathname)

  return (
    <div className="min-h-screen flex text-[--color-midnight] position-relative bg-[#F9FAFB]">
      {/* Sidebar */}
      <aside className="w-65 h-dvh border-r sticky top-0 text-[#697788] border-[#E5E7EB] bg-[#F9FAFB] flex flex-col ">
        {/* Logo */}
        <div className="h-14 px-4 flex items-center justify-between mb-5">
          <ZoeLogo className="w-15 h-full text-teal-500" />
          <PanelLeftClose className="h-6 cursor-pointer" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          <NavLink to="/dashboard" className={({ isActive }) => navLinkClass(isActive)}>
            <House className="w-[18px] h-[18px]" strokeWidth={2.5}/> Dashboard
          </NavLink>

          <button
            onClick={() => setIntelOpen(!intelOpen)}
            className={`w-full flex items-center justify-between pl-3 py-2 rounded-md text-[14px] font-medium transition-colors ${
              intelOpen ? "text-[#697788]" : "text-[#697788]"
            }`}
          >
            <span className="flex items-center gap-2">
              <Brain className="w-[18px] h-[18px]" strokeWidth={2.5}/> Intelligence
            </span>
            {intelOpen ? <ChevronUp className="w-4 h-4 text-[#697788]" /> : <ChevronDown className="w-4 h-4 text-[#697788]" />}
          </button>
          
          {intelOpen && (
            <div className="ml-[21px] border-l-2 border-[#E5E7EB] flex flex-col mt-0 mb-2">
              <SubNavItem to="/intelligence/monitoring">Monitoramento</SubNavItem>
              <SubNavItem to="/intelligence/sentiment">Sentimento</SubNavItem>
              <SubNavItem to="/intelligence/influencers">Influenciadores</SubNavItem>
              <SubNavItem to="/alerts" badge={<span className="bg-ember text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>}>Alertas</SubNavItem>
            </div>
          )}

          <button
            onClick={() => setGestaoOpen(!gestaoOpen)}
            className={`w-full flex items-center justify-between pl-3 py-2 rounded-md text-[14px] font-medium transition-colors ${
              gestaoOpen ? "text-[#697788]" : "text-[#697788] "
            }`}
          >
            <span className="flex items-center gap-2">
              <Settings className="w-[18px] h-[18px]" strokeWidth={2.5} /> Gestão
            </span>
            {gestaoOpen ? <ChevronUp className="w-4 h-4 text-[#697788]" /> : <ChevronDown className="w-4 h-4 text-[#697788]" />}
          </button>
          
          {gestaoOpen && (
            <div className="ml-[21px] border-l-2 border-[#E5E7EB] flex flex-col mt-0 mb-2">
              <SubNavItem to="/brands">Marcas</SubNavItem>
              <SubNavItem to="/reports">Relatórios</SubNavItem>
              <SubNavItem to="/users">Usuários</SubNavItem>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-2 m-2 flex items-center gap-3 rounded-lg hover:bg-[#F3F4F6] cursor-pointer transition-colors mt-auto mb-2 text-[#697788]">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-teal-500 text-white text-sm font-semibold">
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-[13px]">
            <div className="font-semibold text-[#111827] truncate">{user?.name ?? "User"}</div>
            <div className="text-[#6B7280] text-xs truncate">Intelligence • Admin</div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-[#6B7280]" />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-13 sticky top-0 bg-[#F9FAFB] border-b border-[#E5E7EB] px-6 flex items-center gap-4 shrink-0">
          <h1 className="text-sm font-bold flex-1">{pageTitle}</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-40 h-8 pl-8 pr-3 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-md outline-none focus:ring-1 focus:ring-teal-500"
              readOnly
            />
          </div>
          <button className="relative text-[#6B7280] hover:text-[--color-midnight] transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#DC2626] rounded-full" />
          </button>
          <button className="flex items-center gap-1.5 text-xs text-[--color-midnight] hover:bg-[#F9FAFB] px-2 py-1 rounded-md transition-colors">
            <span className="w-2 h-2 rounded-full bg-[#820AD1]" />
            <span>Nubank</span>
            <ChevronDown className="w-3 h-3 text-[#6B7280]" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto bg-[#F9FAFB]">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/intelligence/monitoring": "Monitoramento",
    "/intelligence/sentiment": "Sentimento",
    "/intelligence/influencers": "Influenciadores",
    "/alerts": "Alertas",
    "/brands": "Marcas",
    "/reports": "Relatórios",
    "/users": "Usuários",
  }
  return titles[pathname] ?? "Zoe"
}

