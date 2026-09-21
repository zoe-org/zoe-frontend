import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Lock, Sparkles, Calendar, FileText, TrendingUp, Users, ArrowRight, ExternalLink, Download, AlertCircle, Trash2, Loader2,
} from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { useConfirm } from "@/features/confirm/context"
import { useFeature } from "@/features/auth/useFeature"
import { useActiveBrand } from "@/features/brands/context"
import { CoverageNotice } from "@/components/coverage/CoverageNotice"
import { SearchBox } from "@/components/operations/shared"
import { stagger } from "@/lib/motion"
import { ApiError } from "@/lib/api"
import {
  useReports, useReportTemplates, useCreateReport, useDeleteReport,
  type Report, type ReportTemplate,
} from "@/lib/api/reports"

// Ícones do design → lucide.
const TEMPLATE_ICON: Record<string, typeof FileText> = {
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

/** `requiresFeature` do template para o nome do módulo que o cliente conhece. */
const MODULE_LABEL: Record<string, string> = {
  intelligence: "Intelligence",
  sov: "Intelligence",
  operations: "Operations",
}

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
  // Hooks separados: com `&&` o curto-circuito pularia o segundo em alguns
  // renders e mudaria a ordem deles.
  const hasIntelligence = useFeature("intelligence")
  const hasOperations = useFeature("operations")
  // Rótulo de módulo só faz sentido em workspace que tem mais de um.
  const mostrarModulo = hasIntelligence && hasOperations
  const navigate = useNavigate()
  const brand = useActiveBrand()

  const list = useReports(hasReports)
  const templates = useReportTemplates(hasReports)
  const iconByTemplate = new Map((templates.data?.items ?? []).map((t) => [t.code, t.icon]))
  const create = useCreateReport()
  const del = useDeleteReport()
  const confirm = useConfirm()

  const handleDelete = async (r: Report) => {
    const ok = await confirm({
      title: `Apagar “${titleOf(r)}”?`,
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Apagar",
      tone: "danger",
    })
    if (!ok) return
    del.mutate(r.id, {
      onSuccess: () => notifySuccess("Relatório apagado."),
      onError: (e) => notifyError(e, "Não foi possível apagar."),
    })
  }

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
          notifySuccess(`${tpl.name} gerado.`)
          navigate(`/reports/${res.report.id}`)
        },
        onError: (e) =>
          notifyError(e, "Não foi possível gerar o relatório."),
      },
    )
  }

  return (
    <div className="-m-6 min-h-[calc(100dvh-3.75rem)] flex flex-col" style={{ color: "var(--ink)" }}>
      {/* Hero */}
      <section
        className="px-8 pt-7 pb-6 border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="eyebrow mb-3">Gestão · Entregáveis</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Relatórios
            </h1>
            <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-200">
              Gere relatórios prontos para enviar ao cliente — automáticos ou sob demanda.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Agendamento entra com a geração assíncrona (Etapa 7). */}
            <button
              disabled
              title="Agendamento chega com a geração automática"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-medium border border-border-soft opacity-45 cursor-not-allowed"
            >
              <Calendar className="w-3.5 h-3.5 text-ink-muted" /> Agendar
            </button>
          </div>
        </div>
      </section>

      {/* O relatório sai com o que o tenant pode ver: dizer antes de gerar, não depois. */}
      <CoverageNotice tenantBrandIds={[brand.active?.tenantBrandId]} className="mx-8 mt-4" />

      {/* Templates */}
      <section
        className="px-8 py-6 border-b border-border-soft"
        style={{ background: "var(--surface)" }}
      >
        <div className="eyebrow mb-3.5">Começar a partir de um template</div>
        {templates.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-[14px] z-skeleton" />
            ))}
          </div>
        ) : (templates.data?.items.length ?? 0) === 0 ? (
          <div className="text-[13px] text-ink-muted py-4">
            Nenhum template disponível para os módulos deste workspace.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {templates.data!.items.map((t, i) => {
              const Icon = TEMPLATE_ICON[t.icon] ?? FileText
              const busy = create.isPending && create.variables?.template === t.code
              return (
                <button
                  key={t.code}
                  onClick={() => generate(t)}
                  disabled={create.isPending || !brand.brandId}
                  title={!brand.brandId ? "Assine uma marca para gerar relatórios" : undefined}
                  className="text-left p-4.5 rounded-[14px] border border-border-soft hover:border-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border-soft cursor-pointer z-rise"
                  style={{ background: "var(--surface)", ...stagger(i) }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: "var(--teal-bg)" }}
                  >
                    <Icon className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold">{t.name}</span>
                    {/* De qual módulo o template é. Só aparece em workspace com
                        os dois: com um módulo só, o rótulo é sempre o mesmo e
                        vira ruído. Hoje a API só devolve templates de
                        Intelligence — dizer o módulo torna isso visível em vez
                        de a lista parecer completa. */}
                    {mostrarModulo && MODULE_LABEL[t.requiresFeature] && (
                      <span className="chip text-[10px]">{MODULE_LABEL[t.requiresFeature]}</span>
                    )}
                  </div>
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
      {/* Barra de trabalho: calha de 8 como o resto da página, e grudada —
          a biblioteca rola e a busca precisa acompanhar. */}
      <section
        className="px-8 py-3 border-b border-border-soft flex items-center justify-between gap-x-4 gap-y-2.5 flex-wrap sticky top-0 z-10"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTab("biblioteca")}
            aria-pressed={tab === "biblioteca"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium text-white cursor-pointer"
            style={{ background: "var(--color-teal-500)" }}
          >
            Biblioteca
            <span className="font-mono-zoe text-[11px] opacity-85">{reports.length}</span>
          </button>
          {/* Agendados/Rascunhos existem no design mas dependem de agendamento
              e rascunho, que ainda não existem no backend — desabilitados em vez
              de fabricar contagem. */}
          {["Agendados", "Rascunhos"].map((label) => (
            <button
              key={label}
              disabled
              title="Chega com a geração agendada"
              className="inline-flex items-center h-8 px-3 rounded-lg text-[12.5px] font-medium text-ink-muted opacity-45 cursor-not-allowed"
            >
              {label}
            </button>
          ))}
        </div>

        <SearchBox value={search} onChange={setSearch} placeholder="Buscar relatório…" className="w-48 sm:w-60" />
      </section>

      {/* Biblioteca */}
      <section className="flex-1 p-7 bg-inset">
        {list.isError && !forbidden ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 rounded-[14px] z-skeleton" />
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
            {filtered.map((r, i) => (
              <ReportCard
                key={r.id}
                report={r}
                index={i}
                // O relatório guarda o código do template; o nome do ícone vive
                // no template. O join acontece aqui, onde os dois existem.
                icon={iconByTemplate.get(r.template)}
                onOpen={() => navigate(`/reports/${r.id}`)}
                onDelete={() => handleDelete(r)}
                deleting={del.isPending && del.variables === r.id}
              />
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

/**
 * Cartão do relatório, sem miniatura.
 *
 * Havia uma capa 4/5 ocupando dois terços da altura — um desenho genérico de
 * documento, igual em todos os cartões. Preencher com o conteúdo real exigia
 * uma requisição por cartão, e continuava sendo enfeite: o que distingue um
 * relatório do outro é template, marca e período, tudo já aqui em texto.
 *
 * Sem ela o cartão cabe em cerca de um terço da altura, e a biblioteca passa a
 * ser varrida de relance em vez de rolada.
 */
function ReportCard({
  report, onOpen, onDelete, deleting, index, icon,
}: {
  report: Report
  onOpen: () => void
  onDelete: () => void
  deleting: boolean
  index: number
  /** Nome do ícone do template que gerou este relatório. */
  icon?: string
}) {
  const generating = report.status === "Generating"
  const failed = report.status === "Failed"
  const Icon = TEMPLATE_ICON[icon ?? ""] ?? FileText

  return (
    <div
      className="p-4 rounded-[14px] border border-border-soft transition-shadow hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] z-rise"
      style={{ background: "var(--surface)", ...stagger(Math.min(index, 12)) }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center"
          style={{
            background: failed ? "var(--neg-bg)" : "var(--teal-bg)",
            color: failed ? "var(--color-neg)" : "var(--color-teal-500)",
          }}
          aria-hidden
        >
          <Icon className="w-4 h-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-[1.35]">{titleOf(report)}</div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="chip text-[10.5px]">{TEMPLATE_LABELS[report.template] ?? report.template}</span>
            <span className="font-mono-zoe text-[10.5px] text-ink-muted">{report.brandName ?? "Multi"}</span>
          </div>
        </div>

        {report.status === "Ready" && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onOpen}
              title="Abrir relatório"
              aria-label="Abrir relatório"
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-tint transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpen}
              title="Abrir para imprimir / salvar em PDF"
              aria-label="Salvar em PDF"
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-tint transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              title="Apagar relatório"
              aria-label="Apagar relatório"
              className="p-1.5 rounded-lg text-ink-muted hover:text-[var(--color-neg)] hover:bg-tint transition-colors disabled:opacity-50 cursor-pointer"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-[11.5px] text-ink-muted mt-3 pt-3 border-t border-border-soft">
        <span className="truncate">{fmtDate(report.createdAt)} · {report.requestedByName || "—"}</span>
        <span className="font-mono-zoe shrink-0">
          {report.periodStart.slice(5)} → {report.periodEnd.slice(5)}
        </span>
      </div>

      {generating && (
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex-1 h-[3px] rounded-sm overflow-hidden bg-tint-2">
            <div className="h-full w-2/5" style={{ background: "var(--color-teal-500)" }} />
          </div>
          <span className="font-mono-zoe text-[10.5px] text-ink-muted shrink-0">GERANDO…</span>
        </div>
      )}

      {failed && (
        <div className="flex items-center justify-between gap-3 mt-2.5">
          <span className="text-[12px]" style={{ color: "var(--color-neg)" }}>Falhou ao gerar.</span>
          <button
            onClick={onDelete}
            disabled={deleting}
            aria-label="Apagar relatório"
            className="p-1.5 rounded-lg text-ink-muted hover:text-[var(--color-neg)] hover:bg-tint transition-colors disabled:opacity-50 cursor-pointer"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  )
}

function UpsellScreen() {
  return (
    <div className="-m-6" style={{ background: "var(--surface)", color: "var(--ink)" }}>
      <div className="flex flex-col items-center justify-center text-center px-6 py-24 max-w-lg mx-auto">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: "var(--teal-bg)" }}
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
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-ink mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-ink-muted mb-4">Tente novamente em instantes.</p>
      <button
        onClick={onRetry}
        className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  )
}
