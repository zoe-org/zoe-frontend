import { toast } from "sonner"
import { describeError } from "@/lib/api-error"

/**
 * Feedback de ação (WS-F11). Um lugar só para as regras:
 * - sucesso diz o que mudou e some sozinho;
 * - erro recuperável diz o que fazer e pode oferecer repetir;
 * - erro terminal (caminho de dinheiro) não some sozinho: fica até a pessoa fechar.
 */
export function notifySuccess(message: string) {
  toast.success(message)
}

type ErrorOptions = {
  /** Caminho de dinheiro: o aviso fica até ser fechado, com o código de suporte. */
  terminal?: boolean
  /** Oferece repetir a ação no próprio aviso. */
  retry?: () => void
}

export function notifyError(err: unknown, fallback: string, { terminal = false, retry }: ErrorOptions = {}) {
  const { message, traceId } = describeError(err, fallback)

  toast.error(message, {
    duration: terminal ? Infinity : undefined,
    closeButton: terminal,
    description: terminal && traceId ? `Código para o suporte: ${traceId}` : undefined,
    action: retry ? { label: "Tentar de novo", onClick: retry } : undefined,
  })
}
