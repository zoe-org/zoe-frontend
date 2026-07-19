import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { rules, alertHistory } from "@/lib/mock/alerts"
import { Link } from "react-router-dom"

const severityBorder = { critical: "border-l-[#DC2626]", warning: "border-l-[#D97706]", info: "border-l-teal-500" }
const severityDot = { critical: "bg-[#DC2626]", warning: "bg-[#D97706]", info: "bg-teal-500" }

type Tab = "config" | "history"

export default function AlertsPage() {
  const [tab, setTab] = useState<Tab>("config")

  return (
    <div className="space-y-4">
      <PageHeader title="Alertas" subtitle="Regras de alerta e histórico de notificações." />

      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {([
          { key: "config" as Tab, label: "Configuração" },
          { key: "history" as Tab, label: "Histórico" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-teal-500 text-teal-500"
                : "border-transparent text-[#6B7280] hover:text-midnight dark:hover:text-[#E6E8EF]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
              Regras ativas ({rules.filter(r => r.enabled).length})
            </span>
            <Button className="bg-ember hover:bg-ember/90 text-white text-xs h-8 px-4">
              + Nova regra
            </Button>
          </div>
          <div className="space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`bg-white rounded-lg border border-l-4 p-4 ${severityBorder[rule.severity]} ${!rule.enabled ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <button
                      className={`relative mt-0.5 w-8 h-4.5 rounded-full transition-colors ${rule.enabled ? "bg-teal-500" : "bg-[#E5E7EB]"}`}
                    >
                      <span
                        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${rule.enabled ? "left-4" : "left-0.5"}`}
                      />
                    </button>
                    <div>
                      <h3 className="text-sm font-semibold text-midnight dark:text-[#E6E8EF]">{rule.name}</h3>
                      <p className="text-xs text-[#6B7280] mt-0.5">{rule.condition}</p>
                      <p className="text-xs text-[#6B7280] mt-1">Notificar via: {rule.notifyVia.join(" + ")}</p>
                    </div>
                  </div>
                  <button className="text-xs text-teal-500 hover:underline font-medium">Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide block">
            Timeline de alertas
          </span>
          <div className="space-y-4">
            {alertHistory.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 bg-white rounded-lg border p-4">
                <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${severityDot[entry.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-midnight dark:text-[#E6E8EF]">{entry.description}</p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Regra: {entry.ruleName} · {entry.datetime}
                  </p>
                  {entry.mentionLink && (
                    <Link to={entry.mentionLink} className="text-xs text-teal-500 hover:underline mt-1 inline-block">
                      Ver menção →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
