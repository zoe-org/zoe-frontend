import { Navigate } from "react-router-dom"
import { useAuth } from "@/features/auth/AuthContext"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[--color-teal-500] border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
