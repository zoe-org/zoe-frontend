import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { brands } from "@/lib/mock/brands"
import { MoreHorizontal } from "lucide-react"

const statusStyles = {
  active: { label: "Ativa", className: "bg-[#F0FDF4] text-[#16A34A]" },
  paused: { label: "Pausada", className: "bg-[#F3F4F6] text-[#6B7280]" },
  configuring: { label: "Configurando", className: "bg-[#FFFBEB] text-[#D97706]" },
}

export default function BrandsPage() {
  if (brands.length === 0) {
    return (
      <div>
        <PageHeader title="Marcas monitoradas" />
        <EmptyState
          title="Nenhuma marca configurada"
          description="Adicione sua primeira marca para começar a monitorar menções."
          actionLabel="+ Nova marca"
          onAction={() => {}}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Marcas monitoradas">
        <Button className="bg-ember hover:bg-ember/90 text-white text-xs h-8 px-4">
          + Nova marca
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map(brand => {
          const status = statusStyles[brand.status]
          return (
            <div key={brand.id} className="bg-white rounded-lg border p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: brand.color }}
                  >
                    {brand.initial}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[--color-midnight]">{brand.name}</h3>
                    <p className="text-xs text-[#6B7280]">{brand.mentions} menções · {brand.keywords} keywords</p>
                  </div>
                </div>
                <button className="text-[#6B7280] hover:text-[--color-midnight]">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden mb-3">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${brand.mentionProgress}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280]">{brand.mentionProgress}% da meta</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${status.className}`}>{status.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
