import { createContext, useContext } from "react"
import type { AuthState, AuthActions } from "@/features/auth/types"

export const AuthContext = createContext<(AuthState & AuthActions) | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
