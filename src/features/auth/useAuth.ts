import {
  signIn, signUp, signOut, confirmSignUp, getCurrentUser, fetchAuthSession,
} from "aws-amplify/auth"

export const auth = {
  login: (email: string, password: string) =>
    signIn({ username: email, password }),
  register: (email: string, password: string) =>
    signUp({ username: email, password, options: { userAttributes: { email } } }),
  confirm: (email: string, code: string) =>
    confirmSignUp({ username: email, confirmationCode: code }),
  logout: () => signOut(),
  current: () => getCurrentUser(),
  token: async () => (await fetchAuthSession()).tokens?.idToken?.toString(),
}