import { useMemo, useState } from "react"
import { Sparkles, Check, Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/features/auth/context"
import { EmptyBlock } from "@/components/ui/empty-block"
import { useFeatureCatalog } from "@/lib/api/features"

type Tab = "perfil" | "addons" | "aparencia"

function initials(name?: string | null, email?: string | null): string {
  const base = name?.trim() || email || "U"
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export default function SettingsPage() {
  const { user, role, memberships, activeTenantId, hasFeature } = useAuth()
  const isAdmin = role === "Owner" || role === "Admin"

  const [tab, setTab] = useState<Tab>("perfil")

  const activeMembership = memberships.find((m) => m.tenantId === activeTenantId)

  const tabs: { key: Tab; label: string }[] = [
    { key: "perfil", label: "Perfil" },
    { key: "addons", label: "Add-ons" },
    { key: "aparencia", label: "Aparência" },
  ]

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      {/* Hero */}
      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="eyebrow mb-2.5">Conta · Configurações</div>
        <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>
          Meu perfil
        </h1>
        <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
          Gerencie seus dados, add-ons do workspace e preferências de aparência.
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
              </button>
            )
          })}
        </div>
      </section>

      <section className="p-7 bg-[#F9FAFB] dark:bg-[#0B0D18] min-h-[360px]">
        {tab === "perfil" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">
            {/* Dados pessoais (reais: nome + e-mail; edição exige backend, ainda não há) */}
            <div className="p-6 rounded-[14px] border border-border-soft" style={{ background: "var(--surface)" }}>
              <div className="eyebrow mb-4">Dados pessoais</div>
              <div className="flex items-center gap-4 mb-5">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-display text-[20px]"
                  style={{ background: "linear-gradient(135deg, #5DE0D4, #008F82)" }}
                >
                  {initials(user?.name, user?.email)}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                    {user?.name ?? "—"}
                  </div>
                  <div className="font-mono-zoe text-[12px] text-ink-muted truncate">{user?.email}</div>
                </div>
              </div>
              <Field label="Nome" value={user?.name ?? "—"} />
              <Field label="E-mail" value={user?.email ?? "—"} mono />
            </div>

            {/* Workspace (real) */}
            <div className="p-6 rounded-[14px] border border-border-soft" style={{ background: "var(--surface)" }}>
              <div className="eyebrow mb-4">Workspace</div>
              <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                {activeMembership?.tenantName ?? "—"}
              </div>
              <div className="h-px bg-border-soft my-3.5" />
              <Row label="Seu papel" value={role ?? "—"} />
              <Row label="Workspaces" value={`${memberships.length}`} />
            </div>
          </div>
        )}

        {tab === "addons" && <AddOnsTab isAdmin={isAdmin} hasFeature={hasFeature} />}

        {tab === "aparencia" && <AppearanceTab />}
      </section>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mb-3.5">
      <label className="block text-[11.5px] text-ink-muted font-medium mb-1">{label}</label>
      <div
        className={`w-full px-3 py-2 text-[13px] rounded-lg border border-border-soft bg-[#FAFBFC] dark:bg-[#181B28] ${mono ? "font-mono-zoe" : ""}`}
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px] mb-2">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono-zoe" style={{ color: "var(--ink)" }}>{value}</span>
    </div>
  )
}

// ── Add-ons ────────────────────────────────────────────────────────────────

function AddOnsTab({ isAdmin, hasFeature }: { isAdmin: boolean; hasFeature: (code: string) => boolean }) {
  const catalog = useFeatureCatalog()

  const addons = useMemo(
    () => (catalog.data ?? []).filter((f) => f.kind === "SubscriptionAddOn"),
    [catalog.data],
  )

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <div className="eyebrow mb-1.5">Complementos</div>
        <h2 className="font-display m-0" style={{ fontSize: 22, color: "var(--ink)" }}>
          Add-ons do workspace
        </h2>
        <p className="text-[13.5px] text-ink-muted mt-1.5 max-w-xl">
          O que está ativo vem do seu plano. Para incluir ou remover um add-on, mude a
          assinatura — a alteração reflete aqui em seguida.
        </p>
      </div>

      {catalog.isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1].map((i) => <div key={i} className="h-20 rounded-[14px] bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
        </div>
      ) : addons.length === 0 ? (
        <EmptyBlock message="Nenhum add-on disponível no catálogo." />
      ) : (
        <div className="rounded-[14px] border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
          {addons.map((f, i) => {
            const active = hasFeature(f.code)
            return (
              <div
                key={f.code}
                className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-border-soft" : ""}`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: active ? "var(--color-teal-50)" : "#F3F4F6" }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: active ? "var(--color-teal-500)" : "#9AA1AE" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{f.name}</span>
                    {active && <span className="chip chip-pos text-[10px]">ativo</span>}
                  </div>
                  <div className="text-[12.5px] text-ink-muted mt-0.5">{f.description}</div>
                </div>
                <span className="text-[12px] text-ink-muted-2">{active ? "no plano" : "fora do plano"}</span>
              </div>
            )
          })}
        </div>
      )}

      {isAdmin && (
        <p className="text-[12px] text-ink-muted mt-3">
          Alterações de plano são feitas na cobrança do workspace.
        </p>
      )}
    </div>
  )
}

// ── Aparência ──────────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const options = [
    { id: "light", label: "Claro", Icon: Sun },
    { id: "dark", label: "Escuro", Icon: Moon },
    { id: "system", label: "Sistema", Icon: Monitor },
  ] as const

  return (
    <div className="max-w-3xl">
      <div className="p-6 rounded-[14px] border border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="eyebrow mb-4">Tema</div>
        <div className="grid grid-cols-3 gap-3">
          {options.map(({ id, label, Icon }) => {
            const active = (theme ?? "system") === id
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className="p-4 rounded-xl text-left transition-colors"
                style={{
                  border: `2px solid ${active ? "var(--color-teal-500)" : "var(--border-soft)"}`,
                  background: "var(--surface)",
                }}
              >
                <Icon className="w-5 h-5 mb-3" style={{ color: active ? "var(--color-teal-500)" : "var(--ink-muted)" }} />
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{label}</span>
                  {active && <Check className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />}
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-[12px] text-ink-muted mt-4">
          "Sistema" acompanha a preferência do seu dispositivo.
        </p>
      </div>
    </div>
  )
}
