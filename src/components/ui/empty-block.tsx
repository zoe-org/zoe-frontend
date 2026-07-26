import type { ReactNode } from "react"
import { Inbox } from "lucide-react"

/**
 * Estado vazio LEVE, para dentro de um bloco/seção (irmão do `EmptyState`, que é
 * de página inteira e tem botão de ação). Serve pra quando uma marca ainda não tem
 * dado pra popular aquele bloco: em vez de um espaço em branco, mostra um ícone
 * discreto + mensagem. Nada fabricado — só sinaliza a ausência.
 */
export function EmptyBlock({
  message,
  hint,
  icon,
  className,
}: {
  message: string
  hint?: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className ?? ""}`}>
      <div className="mb-2.5 text-ink-muted-2">
        {icon ?? <Inbox className="w-7 h-7" strokeWidth={1.5} />}
      </div>
      <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{message}</div>
      {hint && <div className="text-[12px] text-ink-muted mt-1 max-w-xs">{hint}</div>}
    </div>
  )
}
