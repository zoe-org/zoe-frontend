import { Check, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "@/features/auth/context"
import { Section, ReadOnlyValue } from "./AccountPanel"

// Workspace ativo e a lista de todos. A troca vive aqui além do menu do rodapé:
// quem abre configurações para conferir plano ou consumo precisa poder confirmar
// PRIMEIRO em qual workspace está — os dois números são por tenant.

/** Hash determinístico → cor consistente por tenant, igual à do menu do rodapé. */
const TENANT_PALETTE = [
  "#820AD1", "#00A799", "#F97316", "#0EA5E9",
  "#DC2626", "#16A34A", "#D97706", "#7C3AED",
]
function tenantColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return TENANT_PALETTE[Math.abs(h) % TENANT_PALETTE.length]
}

export function WorkspacePanel({ onNavigate }: { onNavigate: () => void }) {
  const { role, memberships, activeTenantId, switchTenant } = useAuth()
  const active = memberships.find((m) => m.tenantId === activeTenantId)

  return (
    <div className="space-y-6">
      <Section title="Nome do workspace">
        <ReadOnlyValue value={active?.tenantName ?? "—"} />
      </Section>

      <Section title="Seu papel" hint="Define o que você pode alterar neste workspace.">
        <ReadOnlyValue value={role ?? "—"} />
      </Section>

      <div className="h-px bg-border-soft" />

      <div>
        <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
          Seus workspaces
        </div>
        <div className="text-[12.5px] text-ink-muted mt-0.5 mb-3">
          Plano, consumo e marcas são de cada workspace, não da sua conta.
        </div>

        <div
          className="rounded-[14px] border border-border-soft overflow-hidden"
          style={{ background: "var(--surface)" }}
        >
          {memberships.map((m, i) => {
            const isActive = m.tenantId === activeTenantId
            return (
              <button
                key={m.tenantId}
                onClick={() => { if (!isActive) void switchTenant(m.tenantId) }}
                disabled={isActive}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  i > 0 ? "border-t border-border-soft" : ""
                } ${isActive ? "cursor-default" : "hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tenantColor(m.tenantId) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>
                    {m.tenantName}
                  </div>
                  <div className="text-[11.5px] text-ink-muted truncate">{m.role}</div>
                </div>
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] shrink-0" style={{ color: "var(--color-teal-500)" }}>
                    <Check className="w-3.5 h-3.5" /> ativo
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Fecha o diálogo: a criação é uma tela inteira, e deixar o modal aberto por
            cima dela esconderia justamente o formulário que se foi preencher. */}
        <Link
          to="/onboarding/tenant"
          onClick={onNavigate}
          className="mt-3 h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
          style={{ color: "var(--ink)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Criar novo workspace
        </Link>
      </div>
    </div>
  )
}
