import { useRef, useState } from "react"
import { useTheme } from "next-themes"
import { heatmapRamp } from "@/lib/heatmap-ramp"

type SparklineProps = {
  data: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#00A799",
  fillOpacity = 0.12,
}: SparklineProps) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map(
    (v, i) =>
      [
        (i / (data.length - 1)) * width,
        (1 - (v - min) / range) * (height - 4) + 2,
      ] as const
  )
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const midX = (p0[0] + p1[0]) / 2
    d += ` Q ${midX} ${p0[1]}, ${midX} ${(p0[1] + p1[1]) / 2} T ${p1[0]} ${p1[1]}`
  }
  const area = d + ` L ${width} ${height} L 0 ${height} Z`
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={area} fill={color} fillOpacity={fillOpacity} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

type AreaLineProps = {
  data: { day: number; value: number; label?: string }[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
}

export function AreaLine({
  data,
  width = 600,
  height = 180,
  color = "#00A799",
  fillOpacity = 0.12,
}: AreaLineProps) {
  const pad = { t: 12, r: 12, b: 6, l: 6 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const values = data.map((d) => d.value)
  const vmin = Math.min(...values)
  const vmax = Math.max(...values)
  const range = vmax - vmin || 1

  const points = data.map((d, i) => {
    const x = pad.l + (i / (data.length - 1)) * W
    const y = pad.t + (1 - (d.value - vmin) / range) * H
    return [x, y] as const
  })

  const smoothPath = (pts: readonly (readonly [number, number])[]) => {
    if (pts.length < 2) return ""
    let d = `M ${pts[0][0]} ${pts[0][1]}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] || p2
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`
    }
    return d
  }

  const linePath = smoothPath(points)
  const areaPath =
    linePath +
    ` L ${points[points.length - 1][0]} ${pad.t + H} L ${points[0][0]} ${pad.t + H} Z`

  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = `grad-${color.replace("#", "")}`

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (width / rect.width)
    const idx = Math.max(
      0,
      Math.min(
        data.length - 1,
        Math.round(((x - pad.l) / W) * (data.length - 1))
      )
    )
    setHover(idx)
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity * 2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hover !== null && (
          <g>
            <line
              x1={points[hover][0]}
              x2={points[hover][0]}
              y1={pad.t}
              y2={pad.t + H}
              stroke={color}
              strokeOpacity="0.3"
              strokeDasharray="3 3"
            />
            <circle
              cx={points[hover][0]}
              cy={points[hover][1]}
              r="4"
              fill={color}
              stroke="#fff"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          style={{
            position: "absolute",
            left: `${(points[hover][0] / width) * 100}%`,
            top: `${(points[hover][1] / height) * 100}%`,
            transform: "translate(-50%, -120%)",
            pointerEvents: "none",
            background: "#07091A",
            color: "#fff",
            padding: "6px 8px",
            fontSize: 11.5,
            borderRadius: 6,
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
          }}
        >
          {data[hover].label || `Dia ${hover + 1}`} · {data[hover].value}
        </div>
      )}
    </div>
  )
}

type Series = {
  name: string
  color: string
  data: number[]
}

type MultiLineProps = {
  series: Series[]
  labels?: string[]
  width?: number
  height?: number
}

export function MultiLine({
  series,
  labels,
  width = 600,
  height = 180,
}: MultiLineProps) {
  const pad = { t: 12, r: 12, b: 20, l: 28 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const all = series.flatMap((s) => s.data)
  const vmax = Math.max(...all, 0)
  const vmin = 0
  const range = vmax - vmin || 1
  const len = series[0]?.data.length ?? 0

  const xOf = (i: number) =>
    pad.l + (len === 1 ? W / 2 : (i / (len - 1)) * W)
  const yOf = (v: number) => pad.t + (1 - (v - vmin) / range) * H

  const smoothPath = (pts: readonly (readonly [number, number])[]) => {
    if (pts.length < 2) return ""
    let d = `M ${pts[0][0]} ${pts[0][1]}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] || p2
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`
    }
    return d
  }

  const gridSteps = 4
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = vmin + (range * i) / gridSteps
    return { v, y: yOf(v) }
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: "block" }}
    >
      {grid.map((g, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            x2={pad.l + W}
            y1={g.y}
            y2={g.y}
            stroke="currentColor"
            strokeOpacity="0.08"
          />
          <text
            x={pad.l - 6}
            y={g.y + 3}
            fontSize="9.5"
            fill="currentColor"
            opacity="0.45"
            textAnchor="end"
            fontFamily="var(--font-mono)"
          >
            {Math.round(g.v)}
          </text>
        </g>
      ))}
      {series.map((s) => {
        const pts = s.data.map((v, i) => [xOf(i), yOf(v)] as const)
        return (
          <g key={s.name}>
            <path
              d={smoothPath(pts)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.5" fill={s.color} />
            ))}
          </g>
        )
      })}
      {labels && labels.map((lb, i) => (
        <text
          key={lb}
          x={xOf(i)}
          y={height - 4}
          fontSize="10"
          fill="currentColor"
          opacity="0.55"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
        >
          {lb}
        </text>
      ))}
    </svg>
  )
}

type HeatmapProps = {
  data: number[][]
  width?: number
}

export function Heatmap({ data, width = 560 }: HeatmapProps) {
  const rows = data.length
  const cols = data[0]?.length ?? 0
  const labelW = 32
  const cellGap = 2
  const cellW = (width - labelW) / cols - cellGap
  const cellH = 18
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

  // A rampa clara SOBE a partir do branco: no fundo escuro, a célula vazia — que é
  // a maioria — virava um bloco branco, e o mapa lia como um tabuleiro aceso onde
  // não há nada. No escuro ela sobe a partir da própria superfície, então ausência
  // parece ausência e a intensidade cresce em direção ao teal.
  const { resolvedTheme } = useTheme()
  const ramp = heatmapRamp(resolvedTheme === "dark")

  const color = (v: number) =>
    ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))]
  const [hover, setHover] = useState<{ ri: number; ci: number; v: number } | null>(null)

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${rows * (cellH + cellGap) + 24}`}
        width="100%"
      >
        {data.map((row, ri) => (
          <g key={ri}>
            <text
              x="0"
              y={ri * (cellH + cellGap) + cellH * 0.7}
              fontSize="10.5"
              fill="currentColor"
              opacity="0.7"
            >
              {days[ri]}
            </text>
            {row.map((v, ci) => (
              <rect
                key={ci}
                x={labelW + ci * (cellW + cellGap)}
                y={ri * (cellH + cellGap)}
                width={cellW}
                height={cellH}
                rx={2}
                fill={color(v)}
                onMouseEnter={() => setHover({ ri, ci, v })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              />
            ))}
          </g>
        ))}
        {[0, 6, 12, 18, 23].map((h) => (
          <text
            key={h}
            x={labelW + h * (cellW + cellGap) + cellW / 2}
            y={rows * (cellH + cellGap) + 14}
            fontSize="10"
            fill="currentColor"
            opacity="0.55"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
          >
            {String(h).padStart(2, "0")}h
          </text>
        ))}
      </svg>
      {hover && (
        <div
          style={{
            position: "absolute",
            left: `${((labelW + hover.ci * (cellW + cellGap) + cellW / 2) / width) * 100}%`,
            top: hover.ri * (cellH + cellGap) - 12,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            background: "#07091A",
            color: "#fff",
            padding: "6px 8px",
            fontSize: 11.5,
            borderRadius: 6,
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
          }}
        >
          {days[hover.ri]} {String(hover.ci).padStart(2, "0")}h · {Math.round(hover.v * 80)} menções
        </div>
      )}
    </div>
  )
}
