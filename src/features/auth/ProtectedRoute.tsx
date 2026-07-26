import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/features/auth/context"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (needsOnboarding && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding/tenant" replace />
  }

  return <>{children}</>
}
