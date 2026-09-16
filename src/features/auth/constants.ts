export const useCognitoAuth = Boolean(
  import.meta.env.VITE_COGNITO_USER_POOL_ID && import.meta.env.VITE_COGNITO_CLIENT_ID
)

// Login com Google/Microsoft precisa do domínio do Hosted UI do Cognito.
export const socialLoginEnabled = useCognitoAuth && Boolean(import.meta.env.VITE_COGNITO_DOMAIN)

export const DEV_CREDENTIALS = { email: "julia@zoe.ai", password: "zoe12345" }
