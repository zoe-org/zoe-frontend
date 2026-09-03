import { useAuth } from "@/features/auth/context"

// Perfil do usuário. Só leitura: editar nome ou e-mail exige endpoint que ainda não
// existe, e um campo editável que não salva é pior que um campo que se assume fixo.

function initials(name?: string | null, email?: string | null): string {
  const base = name?.trim() || email || "U"
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export function AccountPanel() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <Section title="Avatar">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-display text-[15px] shrink-0"
          style={{ background: "linear-gradient(135deg, #5DE0D4, #008F82)" }}
        >
          {initials(user?.name, user?.email)}
        </div>
      </Section>

      <Section title="Nome completo">
        <ReadOnlyValue value={user?.name ?? "—"} />
      </Section>

      <Section title="E-mail" hint="Usado para entrar e para receber avisos de cobrança.">
        <ReadOnlyValue value={user?.email ?? "—"} mono />
      </Section>
    </div>
  )
}

/**
 * Linha rótulo-à-esquerda / controle-à-direita, que é a gramática do diálogo inteiro.
 * Empilha em contêiner estreito — e a medida é do CONTÊINER, não da janela: dentro do
 * modal a viewport diz 1440px e a coluna tem 800.
 */
export function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="@container">
      <div className="flex flex-col gap-2 @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-6">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
            {title}
          </div>
          {hint && <div className="text-[12.5px] text-ink-muted mt-0.5 max-w-100">{hint}</div>}
        </div>
        <div className="shrink-0 @xl:max-w-[52%] w-full @xl:w-auto">{children}</div>
      </div>
    </div>
  )
}

export function ReadOnlyValue({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div
      className={`h-9 px-3 inline-flex items-center rounded-lg border border-border-soft text-[13px] w-full @xl:min-w-56 justify-end @xl:justify-start ${
        mono ? "font-mono-zoe" : ""
      }`}
      style={{ background: "var(--surface)", color: "var(--ink)" }}
    >
      <span className="truncate">{value}</span>
    </div>
  )
}
