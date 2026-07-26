import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fetchAuthSession, signOut as amplifySignOut } from "aws-amplify/auth"
import { meApi, type Me, type Membership, type MeTenant } from "@/lib/api/me"
import { ApiError, getActiveTenantId, setActiveTenantId } from "@/lib/api"
import { AuthContext } from "@/features/auth/context"
import { useCognitoAuth } from "@/features/auth/constants"
import type { AuthState, AuthActions } from "@/features/auth/types"

const DEV_MOCK: { me: Me; tenant: MeTenant } = {
  me: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "julia@zoe.ai",
    name: "Júlia",
    memberships: [{
      tenantId: "00000000-0000-0000-0000-0000000000aa",
      tenantName: "Zoe Dev",
      tenantSlug: "zoe-dev",
      role: "Owner",
    }],
  },
  tenant: {
    tenant: {
      id: "00000000-0000-0000-0000-0000000000aa",
      name: "Zoe Dev",
      slug: "zoe-dev",
      status: "Active",
    },
    role: "Owner",
    features: ["intelligence", "operations"],
  },
}

const initialState: AuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  memberships: [],
  activeTenantId: null,
  activeTenant: null,
  role: null,
  features: [],
  needsOnboarding: false,
  isZoeAdmin: false,
  error: null,
}

async function hasCognitoSession(): Promise<boolean> {
  try {
    const session = await fetchAuthSession()
    return Boolean(session.tokens?.idToken)
  } catch {
    return false
  }
}

/** Grupo `zoe-admin` no idToken — mesma fonte que a policy `ZoeAdmin` do backend. */
const ZOE_ADMIN_GROUP = "zoe-admin"
async function readIsZoeAdmin(): Promise<boolean> {
  try {
    const session = await fetchAuthSession()
    const groups = session.tokens?.idToken?.payload?.["cognito:groups"]
    return Array.isArray(groups) && groups.includes(ZOE_ADMIN_GROUP)
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)
  /** Travessas concorrentes: protege contra um refresh tardio sobrescrever um signOut recente. */
  const generationRef = useRef(0)

  const applyTenant = useCallback((memberships: Membership[]): string | null => {
    const stored = getActiveTenantId()
    const valid = stored && memberships.some(m => m.tenantId === stored) ? stored : memberships[0]?.tenantId ?? null
    if (valid !== stored) setActiveTenantId(valid)
    return valid
  }, [])

  const loadTenantContext = useCallback(async (tenantId: string | null): Promise<MeTenant | null> => {
    if (!tenantId) return null
    try {
      return await meApi.getTenant(tenantId)
    } catch (err) {
      // Membership pode ter sido revogada entre /api/me e /api/me/tenant — limpa e segue.
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        setActiveTenantId(null)
        return null
      }
      throw err
    }
  }, [])

  const refresh = useCallback(async () => {
    const gen = ++generationRef.current
    setState(s => ({ ...s, isLoading: true, error: null }))

    if (!useCognitoAuth) {
      // Modo dev sem Cognito: já fica autenticado com mock. devLogin() é o gatilho real.
      if (gen !== generationRef.current) return
      setState({ ...initialState, isLoading: false, isAuthenticated: false })
      return
    }

    const signedIn = await hasCognitoSession()
    if (!signedIn) {
      if (gen !== generationRef.current) return
      setActiveTenantId(null)
      setState({ ...initialState, isLoading: false })
      return
    }

    try {
      const me = await meApi.get()
      const activeTenantId = applyTenant(me.memberships)
      const [tenantCtx, isZoeAdmin] = await Promise.all([
        loadTenantContext(activeTenantId),
        readIsZoeAdmin(),
      ])
      if (gen !== generationRef.current) return
      setState({
        isLoading: false,
        isAuthenticated: true,
        user: me,
        memberships: me.memberships,
        activeTenantId,
        activeTenant: tenantCtx,
        role: tenantCtx?.role ?? null,
        features: tenantCtx?.features ?? [],
        needsOnboarding: me.memberships.length === 0,
        isZoeAdmin,
        error: null,
      })
    } catch (err) {
      if (gen !== generationRef.current) return
      const message = err instanceof Error ? err.message : "Falha ao carregar sessão."
      setState(s => ({ ...s, isLoading: false, error: message }))
    }
  }, [applyTenant, loadTenantContext])

  const switchTenant = useCallback(async (tenantId: string) => {
    if (!state.memberships.some(m => m.tenantId === tenantId)) return
    setActiveTenantId(tenantId)
    setState(s => ({ ...s, isLoading: true }))
    const tenantCtx = await loadTenantContext(tenantId)
    setState(s => ({
      ...s,
      isLoading: false,
      activeTenantId: tenantId,
      activeTenant: tenantCtx,
      role: tenantCtx?.role ?? null,
      features: tenantCtx?.features ?? [],
    }))
  }, [state.memberships, loadTenantContext])

  const signOut = useCallback(async () => {
    generationRef.current++
    if (useCognitoAuth) {
      await amplifySignOut().catch(() => { /* já deslogado */ })
    }
    setActiveTenantId(null)
    setState({ ...initialState, isLoading: false })
  }, [])

  const devLogin = useCallback(() => {
    generationRef.current++
    setActiveTenantId(DEV_MOCK.tenant.tenant.id)
    setState({
      isLoading: false,
      isAuthenticated: true,
      user: DEV_MOCK.me,
      memberships: DEV_MOCK.me.memberships,
      activeTenantId: DEV_MOCK.tenant.tenant.id,
      activeTenant: DEV_MOCK.tenant,
      role: DEV_MOCK.tenant.role,
      features: DEV_MOCK.tenant.features,
      needsOnboarding: false,
      // Login mock local não é admin Zoe — pra ver a curadoria é preciso o
      // grupo `zoe-admin` no Cognito de verdade.
      isZoeAdmin: false,
      error: null,
    })
  }, [])

  const hasFeature = useCallback((code: string) => state.features.includes(code), [state.features])

  useEffect(() => { void Promise.resolve().then(refresh) }, [refresh])

  const value = useMemo<AuthState & AuthActions>(() => ({
    ...state,
    refresh,
    switchTenant,
    signOut,
    devLogin,
    hasFeature,
  }), [state, refresh, switchTenant, signOut, devLogin, hasFeature])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
