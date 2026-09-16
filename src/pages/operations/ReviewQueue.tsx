import { useEffect, useRef, type ReactNode } from "react"
import { ChevronDown, X } from "lucide-react"
import { useFocusTrap } from "@/lib/useFocusTrap"

/*
 * Peças da fila de revisão, comuns a "Cortes por aprovar" e "Entregas publicadas". Largura e
 * teclado ficam em `queueNavigation.ts`.
 *
 * As duas telas eram diferentes para a mesma tarefa — uma pilha de cards com o player aberto,
 * uma grade com gaveta — e nenhuma escalava: com cinco itens a pessoa rolava várias telas para
 * achar o próximo. Aqui as duas viram lista compacta à esquerda e um item por vez à direita,
 * o mesmo mestre-detalhe de Campanhas.
 */

/**
 * Lista e detalhe. Largo: lado a lado, com o detalhe preso no alto enquanto a lista rola.
 * Estreito: a lista ocupa a tela e o detalhe abre por cima, como gaveta.
 */
export function QueueLayout({
  wide, list, detail, onCloseDetail, detailTitle, hint,
}: {
  wide: boolean
  list: ReactNode
  detail: ReactNode | null
  onCloseDetail: () => void
  detailTitle: string
  /** Rodapé da lista — os atalhos, só onde há teclado. */
  hint?: ReactNode
}) {
  // Só a gaveta do celular prende o foco; lado a lado, lista e detalhe convivem na página.
  const drawerRef = useFocusTrap<HTMLDivElement>(!wide && Boolean(detail))

  if (wide) {
    return (
      <div className="grid grid-cols-[minmax(300px,380px)_minmax(0,1fr)] gap-5 items-start">
        <div>
          <div
            className="rounded-xl border border-border-soft overflow-y-auto"
            style={{ background: "var(--surface)", maxHeight: "calc(100vh - 240px)" }}
          >
            {list}
          </div>
          {hint && <div className="text-[11px] text-ink-muted mt-2 px-1">{hint}</div>}
        </div>
        <div
          className="rounded-xl border border-border-soft sticky top-4 overflow-y-auto"
          style={{ background: "var(--surface)", maxHeight: "calc(100vh - 110px)" }}
        >
          {detail ?? <p className="text-[13px] text-ink-muted p-6 m-0">Escolha um item na lista.</p>}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-border-soft overflow-hidden" style={{ background: "var(--surface)" }}>
        {list}
      </div>
      {detail && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(11,15,26,.5)" }} onClick={onCloseDetail} />
          <div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] overflow-y-auto border-l border-border-soft"
            style={{ background: "var(--surface)" }}
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={detailTitle}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b border-border-soft"
              style={{ background: "var(--surface)" }}
            >
              <div className="eyebrow">{detailTitle}</div>
              <button onClick={onCloseDetail} className="text-ink-muted hover:opacity-70" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
            {detail}
          </div>
        </>
      )}
    </>
  )
}

/** Uma linha da fila: quem, de qual trabalho, em que estado e há quanto tempo espera. */
export function QueueRow({
  id, active, onSelect, thumb, title, subtitle, status, meta, alert,
}: {
  id: string
  active: boolean
  onSelect: (id: string) => void
  thumb?: ReactNode
  title: string
  subtitle: string
  status: ReactNode
  meta: string
  /** Aviso curto em vermelho — prazo vencido. */
  alert?: string | null
}) {
  const ref = useRef<HTMLButtonElement>(null)

  // Andar pelo teclado precisa trazer a linha para a vista, senão a seleção some da tela.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ block: "nearest" })
  }, [active])

  return (
    <button
      ref={ref}
      onClick={() => onSelect(id)}
      aria-current={active ? "true" : undefined}
      className="w-full flex items-center gap-3 px-3.5 py-3 text-left border-b border-border-soft last:border-b-0 transition-colors hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
      style={{
        background: active ? "var(--color-teal-50, #F0FDFB)" : undefined,
        borderLeft: `3px solid ${active ? "var(--color-teal-500)" : "transparent"}`,
      }}
    >
      {thumb && (
        <div className="w-16 h-9 rounded overflow-hidden shrink-0 relative bg-[#111827]">{thumb}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{title}</span>
          <span className="text-[10.5px] text-ink-muted shrink-0">{meta}</span>
        </div>
        <div className="text-[11.5px] text-ink-muted truncate">{subtitle}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {status}
          {alert && (
            <span className="text-[10.5px] font-semibold" style={{ color: "#DC2626" }}>{alert}</span>
          )}
        </div>
      </div>
    </button>
  )
}

/**
 * Cabeçalho de uma seção da fila: a campanha, quantos esperam decisão e quantos itens há. Recolhe e
 * abre; fica preso no alto enquanto a lista rola, para a pessoa não perder de qual campanha é a linha.
 */
export function QueueSection({
  label, count, pending, collapsed, onToggle,
}: {
  label: string
  count: number
  pending: number
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="w-full flex items-center gap-2 px-3.5 py-2 text-left border-b border-border-soft sticky top-0 z-[1]"
      style={{ background: "var(--bg, #F9FAFB)" }}
    >
      <ChevronDown
        className="w-3.5 h-3.5 text-ink-muted shrink-0 transition-transform"
        style={{ transform: collapsed ? "rotate(-90deg)" : undefined }}
      />
      <span className="text-[11.5px] font-semibold truncate flex-1" style={{ color: "var(--ink)" }}>{label}</span>
      {pending > 0 && (
        <span className="text-[10.5px] font-medium shrink-0" style={{ color: "#B45309" }}>
          {pending} {pending === 1 ? "esperando" : "esperando"}
        </span>
      )}
      <span className="text-[10.5px] font-mono-zoe text-ink-muted shrink-0">{count}</span>
    </button>
  )
}
