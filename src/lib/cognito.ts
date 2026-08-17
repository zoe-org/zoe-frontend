import { Amplify } from "aws-amplify"
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito"
import { defaultStorage, sessionStorage as amplifySessionStorage } from "aws-amplify/utils"

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: { email: true },
    },
  },
})

const REMEMBER_KEY = "zoe.rememberMe"

/**
 * Escolhe onde os tokens do Cognito ficam guardados:
 * - `remember = true`  → localStorage: a sessão sobrevive a fechar o navegador ("manter conectado").
 * - `remember = false` → sessionStorage: a sessão some quando a aba/navegador fecha.
 *
 * Deve ser chamado ANTES do signIn (pra os tokens caírem no storage certo) e no bootstrap
 * abaixo (pra o Amplify ler os tokens do lugar certo após um reload).
 */
export function applyRememberMe(remember: boolean) {
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0")
  cognitoUserPoolsTokenProvider.setKeyValueStorage(remember ? defaultStorage : amplifySessionStorage)
}

// Bootstrap: respeita a escolha anterior. Default = manter conectado.
applyRememberMe(localStorage.getItem(REMEMBER_KEY) !== "0")
