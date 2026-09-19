import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useTheme } from "next-themes"
import { heatmapRamp } from "@/lib/heatmap-ramp"
import { monotonePath } from "@/lib/curve"

/**
 * Largura real do container, para o SVG ser desenhado no tamanho em que aparece.
 *
 * Com viewBox fixo e altura fixa, o navegador só escala proporcionalmente: numa tela
 * larga o gráfico ficava com 600px, centralizado, com margem vazia dos dois lados.
 * Esticar com preserveAspectRatio="none" deformaria texto e marcadores — medir não.
 */
function useContainerWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width ?? fallback] as const
}

type SparklineProps = {
  data: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
}

export function Sparkline({
  data,
  width: widthProp,
  height = 24,
  color = "#00A799",
  fillOpacity = 0.12,
}: SparklineProps) {
  // Sem `width`, ocupa a largura do container.
  const [boxRef, measured] = useContainerWidth<HTMLDivElement>(widthProp ?? 80)
  const width = widthProp ?? measured
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
  const d = monotonePath(pts)
  const area = d + ` L ${width} ${height} L 0 ${height} Z`
  return (
    <div ref={boxRef} style={{ width: widthProp ?? "100%" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        <path d={area} fill={color} fillOpacity={fillOpacity} className="z-fade" />
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" pathLength={1} className="z-draw" />
      </svg>
    </div>
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
  width: widthProp,
  height = 180,
  color = "#00A799",
  fillOpacity = 0.12,
}: AreaLineProps) {
  // Sem `width`, desenha na largura real do container (ver useContainerWidth).
  const [boxRef, measured] = useContainerWidth<HTMLDivElement>(widthProp ?? 600)
  const width = widthProp ?? measured
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

  const linePath = monotonePath(points)
  const areaPath =
    linePath +
    ` L ${points[points.length - 1][0]} ${pad.t + H} L ${points[0][0]} ${pad.t + H} Z`

  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`

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
    <div ref={boxRef} style={{ position: "relative", width: "100%" }}>
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
        <path d={areaPath} fill={`url(#${gradId})`} className="z-fade" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="z-draw"
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
              stroke="var(--surface)"
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
            background: "var(--ink)",
            color: "var(--surface)",
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
  /** Liga o hover: guia vertical e os valores daquela coluna. Desligado, é o gráfico de sempre. */
  interactive?: boolean
  /** Série desenhada por cima e mais grossa; as outras recuam. */
  emphasize?: string
  /** Séries fora do desenho E da escala — isolar um concorrente é também dar zoom nele. */
  hidden?: ReadonlySet<string>
  formatValue?: (v: number) => string
  /** Título da coluna no tooltip. Sem ele, o rótulo do eixo. */
  columnLabel?: (i: number) => string
  /** Coluna sem dado: o tooltip diz isso em vez de listar zeros que parecem medição. */
  isEmptyColumn?: (i: number) => boolean
  emptyLabel?: string
}

export function MultiLine({
  series,
  labels,
  width: widthProp,
  height = 180,
  interactive = false,
  emphasize,
  hidden,
  formatValue = (v) => String(v),
  columnLabel,
  isEmptyColumn,
  emptyLabel = "Sem dados neste ponto",
}: MultiLineProps) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  // Sem `width`, desenha na largura real do container (ver useContainerWidth).
  const [boxRef, measured] = useContainerWidth<HTMLDivElement>(widthProp ?? 600)
  const width = widthProp ?? measured

  const pad = { t: 12, r: 12, b: 20, l: 28 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const visible = hidden ? series.filter((s) => !hidden.has(s.name)) : series
  const all = visible.flatMap((s) => s.data)
  const vmax = Math.max(...all, 0)
  const vmin = 0
  const range = vmax - vmin || 1
  const len = series[0]?.data.length ?? 0

  const xOf = (i: number) =>
    pad.l + (len === 1 ? W / 2 : (i / (len - 1)) * W)
  const yOf = (v: number) => pad.t + (1 - (v - vmin) / range) * H

  const gridSteps = 4
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = vmin + (range * i) / gridSteps
    return { v, y: yOf(v) }
  })

  // A destacada vai por último para ficar por cima nos cruzamentos.
  const ordered = emphasize
    ? [...visible.filter((s) => s.name !== emphasize), ...visible.filter((s) => s.name === emphasize)]
    : visible

  // Pointer, e não mouse: no toque o tooltip também aparece enquanto o dedo arrasta.
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || len === 0) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * width
    const i = len === 1 ? 0 : Math.round(((x - pad.l) / W) * (len - 1))
    setHover(Math.max(0, Math.min(len - 1, i)))
  }

  const chart = (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: "block", touchAction: interactive ? "pan-y" : undefined }}
      onPointerMove={interactive ? onMove : undefined}
      onPointerLeave={interactive ? () => setHover(null) : undefined}
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
      {interactive && hover != null && (
        <line
          x1={xOf(hover)}
          x2={xOf(hover)}
          y1={pad.t}
          y2={pad.t + H}
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeDasharray="3 3"
        />
      )}
      {ordered.map((s) => {
        const pts = s.data.map((v, i) => [xOf(i), yOf(v)] as const)
        const strong = s.name === emphasize
        const faded = emphasize != null && !strong
        return (
          <g key={s.name} opacity={faded ? 0.5 : 1}>
            <path
              d={monotonePath(pts)}
              fill="none"
              stroke={s.color}
              strokeWidth={strong ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="z-draw"
            />
            {pts.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={hover === i ? 4 : strong ? 3 : 2.5}
                fill={s.color}
                className="z-fade"
                style={{ "--i": 40 + i * 3 } as React.CSSProperties}
              />
            ))}
          </g>
        )
      })}
      {labels && labels.map((lb, i) => (
        <text
          key={i}
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

  if (!interactive) return <div ref={boxRef}>{chart}</div>

  const leftPct = hover == null ? 0 : (xOf(hover) / width) * 100
  const empty = hover != null && (isEmptyColumn?.(hover) ?? false)
  const rows = hover == null
    ? []
    : visible
        .map((s) => ({ name: s.name, color: s.color, v: s.data[hover] }))
        .sort((a, b) => b.v - a.v)

  return (
    <div ref={boxRef} className="relative">
      {chart}
      {hover != null && (
        <div
          className="absolute top-1 pointer-events-none z-10 rounded-lg border border-border-soft px-3 py-2 text-[12px] shadow-sm min-w-44"
          style={{
            left: `${leftPct}%`,
            // Depois da metade vira para a esquerda, senão sai do card.
            transform: leftPct > 55 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            background: "var(--surface)",
          }}
        >
          <div className="font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            {columnLabel?.(hover) ?? labels?.[hover] ?? ""}
          </div>
          {empty ? (
            <div className="text-ink-muted">{emptyLabel}</div>
          ) : (
            rows.map((r) => (
              <div key={r.name} className="flex items-center justify-between gap-4 py-px">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: r.color }} />
                  <span
                    className="truncate"
                    style={{ color: "var(--ink)", fontWeight: r.name === emphasize ? 600 : 400 }}
                  >
                    {r.name}
                  </span>
                </span>
                <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{formatValue(r.v)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

type HeatmapProps = {
  /** Intensidade normalizada [0,1] — decide a cor. */
  data: number[][]
  /** Contagem crua, mesma forma de `data`. É o que o tooltip mostra. */
  counts?: number[][]
  width?: number
}

export function Heatmap({ data, counts, width = 560 }: HeatmapProps) {
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
                className="z-fade"
                style={{ cursor: "pointer", "--i": ci + ri * 3 } as React.CSSProperties}
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
            background: "var(--ink)",
            color: "var(--surface)",
            padding: "6px 8px",
            fontSize: 11.5,
            borderRadius: 6,
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
          }}
        >
          {days[hover.ri]} {String(hover.ci).padStart(2, "0")}h
          {counts && (
            <> · {counts[hover.ri][hover.ci]} {counts[hover.ri][hover.ci] === 1 ? "menção" : "menções"}</>
          )}
        </div>
      )}
    </div>
  )
}

type StackedSeries = { name: string; color: string; data: number[] }

/**
 * Área empilhada: cada faixa é uma série, o topo é o total. Traço reto entre os
 * pontos, e não curva: com curva, uma faixa podia passar por cima da vizinha entre
 * dois dias e desenhar um volume que não existiu.
 */
export function StackedArea({
  series,
  labels,
  height = 200,
  totalColor = "var(--color-teal-500)",
}: {
  series: StackedSeries[]
  /** Um rótulo por coluna (o dia). */
  labels: string[]
  height?: number
  totalColor?: string
}) {
  const [boxRef, width] = useContainerWidth<HTMLDivElement>(600)
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const pad = { t: 10, r: 8, b: 22, l: 28 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b
  const len = labels.length
  const totals = labels.map((_, i) => series.reduce((acc, s) => acc + (s.data[i] ?? 0), 0))
  const vmax = Math.max(...totals, 1)
  const xOf = (i: number) => pad.l + (len <= 1 ? W / 2 : (i / (len - 1)) * W)
  const yOf = (v: number) => pad.t + (1 - v / vmax) * H

  const bands = series.reduce<{ lower: number[]; out: (StackedSeries & { d: string })[] }>(
    (acc, s) => {
      const upper = acc.lower.map((l, i) => l + (s.data[i] ?? 0))
      const top = upper.map((v, i) => `${i ? "L" : "M"}${xOf(i)} ${yOf(v)}`).join(" ")
      const bottom = acc.lower
        .map((v, i) => `L${xOf(i)} ${yOf(v)}`)
        .reverse()
        .join(" ")
      return { lower: upper, out: [...acc.out, { ...s, d: `${top} ${bottom} Z` }] }
    },
    { lower: new Array(len).fill(0), out: [] },
  ).out
  const totalPath = totals.map((v, i) => `${i ? "L" : "M"}${xOf(i)} ${yOf(v)}`).join(" ")

  const grid = [0, 0.5, 1].map((f) => ({ v: Math.round(vmax * f), y: yOf(vmax * f) }))
  const tickEvery = Math.max(1, Math.ceil(len / 6))

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || len === 0) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * width
    const i = len === 1 ? 0 : Math.round(((x - pad.l) / W) * (len - 1))
    setHover(Math.max(0, Math.min(len - 1, i)))
  }

  const leftPct = hover == null ? 0 : (xOf(hover) / width) * 100

  return (
    <div ref={boxRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ display: "block", touchAction: "pan-y" }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {grid.map((g) => (
          <g key={g.y}>
            <line x1={pad.l} x2={pad.l + W} y1={g.y} y2={g.y} stroke="currentColor" strokeOpacity="0.08" />
            <text x={pad.l - 6} y={g.y + 3} fontSize="9.5" fill="currentColor" opacity="0.45" textAnchor="end" fontFamily="var(--font-mono)">
              {g.v}
            </text>
          </g>
        ))}
        <g className="z-wipe">
          {bands.map((b) => (
            <path key={b.name} d={b.d} fill={b.color} fillOpacity={0.78} />
          ))}
        </g>
        <path
          d={totalPath}
          fill="none"
          stroke={totalColor}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          className="z-draw"
        />
        {hover != null && (
          <g>
            <line x1={xOf(hover)} x2={xOf(hover)} y1={pad.t} y2={pad.t + H} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
            <circle cx={xOf(hover)} cy={yOf(totals[hover])} r="3.5" fill={totalColor} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
        {labels.map((lb, i) =>
          i % tickEvery === 0 || i === len - 1 ? (
            <text
              key={i}
              x={xOf(i)}
              y={height - 5}
              fontSize="10"
              fill="currentColor"
              opacity="0.5"
              // As pontas ancoram para dentro: centrado, o último rótulo saía do gráfico.
              textAnchor={i === 0 ? "start" : i === len - 1 ? "end" : "middle"}
              fontFamily="var(--font-mono)"
            >
              {lb}
            </text>
          ) : null,
        )}
      </svg>
      {hover != null && (
        <div
          className="absolute top-1 pointer-events-none z-10 rounded-lg border border-border-soft px-3 py-2 text-[12px] shadow-sm min-w-40"
          style={{
            left: `${leftPct}%`,
            transform: leftPct > 55 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            background: "var(--surface)",
          }}
        >
          <div className="flex items-baseline justify-between gap-4 mb-1.5">
            <span className="font-medium" style={{ color: "var(--ink)" }}>{labels[hover]}</span>
            <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{totals[hover]}</span>
          </div>
          {[...series].reverse().map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-4 py-px">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                <span className="text-ink-muted">{s.name}</span>
              </span>
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{s.data[hover] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
