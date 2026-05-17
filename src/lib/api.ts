import { auth } from "@/features/auth/useAuth"

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.token()
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}