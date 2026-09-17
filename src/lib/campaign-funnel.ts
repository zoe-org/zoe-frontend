import type { CampaignContract, CampaignDetail } from "@/lib/api/operations"

export type FunnelTone = "alert" | "attention" | "neutral" | "ok"

/** Um criador da campanha: onde ele está e, quando a vez é da marca, o que fazer. */
export type FunnelRow = {
  influencerId: string
  creatorName: string
  stage: string
  tone: FunnelTone
  action: { label: string; to: string } | null
  /**
   * Outros contratos ativos do mesmo criador na campanha. A linha mostra o que mais precisa da
   * marca; sem este número, um segundo trabalho em andamento simplesmente sumia da tela.
   */
  otherContracts: number
}

type FunnelStage = Pick<FunnelRow, "stage" | "tone" | "action">

const TONE_ORDER: Record<FunnelTone, number> = { alert: 0, attention: 1, neutral: 2, ok: 3 }

/**
 * Funil por criador da campanha.
 *
 * <p>O detalhe da campanha listava contratos e entregas em blocos separados, e saber "em que pé
 * está cada um e o que falta de mim" pedia cruzar os dois de cabeça. Aqui cada criador ocupa uma
 * linha com a etapa e, quando depende da marca, o link para o lugar de agir.</p>
 *
 * <p>Quem precisa de ação sobe: alerta (disputa, recusa), depois atenção (revisar, abrir custódia,
 * pagar), depois o que está andando sem a marca, e por último o que terminou.</p>
 */
export function campaignFunnel(
  d: CampaignDetail,
  /**
   * Criadores cuja conta de recebimento ainda não está pronta. O detalhe da campanha não traz
   * isso; sem o dado, custódia liberável parecia pagamento esperando a marca.
   */
  payoutNotReady: ReadonlySet<string> = new Set(),
): FunnelRow[] {
  const names = new Map<string, string>()
  for (const i of d.invites ?? []) names.set(i.influencerId, i.influencerName)
  for (const c of d.contracts) names.set(c.influencerId, c.influencerName)

  const rows: FunnelRow[] = []

  for (const [influencerId, creatorName] of names) {
    const base = { influencerId, creatorName, otherContracts: 0 }
    const contracts = d.contracts.filter((c) => c.influencerId === influencerId)
    const active = contracts.filter((x) => x.status !== "Cancelled")

    if (active.length === 0) {
      if (contracts.length > 0) {
        rows.push({ ...base, stage: "Contrato cancelado", tone: "ok", action: null })
        continue
      }
      // Sem contrato: vale o convite, com o aceito na frente do mais recente.
      const invites = (d.invites ?? []).filter((i) => i.influencerId === influencerId)
      const invite = invites.find((i) => i.accepted) ?? invites[0]
      if (invite?.accepted) {
        rows.push({ ...base, stage: "Aceitou — sem contrato", tone: "attention", action: { label: "Criar contrato", to: `/operations/contracts?new=1&campaign=${d.campaignId}&creator=${influencerId}` } })
      } else if (invite?.expired) {
        rows.push({ ...base, stage: "Convite vencido", tone: "neutral", action: null })
      } else {
        rows.push({ ...base, stage: "Convite enviado", tone: "neutral", action: null })
      }
      continue
    }

    // Mais de um trabalho com o mesmo criador: vale o que mais precisa da marca. No empate, o mais
    // antigo (a API manda do mais antigo ao mais novo) — é o que está esperando há mais tempo.
    let chosen = contractStage(d, active[0], payoutNotReady)
    for (const c of active.slice(1)) {
      const e = contractStage(d, c, payoutNotReady)
      if (TONE_ORDER[e.tone] < TONE_ORDER[chosen.tone]) chosen = e
    }
    rows.push({ ...base, ...chosen, otherContracts: active.length - 1 })
  }

  // sort é estável: dentro do mesmo tom, a ordem de chegada se mantém.
  return rows.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}

/** Etapa de um contrato não cancelado. */
function contractStage(
  d: CampaignDetail,
  c: CampaignContract,
  payoutNotReady: ReadonlySet<string>,
): FunnelStage {
  const contractLink = `/operations/contracts/${c.contractId}`
  const queueLink = `/operations/deliveries?campaign=${d.campaignId}&contract=${c.contractId}`

  if (c.status === "Draft") {
    return { stage: "Rascunho do contrato", tone: "attention", action: { label: "Revisar e enviar", to: contractLink } }
  }
  if (c.status === "SentForSignature") {
    return { stage: "Aguardando assinatura", tone: "neutral", action: { label: "Ver contrato", to: contractLink } }
  }

  // Assinado. O que o dinheiro diz vem antes da entrega quando já encerrou ou travou.
  if (c.escrowState === "Released") return { stage: "Pago", tone: "ok", action: null }
  if (c.escrowState === "Refunded") return { stage: "Reembolsado", tone: "ok", action: null }
  if (c.escrowState === "Disputed") {
    return { stage: "Em disputa", tone: "alert", action: { label: "Ver custódia", to: "/operations/escrow" } }
  }

  const latest = d.deliveries
    .filter((x) => x.contractId === c.contractId)
    .sort((a, b) => b.submissionAttempt - a.submissionAttempt)[0]

  if (latest) {
    if (latest.status === "Submitted" || latest.status === "UnderReview") {
      return { stage: "Entrega esperando revisão", tone: "attention", action: { label: "Revisar entrega", to: queueLink } }
    }
    if (latest.status === "ReworkRequested") {
      return { stage: "Correção pedida — vez do criador", tone: "neutral", action: { label: "Ver entrega", to: queueLink } }
    }
    if (latest.status === "Rejected") {
      return { stage: "Entrega recusada", tone: "alert", action: { label: "Ver entrega", to: queueLink } }
    }
    if (c.escrowState === "Releasable" && payoutNotReady.has(c.influencerId)) {
      // Liberável, mas a vez é do criador: o pagamento espera a conta dele. Mandar a marca à
      // custódia a fazia procurar um clique que não resolve nada.
      return {
        stage: "Aprovada — pagamento esperando a conta do criador",
        tone: "neutral",
        action: { label: "Ver criador", to: `/operations/influencers?creator=${c.influencerId}` },
      }
    }
    if (c.escrowState === "Releasable") {
      return { stage: "Aprovada — pagamento liberável", tone: "attention", action: { label: "Ver custódia", to: "/operations/escrow" } }
    }
    return { stage: "Entrega aprovada", tone: "ok", action: null }
  }

  // Sem entrega ainda: o corte diz em que pé está a produção. Corte esperando aprovação é a
  // etapa em que o criador mais fica parado, e o funil não a mostrava.
  if (c.draftStatus === "AwaitingReview") {
    return { stage: "Corte esperando aprovação", tone: "attention", action: { label: "Revisar o corte", to: "/operations/deliveries?stage=drafts" } }
  }
  if (c.draftStatus === "ChangesRequested") {
    return { stage: "Correção no corte — vez do criador", tone: "neutral", action: null }
  }
  if (c.draftStatus === "Approved") {
    return { stage: "Corte aprovado — aguardando publicar", tone: "neutral", action: null }
  }

  if (c.usesEscrow && !c.escrowState) {
    return { stage: "Assinado — custódia não aberta", tone: "attention", action: { label: "Abrir custódia", to: contractLink } }
  }
  if (c.escrowState === "PendingDeposit") {
    return { stage: "Aguardando o depósito", tone: "neutral", action: { label: "Ver contrato", to: contractLink } }
  }
  return { stage: "Em produção", tone: "neutral", action: null }
}
