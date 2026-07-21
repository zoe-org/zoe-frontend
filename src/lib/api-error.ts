import { ApiError } from "@/lib/api"

/**
 * Extrai a mensagem ÚTIL de um erro da API. O backend devolve ProblemDetails
 * (RFC 7807) com `errors` do FluentValidation — mostrar um "não foi possível"
 * genérico joga fora exatamente a informação que o usuário precisa pra corrigir.
 */
export function apiMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback
  const firstFieldError = Object.values(err.problem?.errors ?? {}).flat()[0]
  return firstFieldError || err.problem?.detail || err.message || fallback
}
