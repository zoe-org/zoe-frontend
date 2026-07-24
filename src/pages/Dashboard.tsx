import { useState } from "react"
import { ArrowUp, ArrowDown, Download, Sparkles, Play } from "lucide-react"
import { useAuth } from "@/features/auth/context"
import { Sparkline, AreaLine, Heatmap } from "@/components/ui/charts"
import {
  trend30d,
  competitors,
  platformsBreakdown,
  heatmap7x24,
  editorialMentions,
  editorialAlerts,
  editorialInfluencers,
} from "@/lib/mock/dashboard"

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

function formatDateLong(d = new Date()): string {
  return d
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^./, (c) => c.toUpperCase())
}

function DeltaChip({
  value,
  kind = "pos",
}: {
  value: string
  kind?: "pos" | "neg" | "warn"
}) {
  const Icon = kind === "neg" ? ArrowDown : ArrowUp
  const cls = kind === "pos" ? "chip-pos" : kind === "neg" ? "chip-neg" : "chip-warn"
  return (
    <span className={`chip ${cls}`}>
      <Icon className="w-2.5 h-2.5" /> {value}
    </span>
  )
}

function PlatformDot({ name }: { name: string }) {
  const colors: Record<string, string> = {
    YouTube: "#FF0000",
    TikTok: "#000000",
    Instagram: "#E1306C",
  }
  return (
    <span
      className="w-2 h-2 rounded-full inline-block"
      style={{ background: colors[name] ?? "#9AA1AE" }}
    />
  )
}

type KpiProps = {
  label: string
  value: string
  suffix?: string
  delta?: string
  deltaKind?: "pos" | "neg" | "warn"
  deltaLabel?: string
  trendData: number[]
  accent?: boolean
}

function Kpi({ label, value, suffix, delta, deltaKind = "pos", deltaLabel, trendData, accent }: KpiProps) {
  return (
    <div className="px-5 pt-6 pb-5 flex flex-col gap-1 min-h-[150px]">
      <div className="eyebrow">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-display leading-none"
          style={{
            fontSize: 40,
            color: accent ? "var(--color-teal-500)" : "var(--ink)",
          }}
        >
          {value}
        </span>
        {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        {delta && <DeltaChip value={delta} kind={deltaKind} />}
        {deltaLabel && <span className="text-[11.5px] text-ink-muted">{deltaLabel}</span>}
      </div>
      <div className="mt-3">
        <Sparkline
          data={trendData}
          width={200}
          height={28}
          color={accent ? "#00A799" : "#9AA1AE"}
        />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const displayName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? ""
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "1a">("30d")
  const trendSpark = trend30d.slice(-14).map((d) => d.value)
  const trendTotal = trend30d.reduce((a, b) => a + b.value, 0)

  return (
    <div className="-m-6">
      {/* Hero */}
      <section
        className="px-8 pt-7 pb-6 border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div className="flex-1">
            <div className="eyebrow mb-3">
              {getGreeting()}, {displayName} · {formatDateLong()}
            </div>
            <h1
              className="font-display m-0"
              style={{
                fontSize: 40,
                lineHeight: 1.1,
                color: "var(--ink)",
              }}
            >
              Sua marca está{" "}
              <span style={{ color: "var(--color-teal-500)" }}>bombando</span> esta semana —
              <span style={{ color: "var(--ink-muted-2)" }}>
                {" "}mas vale ficar de olho em um pico negativo no TikTok.
              </span>
            </h1>
            <div className="flex justify-between items-center mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip chip-primary">
                  <Sparkles className="w-3 h-3" /> Resumo gerado por Zoe IA · há 4 min
                </span>
                <span className="chip">3 insights novos</span>
                <span className="chip chip-warn">1 alerta requer atenção</span>
              </div>
              
              <div className="flex-1 flex items-center justify-end gap-2">
                <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
                  <Download className="w-3.5 h-3.5" /> Exportar
                </button>
                <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors">
                  <Sparkles className="w-3.5 h-3.5" /> Pedir análise
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-b border-border-soft">
        <div className="border-r border-b lg:border-b-0 border-border-soft">
          <Kpi
            label="Menções · 7d"
            value="847"
            delta="+23%"
            deltaLabel="vs semana anterior"
            trendData={trendSpark}
            accent
          />
        </div>
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft">
          <Kpi
            label="Sentimento positivo"
            value="67"
            suffix="%"
            delta="+4pp"
            deltaLabel="vs mês passado"
            trendData={[58, 60, 61, 63, 64, 66, 67, 65, 66, 67, 68, 67]}
          />
        </div>
        <div className="border-r border-b lg:border-b-0 border-border-soft">
          <Kpi
            label="Share of voice"
            value="34"
            suffix="%"
            delta="+6pp"
            deltaLabel="vs concorrentes"
            trendData={[22, 25, 26, 28, 30, 29, 31, 32, 33, 33, 34, 34]}
          />
        </div>
        <div>
          <Kpi
            label="Alcance estimado"
            value="12.4"
            suffix="M views"
            delta="+1.8M"
            deltaLabel="este mês"
            trendData={[6, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12, 12.4]}
          />
        </div>
      </section>

      {/* Trend + Sentiment distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] border-b border-border-soft">
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft p-7">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="eyebrow">Tendência de menções</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className="font-display"
                  style={{ fontSize: 32, color: "var(--ink)" }}
                >
                  {trendTotal}
                </span>
                <DeltaChip value="+18% vs período anterior" />
              </div>
            </div>
            <div className="inline-flex bg-[#F3F4F6] dark:bg-[#1A1D2D] rounded-lg p-[3px]">
              {(["7d", "30d", "90d", "1a"] as const).map((r) => (
                <button
                  key={r}
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium transition ${range === r
                      ? "bg-white dark:bg-[#2A2F45] text-ink shadow-sm"
                      : "text-ink-muted"
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <AreaLine data={trend30d} height={160} color="#00A799" fillOpacity={0.12} />
          <div className="flex justify-between mt-2">
            <span className="font-mono-zoe text-[10.5px] text-ink-muted-2">19 MAR</span>
            <span className="font-mono-zoe text-[10.5px] text-ink-muted-2">17 ABR</span>
          </div>
        </div>

        <div className="p-7">
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow">Distribuição de sentimento</div>
            <div className="font-mono-zoe text-[11px] text-ink-muted">BASE · 847 MENÇÕES</div>
          </div>
          <div className="flex gap-8 items-end">
            {[
              { label: "Positivo", pct: 67, color: "var(--color-pos)", count: 568 },
              { label: "Neutro", pct: 22, color: "#9AA1AE", count: 186 },
              { label: "Negativo", pct: 11, color: "var(--color-neg)", count: 93 },
            ].map((d) => (
              <div key={d.label} className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-display leading-none"
                    style={{ fontSize: 44, color: d.color }}
                  >
                    {d.pct}
                  </span>
                  <span style={{ fontSize: 14, color: d.color }}>%</span>
                </div>
                <div className="text-[12.5px] text-ink-muted mt-1">
                  {d.label} · {d.count} menções
                </div>
                <div className="mt-2.5 h-[3px] bg-[#EEF0F2] dark:bg-[#1C1F2E] rounded-sm overflow-hidden">
                  <div
                    style={{
                      width: `${d.pct}%`,
                      height: "100%",
                      background: d.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitors + Heatmap */}
      <section className="grid grid-cols-1 lg:grid-cols-2 border-b border-border-soft">
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft p-7">
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow">Share of voice · concorrentes</div>
            <button className="text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium">
              Comparar marcas →
            </button>
          </div>
          <div className="flex flex-col gap-3.5">
            {competitors.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ background: c.color }}
                    />
                    <span
                      className="text-[13px]"
                      style={{ fontWeight: c.isYou ? 600 : 400 }}
                    >
                      {c.name}
                    </span>
                    {c.isYou && (
                      <span className="chip chip-primary text-[10px] py-[1px] px-1.5">
                        VOCÊ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono-zoe text-[12px] text-ink-muted">
                      {c.sov}%
                    </span>
                    <span
                      className="text-[11.5px] min-w-[36px] text-right"
                      style={{
                        color:
                          c.delta > 0
                            ? "var(--color-pos)"
                            : c.delta < 0
                              ? "var(--color-neg)"
                              : "var(--ink-muted)",
                      }}
                    >
                      {c.delta > 0 ? "+" : ""}
                      {c.delta}pp
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-[#F3F4F6] dark:bg-[#1C1F2E] rounded-sm overflow-hidden">
                  <div
                    style={{
                      width: `${Math.min(c.sov * 2.5, 100)}%`,
                      height: "100%",
                      background: c.color,
                      transition: "width .5s",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-7">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="eyebrow">Quando sua marca é mencionada</div>
              <div className="text-[12px] text-ink-muted mt-1">
                Dia da semana × hora · últimos 30 dias
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              <span>menos</span>
              <div className="flex gap-[2px]">
                {["#F0FDFB", "#CCFBF4", "#5DE0D4", "#00A799", "#006B60"].map((c) => (
                  <div
                    key={c}
                    className="w-3 h-2.5 rounded-sm"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span>mais</span>
            </div>
          </div>
          <Heatmap data={heatmap7x24} />
        </div>
      </section>

      {/* Recent mentions + Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] border-b border-border-soft">
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft">
          <div className="flex items-center justify-between px-7 pt-5 pb-3.5">
            <div>
              <div className="eyebrow">Menções recentes</div>
              <div className="text-[12px] text-ink-muted mt-1">Últimas 24 horas</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md">
                <span className="live-dot" />
                <span className="text-[11.5px] text-ink-muted">ao vivo</span>
              </span>
              <button className="text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium">
                Ver todas ({editorialMentions.length}) →
              </button>
            </div>
          </div>
          <div>
            {editorialMentions.map((m) => (
              <button
                key={m.id}
                className="grid items-center gap-3.5 px-7 py-3 border-t border-border-soft w-full text-left cursor-pointer hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
                style={{ gridTemplateColumns: "84px 1fr auto auto" }}
              >
                <div
                  className="relative w-[84px] h-12 rounded-md overflow-hidden flex items-center justify-center"
                  style={{ background: m.thumbColor }}
                >
                  <Play className="w-4.5 h-4.5 text-white/90" />
                  <span className="absolute bottom-1 right-1 font-mono-zoe bg-black/70 text-white text-[9px] px-1 py-[1px] rounded-sm">
                    {m.duration}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium truncate mb-0.5" style={{ color: "var(--ink)" }}>
                    {m.title}
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
                    <span>{m.author}</span>
                    <span>·</span>
                    <span className="font-mono-zoe">{m.views} views</span>
                    <span>·</span>
                    <span>{m.when} atrás</span>
                    {m.hasLogo && (
                      <span className="chip chip-primary text-[9.5px] px-1.5 py-[1px]">
                        LOGO
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <PlatformDot name={m.platform} />
                  <span className="text-[11.5px] text-ink-muted">{m.platform}</span>
                </div>
                <span
                  className={`chip ${m.sentiment === "pos" ? "chip-pos" : m.sentiment === "neg" ? "chip-neg" : ""}`}
                >
                  {m.sentiment === "pos"
                    ? "Positivo"
                    : m.sentiment === "neg"
                      ? "Negativo"
                      : "Neutro"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-7">
          <div className="flex items-start justify-between mb-3.5">
            <div>
              <div className="eyebrow">Alertas ativos</div>
              <div className="text-[12px] text-ink-muted mt-1">
                3 pendentes · 1 crítico
              </div>
            </div>
            <button className="text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium">
              Configurar →
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {editorialAlerts.map((a) => {
              const color =
                a.level === "critical"
                  ? "var(--color-neg)"
                  : a.level === "warn"
                    ? "var(--color-warn)"
                    : "var(--color-teal-500)"
              const bg =
                a.level === "critical"
                  ? "var(--neg-bg)"
                  : a.level === "warn"
                    ? "var(--warn-bg)"
                    : "var(--color-teal-50)"
              return (
                <button
                  key={a.id}
                  className="block text-left px-3.5 py-3 rounded-[10px] w-full border border-transparent hover:border-border-soft transition-colors"
                  style={{ background: bg }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: color }}
                    />
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {a.title}
                    </span>
                    <span className="flex-1" />
                    <span className="font-mono-zoe text-[10.5px] text-ink-muted">
                      {a.time}
                    </span>
                  </div>
                  <div
                    className="text-[12.5px] leading-snug"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {a.detail}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Influencers + Platforms */}
      <section className="grid grid-cols-1 lg:grid-cols-2">
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft p-7">
          <div className="flex items-start justify-between mb-3.5">
            <div>
              <div className="eyebrow">Top influenciadores · 30d</div>
              <div className="text-[12px] text-ink-muted mt-1">Por alcance combinado</div>
            </div>
            <button className="text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium">
              Ver ranking →
            </button>
          </div>
          <div className="flex flex-col">
            {editorialInfluencers.map((inf, i) => (
              <div
                key={inf.handle}
                className={`flex items-center gap-3 py-2.5 ${i === 0 ? "" : "border-t border-border-soft"}`}
              >
                <span className="font-mono-zoe text-[11px] text-ink-muted-2 w-[18px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div
                  className="w-7 h-7 rounded-full shrink-0"
                  style={{ background: `hsl(${i * 67}, 40%, 70%)` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{inf.name}</div>
                  <div className="font-mono-zoe text-[10.5px] text-ink-muted truncate">
                    {inf.handle}
                  </div>
                </div>
                <div className="text-right min-w-[60px]">
                  <div className="font-mono-zoe text-[12px]" style={{ color: "var(--ink)" }}>
                    {inf.reach}
                  </div>
                  <div className="text-[10px] text-ink-muted">alcance</div>
                </div>
                <div className="min-w-[70px] text-right">
                  <span
                    className={`chip text-[11px] ${inf.sentiment > 0.3
                        ? "chip-pos"
                        : inf.sentiment < -0.1
                          ? "chip-neg"
                          : ""
                      }`}
                  >
                    {inf.sentiment > 0 ? "+" : ""}
                    {inf.sentiment.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-7">
          <div className="eyebrow mb-3.5">Por plataforma</div>
          {platformsBreakdown.map((p) => (
            <div key={p.name} className="mb-3.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {p.name !== "Outros" && <PlatformDot name={p.name} />}
                  <span className="text-[13px]">{p.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-zoe text-[11.5px] text-ink-muted">
                    {p.count}
                  </span>
                  <span className="font-mono-zoe text-[12px] text-ink-muted">{p.pct}%</span>
                </div>
              </div>
              <div className="h-1 bg-[#F3F4F6] dark:bg-[#1C1F2E] rounded-sm overflow-hidden">
                <div
                  style={{
                    width: `${p.pct}%`,
                    height: "100%",
                    background: p.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
