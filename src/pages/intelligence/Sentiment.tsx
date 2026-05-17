import { Download, Sparkles } from "lucide-react"
import { MultiLine } from "@/components/ui/charts"
import {
  weeklyTrend,
  impactEvents,
  topicBreakdown,
  topicTags,
} from "@/lib/mock/sentiment"

function StackedBar({
  pos,
  neu,
  neg,
}: {
  pos: number
  neu: number
  neg: number
}) {
  return (
    <div className="flex h-[6px] rounded-sm overflow-hidden bg-[#EEF0F2] dark:bg-[#1C1F2E]">
      <div style={{ width: `${pos}%`, background: "var(--color-pos)" }} />
      <div style={{ width: `${neu}%`, background: "#9AA1AE" }} />
      <div style={{ width: `${neg}%`, background: "var(--color-neg)" }} />
    </div>
  )
}

export default function SentimentPage() {
  const totalPos = weeklyTrend.reduce((a, b) => a + b.positive, 0)
  const totalNeu = weeklyTrend.reduce((a, b) => a + b.neutral, 0)
  const totalNeg = weeklyTrend.reduce((a, b) => a + b.negative, 0)
  const total = totalPos + totalNeu + totalNeg
  const pctPos = Math.round((totalPos / total) * 100)
  const pctNeu = Math.round((totalNeu / total) * 100)
  const pctNeg = 100 - pctPos - pctNeu

  const netScore = ((totalPos - totalNeg) / total).toFixed(2)
  const netSigned = (totalPos - totalNeg) >= 0 ? `+${netScore}` : netScore

  const series = [
    {
      name: "Positivo",
      color: "#16A34A",
      data: weeklyTrend.map((w) => w.positive),
    },
    {
      name: "Neutro",
      color: "#9AA1AE",
      data: weeklyTrend.map((w) => w.neutral),
    },
    {
      name: "Negativo",
      color: "#DC2626",
      data: weeklyTrend.map((w) => w.negative),
    },
  ]

  const tagSizes: Record<string, { size: number; weight: number }> = {
    "App/UX": { size: 30, weight: 700 },
    PIX: { size: 24, weight: 600 },
    Atendimento: { size: 28, weight: 700 },
    Cashback: { size: 22, weight: 500 },
    Limite: { size: 20, weight: 500 },
    Investimentos: { size: 26, weight: 600 },
    Taxas: { size: 22, weight: 600 },
    "Cartão virtual": { size: 18, weight: 500 },
    Seguros: { size: 17, weight: 500 },
    "Conta PJ": { size: 19, weight: 500 },
  }

  return (
    <div
      className="-m-6 border-t border-border-soft"
      style={{ background: "var(--surface)", color: "var(--ink)" }}
    >
      {/* Hero */}
      <section
        className="px-8 pt-7 pb-6 border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex-1 max-w-[680px] min-w-[280px]">
            <div className="eyebrow mb-3">Sentimento · análise narrativa</div>
            <h1
              className="font-display m-0"
              style={{ fontSize: 36, lineHeight: 1.1, color: "var(--ink)" }}
            >
              Net score <span style={{ color: "var(--color-teal-500)" }}>{netSigned}</span>{" "}
              <span style={{ color: "var(--ink-muted-2)" }}>
                esta semana — impulsionado por PIX por aproximação.
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="chip chip-primary">
                <Sparkles className="w-3 h-3" /> Zoe IA · análise gerada há 12 min
              </span>
              <span className="chip">Último mês</span>
              <span className="chip">Todas marcas</span>
              <span className="chip">Semanal</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        </div>
      </section>

      {/* Score hero */}
      <section className="grid grid-cols-1 md:grid-cols-3 border-b border-border-soft">
        <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
          <div className="eyebrow mb-2">Net score</div>
          <div
            className="font-display leading-none"
            style={{ fontSize: 64, color: "var(--color-teal-500)" }}
          >
            {netSigned}
          </div>
          <div className="text-[12.5px] text-muted mt-2">
            escala −1 a +1 · {total} menções
          </div>
        </div>
        <div className="p-7 border-b md:border-b-0 md:border-r border-border-soft">
          <div className="eyebrow mb-2">Volume total</div>
          <div
            className="font-display leading-none"
            style={{ fontSize: 56, color: "var(--ink)" }}
          >
            {total}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="chip chip-pos">+18%</span>
            <span className="text-[12px] text-muted">vs mês anterior</span>
          </div>
        </div>
        <div className="p-7">
          <div className="eyebrow mb-3">Distribuição</div>
          <div className="flex flex-col gap-2.5 mt-1">
            {[
              { label: "Positivo", pct: pctPos, color: "var(--color-pos)", count: totalPos },
              { label: "Neutro", pct: pctNeu, color: "#9AA1AE", count: totalNeu },
              { label: "Negativo", pct: pctNeg, color: "var(--color-neg)", count: totalNeg },
            ].map((d) => (
              <div key={d.label}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[12.5px] text-ink-2">{d.label}</span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="font-mono-zoe text-[11.5px] text-muted"
                    >
                      {d.count}
                    </span>
                    <span
                      className="font-display"
                      style={{ fontSize: 18, color: d.color }}
                    >
                      {d.pct}%
                    </span>
                  </div>
                </div>
                <div className="h-[3px] bg-[#EEF0F2] dark:bg-[#1C1F2E] rounded-sm overflow-hidden">
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

      {/* Evolution + Impact */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] border-b border-border-soft">
        <div className="lg:border-r border-b lg:border-b-0 border-border-soft p-7">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="eyebrow">Evolução de sentimento</div>
              <div className="text-[12px] text-muted mt-1">Últimas 4 semanas</div>
            </div>
            <div className="flex items-center gap-4 text-[11.5px] text-muted">
              {series.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          <MultiLine
            series={series}
            labels={weeklyTrend.map((w) => w.week)}
            height={200}
          />
        </div>

        <div className="p-7">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="eyebrow">Eventos de impacto</div>
              <div className="text-[12px] text-muted mt-1">
                Momentos que moveram a curva
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            {impactEvents.map((e, i) => {
              const positive = e.delta > 0
              return (
                <div
                  key={e.id}
                  className={`flex items-start gap-3 py-3 ${
                    i === 0 ? "" : "border-t border-border-soft"
                  }`}
                >
                  <span className="font-mono-zoe text-[10.5px] text-muted-2 shrink-0 pt-0.5 w-12">
                    {e.date.slice(5).replace("-", "/")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px]"
                      style={{ color: "var(--ink)" }}
                    >
                      {e.title}
                    </div>
                    <span
                      className={`chip mt-1.5 text-[11px] ${
                        positive ? "chip-pos" : "chip-neg"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {e.delta.toFixed(2)} no score
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="border-b border-border-soft">
        <div className="flex items-start justify-between px-8 pt-6 pb-4">
          <div>
            <div className="eyebrow">Sentimento por tópico</div>
            <div className="text-[12px] text-muted mt-1">
              Como cada tema se comporta nas menções
            </div>
          </div>
          <button className="text-[13px] text-teal-700 dark:text-teal-300 hover:text-teal-500 font-medium">
            Explorar tópicos →
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {topicBreakdown.map((t, i) => {
            const col = i % 4
            const isNegHeavy = t.negative >= 40
            return (
              <div
                key={t.id}
                className={`p-6 border-t border-border-soft ${
                  col !== 3 ? "lg:border-r" : ""
                } ${col % 2 !== 1 ? "sm:border-r lg:border-r" : ""} ${
                  col === 1 ? "sm:border-r-0 lg:border-r" : ""
                }`}
              >
                <div className="flex items-baseline justify-between mb-3">
                  <h3
                    className="font-display"
                    style={{
                      fontSize: 18,
                      color: "var(--ink)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {t.name}
                  </h3>
                  {isNegHeavy && (
                    <span className="chip chip-neg text-[10px] px-1.5 py-[1px]">
                      atenção
                    </span>
                  )}
                </div>
                <StackedBar pos={t.positive} neu={t.neutral} neg={t.negative} />
                <div className="flex justify-between mt-2 font-mono-zoe text-[11px]">
                  <span style={{ color: "var(--color-pos)" }}>
                    +{t.positive}%
                  </span>
                  <span className="text-muted">{t.neutral}%</span>
                  <span style={{ color: "var(--color-neg)" }}>
                    −{t.negative}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Keywords cloud */}
      <section className="px-8 py-7">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="eyebrow">Palavras e tópicos mais citados</div>
            <div className="text-[12px] text-muted mt-1">
              Tamanho proporcional ao volume · cor indica sentimento
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
          {topicTags.map((tag) => {
            const meta = tagSizes[tag.name] ?? { size: 18, weight: 500 }
            const color =
              tag.sentiment === "positive"
                ? "var(--color-pos)"
                : tag.sentiment === "negative"
                  ? "var(--color-neg)"
                  : "var(--color-warn)"
            return (
              <span
                key={tag.name}
                className="font-display hover:opacity-80 transition-opacity cursor-pointer"
                style={{
                  fontSize: meta.size,
                  fontWeight: meta.weight,
                  color,
                  letterSpacing: "-0.02em",
                }}
              >
                {tag.name}
              </span>
            )
          })}
        </div>
      </section>
    </div>
  )
}
