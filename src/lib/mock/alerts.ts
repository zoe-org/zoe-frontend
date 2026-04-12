export type AlertRule = {
  id: string; name: string; condition: string; notifyVia: string[]
  enabled: boolean; severity: "critical" | "warning" | "info"
}

export const rules: AlertRule[] = [
  { id: "r1", name: "Pico de sentimento negativo", condition: "Sentimento < -0.5 AND views > 100K", notifyVia: ["E-mail", "Slack"], enabled: true, severity: "critical" },
  { id: "r2", name: "CONAR — #publi ausente", condition: "Menção sem #publi ou #ad", notifyVia: ["E-mail"], enabled: true, severity: "warning" },
  { id: "r3", name: "Audiência anômala", condition: "Crescimento de inscritos > 30% em 24h", notifyVia: ["Slack"], enabled: true, severity: "warning" },
  { id: "r4", name: "Share of voice abaixo do limiar", condition: "SoV < 25% por 7 dias", notifyVia: ["E-mail"], enabled: false, severity: "info" },
]

export type AlertHistoryItem = {
  id: string; ruleId: string; ruleName: string; description: string
  severity: "critical" | "warning" | "info"; datetime: string; mentionLink?: string
}

export const alertHistory: AlertHistoryItem[] = [
  { id: "ah1", ruleId: "r1", ruleName: "Pico de sentimento negativo", description: "Sentimento caiu para -0.65 em vídeo com 450K views", severity: "critical", datetime: "2026-04-10 14:30", mentionLink: "/intelligence/monitoring" },
  { id: "ah2", ruleId: "r2", ruleName: "CONAR — #publi ausente", description: "#publi ausente em vídeo de @financeiro_br", severity: "warning", datetime: "2026-04-10 09:15", mentionLink: "/intelligence/monitoring" },
  { id: "ah3", ruleId: "r3", ruleName: "Audiência anômala", description: "Crescimento de 45% em inscritos de @dinheirocomvc", severity: "warning", datetime: "2026-04-09 18:00" },
  { id: "ah4", ruleId: "r1", ruleName: "Pico de sentimento negativo", description: "Sentimento caiu para -0.88 em vídeo de @mariafinancas", severity: "critical", datetime: "2026-04-08 11:45", mentionLink: "/intelligence/monitoring" },
]
