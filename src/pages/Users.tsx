import { useMemo, useState } from "react"
import { Plus, Trash2, Copy, X, Mail, AlertCircle, Loader2, Check, Tag, Send } from "lucide-react"
import { notifyError, notifySuccess } from "@/lib/feedback"
import { useConfirm } from "@/features/confirm/context"
import { useAuth } from "@/features/auth/context"
import { SelectField } from "@/components/ui/select-field"
import { TabPill } from "@/components/ui/tab-pill"
import { stagger } from "@/lib/motion"
import { EmptyBlock } from "@/components/ui/empty-block"
import {
  useMembers, useInvites, useTeamMutations,
  type TenantRole, type TenantMember, type PendingInvite, type EmailDeliveryStatus,
} from "@/lib/api/tenants"
import { useTenantBrands } from "@/lib/api/brands"
import { monitoredBrands } from "@/lib/brands"

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
    // Gatilho compacto (cabe na célula) e menu do app, não o do sistema.
    <span style={{ color: meta.color }}>
      <SelectField
        value={member.role}
        onChange={(v) => onChange(v as TenantRole)}
        disabled={pending}
        ariaLabel="Alterar papel do membro"
        className="data-[size=default]:h-7 px-2 text-[12px] font-semibold rounded-md border-border-soft hover:bg-tint disabled:opacity-50"
        options={ROLE_ORDER.map((r) => ({
          key: r,
          label: r,
          // Só quem é Owner promove a Owner.
          disabled: r === "Owner" && !isOwner,
        }))}
      />
    </span>
  )
}

export default function UsersPage() {
  const { user, role } = useAuth()
  const isAdmin = role === "Owner" || role === "Admin"
  const isOwner = role === "Owner"

  const members = useMembers()
  const invites = useInvites(isAdmin)
  const { removeMember, revokeInvite, resendInvite, changeMemberRole } = useTeamMutations()

  const [tab, setTab] = useState<Tab>("pessoas")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingBrands, setEditingBrands] = useState<TenantMember | null>(null)
  // Só é preenchido quando o reenvio NÃO conseguiu mandar o e-mail — aí o link
  // volta a ser o caminho principal e precisa aparecer pra ser copiado.
  const [resentLink, setResentLink] = useState<string | null>(null)
  const confirm = useConfirm()

  const memberList = useMemo(() => members.data ?? [], [members.data])
  const inviteList = useMemo(() => invites.data ?? [], [invites.data])

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of memberList) c[m.role] = (c[m.role] ?? 0) + 1
    return c
  }, [memberList])

  const handleRemove = async (m: TenantMember) => {
    const ok = await confirm({
      title: `Remover ${m.name || m.email} do workspace?`,
      description: "A pessoa perde o acesso a este workspace. Para voltar, precisa de um convite novo.",
      confirmLabel: "Remover",
      tone: "danger",
    })
    if (!ok) return
    removeMember.mutate(m.userId, {
      onSuccess: () => notifySuccess("Membro removido."),
      onError: (e) => notifyError(e, "Não foi possível remover."),
    })
  }

  const handleRoleChange = async (m: TenantMember, nextRole: TenantRole) => {
    if (nextRole === m.role) return
    const who = m.name || m.email
    const ok = await confirm({
      title: `Alterar o papel de ${who}?`,
      description: `${who} passa de ${m.role} para ${nextRole}. ${ROLE_META[nextRole].desc}`,
      confirmLabel: "Alterar papel",
    })
    if (!ok) return
    changeMemberRole.mutate(
      { userId: m.userId, role: nextRole },
      {
        onSuccess: () => notifySuccess("Papel atualizado."),
        onError: (e) => notifyError(e, "Não foi possível alterar o papel."),
      },
    )
  }

  const handleRevoke = (inv: PendingInvite) => {
    revokeInvite.mutate(inv.id, {
      onSuccess: () => notifySuccess("Convite revogado."),
      onError: (e) => notifyError(e, "Não foi possível revogar."),
    })
  }

  const handleResend = async (inv: PendingInvite) => {
    // O reenvio invalida o link anterior — quem já compartilhou o antigo à mão
    // precisa saber disso antes, não depois.
    const ok = await confirm({
      title: `Reenviar o convite para ${inv.email}?`,
      description: "Um link novo será gerado e o anterior deixará de funcionar.",
      confirmLabel: "Reenviar",
    })
    if (!ok) return

    resendInvite.mutate(inv.id, {
      onSuccess: (res) => {
        if (res.emailDelivery === "Sent") notifySuccess(`Convite reenviado para ${res.email}.`)
        else setResentLink(`${window.location.origin}/invite/${res.token}`)
      },
      onError: (e) => notifyError(e, "Não foi possível reenviar."),
    })
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "pessoas", label: "Pessoas", count: memberList.length },
    { key: "papeis", label: "Papéis", count: ROLE_ORDER.length },
    ...(isAdmin ? [{ key: "convites" as Tab, label: "Convites", count: inviteList.length }] : []),
  ]

  return (
    <div className="-m-6 min-h-[calc(100dvh-3.75rem)] flex flex-col" style={{ color: "var(--ink)" }}>
      {/* Hero */}
      <section className="px-8 pt-7 pb-6 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex-1 max-w-190 min-w-70">
            <div className="eyebrow mb-3">Gestão · Equipe</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
              Usuários
            </h1>
            {/* As contagens saíram daqui: as abas logo abaixo já dizem
                "Pessoas (5)" e "Convites (2)" — era o mesmo número duas vezes,
                a 60px de distância. */}
            <p className="text-[14.5px] leading-relaxed text-ink-muted mt-2.5 mb-0 max-w-150">
              Quem entra no workspace, com qual papel e sobre quais marcas.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-medium text-white transition-colors shrink-0 cursor-pointer"
              style={{ background: "var(--color-teal-500)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Convidar usuário
            </button>
          )}
        </div>
      </section>

      {/* Barra de trabalho: `TabPill` porque o conteúdo de cada aba é OUTRO —
          pessoas, papéis e convites são entidades diferentes, não recortes da
          mesma lista (aí seria `Segmented`). Gruda no topo porque a tabela rola. */}
      <section
        className="px-8 py-3 border-b border-border-soft flex items-center gap-1.5 flex-wrap sticky top-0 z-10"
        style={{ background: "var(--surface)" }}
      >
        {tabs.map((t) => (
          <TabPill
            key={t.key}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
            label={t.label}
            count={t.count}
          />
        ))}
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
                    <th className="text-left px-3 py-3 eyebrow font-semibold">Papel</th>
                    <th className="text-left px-3 py-3 eyebrow font-semibold">Marcas</th>
                    <th className="text-left px-3 py-3 eyebrow font-semibold">Entrou em</th>
                    <th className="px-8 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {memberList.map((m, i) => {
                    const isSelf = m.userId === user?.id
                    return (
                      <tr
                        key={m.membershipId}
                        className="border-b border-border-soft hover:bg-hover transition-colors z-rise"
                        style={stagger(Math.min(i, 12))}
                      >
                        <td className="px-8 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center font-display text-white text-[12px]"
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
                        <td className="px-3 py-3.5">
                          <RoleCell
                            member={m}
                            canEdit={isAdmin}
                            isOwner={isOwner}
                            isSelf={isSelf}
                            pending={changeMemberRole.isPending}
                            onChange={(next) => handleRoleChange(m, next)}
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <BrandsCell member={m} canEdit={isAdmin} onEdit={() => setEditingBrands(m)} />
                        </td>
                        <td className="px-3 py-3.5 font-mono-zoe text-ink-2">{fmtDate(m.joinedAt)}</td>
                        <td className="px-8 py-3.5 text-right">
                          {isAdmin && !isSelf && (
                            <button
                              onClick={() => handleRemove(m)}
                              disabled={removeMember.isPending}
                              title="Remover do workspace"
                              className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-neg transition-colors disabled:opacity-50"
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
        <section className="flex-1 p-7 bg-inset">
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
                  <div className="text-[12.5px] text-ink-2 leading-normal">{meta.desc}</div>
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
                  <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-tint text-ink-muted">
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
                    onClick={() => handleResend(inv)}
                    disabled={resendInvite.isPending}
                    className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Reenviar
                  </button>
                  <button
                    onClick={() => handleRevoke(inv)}
                    disabled={revokeInvite.isPending}
                    className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg text-ink-muted hover:text-neg transition-colors disabled:opacity-50"
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
      {resentLink && <ResentLinkModal link={resentLink} onClose={() => setResentLink(null)} />}
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
        <span key={b.brandId} className="chip text-[10.5px] max-w-30 truncate">{b.name}</span>
      ))}
      {extra > 0 && <span className="text-[11px] text-ink-muted">+{extra}</span>}
    </div>
  )

  if (!canEdit) return content

  return (
    <button
      onClick={onEdit}
      title="Editar marcas do membro"
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -ml-1.5 hover:bg-tint transition-colors"
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
  const brands = useMemo(() => monitoredBrands(brandsQuery.data?.items ?? []), [brandsQuery.data])

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
      // Atribuição antiga a marca arquivada faria a API recusar o conjunto todo.
      { userId: member.userId, brandIds: [...selected].filter((id) => brands.some((b) => b.brandId === id)) },
      {
        onSuccess: () => {
          notifySuccess("Marcas atualizadas.")
          onClose()
        },
        onError: (e) =>
          notifyError(e, "Não foi possível salvar."),
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
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
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-tint">
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
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-lg z-skeleton" />)}
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
                    className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-left hover:bg-hover transition-colors"
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
                      style={{ background: b.color ?? "var(--ink-muted-2)" }}
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
            <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-hover">
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
  const brands = useMemo(() => monitoredBrands(brandsQuery.data?.items ?? []), [brandsQuery.data])

  const inviteRoles = useMemo<TenantRole[]>(
    () => (isOwner ? ["Owner", ...BASE_INVITE_ROLES] : BASE_INVITE_ROLES),
    [isOwner],
  )

  const [email, setEmail] = useState("")
  const [role, setRole] = useState<TenantRole>("Viewer")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState("")
  const [link, setLink] = useState<string | null>(null)
  const [delivery, setDelivery] = useState<EmailDeliveryStatus>("Disabled")
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
          // O e-mail é o caminho normal (ADR-032), mas o link continua exposto:
          // é o que salva quando o provider está fora ou o ambiente não tem chave.
          // O escopo de marcas/mensagem foi persistido e é aplicado no aceite.
          setLink(`${window.location.origin}/invite/${res.token}`)
          setDelivery(res.emailDelivery)
          notifySuccess(res.emailDelivery === "Sent" ? "Convite enviado." : "Convite criado.")
        },
        onError: (e) =>
          notifyError(e, "Não foi possível criar o convite."),
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
      notifyError(null, "Não foi possível copiar.")
    }
  }

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
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
            <button onClick={onClose} className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-tint">
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
                {delivery === "Sent" ? "Convite enviado!" : "Convite criado!"}
              </h3>
              <p className="text-[13px] text-ink-muted mb-4 max-w-sm">
                {delivery === "Sent" ? (
                  <>
                    Enviamos um e-mail para <span className="font-mono-zoe">{email.trim()}</span>.
                    Se preferir, o link direto está abaixo — ele expira em 7 dias.
                  </>
                ) : (
                  <>
                    Compartilhe o link abaixo com <span className="font-mono-zoe">{email.trim()}</span> — ele expira em 7 dias.
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border-soft bg-inset">
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
              <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-hover">
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
                <div className="space-y-2">
                  {[0, 1].map((i) => <div key={i} className="h-10 rounded-lg z-skeleton" />)}
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
                          className="flex items-center gap-3 px-2.5 py-2 rounded-md text-left hover:bg-hover transition-colors"
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
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color ?? "var(--ink-muted-2)" }} />
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
              <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-hover">
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

// ── Link do reenvio ────────────────────────────────────────────────────────
// Aparece só quando o e-mail do reenvio não saiu (provider fora do ar ou ambiente
// sem chave). O convite existe; o que falta é entregar o link.

function ResentLinkModal({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      notifyError(null, "Não foi possível copiar.")
    }
  }

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border-soft shadow-2xl overflow-hidden"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Link do convite"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-4 flex items-start justify-between">
          <div>
            <div className="eyebrow mb-1.5">Gestão · Equipe</div>
            <h2 className="font-display m-0" style={{ fontSize: 22, color: "var(--ink)" }}>
              Convite renovado
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-tint"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-7 pb-7">
          <p className="text-[13px] text-ink-muted mb-4">
            O e-mail não pôde ser enviado agora, mas o convite foi renovado. Compartilhe o
            link abaixo — ele expira em 7 dias.
          </p>
          <div className="flex items-center gap-2 p-2 rounded-lg border border-border-soft bg-inset">
            <span className="flex-1 font-mono-zoe text-[12px] truncate" style={{ color: "var(--ink)" }}>
              {link}
            </span>
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
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-hover"
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Estados ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="px-8 py-6 space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-11 rounded z-skeleton" />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold text-midnight dark:text-ink mb-1">Não foi possível carregar</h3>
      <p className="text-sm text-ink-muted mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-hover transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
