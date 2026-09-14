import { ApiError } from "@/lib/api"

/**
 * Extrai a mensagem ÚTIL de um erro da API. O backend devolve ProblemDetails
 * (RFC 7807) com `errors` do FluentValidation — mostrar um "não foi possível"
 * genérico joga fora exatamente a informação que o usuário precisa pra corrigir.
 */
export function apiMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback
  // Sem ProblemDetails, ou só com `title`, o texto é o status HTTP ("Not Found") ou um
  // corpo cru de proxy: não veio da regra de negócio e não diz nada a quem lê.
  const firstFieldError = Object.values(err.problem?.errors ?? {}).flat()[0]
  return firstFieldError || err.problem?.detail || fallback
}

export type ErrorFeedback = {
  message: string
  /** Código semântico da API, para a tela decidir o próximo passo (ex.: `payment_method_required`). */
  code?: string
  /** O que o suporte precisa para achar a requisição no log. */
  traceId?: string
}

/** O que dizer sobre um erro: a mensagem vem da API, nunca inventada no cliente (WS-F11). */
export function describeError(err: unknown, fallback: string): ErrorFeedback {
  if (!(err instanceof ApiError)) return { message: fallback }
  return { message: apiMessage(err, fallback), code: err.code, traceId: err.problem?.traceId }
}
