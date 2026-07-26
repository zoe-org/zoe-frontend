import { ChevronDown, Check, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useActiveBrand } from "@/features/brands/context"

/** Paleta do design pro fallback de cor quando o tenant não escolheu uma. */
const PALETTE = ["#00A799", "#8B5CF6", "#EF4444", "#2563EB", "#F59E0B", "#14B8A6", "#EC4899"]
function brandColor(color: string | null, slug: string): string {
  if (color) return color
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/**
 * Seletor de marca ATIVA no header (posição que era do workspace). A marca é
 * global (BrandContext) — trocar aqui reflete em Dashboard/Monitoramento/
 * Sentimento. Sem marca assinada, não renderiza (as páginas mostram o empty).
 */
export function BrandSwitcher() {
  const { brands, brandId, active, setBrand } = useActiveBrand()

  if (brands.length === 0) return null

  const label = active ? (active.displayName ?? active.brandName) : "Selecione uma marca"
  const dot = active ? brandColor(active.color, active.brandSlug) : "#9AA1AE"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="border border-[#E5E7EB] dark:border-[#262A3A] flex items-center gap-1.5 text-xs text-midnight dark:text-[#E6E8EF] hover:bg-[#F9FAFB] dark:hover:bg-[#1A1D2D] px-3 py-2 rounded-md transition-colors cursor-pointer"
          aria-label="Trocar marca ativa"
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown className="w-3 h-3 text-[#6B7280]" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-[#6B7280] font-semibold">
          Marcas monitoradas
        </DropdownMenuLabel>

        {brands.map((b) => {
          const isActive = b.brandId === brandId
          return (
            <DropdownMenuItem
              key={b.brandId}
              onSelect={() => { if (!isActive) setBrand(b.brandId) }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: brandColor(b.color, b.brandSlug) }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{b.displayName ?? b.brandName}</div>
                <div className="text-[11px] text-[#6B7280] truncate">
                  {b.videoCount30d} {b.videoCount30d === 1 ? "vídeo" : "vídeos"} · 30d
                </div>
              </div>
              {isActive && <Check className="w-4 h-4 text-teal-500 shrink-0" />}
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/brands" className="flex items-center gap-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            Gerenciar marcas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
