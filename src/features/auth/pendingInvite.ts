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

/**
 * Convite de CRIADOR — chave separada de propósito. Os dois convites sobrevivem ao
 * mesmo round-trip, mas terminam em endpoints diferentes: o de membro cria membership
 * no workspace, o de criador cria um influenciador com conta própria. Guardar os dois
 * na mesma chave faria o Register aceitar um token no endpoint errado, que é
 * justamente a confusão que motivou tabelas separadas no backend.
 */
const INFLUENCER_STORAGE_KEY = "zoe_pending_influencer_invite_token"

export function setPendingInfluencerInviteToken(token: string) {
  try { localStorage.setItem(INFLUENCER_STORAGE_KEY, token) } catch { /* storage off */ }
}

export function getPendingInfluencerInviteToken(): string | null {
  try { return localStorage.getItem(INFLUENCER_STORAGE_KEY) } catch { return null }
}

export function clearPendingInfluencerInviteToken() {
  try { localStorage.removeItem(INFLUENCER_STORAGE_KEY) } catch { /* storage off */ }
}
