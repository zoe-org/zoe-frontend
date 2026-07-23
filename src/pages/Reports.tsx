import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Lock, Sparkles, Calendar, FileText, TrendingUp, Users, ArrowRight,
  Search, ExternalLink, Download, AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useFeature } from "@/features/auth/useFeature"
import { useActiveBrand } from "@/features/brands/BrandContext"
import { ApiError } from "@/lib/api"
import {
  useReports, useReportTemplates, useCreateReport,
  type Report, type ReportTemplate,
} from "@/lib/api/reports"

// Ícones do design → lucide.
const templateIcons: Record<string, typeof FileText> = {
  reports: FileText,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  users: Users,
}

// Janela padrão por template (o design mostra o template, não o período; a janela
// é o que o backend precisa para agregar).
const templateWindowDays: Record<string, number> = {
  ExecutiveSummary: 7,
  SentimentDeepDive: 30,
  CompetitorComparison: 30,
  InfluencerDossier: 30,
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

function periodFor(templateCode: string): { periodStart: string; periodEnd: string } {
  const days = templateWindowDays[templateCode] ?? 30
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { periodStart: isoDate(start), periodEnd: isoDate(end) }
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function windowLabel(code: string): string {
  const days = templateWindowDays[code] ?? 30
  return `últimos ${days} dias`
}

export default function ReportsPage() {
  const hasReports = useFeature("reports")
  const navigate = useNavigate()
  const brand = useActiveBrand()

  const list = useReports(hasReports)
  const templates = useReportTemplates(hasReports)
  const create = useCreateReport()

  const [tab, setTab] = useState<"biblioteca">("biblioteca")
  const [search, setSearch] = useState("")

  const reports = useMemo(() => list.data?.items ?? [], [list.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return reports
    return reports.filter((r) =>
      titleOf(r).toLowerCase().includes(q) ||
      (r.brandName ?? "").toLowerCase().includes(q))
  }, [reports, search])

  // Sem a feature → upsell. O backend também retorna 403; a UI não depende só de si.
  const forbidden =
    (list.error instanceof ApiError && list.error.status === 403) ||
    (templates.error instanceof ApiError && templates.error.status === 403)
  if (!hasReports || forbidden) return <UpsellScreen />

  const generate = (tpl: ReportTemplate) => {
    create.mutate(
      { template: tpl.code, ...periodFor(tpl.code), brandId: brand.brandId },
      {
        onSuccess: (res) => {
          toast.success(`${tpl.name} gerado.`)
          navigate(`/reports/${res.report.id}`)
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : "Não foi possível gerar o relatório."),
      },
    )
  }

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      {/* Hero */}
      <section
        className="px-8 pt-7 pb-5 border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="eyebrow mb-2.5">Gestão · Entregáveis</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Relatórios
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              Gere relatórios prontos para enviar ao cliente — automáticos ou sob demanda.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Agendamento entra com a geração assíncrona (Etapa 7). */}
            <button
              disabled
              title="Agendamento chega com a geração automática"
              className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-[13px] font-medium border border-[#E5E7EB] dark:border-[#262A3A] bg-[var(--surface)] opacity-45 cursor-not-allowed"
            >
              <Calendar className="w-3.5 h-3.5 text-ink-muted" /> Agendar
            </button>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section
        className="px-8 py-6 border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="eyebrow mb-3.5">Começar a partir de um template</div>
        {templates.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
            ))}
          </div>
        ) : (templates.data?.items.length ?? 0) === 0 ? (
          <div className="text-[13px] text-ink-muted py-4">
            Nenhum template disponível para os módulos deste workspace.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {templates.data!.items.map((t) => {
              const Icon = templateIcons[t.icon] ?? FileText
              const busy = create.isPending && create.variables?.template === t.code
              return (
                <button
                  key={t.code}
                  onClick={() => generate(t)}
                  disabled={create.isPending || !brand.brandId}
                  title={!brand.brandId ? "Assine uma marca para gerar relatórios" : undefined}
                  className="text-left p-4.5 rounded-[14px] border border-border-soft hover:border-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border-soft"
                  style={{ background: "var(--surface)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: "var(--color-teal-50)" }}
                  >
                    <Icon className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />
                  </div>
                  <div className="text-[14px] font-semibold mb-1">{t.name}</div>
                  <div className="text-[12px] text-ink-muted leading-[1.4] mb-2.5">{t.description}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-zoe text-[10.5px] text-ink-muted-2">
                      {busy ? "gerando…" : windowLabel(t.code)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-ink-muted" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Tabs + busca */}
      <section
        className="px-6 py-3.5 border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab("biblioteca")}
              className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white"
              style={{ background: "var(--color-teal-500)" }}
              aria-pressed={tab === "biblioteca"}
            >
              Biblioteca{" "}
              <span className="ml-1 font-medium opacity-80">({reports.length})</span>
            </button>
            {/* Agendados/Rascunhos existem no design mas dependem de agendamento
                e rascunho, que ainda não existem no backend — desabilitados em vez
                de fabricar contagem. */}
            {["Agendados", "Rascunhos"].map((label) => (
              <button
                key={label}
                disabled
                title="Chega com a geração agendada"
                className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-ink-muted opacity-45 cursor-not-allowed"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-50 rounded-lg py-1.5 pl-7.5 pr-2.5 text-[12.5px] border border-[#E5E7EB] dark:border-[#262A3A] outline-none focus:ring-1 focus:ring-teal-500"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
        </div>
      </section>

      {/* Biblioteca */}
      <section className="p-7 bg-[#F9FAFB] dark:bg-[#0B0D18] min-h-[320px]">
        {list.isError && !forbidden ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-10 h-10 mx-auto mb-3 text-ink-muted-2" />
            <div className="text-[14px] font-medium mb-1" style={{ color: "var(--ink)" }}>
              {reports.length === 0 ? "Nenhum relatório ainda" : "Nada encontrado"}
            </div>
            <div className="text-[13px] text-ink-muted">
              {reports.length === 0
                ? "Escolha um template acima para gerar o primeiro."
                : "Tente outro termo de busca."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((r) => (
              <ReportCard key={r.id} report={r} onOpen={() => navigate(`/reports/${r.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** Título derivado: o backend guarda template + período, não um título livre. */
function titleOf(r: Report): string {
  const name = TEMPLATE_LABELS[r.template] ?? r.template
  return `${name} · ${r.brandName ?? "Multi"}`
}

const TEMPLATE_LABELS: Record<string, string> = {
  ExecutiveSummary: "Resumo executivo",
  SentimentDeepDive: "Deep-dive de sentimento",
  CompetitorComparison: "Comparativo de concorrentes",
  InfluencerDossier: "Dossiê de influenciadores",
}

function ReportCard({ report, onOpen }: { report: Report; onOpen: () => void }) {
  const generating = report.status === "Generating"
  const failed = report.status === "Failed"

  return (
    <div
      className="p-4 rounded-[14px] border border-border-soft transition-shadow hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
      style={{ background: "var(--surface)" }}
    >
      <div className="mb-3.5 relative">
        <PreviewThumb tone={failed ? "neg" : "neu"} />
        {generating && (
          <div className="absolute inset-0 rounded-md flex flex-col items-center justify-center gap-2 bg-white/85 dark:bg-black/60">
            <div className="w-15 h-[3px] rounded-sm overflow-hidden relative bg-[#E5E7EB] dark:bg-[#262A3A]">
              <div
                className="absolute left-0 top-0 h-full w-2/5 animate-pulse"
                style={{ background: "var(--color-teal-500)" }}
              />
            </div>
            <span className="font-mono-zoe text-[10.5px] text-ink-muted">GERANDO…</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <span className="chip text-[10.5px]">{TEMPLATE_LABELS[report.template] ?? report.template}</span>
        <span className="font-mono-zoe text-[10.5px] text-ink-muted">{report.brandName ?? "Multi"}</span>
      </div>

      <div className="text-[14px] font-semibold mb-2 leading-[1.35]">{titleOf(report)}</div>

      <div className="flex items-center justify-between text-[11.5px] text-ink-muted">
        <span>{fmtDate(report.createdAt)} · {report.requestedByName || "—"}</span>
        <span className="font-mono-zoe">
          {report.periodStart.slice(5)} → {report.periodEnd.slice(5)}
        </span>
      </div>

      {report.status === "Ready" && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border-soft">
          <button
            onClick={onOpen}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-[5px] rounded-lg text-[12px] font-medium border border-[#E5E7EB] dark:border-[#262A3A] hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Abrir
          </button>
          <button
            onClick={onOpen}
            title="Abrir para imprimir / salvar em PDF"
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-ink-muted" />
          </button>
        </div>
      )}

      {failed && (
        <div className="mt-3 pt-3 border-t border-border-soft text-[12px]" style={{ color: "var(--color-neg)" }}>
          Falhou ao gerar.
        </div>
      )}
    </div>
  )
}

/** Miniatura de página do design — puramente decorativa. */
function PreviewThumb({ tone }: { tone: "pos" | "neu" | "neg" }) {
  const accent =
    tone === "pos" ? "var(--color-pos)" : tone === "neg" ? "var(--color-neg)" : "#9AA1AE"
  return (
    <div
      className="rounded-md border border-[#E5E7EB] dark:border-[#262A3A] p-2.5 flex flex-col gap-1 overflow-hidden"
      style={{ aspectRatio: "4 / 5", background: "var(--surface)" }}
    >
      <div className="h-1 w-2/5 rounded-sm" style={{ background: accent }} />
      <div className="h-2 w-4/5 rounded-sm mt-0.5 bg-[#1F2937] dark:bg-[#C9CEDA]" />
      <div className="h-[3px] w-3/5 rounded-sm bg-[#E5E7EB] dark:bg-[#262A3A]" />
      <div className="flex-1 mt-1 grid grid-cols-2 gap-[3px]">
        <div className="rounded-sm bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
        <div className="rounded-sm bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      </div>
      <div className="h-3.5 rounded-sm" style={{ background: `color-mix(in srgb, ${accent} 13%, transparent)` }} />
    </div>
  )
}

function UpsellScreen() {
  return (
    <div className="-m-6 border-t border-border-soft" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <div className="flex flex-col items-center justify-center text-center px-6 py-24 max-w-lg mx-auto">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: "var(--color-teal-50)" }}
        >
          <Lock className="w-6 h-6" style={{ color: "var(--color-teal-500)" }} />
        </div>
        <div className="eyebrow mb-3">Recurso premium</div>
        <h1 className="font-display m-0 mb-3" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
          Relatórios
        </h1>
        <p className="text-[14px] text-ink-muted mb-6 max-w-md">
          Gere relatórios executivos prontos para enviar ao cliente, com os números do período
          que você escolher. Disponível nos planos com Relatórios habilitado.
        </p>
        <a
          href="mailto:contato@heyzoe.com.br?subject=Habilitar%20Relat%C3%B3rios"
          className="inline-flex items-center gap-1.5 h-10 px-5 text-[13.5px] font-medium rounded-md text-white transition-colors"
          style={{ background: "var(--color-ember)" }}
        >
          <Sparkles className="w-4 h-4" /> Falar com o time
        </a>
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button
        onClick={onRetry}
        className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  )
}
