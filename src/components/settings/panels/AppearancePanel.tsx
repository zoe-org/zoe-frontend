import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function AppearancePanel() {
  const { theme, setTheme } = useTheme()
  const options = [
    { id: "system", label: "Sistema", hint: "Acompanha o seu dispositivo", Icon: Monitor },
    { id: "light", label: "Claro", hint: "Sempre no tema claro", Icon: Sun },
    { id: "dark", label: "Escuro", hint: "Sempre no tema escuro", Icon: Moon },
  ] as const

  return (
    <div className="@container">
      <div className="text-[13.5px] font-medium mb-1" style={{ color: "var(--ink)" }}>
        Tema
      </div>
      <div className="text-[12.5px] text-ink-muted mb-3">
        Vale para este navegador, não para a sua conta.
      </div>

      <div className="grid gap-3 @lg:grid-cols-3">
        {options.map(({ id, label, hint, Icon }) => {
          const active = (theme ?? "system") === id
          return (
            <button
              key={id}
              onClick={() => setTheme(id)}
              aria-pressed={active}
              className="p-4 rounded-xl text-left transition-colors"
              style={{
                border: `1.5px solid ${active ? "var(--color-teal-500)" : "var(--border-soft)"}`,
                background: active ? "var(--color-teal-50)" : "var(--surface)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon
                  className="w-[18px] h-[18px]"
                  style={{ color: active ? "var(--color-teal-500)" : "var(--ink-muted)" }}
                />
                {active && <Check className="w-4 h-4" style={{ color: "var(--color-teal-500)" }} />}
              </div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{label}</div>
              <div className="text-[11.5px] text-ink-muted mt-0.5">{hint}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
