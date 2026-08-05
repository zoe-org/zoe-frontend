/**
 * Formatação usada pelas telas de Operations. Separado de `shared.tsx` porque o
 * Fast Refresh só funciona em arquivos que exportam apenas componentes — misturar
 * função e componente no mesmo módulo desliga o hot reload da página inteira.
 */

/** Data curta em pt-BR. Mesma forma usada em Usuários. */
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })

/** Iniciais para o avatar, a partir do nome ou, na falta dele, do e-mail. */
export function initials(name: string, email: string): string {
  const base = name?.trim() || email
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}
