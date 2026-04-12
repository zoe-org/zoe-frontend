import { useState, useEffect } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Eye, Activity, Users, Bell, Tag, FileText,
  ChevronDown, ChevronUp, Search, Settings,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/AuthContext"
import { Breadcrumb } from "@/components/ui/breadcrumb"

const STORAGE_KEY = "zoe_sidebar_intel_open"

function getInitialIntelOpen(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === null ? true : stored === "true"
  } catch {
    return true
  }
}

const navLinkClass = (isActive: boolean) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive
      ? "bg-[#F0FDFA] text-[#00A799] font-semibold"
      : "text-[--color-midnight] hover:bg-[#F9FAFB]"
  }`

export function AppShell() {
  const { user } = useAuth()
  const location = useLocation()
  const [intelOpen, setIntelOpen] = useState(getInitialIntelOpen)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(intelOpen)) } catch {}
  }, [intelOpen])

  useEffect(() => {
    if (
      location.pathname.startsWith("/intelligence") ||
      location.pathname === "/alerts"
    ) {
      setIntelOpen(true)
    }
  }, [location.pathname])

  const pageTitle = getPageTitle(location.pathname)

  return (
    <div className="min-h-screen flex bg-[--color-ivory] text-[--color-midnight]">
      {/* Sidebar */}
      <aside className="w-55 border-r border-[#E5E7EB] bg-white flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-14 px-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-teal-500 flex items-center justify-center text-white text-sm font-bold">Z</div>
          <span className="text-base font-bold text-[--color-midnight]">Zoe</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <NavLink to="/dashboard" className={({ isActive }) => navLinkClass(isActive)}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </NavLink>

          <div className="pt-3">
            <span className="px-3 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Intelligence</span>
          </div>
          <button
            onClick={() => setIntelOpen(!intelOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-[--color-midnight] hover:bg-[#F9FAFB] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> Intelligence
            </span>
            {intelOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {intelOpen && (
            <div className="ml-4 space-y-0.5">
              <NavLink to="/intelligence/monitoring" className={({ isActive }) => navLinkClass(isActive)}>
                <Eye className="w-4 h-4" /> Monitoramento
              </NavLink>
              <NavLink to="/intelligence/sentiment" className={({ isActive }) => navLinkClass(isActive)}>
                <Activity className="w-4 h-4" /> Sentimento
              </NavLink>
              <NavLink to="/intelligence/influencers" className={({ isActive }) => navLinkClass(isActive)}>
                <Users className="w-4 h-4" /> Influenciadores
              </NavLink>
              <NavLink to="/alerts" className={({ isActive }) => navLinkClass(isActive)}>
                <Bell className="w-4 h-4" /> Alertas
                <span className="ml-auto bg-ember text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
              </NavLink>
            </div>
          )}

          <div className="pt-3">
            <span className="px-3 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Gestão</span>
          </div>
          <NavLink to="/brands" className={({ isActive }) => navLinkClass(isActive)}>
            <Tag className="w-4 h-4" /> Marcas
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => navLinkClass(isActive)}>
            <FileText className="w-4 h-4" /> Relatórios
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#E5E7EB] flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-teal-500 text-white text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-medium truncate">{user?.name ?? user?.email}</div>
            <div className="text-[#6B7280] truncate">Tenant: {user?.tenant.id}</div>
          </div>
          <button className="text-[#6B7280] hover:text-[--color-midnight] transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-13 bg-white border-b border-[#E5E7EB] px-6 flex items-center gap-4 shrink-0">
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
  }
  return titles[pathname] ?? "Zoe"
}
