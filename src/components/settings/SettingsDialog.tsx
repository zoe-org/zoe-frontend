import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { Dialog } from "radix-ui"
import { Building2, CreditCard, Gauge, Palette, Sparkles, User, X } from "lucide-react"
import { AccountPanel } from "./panels/AccountPanel"
import { AddOnsPanel } from "./panels/AddOnsPanel"
import { AppearancePanel } from "./panels/AppearancePanel"
import { WorkspacePanel } from "./panels/WorkspacePanel"
import { PlanPanel } from "./panels/PlanPanel"
import { UsagePanel } from "./panels/UsagePanel"

/**
 * Configurações da conta e do workspace num diálogo só.
 *
 * Por que diálogo e não página: Plano e Consumo saíram de "Gestão", que é o menu do
 * trabalho do dia — marcas, relatórios, usuários. Contrato e fatura não são trabalho
 * diário: são conferidos de vez em quando, quase sempre no meio de outra coisa. O
 * diálogo devolve o usuário exatamente onde ele estava.
 *
 * Estado na URL (`?settings=<seção>`), não em useState: assim o link do banner de
 * teste abre direto em Plano, o botão voltar do navegador fecha, e a rota de trás
 * continua montada atrás do overlay.
 */

export const SETTINGS_PARAM = "settings"

export type SectionKey = "perfil" | "aparencia" | "workspace" | "plano" | "consumo" | "addons"

type Section = {
  key: SectionKey
  label: string
  group: "Conta" | "Workspace"
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const SECTIONS: Section[] = [
  {
    key: "perfil",
    label: "Perfil",
    group: "Conta",
    icon: User,
    title: "Perfil",
    description: "Seus dados de acesso. Valem para todos os workspaces.",
  },
  {
    key: "aparencia",
    label: "Aparência",
    group: "Conta",
    icon: Palette,
    title: "Aparência",
    description: "Como a Zoe se apresenta neste navegador.",
  },
  {
    key: "workspace",
    label: "Geral",
    group: "Workspace",
    icon: Building2,
    title: "Workspace",
    description: "O workspace ativo, seu papel nele e a troca entre os seus.",
  },
  {
    key: "plano",
    label: "Plano",
    group: "Workspace",
    icon: CreditCard,
    title: "Plano e faturamento",
    description:
      "Cada plano dá uma cota de vídeo-minutos por mês. Trocas entram com proração na próxima fatura.",
  },
  {
    key: "consumo",
    label: "Consumo",
    group: "Workspace",
    icon: Gauge,
    title: "Consumo",
    description:
      "O que foi processado neste período de cobrança, de onde veio e quanto ainda cabe na cota.",
  },
  {
    key: "addons",
    label: "Add-ons",
    group: "Workspace",
    icon: Sparkles,
    title: "Add-ons",
    description: "Complementos contratados junto com o plano.",
  },
]

const DEFAULT_SECTION: SectionKey = "perfil"

const GROUP_ORDER: Section["group"][] = ["Conta", "Workspace"]

function isSection(v: string | null): v is SectionKey {
  return SECTIONS.some((s) => s.key === v)
}

export function SettingsDialog() {
  const [params, setParams] = useSearchParams()
  const raw = params.get(SETTINGS_PARAM)
  const open = raw !== null
  // Valor inválido na URL não é erro do usuário: cai na primeira seção em vez de
  // abrir um diálogo vazio.
  const activeKey: SectionKey = isSection(raw) ? raw : DEFAULT_SECTION

  const close = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(SETTINGS_PARAM)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  const goTo = useCallback(
    (key: SectionKey) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(SETTINGS_PARAM, key)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const groups = useMemo(
    () => GROUP_ORDER.map((g) => ({ group: g, items: SECTIONS.filter((s) => s.group === g) })),
    [],
  )

  const active = SECTIONS.find((s) => s.key === activeKey)!

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) close() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 flex w-[min(1120px,calc(100vw-2rem))] h-[min(760px,calc(100dvh-3rem))] overflow-hidden rounded-[18px] border border-border-soft shadow-2xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0"
          style={{ background: "var(--surface)", color: "var(--ink)" }}
        >
          <Dialog.Title className="sr-only">Configurações</Dialog.Title>
          <Dialog.Description className="sr-only">{active.description}</Dialog.Description>

          <Rail groups={groups} activeKey={activeKey} onSelect={goTo} />

          <div className="flex-1 min-w-0 flex flex-col">
            <header className="shrink-0 flex items-start gap-4 px-5 pt-6 pb-4 sm:px-8 sm:pt-7 sm:pb-5 border-b border-border-soft">
              <div className="min-w-0 flex-1">
                <h2 className="font-display m-0" style={{ fontSize: 22, lineHeight: 1.2, color: "var(--ink)" }}>
                  {active.title}
                </h2>
                <p className="text-[13px] text-ink-muted mt-1.5 max-w-165 leading-relaxed">
                  {active.description}
                </p>
              </div>
              <Dialog.Close
                aria-label="Fechar configurações"
                className="shrink-0 -mt-1 -mr-2 p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors"
              >
                <X className="w-[18px] h-[18px]" />
              </Dialog.Close>
            </header>

            {/* Sem o rail lateral a navegação teria sumido junto: em tela estreita o
                usuário ficaria preso na seção em que abriu. */}
            <TabStrip activeKey={activeKey} onSelect={goTo} />

            {/* A `key` remonta o painel ao trocar de seção: sem ela o scroll da seção
                anterior fica herdado e a próxima abre no meio. */}
            <div key={activeKey} className="flex-1 min-h-0 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">
              <Panel section={activeKey} onClose={close} onGoTo={goTo} />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Rail({
  groups,
  activeKey,
  onSelect,
}: {
  groups: { group: string; items: Section[] }[]
  activeKey: SectionKey
  onSelect: (key: SectionKey) => void
}) {
  return (
    <nav
      className="hidden sm:flex w-56 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border-soft px-3 py-6"
      aria-label="Seções de configurações"
    >
      {groups.map(({ group, items }) => (
        <div key={group}>
          <div className="eyebrow px-3 mb-1.5">{group}</div>
          <div className="flex flex-col gap-0.5">
            {items.map(({ key, label, icon: Icon }) => {
              const active = key === activeKey
              return (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] font-medium text-left transition-colors ${
                    active ? "" : "text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D]"
                  }`}
                  style={active ? { background: "var(--teal-bg)", color: "var(--teal-fg)" } : undefined}
                >
                  <Icon className="w-[15px] h-[15px] shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

/** Navegação de tela estreita: o rail vira uma faixa rolável logo abaixo do título. */
function TabStrip({
  activeKey,
  onSelect,
}: {
  activeKey: SectionKey
  onSelect: (key: SectionKey) => void
}) {
  return (
    <div className="sm:hidden shrink-0 border-b border-border-soft overflow-x-auto">
      <div className="flex items-center gap-1 px-5 py-2.5 w-max">
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const active = key === activeKey
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                active ? "" : "text-ink-muted"
              }`}
              style={active ? { background: "var(--teal-bg)", color: "var(--teal-fg)" } : undefined}
            >
              <Icon className="w-[14px] h-[14px] shrink-0" />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Panel({
  section,
  onClose,
  onGoTo,
}: {
  section: SectionKey
  onClose: () => void
  onGoTo: (key: SectionKey) => void
}) {
  switch (section) {
    case "perfil":
      return <AccountPanel />
    case "aparencia":
      return <AppearancePanel />
    case "workspace":
      return <WorkspacePanel onNavigate={onClose} />
    case "plano":
      return <PlanPanel />
    case "consumo":
      return <UsagePanel />
    case "addons":
      return <AddOnsPanel onGoToPlan={() => onGoTo("plano")} />
  }
}
