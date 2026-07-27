/**
 * Token do convite que um usuário sem conta está aceitando via cadastro.
 * Persistido em localStorage pra sobreviver ao round-trip cadastro → confirmação de
 * e-mail → auto-login, e ser consumido no fim do Register (aceite automático).
 * Também serve de guarda no ProtectedRoute contra criar um workspace por engano.
 */
const STORAGE_KEY = "zoe_pending_invite_token"

export function setPendingInviteToken(token: string) {
  try { localStorage.setItem(STORAGE_KEY, token) } catch { /* storage off */ }
}

export function getPendingInviteToken(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

export function clearPendingInviteToken() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage off */ }
}
