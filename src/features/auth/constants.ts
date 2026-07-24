export const useCognitoAuth = Boolean(
  import.meta.env.VITE_COGNITO_USER_POOL_ID && import.meta.env.VITE_COGNITO_CLIENT_ID
)

export const DEV_CREDENTIALS = { email: "julia@zoe.ai", password: "zoe12345" }
