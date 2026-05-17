import { createContext, useContext, useEffect, useState } from "react"
import { fetchAuthSession } from "aws-amplify/auth"

type Tenant = { id: string; modules: ("intelligence" | "operations")[] }
type User = { email: string; name?: string; tenant: Tenant } | null

const DEV_MOCK_USER: User = {
  email: "julia@zoe.ai",
  name: "Júlia",
  tenant: { id: "zoe-dev", modules: ["intelligence", "operations"] },
}

export const useCognitoAuth = Boolean(
  import.meta.env.VITE_COGNITO_USER_POOL_ID && import.meta.env.VITE_COGNITO_CLIENT_ID
)

export const DEV_CREDENTIALS = { email: "julia@zoe.ai", password: "zoe12345" }

const Ctx = createContext<{ user: User; loading: boolean; refresh: () => Promise<void>; devLogin: () => void }>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!useCognitoAuth) {
      setUser(DEV_MOCK_USER)
      setLoading(false)
      return
    }
    try {
      const session = await fetchAuthSession()
      const claims = session.tokens?.idToken?.payload
      if (!claims) { setUser(null); return }
      setUser({
        email: claims.email as string,
        tenant: {
          id: claims["custom:tenant_id"] as string,
          modules: JSON.parse((claims["custom:module_config"] as string) ?? "[]"),
        },
      })
    } finally { setLoading(false) }
  }

  const devLogin = () => {
    setUser(DEV_MOCK_USER)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])
  return <Ctx.Provider value={{ user, loading, refresh, devLogin }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)