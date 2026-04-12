export type ReportTemplate = { id: string; emoji: string; name: string; description: string; pages: string }

export const templates: ReportTemplate[] = [
  { id: "rt1", emoji: "📊", name: "Relatório Semanal", description: "Resumo de menções, sentimento e alcance dos últimos 7 dias.", pages: "~2 páginas" },
  { id: "rt2", emoji: "📋", name: "Relatório Mensal", description: "Análise completa com tendências, influenciadores e tópicos.", pages: "~8 páginas" },
  { id: "rt3", emoji: "🚨", name: "Relatório de Crise", description: "Detalhamento de eventos negativos e plano de resposta.", pages: "~4 páginas" },
]

export type GeneratedReport = { id: string; name: string; date: string; pages: number; status: "sent" | "generated" }

export const generatedReports: GeneratedReport[] = [
  { id: "gr1", name: "Relatório Semanal — 01 a 07 Abr", date: "2026-04-07", pages: 2, status: "sent" },
  { id: "gr2", name: "Relatório Mensal — Março 2026", date: "2026-04-01", pages: 8, status: "sent" },
  { id: "gr3", name: "Relatório de Crise — Incidente Atendimento", date: "2026-03-16", pages: 4, status: "generated" },
]
