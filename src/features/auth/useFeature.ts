import { useAuth } from "@/features/auth/context"

/** Retorna true se o tenant ativo tem a feature habilitada. */
export function useFeature(code: string): boolean {
  return useAuth().hasFeature(code)
}
