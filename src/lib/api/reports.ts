import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/AuthContext"

// Relatórios (Etapa 4.5). Add-on cross-módulo `reports`: sem a feature o backend
// devolve 403 e a página mostra o upsell — mesmo padrão do Share of Voice.
// O "PDF" do MVP sai da view print-friendly (`window.print()`); o snapshot fica em
// reports.payload_json, então o histórico reabre com os números do período.

export type ReportStatus = "Generating" | "Ready" | "Failed"

export type Report = {
  id: string
  brandId: string | null
  /** null = relatório multi-marca (o design mostra "Multi"). */
  brandName: string | null
  template: string
  periodStart: string
  periodEnd: string
  format: string
  status: ReportStatus
  requestedByName: string
  createdAt: string
}
export type ReportList = { items: Report[] }

export type ReportTemplate = {
  code: string
  name: string
  description: string
  /** Feature necessária para gerar (o backend já filtra pelo que o tenant tem). */
  requiresFeature: string
  /** Nome do ícone no design; mapeado para lucide na página. */
  icon: string
}
export type ReportTemplateList = { items: ReportTemplate[] }

export type ReportVideoItem = {
  youtubeVideoId: string
  title: string
  channelName: string
  views: number
  score: number | null
}
export type ReportChannelItem = {
  channelId: string
  name: string
  mentions: number
  reach: number
  avgScore: number
}
export type ReportThemeItem = { theme: string; volume: number }

export type ReportBrandSection = {
  brandId: string
  brandName: string
  totalMentions: number
  avgScore: number
  positive: number
  neutral: number
  negative: number
  topVideos: ReportVideoItem[]
  topChannels: ReportChannelItem[]
  topThemes: ReportThemeItem[]
}

export type ReportPayload = {
  template: string
  periodStart: string
  periodEnd: string
  generatedAt: string
  brands: ReportBrandSection[]
}

export type ReportDetail = { report: Report; payload: ReportPayload | null }
export type CreateReportResult = { report: Report; payload: ReportPayload }

export type CreateReportInput = {
  template: string
  periodStart: string
  periodEnd: string
  format?: "Pdf" | "Csv"
  brandId?: string | null
}

type Opts = { signal?: AbortSignal }

export const reportsApi = {
  list: (opts?: Opts): Promise<ReportList> =>
    apiClient.get("/api/reports", { signal: opts?.signal }),
  templates: (opts?: Opts): Promise<ReportTemplateList> =>
    apiClient.get("/api/reports/templates", { signal: opts?.signal }),
  get: (reportId: string, opts?: Opts): Promise<ReportDetail> =>
    apiClient.get(`/api/reports/${reportId}`, { signal: opts?.signal }),
  create: (input: CreateReportInput): Promise<CreateReportResult> =>
    apiClient.post("/api/reports", { format: "Pdf", ...input }),
  remove: (reportId: string): Promise<void> =>
    apiClient.delete(`/api/reports/${reportId}`),
}

// ── hooks (tenantId na key = isolamento por tenant) ────────────────────────

/** `enabled` deve refletir a feature `reports` — sem ela nem chamamos. */
export function useReports(enabled: boolean) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["reports", activeTenantId],
    queryFn: ({ signal }) => reportsApi.list({ signal }),
    enabled: Boolean(activeTenantId && enabled),
    staleTime: 30_000,
  })
}

export function useReportTemplates(enabled: boolean) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["report-templates", activeTenantId],
    queryFn: ({ signal }) => reportsApi.templates({ signal }),
    enabled: Boolean(activeTenantId && enabled),
    staleTime: 5 * 60_000,
  })
}

export function useReport(reportId: string | undefined) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["report", activeTenantId, reportId],
    queryFn: ({ signal }) => reportsApi.get(reportId!, { signal }),
    enabled: Boolean(activeTenantId && reportId),
    staleTime: 5 * 60_000,
  })
}

export function useCreateReport() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReportInput) => reportsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", activeTenantId] }),
  })
}

export function useDeleteReport() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reportId: string) => reportsApi.remove(reportId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", activeTenantId] }),
  })
}
