import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Loader2, AlertCircle, Lock, Send, Save, PenLine } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate } from "@/pages/operations/format"
import { TableSkeleton } from "@/pages/operations/shared"
import {
  useContract, useContractDetailMutations,
  fieldInputKind, contractProgress,
  type ContractField, type ContractDetail,
} from "@/lib/api/operations"

/** Lê `details.missing` de um Problem Details sem confiar no formato. */
function missingFromProblem(err: unknown): string[] {
  if (!(err instanceof ApiError)) return []
  const details = err.problem?.details as { missing?: unknown } | undefined
  const missing = details?.missing
  return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === "string") : []
}

export default function ContractDetailPage() {
  const { contractId } = useParams<{ contractId: string }>()
  const contract = useContract(contractId)
  const { saveFields, sendForSignature, markSigned } = useContractDetailMutations(contractId)

  // Valores editados localmente. Só o que o usuário tocou vai no PATCH — o
  // backend faz merge por placeholder, então mandar o mundo inteiro seria ruído.
  const [edits, setEdits] = useState<Record<string, string>>({})
  /** Faltantes apontados pelo servidor na última tentativa de envio. */
  const [serverMissing, setServerMissing] = useState<string[]>([])

  const data = contract.data
  const fields = useMemo<ContractField[]>(
    () => (data?.fields ?? []).map((f) => (f.placeholder in edits ? { ...f, value: edits[f.placeholder] } : f)),
    [data?.fields, edits],
  )
  const progress = useMemo(() => contractProgress(fields), [fields])
  const dirty = Object.keys(edits).length > 0

  if (contract.isLoading) return <TableSkeleton rows={5} />

  if (contract.isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
        <h3 className="text-lg font-semibold mb-1">Contrato não encontrado</h3>
        <Link to="/operations/contracts" className="text-[13px] underline" style={{ color: "var(--color-teal-500)" }}>
          Voltar para contratos
        </Link>
      </div>
    )
  }

  const isDraft = data.status === "Draft"
  const missing = new Set([...data.missingRequiredFields, ...serverMissing])

  const setValue = (placeholder: string, value: string) => {
    setEdits((e) => ({ ...e, [placeholder]: value }))
    setServerMissing((m) => m.filter((p) => p !== placeholder))
  }

  const save = () => {
    if (!dirty) return
    saveFields.mutate(edits, {
      onSuccess: (res) => {
        setEdits({})
        toast.success(
          res.missingRequiredFields.length === 0
            ? "Campos salvos. Nenhum obrigatório pendente."
            : `Campos salvos. Faltam ${res.missingRequiredFields.length} obrigatórios.`,
        )
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar."),
    })
  }

  const send = () => {
    if (dirty) {
      toast.error("Salve os campos alterados antes de enviar.")
      return
    }
    sendForSignature.mutate(undefined, {
      onSuccess: () => toast.success("Contrato enviado para assinatura."),
      onError: (e) => {
        const code = e instanceof ApiError ? e.code : undefined
        if (code === "contract_fields_incomplete") {
          const list = missingFromProblem(e)
          setServerMissing(list)
          toast.error(`Faltam ${list.length} campos obrigatórios — estão marcados na lista.`)
          return
        }
        if (code === "template_not_legally_reviewed") {
          toast.error(
            "O template desta modalidade ainda não passou por revisão jurídica. Isso é liberado pela Zoe, não pelo workspace.",
          )
          return
        }
        toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar.")
      },
    })
  }

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      <Header data={data} progress={progress} />

      <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8" style={{ background: "var(--surface)" }}>
        {/* Campos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold m-0">Campos do contrato</h2>
            <RoleGate minRole="Admin">
              <div className="flex items-center gap-2">
                {isDraft && (
                  <button
                    onClick={save}
                    disabled={!dirty || saveFields.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border border-border-soft disabled:opacity-40 hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"
                  >
                    {saveFields.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                )}
                {isDraft && (
                  <button
                    onClick={send}
                    disabled={sendForSignature.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--color-teal-500)" }}
                  >
                    {sendForSignature.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Enviar para assinatura
                  </button>
                )}
              </div>
            </RoleGate>
          </div>

          {!isDraft && (
            <p className="text-[12.5px] text-ink-muted mb-4">
              Contrato fora de rascunho: os campos ficam somente leitura.
            </p>
          )}

          <div className="flex flex-col gap-4">
            {fields.map((f) => (
              <FieldRow
                key={f.placeholder}
                field={f}
                readOnly={!isDraft}
                isMissing={missing.has(f.placeholder)}
                onChange={(v) => setValue(f.placeholder, v)}
              />
            ))}
          </div>
        </div>

        {/* Coluna lateral */}
        <aside className="flex flex-col gap-6">
          <SignaturePanel data={data} onMarkSigned={() => markSigned.mutate(undefined, {
            onSuccess: () => toast.success("Contrato marcado como assinado."),
            onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível marcar."),
          })} pending={markSigned.isPending} />

          <ClausesPanel clauses={data.clauses} />
        </aside>
      </div>
    </div>
  )
}

function Header({
  data, progress,
}: { data: ContractDetail; progress: { required: number; filled: number } }) {
  const pct = progress.required === 0 ? 100 : Math.round((progress.filled / progress.required) * 100)
  return (
    <section className="px-8 pt-6 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
      <Link
        to="/operations/contracts"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Contratos
      </Link>

      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="eyebrow mb-2">
            {tEnum("contractModality", data.modality ?? "")} · template v{data.templateVersion}
            {data.hybridCode && ` · ${data.hybridCode}`}
          </div>
          <h1 className="font-display m-0" style={{ fontSize: 30, lineHeight: 1.1, color: "var(--ink)" }}>
            {data.influencerName}
          </h1>
          <div className="text-[13px] text-ink-muted mt-1.5">
            {tEnum("contractStatus", data.status)}
            {data.signedAt && ` · assinado em ${fmtDate(data.signedAt)}`}
            {" · "}
            {data.usesEscrow ? "com custódia" : "sem custódia"}
            {" · revisão em "}{data.reviewSlaDays} dias
            {" · "}{data.maxResubmissions} correções
          </div>
        </div>

        <div className="min-w-52">
          <div className="flex items-center justify-between text-[12px] text-ink-muted mb-1.5">
            <span>Obrigatórios</span>
            <span className="font-mono-zoe">{progress.filled}/{progress.required}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }}>
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${pct}%`, background: pct === 100 ? "var(--color-teal-500)" : "#D97706" }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function FieldRow({
  field, readOnly, isMissing, onChange,
}: {
  field: ContractField
  readOnly: boolean
  isMissing: boolean
  onChange: (v: string) => void
}) {
  const kind = fieldInputKind(field.dataType)
  const value = field.value ?? ""

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
        {field.label}
        {field.isRequired && <span style={{ color: "#DC2626" }}>*</span>}
        {field.kind === "MachineActionable" && (
          <span
            className="chip text-[10px]"
            title="Campo que o sistema usa — alimenta auditoria, prazos ou valores. Não é só texto do documento."
          >
            sistema
          </span>
        )}
      </span>

      {kind === "checkbox" ? (
        <input
          type="checkbox"
          checked={value === "true"}
          disabled={readOnly}
          onChange={(e) => onChange(String(e.target.checked))}
          className="w-4 h-4 accent-[var(--color-teal-500)] disabled:opacity-50"
        />
      ) : (
        <Input
          type={kind}
          value={value}
          disabled={readOnly}
          step={field.dataType === "Currency" ? "0.01" : undefined}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={isMissing || undefined}
          style={isMissing ? { borderColor: "#DC2626" } : undefined}
        />
      )}

      {field.helpText && <span className="text-[11.5px] text-ink-muted">{field.helpText}</span>}
      {isMissing && <span className="text-[11.5px]" style={{ color: "#DC2626" }}>Obrigatório e ainda vazio.</span>}
    </label>
  )
}

function SignaturePanel({
  data, onMarkSigned, pending,
}: { data: ContractDetail; onMarkSigned: () => void; pending: boolean }) {
  return (
    <div className="rounded-xl border border-border-soft p-4">
      <div className="eyebrow mb-2">Assinatura</div>

      {!data.templateLegalReviewed && (
        <p className="text-[12px] text-[#D97706] mb-2.5">
          Template ainda sem revisão jurídica — o envio para assinatura é recusado até a Zoe liberar.
        </p>
      )}

      {data.signatureProviderRef && (
        <p className="font-mono-zoe text-[11px] text-ink-muted break-all mb-2.5">
          {data.signatureProviderRef}
        </p>
      )}

      {data.status === "SentForSignature" && (
        <RoleGate minRole="Admin">
          <button
            onClick={onMarkSigned}
            disabled={pending}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border border-dashed disabled:opacity-50"
            style={{ borderColor: "#D97706", color: "#D97706" }}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
            Marcar como assinado
          </button>
          <p className="text-[11px] text-ink-muted mt-2">
            Atalho de desenvolvimento. No produto quem dispara isto é o webhook do
            provedor de assinatura — este botão some quando o adapter existir.
          </p>
        </RoleGate>
      )}

      {data.status === "Signed" && (
        <p className="text-[12.5px]" style={{ color: "var(--color-teal-500)" }}>
          Assinado. A custódia já pode ser aberta.
        </p>
      )}
    </div>
  )
}

function ClausesPanel({ clauses }: { clauses: ContractDetail["clauses"] }) {
  return (
    <div className="rounded-xl border border-border-soft p-4">
      <div className="eyebrow mb-2.5">Cláusulas ({clauses.length})</div>
      <ol className="flex flex-col gap-2 m-0 p-0 list-none">
        {clauses.map((c) => (
          <li key={c.order} className="text-[12.5px] flex items-start gap-1.5">
            {c.isSystem && (
              <Lock
                className="w-3 h-3 mt-0.5 shrink-0"
                style={{ color: "var(--color-teal-500)" }}
              />
            )}
            <span style={{ color: c.isSystem ? "var(--ink)" : "var(--ink-muted)" }}>{c.title}</span>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-ink-muted mt-3">
        As cláusulas com cadeado são de sistema (custódia, identificação publicitária,
        auditoria) e não são editáveis em nenhum plano.
      </p>
    </div>
  )
}
