import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, Bell, Info, TrendingDown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAlertEvents, useMarkAlertRead, useMarkAllAlertsRead, type AlertEvent } from "@/lib/api/alerts"
import { describeAlertEvent } from "@/lib/alerts"

/**
 * Sino do topbar.
 *
 * <p><b>Popover, não DropdownMenu.</b> O painel não é um menu de comandos, e o
 * `DropdownMenuContent` do repo trava a largura em
 * `w-(--radix-dropdown-menu-trigger-width)` — a largura do GATILHO. Com um gatilho
 * de 32px o painel abria com 32px e parecia não abrir.</p>
 *
 * <p><b>O painel diz ALERTAS, não "notificações".</b> A camada de notificação da
 * ADR-037 — com destinatário próprio, canal e template — é construção da Etapa 8, e
 * alerta é o único produtor de aviso legível hoje. Chamar de "notificações" o que é
 * uma fonte só promete o que a tela não entrega: quem não recebesse o aviso de cota
 * concluiria que ele não existe, quando ele existe e sai por e-mail.</p>
 *
 * <p>Quando a camada existir, mudam a origem dos itens e o rótulo. A forma da lista,
 * o estado de leitura e o comportamento do ponto ficam.</p>
 *
 * <p><b>Só o painel, sem página.</b> A tela cheia do design seria uma segunda lista
 * do mesmo dado que a página de Alertas já mostra, com filtros próprios e um segundo
 * lugar para "marcar como lido" divergir.</p>
 */
export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  // `unreadOnly: false` de propósito: o dropdown mostra as mais recentes, lidas
  // inclusive. Uma lista que esvazia ao ser lida esconde o que acabou de acontecer.
  const events = useAlertEvents({ brandId: null, unreadOnly: false })
  const markRead = useMarkAlertRead()
  const markAll = useMarkAllAlertsRead()

  const page = events.data?.pages[0]
  const unread = page?.unreadCount ?? 0
  const recent = (page?.items ?? []).slice(0, 5)

  const abrir = (e: AlertEvent) => {
    if (!e.isRead) markRead.mutate(e.id)
    setOpen(false)
    navigate("/alerts")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={unread > 0 ? `Alertas — ${unread} não lidos` : "Alertas"}
          className="relative text-[#6B7280] p-2 rounded-md hover:text-ink hover:bg-muted dark:hover:text-[#E6E8EF] transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {/* O ponto só existe quando há algo não lido. Antes era fixo no markup:
              um indicador que nunca apaga deixa de ser lido como indicador. */}
          {unread > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full border-[1.5px]"
              style={{ background: "var(--color-neg)", borderColor: "var(--surface)" }}
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] max-w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden rounded-[14px] border border-border-soft"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-soft">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>
              Alertas
            </span>
            {unread > 0 && (
              <span
                className="text-[10.5px] font-semibold rounded-full px-2 py-0.5"
                style={{ background: "var(--teal-bg)", color: "var(--teal-fg)" }}
              >
                {unread} {unread === 1 ? "novo" : "novos"}
              </span>
            )}
          </div>
          <button
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            title="Marca como lido só para você. O badge dos colegas não muda."
            className="text-[11.5px] font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-500 transition-colors disabled:opacity-40"
          >
            Marcar tudo como lido
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {events.isLoading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-11 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12.5px] text-ink-muted">
              Nenhum alerta disparado ainda.
            </div>
          ) : (
            recent.map((e) => <NotificationRow key={e.id} event={e} onOpen={() => abrir(e)} />)
          )}
        </div>

        <button
          onClick={() => { setOpen(false); navigate("/alerts") }}
          className="w-full py-3 text-[12.5px] font-semibold text-teal-700 dark:text-teal-300 border-t border-border-soft bg-[#FAFBFC] dark:bg-[#151824] hover:text-teal-500 transition-colors"
        >
          Ver todos os alertas →
        </button>
      </PopoverContent>
    </Popover>
  )
}

/** Tom por severidade — o mesmo vocabulário da tela de Alertas, não um segundo. */
const TONE = {
  Critical: { color: "var(--color-neg)", Icon: TrendingDown },
  Warning: { color: "var(--color-warn)", Icon: AlertTriangle },
  Info: { color: "var(--color-teal-500)", Icon: Info },
} as const

function NotificationRow({ event, onOpen }: { event: AlertEvent; onOpen: () => void }) {
  const tone = TONE[event.severity as keyof typeof TONE] ?? TONE.Info
  const { Icon } = tone

  return (
    <button
      onClick={onOpen}
      className="w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border-soft transition-colors hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
      // Não lida recebe fundo: é o que faz a lista ser varrível sem ler tudo.
      style={event.isRead ? undefined : { background: "var(--teal-bg)" }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${tone.color} 12%, transparent)` }}
      >
        <Icon className="w-[15px] h-[15px]" style={{ color: tone.color }} />
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`text-[12.5px] truncate ${event.isRead ? "font-medium" : "font-bold"}`}
            style={{ color: "var(--ink)" }}
          >
            {event.ruleName}
          </span>
          <span className="font-mono-zoe text-[10.5px] text-ink-muted-2 shrink-0">
            {formatDistanceToNow(new Date(event.triggeredAt), { addSuffix: true, locale: ptBR })}
          </span>
        </span>
        <span className="block text-[11.5px] text-ink-muted mt-0.5 leading-snug line-clamp-2">
          {describeAlertEvent(event)}
        </span>
        <span className="block text-[10.5px] text-ink-muted-2 mt-1">{event.brandName}</span>
      </span>

      {!event.isRead && (
        <span
          className="w-[7px] h-[7px] rounded-full shrink-0 mt-1.5"
          style={{ background: "var(--color-teal-500)" }}
        />
      )}
    </button>
  )
}
