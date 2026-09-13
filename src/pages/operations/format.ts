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

/**
 * Normaliza para comparar: minúsculas e sem acento. Quem procura "custodia" espera achar
 * "Custódia", e quem digita o nome de um criador raramente acentua.
 */
export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/** Se todos os termos da busca aparecem em algum dos campos. */
export function matches(query: string, ...campos: (string | null | undefined)[]): boolean {
  const termos = norm(query).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return true
  const alvo = campos.map(norm).join(" ")
  return termos.every((t) => alvo.includes(t))
}

/**
 * Como a campanha aparece numa lista quando o contrato é avulso.
 *
 * <p>Uma célula em branco lê como dado que faltou carregar. "Sem campanha" diz que o
 * contrato é assim de propósito — trabalho pontual, que não pertence a nenhuma ação.</p>
 */
export function campanhaLabel(nome: string | null | undefined): string {
  return nome?.trim() ? nome : "Sem campanha"
}
