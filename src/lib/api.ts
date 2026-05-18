import { fetchAuthSession, signOut } from "aws-amplify/auth"

const TENANT_STORAGE_KEY = "zoe_active_tenant_id"

export function getActiveTenantId(): string | null {
  try { return localStorage.getItem(TENANT_STORAGE_KEY) } catch { return null }
}

export function setActiveTenantId(id: string | null) {
  try {
    if (id) localStorage.setItem(TENANT_STORAGE_KEY, id)
    else localStorage.removeItem(TENANT_STORAGE_KEY)
  } catch { /* storage indisponível */ }
}

export type ProblemDetails = {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  code?: string
  traceId?: string
  details?: unknown
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem?: ProblemDetails
  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message)
    this.status = status
    this.problem = problem
  }
  /** Código semântico devolvido pela API (ex.: "tenant_header_required"). */
  get code(): string | undefined { return this.problem?.code }
}

type ApiOptions = RequestInit & {
  /** Se true, não envia X-Tenant-Id mesmo que exista um tenant ativo. Default: false. */
  noTenant?: boolean
  /** Override pontual do tenant ativo (ex.: validar membership antes de persistir). */
  tenantId?: string | null
}

async function getIdToken(): Promise<string | undefined> {
  try {
    const session = await fetchAuthSession()
    return session.tokens?.idToken?.toString()
  } catch {
    return undefined
  }
}

async function parseError(res: Response): Promise<ApiError> {
  const text = await res.text()
  if (!text) return new ApiError(res.status, res.statusText || `HTTP ${res.status}`)
  try {
    const problem = JSON.parse(text) as ProblemDetails
    const message = problem.detail || problem.title || res.statusText || `HTTP ${res.status}`
    return new ApiError(res.status, message, problem)
  } catch {
    return new ApiError(res.status, text)
  }
}

let handling401 = false
async function handleUnauthorized() {
  if (handling401) return
  handling401 = true
  try {
    await signOut().catch(() => { /* já deslogado */ })
    setActiveTenantId(null)
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login")
    }
  } finally {
    handling401 = false
  }
}

export async function api<T>(path: string, init: ApiOptions = {}): Promise<T> {
  const { noTenant, tenantId, headers, ...rest } = init
  const token = await getIdToken()
  const tenant = tenantId !== undefined ? tenantId : (noTenant ? null : getActiveTenantId())

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(rest.body && !(rest.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenant ? { "X-Tenant-Id": tenant } : {}),
    ...(headers as Record<string, string> | undefined),
  }

  const base = import.meta.env.VITE_API_BASE_URL ?? ""
  const res = await fetch(`${base}${path}`, { ...rest, headers: finalHeaders })

  if (res.status === 401) {
    await handleUnauthorized()
    throw new ApiError(401, "Sessão expirada.")
  }

  if (res.status === 204) return undefined as T
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<T>
}

export const apiClient = {
  get:    <T>(path: string, opts?: ApiOptions) => api<T>(path, { ...opts, method: "GET" }),
  post:   <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    api<T>(path, { ...opts, method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    api<T>(path, { ...opts, method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    api<T>(path, { ...opts, method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T = void>(path: string, opts?: ApiOptions) => api<T>(path, { ...opts, method: "DELETE" }),
}
