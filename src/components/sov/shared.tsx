import type { ReactNode } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { InfoHint } from "@/components/ui/info-hint"
import { formatScore, readSentiment } from "@/lib/sov"

// Peças comuns às três abas do Share of Voice.

export function DeltaPp({ value, suffix, big }: { value: number; suffix?: string; big?: boolean }) {
  if (value === 0) {
    return <span className={`text-ink-muted-2 font-mono-zoe ${big ? "text-[12px]" : "text-[11.5px]"}`}>—</span>
  }
  const up = value > 0
  const color = up ? "var(--color-pos)" : "var(--color-neg)"
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-medium whitespace-nowrap ${big ? "px-2 py-0.5 rounded text-[11.5px]" : "text-[11.5px]"}`}
      style={big ? { background: up ? "var(--pos-bg)" : "var(--neg-bg)", color } : { color }}
    >
      {up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {up ? "+" : ""}{value}pp{suffix}
    </span>
  )
}

/** Sentimento com rótulo: "0,61" sozinho não diz se é bom. */
export function SentimentChip({ score }: { score: number | null }) {
  const r = readSentiment(score)
  if (r.tone === "unknown") return <span className="text-ink-muted-2 font-mono-zoe">—</span>
  const cls = r.tone === "pos" ? "chip chip-pos" : r.tone === "neg" ? "chip chip-neg" : "chip chip-warn"
  return (
    <span className={`${cls} text-[11px] whitespace-nowrap`}>
      <span className="font-mono-zoe">{formatScore(score)}</span> {r.label}
    </span>
  )
}

export function SectionHead({ title, hint, sub, aside }: {
  title: string
  hint?: string
  sub?: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="eyebrow">{title}</span>
          {hint && <InfoHint text={hint} />}
        </div>
        {sub && <div className="text-[12.5px] text-ink-muted mt-1 max-w-160 leading-relaxed">{sub}</div>}
      </div>
      {aside}
    </div>
  )
}

export function BrandSwatch({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
}

export function BlockSkeleton({ rows = 4, h = "h-9" }: { rows?: number; h?: string }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${h} rounded bg-tint`} />
      ))}
    </div>
  )
}
