import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/features/auth/context"
import {
  getPendingInviteToken,
  getPendingInfluencerInviteToken,
} from "@/features/auth/pendingInvite"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, needsOnboarding, isCreator } = useAuth()
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

  // Convidado sem workspace: manda pro aceite do convite em vez de criar um workspace
  // por engano. Cobre um reload no meio do fluxo ou o accept que ainda não concluiu.
  if (needsOnboarding && !location.pathname.startsWith("/invite/")) {
    const inviteToken = getPendingInviteToken()
    if (inviteToken) {
      return <Navigate to={`/invite/${inviteToken}`} replace />
    }
  }

  // Convite de criador pendente vence o desvio de criador: a conta só vira criador depois do aceite.
  if (needsOnboarding && !location.pathname.startsWith("/creator-invite/")) {
    const influencerToken = getPendingInfluencerInviteToken()
    if (influencerToken) {
      return <Navigate to={`/creator-invite/${influencerToken}`} replace />
    }
  }

  // Criador já registrado: o app da marca não se aplica a ele — sem tenant, toda tela de
  // lá volta 403. A área dele é a única que faz sentido, em qualquer login.
  if (isCreator && !location.pathname.startsWith("/creator")) {
    return <Navigate to="/creator" replace />
  }

  if (needsOnboarding && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding/tenant" replace />
  }

  return <>{children}</>
}
