/**
 * Versão dos Termos de Uso e da Política de Privacidade exibida nas páginas.
 *
 * ⚠️ Tem de ser igual a `LegalTerms.CurrentVersion` no zoe-api. O aceite não usa este número —
 * ele vem da prévia do convite, que é o backend — mas a página mostra a versão que a pessoa está
 * lendo, e as duas precisam bater. Mudou o texto? Mude a versão nos dois lugares.
 */
export const LEGAL_VERSION = "2026-09-16"

/**
 * Canal para exercer direitos e falar com o encarregado (LGPD, art. 41). Vazio enquanto não for
 * definido — as páginas mostram o aviso no lugar em vez de inventar um endereço.
 */
export const PRIVACY_CONTACT_EMAIL = ""
