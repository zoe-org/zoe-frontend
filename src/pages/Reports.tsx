import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { templates, generatedReports } from "@/lib/mock/reports"
import { FileText, Download } from "lucide-react"

const statusStyles = {
  sent: { label: "Enviado", className: "bg-[#F0FDF4] text-[#16A34A]" },
  generated: { label: "Gerado", className: "bg-[#F3F4F6] text-[#6B7280]" },
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" subtitle="Gere relatórios personalizados de inteligência." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map(tpl => (
          <div key={tpl.id} className="bg-white rounded-lg border p-5">
            <span className="text-2xl">{tpl.emoji}</span>
            <h3 className="text-sm font-semibold text-midnight dark:text-[#E6E8EF] mt-2">{tpl.name}</h3>
            <p className="text-xs text-[#6B7280] mt-1">{tpl.description}</p>
            <p className="text-[10px] text-[#6B7280] mt-2">{tpl.pages}</p>
            <button className="text-xs text-[#00A799] hover:underline font-medium mt-3 inline-block">
              Gerar relatório →
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-4">Configurar geração</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <select className="h-9 px-3 text-xs border border-[#E5E7EB] rounded-md bg-white">
            <option>Template</option>
            {templates.map(t => <option key={t.id}>{t.name}</option>)}
          </select>
          <select className="h-9 px-3 text-xs border border-[#E5E7EB] rounded-md bg-white">
            <option>Período</option>
            <option>Última semana</option>
            <option>Último mês</option>
            <option>Último trimestre</option>
          </select>
          <select className="h-9 px-3 text-xs border border-[#E5E7EB] rounded-md bg-white">
            <option>Marcas</option>
            <option>Nubank</option>
            <option>iFood</option>
            <option>Todas</option>
          </select>
          <select className="h-9 px-3 text-xs border border-[#E5E7EB] rounded-md bg-white">
            <option>Formato</option>
            <option>PDF</option>
            <option>CSV</option>
          </select>
        </div>
        <div className="flex gap-3">
          <Button className="bg-[#00A799] hover:bg-[#00A799]/90 text-white text-xs h-8 px-4">
            Gerar PDF agora
          </Button>
          <Button variant="outline" className="text-xs h-8 px-4">
            Agendar envio mensal
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-4">Relatórios gerados</h2>
        <div className="space-y-3">
          {generatedReports.map(report => {
            const status = statusStyles[report.status]
            return (
              <div key={report.id} className="flex items-center gap-4 py-2 border-b last:border-b-0">
                <FileText className="w-5 h-5 text-[#EC4899] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-midnight dark:text-[#E6E8EF]">{report.name}</p>
                  <p className="text-xs text-[#6B7280]">{report.date} · {report.pages} páginas</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${status.className}`}>{status.label}</span>
                <button className="text-xs text-[#00A799] hover:underline font-medium flex items-center gap-1">
                  <Download className="w-3 h-3" /> Baixar
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
