import {
  signIn, signUp, signOut, confirmSignUp, resendSignUpCode,
  getCurrentUser, fetchAuthSession,
  resetPassword, confirmResetPassword,
} from "aws-amplify/auth"

/** Wrapper fino do Amplify Auth — toda lógica de UI/estado fica fora daqui. */
export const auth = {
  login: async (email: string, password: string) => {
    try {
      return await signIn({ username: email, password })
    } catch (err) {
      // Amplify v6 mantém tokens em cache; uma sessão pendurada bloqueia novo signIn.
      // Limpa e tenta de novo. Não usar pra outros erros — só pra essa condição específica.
      if ((err as { name?: string })?.name === "UserAlreadyAuthenticatedException") {
        await signOut().catch(() => { /* swallow */ })
        return await signIn({ username: email, password })
      }
      throw err
    }
  },

  register: (email: string, password: string, name?: string) =>
    signUp({
      username: email,
      password,
      options: {
        userAttributes: { email, ...(name ? { name } : {}) },
      },
    }),

  confirm: (email: string, code: string) =>
    confirmSignUp({ username: email, confirmationCode: code }),

  resendCode: (email: string) =>
    resendSignUpCode({ username: email }),

  forgotPassword: (email: string) =>
    resetPassword({ username: email }),

  confirmForgotPassword: (email: string, code: string, newPassword: string) =>
    confirmResetPassword({ username: email, confirmationCode: code, newPassword }),

  logout: () => signOut(),
  current: () => getCurrentUser(),
  token: async () => (await fetchAuthSession()).tokens?.idToken?.toString(),
}
