import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Printer, AlertCircle } from "lucide-react"
import { useReport, type ReportBrandSection } from "@/lib/api/reports"

/**
 * View print-friendly de um relatório. É o "PDF" do MVP: o usuário imprime
 * (`window.print()`) e salva como PDF — sem worker nem binário no S3, que ficam
 * para a Etapa 7. Renderiza o snapshot persistido, então reabrir um relatório
 * antigo mostra os números daquele período.
 *
 * Fica FORA do AppShell de propósito: documento não imprime com sidebar/topbar.
 */

const TEMPLATE_LABELS: Record<string, string> = {
  ExecutiveSummary: "Resumo executivo",
  SentimentDeepDive: "Deep-dive de sentimento",
  CompetitorComparison: "Comparativo de concorrentes",
  InfluencerDossier: "Dossiê de influenciadores",
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

const fmtNum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`

export default function ReportViewPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const query = useReport(reportId)

  if (query.isLoading) {
    return (
      <div className="max-w-[860px] mx-auto p-10 animate-pulse">
        <div className="h-10 w-2/3 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] mb-4" />
        <div className="h-40 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-10 h-10 text-neg mb-3" />
        <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
          Relatório não encontrado
        </h3>
        <button
          onClick={() => navigate("/reports")}
          className="mt-4 h-9 px-4 text-[13px] rounded-md border border-border-soft"
        >
          Voltar para Relatórios
        </button>
      </div>
    )
  }

  const { report, payload } = query.data
  const templateName = TEMPLATE_LABELS[report.template] ?? report.template

  // O template define o que ganha destaque; o payload é o mesmo superset.
  const showChannels = report.template === "InfluencerDossier" || report.template === "ExecutiveSummary"
  const showVideos = report.template !== "InfluencerDossier"
  const showThemes = report.template === "SentimentDeepDive" || report.template === "ExecutiveSummary"
  const showComparison = report.template === "CompetitorComparison"

  return (
    <div style={{ background: "var(--surface)", color: "var(--ink)", minHeight: "100vh" }}>
      {/* Barra de ações — some na impressão */}
      <div className="print:hidden sticky top-0 z-10 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="max-w-[860px] mx-auto px-10 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/reports")}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Relatórios
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
            style={{ background: "var(--color-teal-500)" }}
          >
            <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <article className="max-w-[860px] mx-auto px-10 py-10">
        {/* Cabeçalho do documento */}
        <header className="pb-6 mb-8 border-b border-border-soft">
          <div className="eyebrow mb-2.5">Zoe · Relatório de Inteligência</div>
          <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
            {templateName}
          </h1>
          <div className="text-[14px] text-ink-muted mt-2">
            {report.brandName ?? "Todas as marcas"} ·{" "}
            <span className="font-mono-zoe">
              {report.periodStart} a {report.periodEnd}
            </span>
          </div>
          <div className="text-[12px] text-ink-muted-2 mt-1">
            Gerado em {fmtDate(report.createdAt)}
            {report.requestedByName ? ` por ${report.requestedByName}` : ""}
          </div>
        </header>

        {!payload || payload.brands.length === 0 ? (
          <p className="text-[14px] text-ink-muted">
            Este relatório não tem dados no período selecionado.
          </p>
        ) : (
          <>
            {showComparison && payload.brands.length > 1 && (
              <ComparisonSection sections={payload.brands} />
            )}

            {payload.brands.map((s) => (
              <section key={s.brandId} className="mb-10 break-inside-avoid">
                {payload.brands.length > 1 && (
                  <h2 className="font-display m-0 mb-4" style={{ fontSize: 22, color: "var(--ink)" }}>
                    {s.brandName}
                  </h2>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-7">
                  <Kpi value={`${s.totalMentions}`} label="Menções" />
                  <Kpi value={s.avgScore.toFixed(2)} label="Sentimento médio" />
                  <Kpi value={`${s.positive}`} label="Positivas" color="var(--color-pos)" />
                  <Kpi value={`${s.negative}`} label="Negativas" color="var(--color-neg)" />
                </div>

                {/* Distribuição */}
                <div className="mb-8">
                  <div className="eyebrow mb-2.5">Distribuição de sentimento</div>
                  <Distribution pos={s.positive} neu={s.neutral} neg={s.negative} />
                </div>

                {showVideos && s.topVideos.length > 0 && (
                  <Block title="Vídeos de maior alcance">
                    <table className="w-full text-[13px]">
                      <tbody>
                        {s.topVideos.map((v, i) => (
                          <tr key={v.youtubeVideoId} className={i > 0 ? "border-t border-border-soft" : ""}>
                            <td className="py-2.5 pr-3 align-top">
                              <div className="font-medium" style={{ color: "var(--ink)" }}>{v.title}</div>
                              <div className="text-[11.5px] text-ink-muted">{v.channelName}</div>
                            </td>
                            <td className="py-2.5 text-right font-mono-zoe whitespace-nowrap align-top">
                              {fmtNum(v.views)} views
                            </td>
                            <td className="py-2.5 pl-4 text-right font-mono-zoe whitespace-nowrap align-top">
                              {v.score == null ? "—" : v.score.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Block>
                )}

                {showChannels && s.topChannels.length > 0 && (
                  <Block title="Principais criadores">
                    <table className="w-full text-[13px]">
                      <tbody>
                        {s.topChannels.map((c, i) => (
                          <tr key={c.channelId} className={i > 0 ? "border-t border-border-soft" : ""}>
                            <td className="py-2.5 pr-3 font-medium" style={{ color: "var(--ink)" }}>{c.name}</td>
                            <td className="py-2.5 text-right font-mono-zoe whitespace-nowrap">
                              {c.mentions} {c.mentions === 1 ? "menção" : "menções"}
                            </td>
                            <td className="py-2.5 pl-4 text-right font-mono-zoe whitespace-nowrap">
                              {fmtNum(c.reach)} alcance
                            </td>
                            <td className="py-2.5 pl-4 text-right font-mono-zoe whitespace-nowrap">
                              {c.avgScore.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Block>
                )}

                {showThemes && s.topThemes.length > 0 && (
                  <Block title="Tópicos mais falados">
                    <div className="flex flex-wrap gap-2">
                      {s.topThemes.map((t) => (
                        <span key={t.theme} className="chip text-[12px]">
                          {t.theme}
                          <span className="font-mono-zoe text-[10.5px] text-ink-muted">{t.volume}</span>
                        </span>
                      ))}
                    </div>
                  </Block>
                )}
              </section>
            ))}
          </>
        )}

        <footer className="pt-6 mt-4 border-t border-border-soft text-[11px] text-ink-muted-2">
          Zoe Intelligence · dados agregados das análises do período. Snapshot gerado em{" "}
          {payload ? fmtDate(payload.generatedAt) : fmtDate(report.createdAt)}.
        </footer>
      </article>

      <style>{`
        @media print {
          @page { margin: 16mm; }
          html, body { background: #fff !important; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

function Kpi({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <div className="font-display leading-none" style={{ fontSize: 30, color: color ?? "var(--ink)" }}>
        {value}
      </div>
      <div className="text-[11.5px] text-ink-muted mt-1.5">{label}</div>
    </div>
  )
}

function Distribution({ pos, neu, neg }: { pos: number; neu: number; neg: number }) {
  const total = pos + neu + neg || 1
  const pct = (n: number) => Math.round((n / total) * 100)
  return (
    <>
      <div className="flex h-2 rounded-full overflow-hidden">
        <div style={{ width: `${pct(pos)}%`, background: "var(--color-pos)" }} />
        <div style={{ width: `${pct(neu)}%`, background: "#9AA1AE" }} />
        <div style={{ width: `${pct(neg)}%`, background: "var(--color-neg)" }} />
      </div>
      <div className="flex justify-between mt-2 text-[11.5px] font-mono-zoe">
        <span style={{ color: "var(--color-pos)" }}>{pct(pos)}% positivo</span>
        <span className="text-ink-muted">{pct(neu)}% neutro</span>
        <span style={{ color: "var(--color-neg)" }}>{pct(neg)}% negativo</span>
      </div>
    </>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 break-inside-avoid">
      <div className="eyebrow mb-2.5">{title}</div>
      {children}
    </div>
  )
}

/** Só no template de comparativo: participação de menções entre as marcas. */
function ComparisonSection({ sections }: { sections: ReportBrandSection[] }) {
  const total = sections.reduce((a, s) => a + s.totalMentions, 0) || 1
  const ranked = [...sections].sort((a, b) => b.totalMentions - a.totalMentions)
  return (
    <div className="mb-10 break-inside-avoid">
      <div className="eyebrow mb-3">Participação de menções no período</div>
      <div className="flex flex-col gap-3">
        {ranked.map((s) => {
          const pct = Math.round((s.totalMentions / total) * 100)
          return (
            <div key={s.brandId}>
              <div className="flex items-center justify-between mb-1.5 text-[13px]">
                <span style={{ color: "var(--ink)" }}>{s.brandName}</span>
                <span className="font-mono-zoe">{pct}% · {s.totalMentions}</span>
              </div>
              <div className="h-2 rounded-sm overflow-hidden bg-[#F3F4F6] dark:bg-[#1C1F2E]">
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-teal-500)" }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
