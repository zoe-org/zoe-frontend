import { signInWithRedirect, signOut } from "aws-amplify/auth"

export type SocialProvider = "Google" | "Microsoft"

/**
 * Tentativa em andamento. Fica no sessionStorage pra atravessar o redirect
 * (mesma aba) e permitir um único retry depois do vínculo de conta (ADR-064).
 */
type Attempt = { provider: SocialProvider; returnTo: string; retried: boolean }

const ATTEMPT_KEY = "zoe.oauthAttempt"

export function readSocialAttempt(): Attempt | null {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY)
    return raw ? (JSON.parse(raw) as Attempt) : null
  } catch { return null }
}

export function clearSocialAttempt() {
  try { sessionStorage.removeItem(ATTEMPT_KEY) } catch { /* storage off */ }
}

function saveAttempt(attempt: Attempt) {
  try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt)) } catch { /* storage off */ }
}

// Google é provedor nativo do Cognito; Microsoft é OIDC custom.
function redirect(provider: SocialProvider) {
  return signInWithRedirect({ provider: provider === "Google" ? "Google" : { custom: provider } })
}

export async function startSocialLogin(provider: SocialProvider, returnTo = "/dashboard") {
  saveAttempt({ provider, returnTo, retried: false })
  try {
    await redirect(provider)
  } catch (err) {
    if ((err as { name?: string })?.name !== "UserAlreadyAuthenticatedException") throw err
    await signOut().catch(() => { /* já deslogado */ })
    await redirect(provider)
  }
}

/** Refaz o redirect uma única vez. `false` quando já tentou. */
export async function retrySocialLogin(): Promise<boolean> {
  const attempt = readSocialAttempt()
  if (!attempt || attempt.retried) return false
  saveAttempt({ ...attempt, retried: true })
  await redirect(attempt.provider)
  return true
}

// O Cognito recusa o primeiro login logo depois do Pre Sign-up vincular a conta.
export function isLinkedOnFirstLogin(message: string) {
  return /already found an entry for username/i.test(message)
}

export function federatedErrorMessage(message: string): string {
  // Erro lançado pela Lambda: "PreSignUp failed with error <mensagem>."
  const lambda = /PreSignUp failed with error (.+?)\.?\s*$/i.exec(message)
  if (lambda) return lambda[1]
  if (/access_denied|cancel/i.test(message)) return "Login cancelado."
  return "Não foi possível entrar com essa conta. Tente de novo."
}
