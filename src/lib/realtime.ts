import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/features/auth/context"

// Transporte real-time (WS-F3, ADR-034). Troca o ticket de 60s (POST
// /api/realtime/ticket) por uma conexão WebSocket viva; o servidor empurra um
// RealtimeEnvelope quando um alerta dispara. Contrato .NET↔TS — os tipos
// abaixo espelham Zoe.Application.Common.Realtime.RealtimeEnvelope no zoe-api.
//
// Silencioso por design, mesmo padrão do resto do transporte: se o backend
// estiver com o WebSocket desligado (Realtime:ManagementEndpoint vazio no
// Render), o ticket volta com webSocketUrl vazio e este hook simplesmente não
// conecta — nenhum erro visível, o produto segue funcionando igual (alerta
// continua no histórico e no e-mail).

type IssueTicketResponse = {
  ticket: string
  webSocketUrl: string
  expiresAt: string
  expiresInSeconds: number
}

type RealtimeEventType = "MentionDetected" | "ProcessingProgress" | "AlertTriggered"

type RealtimeEnvelope = {
  type: RealtimeEventType
  tenantId: string
  brandId: string
  payload: unknown
  ts: string
}

type AlertTriggeredPayload = {
  alertEventId: string
  alertRuleId: string
  ruleName: string
  severity: "Info" | "Warning" | "Critical"
  youtubeVideoId: string
  triggeredAt: string
}

const RECONNECT_BASE_DELAY_MS = 2_000
const RECONNECT_MAX_DELAY_MS = 30_000

/**
 * Mantém a conexão WebSocket viva enquanto o usuário estiver logado com um
 * tenant ativo. Monta uma vez em AppShell — vale pro app inteiro, não só pra
 * tela de Alertas, porque o badge da sidebar também depende disto.
 */
export function useRealtimeConnection() {
  const { isAuthenticated, activeTenantId } = useAuth()
  const qc = useQueryClient()

  // Refs, não state: reconectar não pode causar re-render, e o socket/timer
  // precisam sobreviver entre renders sem disparar o efeito de novo.
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !activeTenantId) return

    cancelledRef.current = false

    const scheduleReconnect = () => {
      if (cancelledRef.current) return
      const attempt = reconnectAttemptRef.current + 1
      reconnectAttemptRef.current = attempt
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1), RECONNECT_MAX_DELAY_MS)
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    async function connect() {
      if (cancelledRef.current) return

      let ticket: IssueTicketResponse
      try {
        ticket = await apiClient.post<IssueTicketResponse>("/api/realtime/ticket")
      } catch {
        // 503 (transporte desligado) ou qualquer outro erro de rede — não é
        // problema do usuário, só tenta de novo com backoff.
        scheduleReconnect()
        return
      }

      if (!ticket.webSocketUrl || cancelledRef.current) return

      const socket = new WebSocket(`${ticket.webSocketUrl}?ticket=${encodeURIComponent(ticket.ticket)}`)
      socketRef.current = socket

      socket.onopen = () => { reconnectAttemptRef.current = 0 }

      socket.onmessage = (event) => {
        let envelope: RealtimeEnvelope
        try {
          envelope = JSON.parse(event.data)
        } catch {
          return
        }

        // Defesa em profundidade: o servidor já roteia certo, mas um frame de
        // outro tenant nunca deve renderizar (mesma regra do RealtimeEnvelope no backend).
        if (envelope.tenantId !== activeTenantId) return

        switch (envelope.type) {
          case "AlertTriggered": {
            const payload = envelope.payload as AlertTriggeredPayload
            toast(payload.ruleName, {
              description: `Alerta ${payload.severity.toLowerCase()} disparado agora`,
            })
            qc.invalidateQueries({ queryKey: ["alert-events", activeTenantId] })
            qc.invalidateQueries({ queryKey: ["alert-unread", activeTenantId] })
            break
          }
          case "MentionDetected":
          case "ProcessingProgress":
            // Sem UI ainda pra estes dois — WS-F3 cobre só Alertas por ora.
            // Log só pra confirmar visualmente (DevTools) que o transporte
            // está vivo e entregando.
            console.debug("[realtime]", envelope.type, envelope.payload)
            break
        }
      }

      socket.onclose = () => {
        if (!cancelledRef.current) scheduleReconnect()
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      cancelledRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [isAuthenticated, activeTenantId, qc])
}
