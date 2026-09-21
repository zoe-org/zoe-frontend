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
  teal: "bg-teal-500",
  amber: "bg-warn",
  red: "bg-neg",
}

export function KpiCard({ label, value, meta, progress, barColor = "teal", sublabel, valueColor }: KpiCardProps) {
  return (
    <div className="bg-surface rounded-lg border border-border-soft p-4 flex flex-col gap-2">
      <span className="text-xs text-ink-muted font-medium uppercase tracking-wide">{label}</span>
      <span className={cn("text-2xl font-bold", valueColor)}>{value}</span>
      {sublabel && <span className="text-xs text-ink-muted">{sublabel}</span>}
      {meta && <span className="text-xs text-ink-muted">{meta}</span>}
      {progress !== undefined && (
        <div className="h-1.5 bg-tint-2 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColors[barColor])}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
