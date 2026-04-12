import { cn } from "@/lib/utils"

type KpiCardProps = {
  label: string
  value: string | number
  meta?: string
  progress?: number
  barColor?: "teal" | "amber" | "red"
  sublabel?: string
  valueColor?: string
}

const barColors = {
  teal: "bg-[#00A799]",
  amber: "bg-[#D97706]",
  red: "bg-[#DC2626]",
}

export function KpiCard({ label, value, meta, progress, barColor = "teal", sublabel, valueColor }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg border p-4 flex flex-col gap-2">
      <span className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">{label}</span>
      <span className={cn("text-2xl font-bold", valueColor)}>{value}</span>
      {sublabel && <span className="text-xs text-[#6B7280]">{sublabel}</span>}
      {meta && <span className="text-xs text-[#6B7280]">{meta}</span>}
      {progress !== undefined && (
        <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColors[barColor])}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
