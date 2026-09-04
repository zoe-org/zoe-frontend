import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

// Alertas (Etapa 5, WS-1/WS-2 da api). Regras configuradas pelo tenant + histórico
// dos disparos que o evaluator gera na ingestão.
//
// RBAC: leitura pra qualquer membro; mutação de regra exige Manager+ (o backend
// decide pelo papel NESTE tenant, então a UI usa RoleGate só pra esconder o que o
// handler já bloqueia). Marcar como lido é livre — é estado de UI de quem lê.

/** Condição que a regra avalia. Fechado no MVP — ver AlertRuleType no domínio. */
export type AlertRuleType = "SentimentBelow" | "MentionVolumeAbove" | "KeywordMatch"

export type AlertSeverity = "Info" | "Warning" | "Critical"

/**
 * Canais do disparo. `InApp` é **obrigatório e implícito**: a factory do domínio
 * o força de volta, então todo disparo entra no histórico mesmo se o e-mail falhar.
 * O usuário só escolhe os extras.
 */
export type AlertChannel = "InApp" | "Email"

export type AlertRule = {
  id: string
  brandId: string
  brandName: string
  name: string
  type: AlertRuleType
  severity: AlertSeverity
  channels: AlertChannel[]
  isEnabled: boolean
  /** Escala [0,1] em SentimentBelow; contagem em MentionVolumeAbove; null em KeywordMatch. */
  threshold: number | null
  keyword: string | null
  createdAt: string
  updatedAt: string
}
export type AlertRuleList = { items: AlertRule[] }

export type AlertEvent = {
  id: string
  alertRuleId: string
  ruleName: string
  brandId: string
  brandName: string
  youtubeVideoId: string
  severity: AlertSeverity
  triggeredAt: string
  isRead: boolean
  emailNotified: boolean
  /** JSON cru do que a regra viu no disparo. Ver `parseAlertSnapshot`. */
  snapshot: string | null
}

/**
 * `unreadCount` é o que VOCÊ ainda não leu (ADR-036), não o total de disparos do
 * workspace — leitura é por usuário desde o `alert_event_reads`. Também não é o
 * total da página nem do filtro: é o número do badge, e ele não pode mudar só
 * porque o usuário filtrou por marca.
 *
 * São dois números diferentes e a tela nunca deve mostrá-los sem rótulo: "3 não
 * lidos" e "3 disparos" significam coisas distintas para quem divide o workspace.
 */
export type AlertEventPage = {
  items: AlertEvent[]
  nextCursor: string | null
  unreadCount: number
}

export type MarkReadResult = { markedCount: number; unreadCount: number }

export type CreateAlertRuleInput = {
  brandId: string
  name: string
  type: AlertRuleType
  severity: AlertSeverity
  /** Só os canais EXTRAS: mandar ["Email"] resulta em InApp+Email no backend. */
  channels: AlertChannel[]
  threshold?: number | null
  keyword?: string | null
  isEnabled: boolean
}

/** O PUT substitui a configuração — a marca não muda (o id vem da rota). */
export type UpdateAlertRuleInput = Omit<CreateAlertRuleInput, "brandId">

type Opts = { signal?: AbortSignal }

type ListEventsParams = {
  brandId?: string | null
  unreadOnly?: boolean
  cursor?: string | null
  limit?: number
}

function eventsQuery({ brandId, unreadOnly, cursor, limit }: ListEventsParams): string {
  const qs = new URLSearchParams()
  if (brandId) qs.set("brandId", brandId)
  if (unreadOnly) qs.set("unreadOnly", "true")
  if (cursor) qs.set("cursor", cursor)
  if (limit) qs.set("limit", String(limit))
  const s = qs.toString()
  return s ? `?${s}` : ""
}

export const alertsApi = {
  listRules: (brandId?: string | null, opts?: Opts): Promise<AlertRuleList> =>
    apiClient.get(`/api/alerts/rules${brandId ? `?brandId=${brandId}` : ""}`, { signal: opts?.signal }),
  createRule: (input: CreateAlertRuleInput): Promise<AlertRule> =>
    apiClient.post("/api/alerts/rules", input),
  updateRule: (ruleId: string, input: UpdateAlertRuleInput): Promise<AlertRule> =>
    apiClient.put(`/api/alerts/rules/${ruleId}`, input),
  deleteRule: (ruleId: string): Promise<void> =>
    apiClient.delete(`/api/alerts/rules/${ruleId}`),

  listEvents: (params: ListEventsParams, opts?: Opts): Promise<AlertEventPage> =>
    apiClient.get(`/api/alerts/events${eventsQuery(params)}`, { signal: opts?.signal }),
  markRead: (eventId: string): Promise<MarkReadResult> =>
    apiClient.post(`/api/alerts/events/${eventId}/read`),
  markAllRead: (): Promise<MarkReadResult> =>
    apiClient.post("/api/alerts/events/read-all"),
}

// ── hooks (tenantId na key = isolamento por tenant, RN-I-066) ──────────────

export function useAlertRules(brandId?: string | null) {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["alert-rules", activeTenantId, brandId ?? null],
    queryFn: ({ signal }) => alertsApi.listRules(brandId, { signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 30_000,
  })
}

export function useAlertEvents(params: { brandId?: string | null; unreadOnly?: boolean }) {
  const { activeTenantId } = useAuth()
  const brandId = params.brandId ?? null
  const unreadOnly = params.unreadOnly ?? false

  return useInfiniteQuery({
    queryKey: ["alert-events", activeTenantId, brandId, unreadOnly],
    queryFn: ({ pageParam, signal }) =>
      alertsApi.listEvents({ brandId, unreadOnly, cursor: pageParam, limit: 30 }, { signal }),
    // Keyset e não offset: o histórico cresce por cima, e offset duplicaria e
    // pularia itens conforme novos disparos chegam.
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(activeTenantId),
    staleTime: 15_000,
  })
}

/**
 * Só o contador do sino. Pede `limit=1` porque o que interessa é o `unreadCount`
 * do envelope, não os itens — e ele é do tenant inteiro, sem filtro de marca.
 */
export function useAlertUnreadCount() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: ["alert-unread", activeTenantId],
    queryFn: ({ signal }) => alertsApi.listEvents({ limit: 1 }, { signal }),
    enabled: Boolean(activeTenantId),
    staleTime: 30_000,
    select: (page) => page.unreadCount,
  })
}

/** Invalida as três famílias de query de alerta do tenant. */
function useAlertInvalidation() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  return {
    rules: () => qc.invalidateQueries({ queryKey: ["alert-rules", activeTenantId] }),
    events: () => qc.invalidateQueries({ queryKey: ["alert-events", activeTenantId] }),
    unread: () => qc.invalidateQueries({ queryKey: ["alert-unread", activeTenantId] }),
  }
}

export function useCreateAlertRule() {
  const inv = useAlertInvalidation()
  return useMutation({
    mutationFn: (input: CreateAlertRuleInput) => alertsApi.createRule(input),
    onSuccess: () => inv.rules(),
  })
}

export function useUpdateAlertRule() {
  const inv = useAlertInvalidation()
  return useMutation({
    mutationFn: ({ ruleId, input }: { ruleId: string; input: UpdateAlertRuleInput }) =>
      alertsApi.updateRule(ruleId, input),
    onSuccess: () => inv.rules(),
  })
}

export function useDeleteAlertRule() {
  const inv = useAlertInvalidation()
  return useMutation({
    mutationFn: (ruleId: string) => alertsApi.deleteRule(ruleId),
    // Apagar a regra apaga o histórico dela no backend — por isso invalida
    // eventos e badge, não só a lista de regras.
    onSuccess: () => { inv.rules(); inv.events(); inv.unread() },
  })
}

export function useMarkAlertRead() {
  const inv = useAlertInvalidation()
  return useMutation({
    mutationFn: (eventId: string) => alertsApi.markRead(eventId),
    onSuccess: () => { inv.events(); inv.unread() },
  })
}

export function useMarkAllAlertsRead() {
  const inv = useAlertInvalidation()
  return useMutation({
    mutationFn: () => alertsApi.markAllRead(),
    onSuccess: () => { inv.events(); inv.unread() },
  })
}
