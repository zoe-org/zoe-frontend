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
          : "bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB]"
      )}
    >
      {label}
      {hasDropdown && <ChevronDown className="w-3 h-3" />}
    </button>
  )
}
