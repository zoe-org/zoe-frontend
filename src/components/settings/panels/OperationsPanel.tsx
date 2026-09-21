import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { useAuth } from "@/features/auth/context"
import { meApi } from "@/lib/api/me"
import { ContractDefaultsTab } from "@/components/settings/panels/ContractDefaultsSettings"
import { Section, ReadOnlyValue } from "./AccountPanel"

/** Operations nas Configurações: CNPJ, padrões de contrato e avisos por e-mail. */
export function OperationsPanel() {
  const { role, activeTenantId, activeTenant } = useAuth()
  const isAdmin = role === "Owner" || role === "Admin"

  return (
    <div className="space-y-6">
      <TenantTaxId
        tenantId={activeTenantId}
        current={activeTenant?.tenant.taxId ?? null}
        canEdit={isAdmin}
      />

      <div className="h-px bg-border-soft" />

      <OperationsEmailCard tenantId={activeTenantId} />

      <div className="h-px bg-border-soft" />

      <ContractDefaultsTab isAdmin={isAdmin} />
    </div>
  )
}

/** CNPJ do contratante, exigido no contrato e na nota da taxa. Só Owner e Admin editam. */
function TenantTaxId({
  tenantId, current, canEdit,
}: {
  tenantId: string | null
  current: string | null
  canEdit: boolean
}) {
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const shown = saved ?? current

  if (shown) {
    return (
      <Section title="CNPJ" hint="Identifica sua empresa como parte nos contratos.">
        <ReadOnlyValue value={shown} mono />
      </Section>
    )
  }

  if (!canEdit) {
    return (
      <Section title="CNPJ" hint="Só Owner e Admin podem informar: aparece em documento com validade jurídica.">
        <ReadOnlyValue value="não informado" />
      </Section>
    )
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!tenantId) return
    setSaving(true)
    try {
      const r = await meApi.setTaxId(tenantId, value)
      setSaved(r.formatted)
      notifySuccess("CNPJ registrado.")
    } catch (e) {
      notifyError(e, "Não foi possível registrar o CNPJ.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
        CNPJ
      </div>
      <p className="text-[12.5px] text-ink-muted mt-0.5 mb-2.5">
        Identifica sua empresa como parte nos contratos.
      </p>
      <div className="flex gap-2 flex-wrap">
        <input
          value={value}
          onChange={(ev) => setValue(ev.target.value)}
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          aria-label="CNPJ"
          className="flex-1 min-w-[170px] h-9 px-3 text-[13px] rounded-lg border border-border-soft bg-inset"
          style={{ color: "var(--ink)" }}
        />
        <button
          type="submit"
          disabled={saving || value.trim().length === 0}
          className="h-9 px-3.5 rounded-lg text-[13px] font-medium border border-border-soft disabled:opacity-50"
          style={{ color: "var(--ink)" }}
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  )
}

/** Avisos do Operations por e-mail, só para você e só neste workspace. */
function OperationsEmailCard({ tenantId }: { tenantId: string | null }) {
  const qc = useQueryClient()
  const prefs = useQuery({
    queryKey: ["me-notifications", tenantId],
    queryFn: () => meApi.getNotifications(),
    enabled: Boolean(tenantId),
  })
  const save = useMutation({
    mutationFn: (operationsEmail: boolean) => meApi.setNotifications({ operationsEmail }),
    onSuccess: (data) => {
      qc.setQueryData(["me-notifications", tenantId], data)
      notifySuccess(data.operationsEmail
        ? "Você volta a receber os avisos do Operations por e-mail."
        : "Você não recebe mais os avisos do Operations por e-mail neste workspace.")
    },
    onError: (e: unknown) => notifyError(e, "Não foi possível salvar a preferência."),
  })
  const enabled = prefs.data?.operationsEmail ?? true

  return (
    <div>
      <div className="text-[13.5px] font-medium mb-2.5" style={{ color: "var(--ink)" }}>
        Avisos por e-mail
      </div>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={prefs.isLoading || save.isPending}
          onChange={(e) => save.mutate(e.target.checked)}
          className="mt-0.5 accent-[var(--color-teal-500)] disabled:opacity-60"
        />
        <span>
          <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            Receber os avisos do Operations
          </span>
          <span className="block text-[12px] text-ink-muted mt-0.5">
            Corte e entrega esperando revisão, contrato assinado, prazo de revisão acabando, reserva confirmada
            e convite aceito. Vale só para você e só neste workspace.
          </span>
        </span>
      </label>
    </div>
  )
}
