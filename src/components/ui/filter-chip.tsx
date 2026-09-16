import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type FilterChipProps = {
  label: string
  active?: boolean
  hasDropdown?: boolean
  onClick?: () => void
}

export function FilterChip({ label, active, hasDropdown = true, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-[#00A799]/10 text-[#00A799] border-[#00A799]/30"
          // `bg-white` fixo virava uma pílula branca sobre a superfície escura.
          // Os tokens seguem o tema; a borda usa a mesma do resto do produto.
          : "bg-surface text-ink-muted border-border-soft hover:bg-[#F9FAFB] dark:hover:bg-[#1A1D2D]"
      )}
    >
      {label}
      {hasDropdown && <ChevronDown className="w-3 h-3" />}
    </button>
  )
}
