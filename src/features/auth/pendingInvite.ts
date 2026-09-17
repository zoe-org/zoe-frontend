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

/** Chave separada do convite de membro: os dois terminam em endpoints diferentes. */
const INFLUENCER_STORAGE_KEY = "zoe_pending_influencer_invite_token"

/** E-mail do convite, porque o cadastro em modo convite trava esse campo. */
const EMAIL_KEY = "zoe_pending_invite_email"

export function setPendingInviteEmail(email: string) {
  try { localStorage.setItem(EMAIL_KEY, email) } catch { /* storage off */ }
}

export function getPendingInviteEmail(): string | null {
  try { return localStorage.getItem(EMAIL_KEY) } catch { return null }
}

export function clearPendingInviteEmail() {
  try { localStorage.removeItem(EMAIL_KEY) } catch { /* storage off */ }
}

export function setPendingInfluencerInviteToken(token: string) {
  try { localStorage.setItem(INFLUENCER_STORAGE_KEY, token) } catch { /* storage off */ }
}

export function getPendingInfluencerInviteToken(): string | null {
  try { return localStorage.getItem(INFLUENCER_STORAGE_KEY) } catch { return null }
}

export function clearPendingInfluencerInviteToken() {
  try { localStorage.removeItem(INFLUENCER_STORAGE_KEY) } catch { /* storage off */ }
}
