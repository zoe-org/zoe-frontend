import { useMemo, useState } from "react"
import { Plus, X, Loader2, Users } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { EmptyBlock } from "@/components/ui/empty-block"
import { StatusChip } from "@/components/ui/status-chip"
import { RoleGate } from "@/features/auth/RoleGate"
import { tEnum } from "@/i18n/enums"
import { fmtDate, initials } from "@/pages/operations/format"
import { Field, TableSkeleton, ErrorState } from "@/pages/operations/shared"
import {
  useRoster, useRosterMutations, payoutBlockReason,
  type RosterItem, type AddInfluencerBody,
} from "@/lib/api/operations"

// Cor por estado do KYC. Verificado é o único verde: os outros três são graus
// diferentes de "ainda não recebe", e recusado precisa saltar aos olhos.
// A primeira entrada é o fallback de valor desconhecido.
const KYC_COLOR: Record<string, string> = {
  NotStarted: "#6B7280",
  Pending: "#D97706",
  Verified: "#00A799",
  Rejected: "#DC2626",
}

export default function OperationsRosterPage() {
  const roster = useRoster()
  const [addOpen, setAddOpen] = useState(false)

  const items = useMemo(() => roster.data?.items ?? [], [roster.data])

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      {/* Hero */}
      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="eyebrow mb-2.5">Operations · Elenco</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Criadores
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                {items.length} {items.length === 1 ? "criador" : "criadores"}
              </span>{" "}
              no elenco deste workspace. A pessoa é única na plataforma — se ela já
              trabalha com outra marca, o cadastro só cria o vínculo com você.
            </div>
          </div>
          <RoleGate minRole="Admin">
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar criador
            </button>
          </RoleGate>
        </div>
      </section>

      {/* Tabela */}
      <section style={{ background: "var(--surface)" }}>
        {roster.isLoading ? (
          <TableSkeleton />
        ) : roster.isError ? (
          <ErrorState onRetry={() => roster.refetch()} />
        ) : items.length === 0 ? (
          <EmptyBlock
            className="py-16"
            icon={<Users className="w-7 h-7" strokeWidth={1.5} />}
            message="Nenhum criador no elenco"
            hint="Adicione um criador para poder contratá-lo. Sem elenco não há contrato."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Criador</th>
                  <th className="text-left py-3 eyebrow font-semibold">País</th>
                  <th className="text-left py-3 eyebrow font-semibold">KYC</th>
                  <th className="text-left py-3 eyebrow font-semibold">Recebimento</th>
                  <th className="text-left py-3 eyebrow font-semibold">Contratos</th>
                  <th className="text-left px-8 py-3 eyebrow font-semibold">Adicionado em</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <RosterRow key={it.tenantInfluencerId} item={it} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {addOpen && <AddInfluencerModal onClose={() => setAddOpen(false)} />}
    </div>
  )
}

function RosterRow({ item, index }: { item: RosterItem; index: number }) {
  const blocked = payoutBlockReason(item)
  const name = item.displayName || item.fullName
  return (
    <tr className="border-b border-border-soft hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors">
      <td className="px-8 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[12px]"
            style={{ background: `hsl(${index * 47 + 200}, 45%, 60%)` }}
          >
            {initials(item.fullName, item.email)}
          </div>
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-2" style={{ color: "var(--ink)" }}>
              {name}
              {item.status !== "Active" && (
                <span className="chip text-[10px]">{tEnum("rosterStatus", item.status)}</span>
              )}
            </div>
            <div className="font-mono-zoe text-[11.5px] text-ink-muted truncate">{item.email}</div>
          </div>
        </div>
      </td>
      <td className="py-3.5 font-mono-zoe text-ink-2">{item.countryCode ?? "—"}</td>
      <td className="py-3.5">
        <StatusChip status={item.kycStatus} kind="kycStatus" colors={KYC_COLOR} />
      </td>
      <td className="py-3.5 text-ink-muted text-[12.5px]">
        {blocked ?? <span style={{ color: "var(--color-teal-500)" }}>liberado</span>}
      </td>
      <td className="py-3.5 font-mono-zoe text-ink-2">{item.contractCount}</td>
      <td className="px-8 py-3.5 font-mono-zoe text-ink-2">{fmtDate(item.addedAt)}</td>
    </tr>
  )
}

function AddInfluencerModal({ onClose }: { onClose: () => void }) {
  const { add } = useRosterMutations()
  const [form, setForm] = useState<AddInfluencerBody>({
    email: "", fullName: "", countryCode: "BR", displayName: "",
  })

  const set = <K extends keyof AddInfluencerBody>(k: K, v: AddInfluencerBody[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const canSubmit = emailOk && form.fullName.trim().length >= 2 && !add.isPending

  const submit = () => {
    if (!canSubmit) return
    add.mutate(
      {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        countryCode: form.countryCode?.trim() || undefined,
        displayName: form.displayName?.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          // `created: false` = a pessoa já existia na plataforma e só ganhou o
          // vínculo. Dizer "criado" nesse caso seria mentira, e é justamente a
          // diferença que explica por que o KYC dela pode já vir verificado.
          toast.success(
            res.created
              ? "Criador cadastrado e adicionado ao elenco."
              : "Criador já existia na plataforma — vínculo criado com este workspace.",
          )
          onClose()
        },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 409) {
            toast.error("Esse criador já está no elenco deste workspace.")
            return
          }
          toast.error(e instanceof ApiError ? e.message : "Não foi possível adicionar.")
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border-soft shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar criador ao elenco"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <div className="eyebrow mb-1.5">Elenco</div>
            <h2 className="font-display m-0" style={{ fontSize: 22, color: "var(--ink)" }}>
              Adicionar criador
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-2 overflow-y-auto flex-1 flex flex-col gap-3.5">
          <Field label="E-mail" hint="Identifica a pessoa na plataforma inteira.">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="criador@exemplo.com"
              autoFocus
            />
          </Field>

          <Field label="Nome completo" hint="Como consta no contrato.">
            <Input
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="Maria Souza"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="País">
              <Input
                value={form.countryCode ?? ""}
                onChange={(e) => set("countryCode", e.target.value.toUpperCase().slice(0, 2))}
                placeholder="BR"
                maxLength={2}
              />
            </Field>
            <Field label="Nome de exibição" hint="Opcional.">
              <Input
                value={form.displayName ?? ""}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="@mariasouza"
              />
            </Field>
          </div>

          <p className="text-[12px] text-ink-muted">
            O KYC começa como não iniciado. Ele trava o recebimento, não a produção —
            o criador pode assinar contrato e gravar antes de concluí-lo.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-soft shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ background: "var(--color-teal-500)" }}
          >
            {add.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

