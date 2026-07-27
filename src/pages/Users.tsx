import { useMemo, useState } from "react"
import { Plus, Trash2, Copy, X, Mail, AlertCircle, Loader2, Check, Tag } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/context"
import { ApiError } from "@/lib/api"
import { EmptyBlock } from "@/components/ui/empty-block"
import {
  useMembers, useInvites, useTeamMutations,
  type TenantRole, type TenantMember, type PendingInvite,
} from "@/lib/api/tenants"
import { useTenantBrands } from "@/lib/api/brands"

type Tab = "pessoas" | "papeis" | "convites"

// Papéis reais do sistema (TenantRole), com cor e descrição do escopo. Não é dado
// de tenant — é a legenda dos papéis que existem.
const ROLE_META: Record<TenantRole, { color: string; desc: string }> = {
  Owner: { color: "#00A799", desc: "Controle total do workspace e faturamento. Não pode ser removido se for o último." },
  Admin: { color: "#DC2626", desc: "Gerencia usuários, convites e configurações de marcas e alertas." },
  Manager: { color: "#2563EB", desc: "Cria e edita conteúdo, gera relatórios e configura monitoramento." },
  Viewer: { color: "#6B7280", desc: "Acesso somente leitura a dashboards e relatórios." },
}
const ROLE_ORDER: TenantRole[] = ["Owner", "Admin", "Manager", "Viewer"]

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })

function expiryLabel(iso: string, expired: boolean): string {
  if (expired) return "expirado"
  const days = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000))
  return days <= 0 ? "expira hoje" : `expira em ${days} ${days === 1 ? "dia" : "dias"}`
}

function initials(name: string, email: string): string {
  const base = name?.trim() || email
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function RoleChip({ role }: { role: string }) {
  const meta = ROLE_META[role as TenantRole] ?? ROLE_META.Viewer
  return (
    <span
      className="font-semibold"
      style={{
        fontSize: 12, padding: "3px 10px", borderRadius: 6,
        background: `${meta.color}15`, color: meta.color,
      }}
    >
      {role}
    </span>
  )
}

// Papel editável (Admin/Owner). Só Owner pode conceder/alterar o papel Owner —
// então a opção Owner fica desabilitada para Admins, e um membro que já é Owner
// vira somente-leitura para quem não é Owner (o backend também recusa).
function RoleCell({
  member, canEdit, isOwner, isSelf, pending, onChange,
}: {
  member: TenantMember
  canEdit: boolean
  isOwner: boolean
  isSelf: boolean
  pending: boolean
  onChange: (role: TenantRole) => void
}) {
  const readOnly = !canEdit || isSelf || (member.role === "Owner" && !isOwner)
  if (readOnly) return <RoleChip role={member.role} />

  const meta = ROLE_META[member.role]
  return (
    <select
      value={member.role}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as TenantRole)}
      title="Alterar papel do membro"
      className="font-semibold cursor-pointer rounded-md border border-border-soft bg-transparent outline-none focus:border-teal-500 disabled:opacity-50 hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors"
      style={{ fontSize: 12, padding: "3px 8px", color: meta.color }}
    >
      {ROLE_ORDER.map((r) => (
        <option key={r} value={r} disabled={r === "Owner" && !isOwner} style={{ color: "var(--ink)" }}>
          {r}
        </option>
      ))}
    </select>
  )
}

export default function UsersPage() {
  const { user, role } = useAuth()
  const isAdmin = role === "Owner" || role === "Admin"
  const isOwner = role === "Owner"

  const members = useMembers()
  const invites = useInvites(isAdmin)
  const { removeMember, revokeInvite, changeMemberRole } = useTeamMutations()

  const [tab, setTab] = useState<Tab>("pessoas")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingBrands, setEditingBrands] = useState<TenantMember | null>(null)

  const memberList = useMemo(() => members.data ?? [], [members.data])
  const inviteList = useMemo(() => invites.data ?? [], [invites.data])

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of memberList) c[m.role] = (c[m.role] ?? 0) + 1
    return c
  }, [memberList])

  const handleRemove = (m: TenantMember) => {
    if (!window.confirm(`Remover ${m.name || m.email} do workspace?`)) return
    removeMember.mutate(m.userId, {
      onSuccess: () => toast.success("Membro removido."),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível remover."),
    })
  }

  const handleRoleChange = (m: TenantMember, nextRole: TenantRole) => {
    if (nextRole === m.role) return
    const who = m.name || m.email
    if (!window.confirm(`Alterar o papel de ${who} para ${nextRole}?`)) return
    changeMemberRole.mutate(
      { userId: m.userId, role: nextRole },
      {
        onSuccess: () => toast.success("Papel atualizado."),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível alterar o papel."),
      },
    )
  }

  const handleRevoke = (inv: PendingInvite) => {
    revokeInvite.mutate(inv.id, {
      onSuccess: () => toast.success("Convite revogado."),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Não foi possível revogar."),
    })
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "pessoas", label: "Pessoas", count: memberList.length },
    { key: "papeis", label: "Papéis", count: ROLE_ORDER.length },
    ...(isAdmin ? [{ key: "convites" as Tab, label: "Convites", count: inviteList.length }] : []),
  ]

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      {/* Hero */}
      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="eyebrow mb-2.5">Gestão · Equipe</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Usuários
            </h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>
                {memberList.length} {memberList.length === 1 ? "pessoa" : "pessoas"}
              </span>{" "}
              com acesso a este workspace
              {isAdmin && inviteList.length > 0 && (
                <> · <span className="font-mono-zoe">{inviteList.length}</span> {inviteList.length === 1 ? "convite pendente" : "convites pendentes"}</>
              )}.
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Convidar usuário
            </button>
          )}
        </div>
      </section>

      {/* Tabs */}
      <section className="px-6 py-3.5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-center gap-1">
          {tabs.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                  active ? "text-white" : "text-ink-muted hover:text-ink"
                }`}
                style={active ? { background: "var(--color-teal-500)" } : undefined}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="ml-1.5 font-medium" style={{ opacity: active ? 0.85 : 0.6 }}>
                    ({t.count})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Conteúdo */}
      {tab === "pessoas" && (
        <section style={{ background: "var(--surface)" }}>
          {members.isLoading ? (
            <TableSkeleton />
          ) : members.isError ? (
            <ErrorState onRetry={() => members.refetch()} />
          ) : memberList.length === 0 ? (
            <EmptyBlock className="py-16" message="Nenhum membro neste workspace" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border-soft">
                    <th className="text-left px-8 py-3 eyebrow font-semibold">Nome</th>
                    <th className="text-left py-3 eyebrow font-semibold">Papel</th>
                    <th className="text-left py-3 eyebrow font-semibold">Marcas</th>
                    <th className="text-left py-3 eyebrow font-semibold">Entrou em</th>
                    <th className="px-8 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {memberList.map((m, i) => {
                    const isSelf = m.userId === user?.id
                    return (
                      <tr key={m.membershipId} className="border-b border-border-soft hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors">
                        <td className="px-8 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-display text-white text-[12px]"
                              style={{ background: `hsl(${i * 47 + 200}, 45%, 60%)` }}
                            >
                              {initials(m.name, m.email)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium flex items-center gap-2" style={{ color: "var(--ink)" }}>
                                {m.name || "—"}
                                {isSelf && <span className="chip text-[10px]">você</span>}
                              </div>
                              <div className="font-mono-zoe text-[11.5px] text-ink-muted truncate">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <RoleCell
                            member={m}
                            canEdit={isAdmin}
                            isOwner={isOwner}
                            isSelf={isSelf}
                            pending={changeMemberRole.isPending}
                            onChange={(next) => handleRoleChange(m, next)}
                          />
                        </td>
                        <td className="py-3.5">
                          <BrandsCell member={m} canEdit={isAdmin} onEdit={() => setEditingBrands(m)} />
                        </td>
                        <td className="py-3.5 font-mono-zoe text-ink-2">{fmtDate(m.joinedAt)}</td>
                        <td className="px-8 py-3.5 text-right">
                          {isAdmin && !isSelf && (
                            <button
                              onClick={() => handleRemove(m)}
                              disabled={removeMember.isPending}
                              title="Remover do workspace"
                              className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-[var(--color-neg)] transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remover
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "papeis" && (
        <section className="p-7 bg-[#F9FAFB] dark:bg-[#0B0D18]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROLE_ORDER.map((r) => {
              const meta = ROLE_META[r]
              const count = roleCounts[r] ?? 0
              return (
                <div key={r} className="p-5 rounded-[14px] border border-border-soft" style={{ background: "var(--surface)" }}>
                  <div className="text-[16px] font-bold" style={{ color: meta.color }}>{r}</div>
                  <div className="font-mono-zoe text-[11px] text-ink-muted mt-0.5">
                    {count} {count === 1 ? "usuário" : "usuários"}
                  </div>
                  <div className="h-px bg-border-soft my-3.5" />
                  <div className="text-[12.5px] text-ink-2 leading-[1.5]">{meta.desc}</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {tab === "convites" && isAdmin && (
        <section style={{ background: "var(--surface)" }}>
          {invites.isLoading ? (
            <TableSkeleton />
          ) : invites.isError ? (
            <ErrorState onRetry={() => invites.refetch()} />
          ) : inviteList.length === 0 ? (
            <EmptyBlock
              className="py-16"
              icon={<Mail className="w-9 h-9" strokeWidth={1.5} />}
              message="Nenhum convite pendente"
              hint='Use "Convidar usuário" para adicionar alguém ao workspace.'
            />
          ) : (
            <div>
              {inviteList.map((inv) => (
                <div key={inv.id} className="flex items-center gap-4 px-8 py-4 border-b border-border-soft">
                  <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-[#F3F4F6] dark:bg-[#1A1D2D] text-ink-muted">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono-zoe text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{inv.email}</div>
                    <div className="text-[11.5px] text-ink-muted mt-0.5">
                      Convidado por {inv.invitedByName || "—"} · {fmtDate(inv.createdAt)} ·{" "}
                      <span style={inv.expired ? { color: "var(--color-neg)" } : undefined}>
                        {expiryLabel(inv.expiresAt, inv.expired)}
                      </span>
                    </div>
                  </div>
                  <RoleChip role={inv.role} />
                  <button
                    onClick={() => handleRevoke(inv)}
                    disabled={revokeInvite.isPending}
                    className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg text-ink-muted hover:text-[var(--color-neg)] transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Revogar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {inviteOpen && <InviteModal isOwner={isOwner} onClose={() => setInviteOpen(false)} />}
      {editingBrands && (
        <AssignBrandsModal member={editingBrands} onClose={() => setEditingBrands(null)} />
      )}
    </div>
  )
}

// ── Coluna Marcas ──────────────────────────────────────────────────────────

function BrandsCell({ member, canEdit, onEdit }: { member: TenantMember; canEdit: boolean; onEdit: () => void }) {
  // Defensivo: uma API antiga (sem o campo) devolve brands undefined → trata como
  // "todas" em vez de quebrar a página.
  const assigned = member.brands ?? []
  const all = assigned.length === 0
  const shown = assigned.slice(0, 3)
  const extra = assigned.length - shown.length

  const content = all ? (
    // Sem escopo restrito = acesso a todas as marcas do workspace.
    <span className="chip chip-primary text-[10.5px]">Todas</span>
  ) : (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map((b) => (
        <span key={b.brandId} className="chip text-[10.5px] max-w-[120px] truncate">{b.name}</span>
      ))}
      {extra > 0 && <span className="text-[11px] text-ink-muted">+{extra}</span>}
    </div>
  )

  if (!canEdit) return content

  return (
    <button
      onClick={onEdit}
      title="Editar marcas do membro"
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -ml-1.5 hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors"
    >
      {content}
      <Tag className="w-3 h-3 text-ink-muted-2" />
    </button>
  )
}

// ── Modal de atribuição de marcas ──────────────────────────────────────────

function AssignBrandsModal({ member, onClose }: { member: TenantMember; onClose: () => void }) {
  const brandsQuery = useTenantBrands()
  const { setMemberBrands } = useTeamMutations()
  const brands = useMemo(() => brandsQuery.data?.items ?? [], [brandsQuery.data])

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((member.brands ?? []).map((b) => b.brandId)),
  )

  const toggle = (brandId: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(brandId)) next.delete(brandId)
      else next.add(brandId)
      return next
    })

  const save = () => {
    setMemberBrands.mutate(
      { userId: member.userId, brandIds: [...selected] },
      {
        onSuccess: () => {
          toast.success("Marcas atualizadas.")
          onClose()
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar."),
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
        aria-label="Marcas do membro"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <div className="eyebrow mb-1.5">Escopo de marcas</div>
            <h2 className="font-display m-0" style={{ fontSize: 22, color: "var(--ink)" }}>
              {member.name || member.email}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-2 shrink-0">
          <p className="text-[12.5px] text-ink-muted">
            {selected.size === 0
              ? "Nenhuma marca selecionada = acesso a todas as marcas do workspace."
              : `Restrito a ${selected.size} ${selected.size === 1 ? "marca" : "marcas"}.`}
          </p>
        </div>

        <div className="px-6 py-2 overflow-y-auto flex-1">
          {brandsQuery.isLoading ? (
            <div className="space-y-2 animate-pulse">
              {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-lg bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
            </div>
          ) : brands.length === 0 ? (
            <EmptyBlock className="py-8" message="Nenhuma marca assinada no workspace" />
          ) : (
            <div className="flex flex-col gap-1">
              {brands.map((b) => {
                const name = b.displayName ?? b.brandName
                const checked = selected.has(b.brandId)
                return (
                  <button
                    key={b.brandId}
                    onClick={() => toggle(b.brandId)}
                    className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-left hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
                  >
                    <span
                      className="w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        borderColor: checked ? "var(--color-teal-500)" : "var(--border-soft)",
                        background: checked ? "var(--color-teal-500)" : "transparent",
                      }}
                    >
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: b.color ?? "#9AA1AE" }}
                    />
                    <span className="text-[13px] flex-1 truncate" style={{ color: "var(--ink)" }}>{name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border-soft shrink-0">
          <button
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
            className="text-[12.5px] text-ink-muted hover:text-ink disabled:opacity-40"
          >
            Limpar (todas)
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={setMemberBrands.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--color-teal-500)" }}
            >
              {setMemberBrands.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de convite ─────────────────────────────────────────────────────

// Owner só pode ser concedido por um Owner (regra do backend) — a opção só aparece
// quando o autor é Owner. Ordem/rótulos do design.
const BASE_INVITE_ROLES: TenantRole[] = ["Admin", "Manager", "Viewer"]

function InviteModal({ isOwner, onClose }: { isOwner: boolean; onClose: () => void }) {
  const { createInvite } = useTeamMutations()
  const brandsQuery = useTenantBrands()
  const brands = useMemo(() => brandsQuery.data?.items ?? [], [brandsQuery.data])

  const inviteRoles = useMemo<TenantRole[]>(
    () => (isOwner ? ["Owner", ...BASE_INVITE_ROLES] : BASE_INVITE_ROLES),
    [isOwner],
  )

  const [email, setEmail] = useState("")
  const [role, setRole] = useState<TenantRole>("Viewer")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState("")
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const toggleBrand = (brandId: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(brandId)) next.delete(brandId)
      else next.add(brandId)
      return next
    })

  const submit = () => {
    if (!emailValid) return
    createInvite.mutate(
      {
        email: email.trim(),
        role,
        brandIds: [...selected],
        message: message.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          // Entrega é por link (sem envio de e-mail garantido no MVP); a rota
          // /invite/:token já existe. O escopo de marcas/mensagem foi persistido
          // no convite e é aplicado no aceite.
          setLink(`${window.location.origin}/invite/${res.token}`)
          toast.success("Convite criado.")
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : "Não foi possível criar o convite."),
      },
    )
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border-soft shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Convidar usuário"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (design: eyebrow "Gestão · Equipe" + título + subtítulo) */}
        <div className="px-7 pt-6 pb-4 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow mb-1.5">Gestão · Equipe</div>
              <h2 className="font-display m-0" style={{ fontSize: 24, color: "var(--ink)" }}>
                Convidar usuário
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D]">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
          {!link && (
            <p className="text-[13px] text-ink-muted mt-2">
              Compartilhe o link gerado — a pessoa define a senha ao aceitar o convite.
            </p>
          )}
        </div>

        {link ? (
          <div className="px-7 pb-7">
            <div className="flex flex-col items-center text-center py-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--pos-bg)" }}
              >
                <Check className="w-6 h-6" style={{ color: "var(--color-pos)" }} strokeWidth={2.5} />
              </div>
              <h3 className="font-display m-0 mb-1" style={{ fontSize: 18, color: "var(--ink)" }}>
                Convite criado!
              </h3>
              <p className="text-[13px] text-ink-muted mb-4 max-w-sm">
                Compartilhe o link abaixo com <span className="font-mono-zoe">{email.trim()}</span> — ele expira em 7 dias.
              </p>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border-soft bg-[#FAFBFC] dark:bg-[#181B28]">
              <span className="flex-1 font-mono-zoe text-[12px] truncate" style={{ color: "var(--ink)" }}>{link}</span>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-white shrink-0"
                style={{ background: "var(--color-teal-500)" }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]">
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-7 pb-5 overflow-y-auto flex-1">
              {/* E-mail */}
              <label className="block text-[13px] font-semibold text-ink-2 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                autoFocus
                className="w-full h-10 px-3 text-[13px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500 mb-5"
              />

              {/* Papel — botões (design) */}
              <label className="block text-[13px] font-semibold text-ink-2 mb-2">Papel</label>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${inviteRoles.length}, minmax(0, 1fr))` }}
              >
                {inviteRoles.map((r) => {
                  const meta = ROLE_META[r]
                  const active = role === r
                  return (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className="py-2.5 px-2 rounded-lg text-center transition-colors"
                      style={{
                        border: `1.5px solid ${active ? meta.color : "var(--border-soft)"}`,
                        background: active ? `${meta.color}14` : "transparent",
                      }}
                    >
                      <span className="text-[12.5px] font-bold" style={{ color: active ? meta.color : "var(--ink-2)" }}>
                        {r}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11.5px] text-ink-muted mt-2 leading-normal">{ROLE_META[role].desc}</p>

              {/* Acesso a marcas */}
              <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-2">Acesso a marcas</label>
              {brandsQuery.isLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[0, 1].map((i) => <div key={i} className="h-10 rounded-lg bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
                </div>
              ) : brands.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">Nenhuma marca assinada no workspace.</p>
              ) : (
                <>
                  <div className="flex flex-col gap-0.5 rounded-lg border border-border-soft p-1">
                    {brands.map((b) => {
                      const name = b.displayName ?? b.brandName
                      const checked = selected.has(b.brandId)
                      return (
                        <button
                          key={b.brandId}
                          onClick={() => toggleBrand(b.brandId)}
                          className="flex items-center gap-3 px-2.5 py-2 rounded-md text-left hover:bg-[#FAFBFC] dark:hover:bg-[#181B28] transition-colors"
                        >
                          <span
                            className="w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors"
                            style={{
                              borderColor: checked ? "var(--color-teal-500)" : "var(--border-soft)",
                              background: checked ? "var(--color-teal-500)" : "transparent",
                            }}
                          >
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color ?? "#9AA1AE" }} />
                          <span className="text-[13px] flex-1 truncate" style={{ color: "var(--ink)" }}>{name}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11.5px] text-ink-muted mt-1.5">
                    {selected.size === 0
                      ? "Nenhuma marca selecionada = acesso a todas as marcas."
                      : `Restrito a ${selected.size} ${selected.size === 1 ? "marca" : "marcas"}.`}
                  </p>
                </>
              )}

              {/* Mensagem pessoal (opcional) */}
              <label className="block text-[13px] font-semibold text-ink-2 mt-5 mb-1.5">
                Mensagem pessoal <span className="font-normal text-ink-muted">(opcional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Ex.: Bem-vinda ao time! Qualquer dúvida me chama."
                className="w-full px-3 py-2.5 text-[13px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500 resize-y"
              />
            </div>

            <div className="flex justify-between items-center gap-2 px-7 py-4 border-t border-border-soft shrink-0">
              <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D]">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={!emailValid || createInvite.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-teal-500)" }}
              >
                {createInvite.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Criar convite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Estados ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="px-8 py-6 space-y-3 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-11 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-[#DC2626] mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-[#6B7280] mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
