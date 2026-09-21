import type { ReactNode } from "react"
import { X } from "lucide-react"
import { useEscapeKey } from "@/lib/useEscapeKey"
import { useFocusTrap } from "@/lib/useFocusTrap"

const WIDTH = {
  sm: "max-w-md",
  md: "max-w-[560px]",
  lg: "max-w-[680px]",
} as const

/**
 * Diálogo centrado da plataforma.
 *
 * A casca estava copiada em seis lugares (campanhas, contratos, convite,
 * detalhe de campanha, regra de alerta) e as cópias divergiam em largura, raio,
 * tamanho do título e botão de fechar. Pior: em quase todas o rodapé rolava
 * junto com o corpo, então em formulário longo o botão de salvar saía da tela.
 * Aqui cabeçalho e rodapé são fixos e só o miolo rola.
 *
 * Traz também o que cada cópia lembrava ou esquecia por conta própria: `Esc`
 * fecha e o foco fica preso dentro enquanto está aberto.
 */
export function Modal({
  eyebrow, title, description, size = "md", onClose, footer, children,
}: {
  eyebrow?: ReactNode
  title: string
  /** Uma linha sob o título: o que a ação faz, ou o que ela NÃO faz. */
  description?: ReactNode
  size?: keyof typeof WIDTH
  onClose: () => void
  /** Rodapé fixo. Use `ModalFooter` para o formato padrão. */
  footer?: ReactNode
  children: ReactNode
}) {
  const ref = useFocusTrap<HTMLDivElement>()
  useEscapeKey(onClose)

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${WIDTH[size]} rounded-[20px] border border-border-soft shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-6 pt-5 pb-4 border-b border-border-soft shrink-0">
          <div className="flex-1 min-w-0">
            {eyebrow && <div className="eyebrow inline-flex items-center gap-1.5 mb-2">{eyebrow}</div>}
            <h2 className="font-display m-0" style={{ fontSize: 23, lineHeight: 1.1, color: "var(--ink)" }}>
              {title}
            </h2>
            {description && <p className="text-[13px] text-ink-muted mt-2 mb-0">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-[30px] h-[30px] rounded-full border border-border-soft flex items-center justify-center text-ink-muted hover:text-ink hover:bg-tint transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">
          {children}
        </div>

        {footer && (
          <div className="flex items-center gap-2.5 px-6 py-4 border-t border-border-soft shrink-0 bg-inset">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Rodapé padrão: a ressalva à esquerda, cancelar e a ação principal à direita.
 * A dica fica onde sobra espaço, e não empurrando o formulário para baixo.
 */
export function ModalFooter({
  hint, onCancel, cancelLabel = "Cancelar", submitLabel, onSubmit, pending, disabled, tone = "primary",
}: {
  hint?: ReactNode
  onCancel: () => void
  cancelLabel?: string
  submitLabel: string
  onSubmit: () => void
  pending?: boolean
  disabled?: boolean
  /** `danger` em ação destrutiva — excluir contrato, cancelar custódia. */
  tone?: "primary" | "danger"
}) {
  return (
    <>
      {hint && <span className="flex-1 text-[11.5px] text-ink-muted">{hint}</span>}
      <button
        type="button"
        onClick={onCancel}
        className={`h-9 px-4 rounded-lg border border-border-soft text-[13px] font-medium text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer ${hint ? "" : "ml-auto"}`}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || disabled}
        className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
        style={{ background: tone === "danger" ? "var(--color-neg)" : "var(--color-teal-500)" }}
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
    </>
  )
}
