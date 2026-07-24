import { ChevronDown, Check, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/features/auth/context"

/** Hash determinístico → cor consistente por tenant (8 buckets do design system). */
const PALETTE = [
  "#820AD1", "#00A799", "#F97316", "#0EA5E9",
  "#DC2626", "#16A34A", "#D97706", "#7C3AED",
]
function tenantColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export function TenantSwitcher() {
  const { activeTenant, activeTenantId, memberships, switchTenant } = useAuth()

  // Sem memberships ainda (pré-onboarding) — não renderiza nada
  if (memberships.length === 0) return null

  const activeName = activeTenant?.tenant.name ?? memberships.find(m => m.tenantId === activeTenantId)?.tenantName ?? "—"
  const activeColor = activeTenantId ? tenantColor(activeTenantId) : "#6B7280"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="border flex items-center gap-1.5 text-xs text-[--color-midnight] dark:text-[#E6E8EF] hover:bg-[#F9FAFB] dark:hover:bg-[#1A1D2D] px-3 py-2 rounded-md transition-colors cursor-pointer"
          aria-label="Trocar tenant"
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeColor }} />
          <span className="max-w-[140px] truncate">{activeName}</span>
          <ChevronDown className="w-3 h-3 text-[#6B7280]" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-[#6B7280] font-semibold">
          Workspaces
        </DropdownMenuLabel>

        {memberships.map(m => {
          const isActive = m.tenantId === activeTenantId
          return (
            <DropdownMenuItem
              key={m.tenantId}
              onSelect={() => { if (!isActive) void switchTenant(m.tenantId) }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tenantColor(m.tenantId) }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.tenantName}</div>
                <div className="text-[11px] text-[#6B7280] truncate">{m.role}</div>
              </div>
              {isActive && <Check className="w-4 h-4 text-teal-500 shrink-0" />}
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/onboarding/tenant" className="flex items-center gap-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            Criar novo workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
