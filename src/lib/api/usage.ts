import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

// Consumo do tenant (ADR-041/043). Duas grandezas que NUNCA se somam: minutos
// cobrados é a unidade de cobrança, vídeos analisados é volume — e owned entra na
// contagem sem entrar na conta. Por isso não existe campo "total" aqui.

/** `Insufficient` não tem data: amostra curta demais para sustentar uma. */
export type ProjectionConfidence = "Insufficient" | "Low" | "Normal"

export type UsageProjection = {
  confidence: ProjectionConfidence
  sampleDays: number
  minutesPerDay: number
  projectedPeriodMinutes: number
  /** Null = não cruza a cota dentro do período, ou amostra insuficiente. */
  estimatedExhaustionAt: string | null
}

export type BrandUsage = {
  brandId: string
  brandName: string
  billedMinutes: number
  videoCount: number
  averageMinutes: number
  longestVideoMinutes: number
}

/**
 * `Normal` → `Warning` (80%) → `Overage` (excedente autorizado) →
 * `SpendCapped` (teto de gasto) / `TierCapped` (teto do tier). Os dois últimos
 * pausam a coleta; a diferença é quem destrava (o tenant, ou só um upgrade).
 */
export type QuotaState = "Normal" | "Warning" | "Overage" | "SpendCapped" | "TierCapped"

export type UsageMeter = {
  periodStart: string
  periodEnd: string
  daysRemaining: number
  billedMinutes: number
  /** Inclui os owned. Nunca somar com `billedMinutes` — são unidades diferentes. */
  analyzedVideos: number
  ownedVideos: number
  /** Zero = sem cota conhecida (sem assinatura, ou Enterprise pay-as-you-go). */
  quotaMinutes: number
  /** Minutos além da cota. Zero dentro dela. */
  overageMinutes: number
  /**
   * Custo do excedente em centavos, já calculado pelo domínio ao preço desta
   * assinatura. A tela NÃO multiplica minutos por preço: dois arredondamentos
   * dariam dois números, e este é o que o cliente confronta com a fatura.
   */
  overageCents: number
  /** Preço do minuto excedente em centavos (R$ 0,034/min → 3.4). Só para exibir a conta. */
  overageCentsPerMinute: number
  /** Teto autorizado pelo tenant. Zero = para em 100% da cota. */
  spendCapCents: number
  state: QuotaState
  projection: UsageProjection
  byBrand: BrandUsage[]
  /** Instante da consulta (ADR-047), não da última medição. */
  asOf: string
}

export type UsagePreferences = {
  spendCapCents: number
  maxVideoMinutes: number
  maxVideoMinutesCeiling: number
  /** Null enquanto o tenant nunca mexeu — o que vale são os defaults. */
  updatedAt: string | null
}

export type UsagePreferencesInput = {
  spendCapCents: number
  maxVideoMinutes: number
}

export const usageApi = {
  meter: (opts?: { signal?: AbortSignal }): Promise<UsageMeter> =>
    apiClient.get("/api/usage/meter", { signal: opts?.signal }),
  preferences: (opts?: { signal?: AbortSignal }): Promise<UsagePreferences> =>
    apiClient.get("/api/usage/preferences", { signal: opts?.signal }),
  savePreferences: (input: UsagePreferencesInput): Promise<UsagePreferences> =>
    apiClient.put("/api/usage/preferences", input),
}

// ── hooks (tenantId na key = isolamento por tenant) ────────────────────────

export function useUsageMeter() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["usage-meter", activeTenantId],
    queryFn: ({ signal }) => usageApi.meter({ signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 60_000,
  })
}

export function useUsagePreferences() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["usage-preferences", activeTenantId],
    queryFn: ({ signal }) => usageApi.preferences({ signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 60_000,
  })
}

/**
 * Salvar o teto invalida o medidor junto: mudar o teto muda o ESTADO da cota na
 * mesma hora (a coleta volta, ou para). Mostrar o medidor velho ao lado do teto
 * novo faria a tela contradizer a si mesma.
 */
export function useSaveUsagePreferences() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UsagePreferencesInput) => usageApi.savePreferences(input),
    onSuccess: (saved) => {
      qc.setQueryData(["usage-preferences", activeTenantId], saved)
      qc.invalidateQueries({ queryKey: ["usage-meter", activeTenantId] })
    },
  })
}
