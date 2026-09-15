import type { CampaignDetail } from "@/lib/api/operations"

export type TomFunil = "alerta" | "atencao" | "neutro" | "ok"

/** Um criador da campanha: onde ele está e, quando a vez é da marca, o que fazer. */
export type LinhaFunil = {
  influencerId: string
  nome: string
  etapa: string
  tom: TomFunil
  acao: { label: string; to: string } | null
}

const ORDEM: Record<TomFunil, number> = { alerta: 0, atencao: 1, neutro: 2, ok: 3 }

/**
 * Funil por criador da campanha.
 *
 * <p>O detalhe da campanha listava contratos e entregas em blocos separados, e saber "em que pé
 * está cada um e o que falta de mim" pedia cruzar os dois de cabeça. Aqui cada criador ocupa uma
 * linha com a etapa mais avançada e, quando depende da marca, o link para o lugar de agir.</p>
 *
 * <p>Quem precisa de ação sobe: alerta (disputa, recusa), depois atenção (revisar, abrir custódia,
 * pagar), depois o que está andando sem a marca, e por último o que terminou.</p>
 */
export function funilDaCampanha(
  d: CampaignDetail,
  /**
   * Criadores cuja conta de recebimento ainda não está pronta. O detalhe da campanha não traz
   * isso; sem o dado, custódia liberável parecia pagamento esperando a marca.
   */
  contaNaoPronta: ReadonlySet<string> = new Set(),
): LinhaFunil[] {
  const nomes = new Map<string, string>()
  for (const i of d.invites ?? []) nomes.set(i.influencerId, i.influencerName)
  for (const c of d.contracts) nomes.set(c.influencerId, c.influencerName)

  const linhas: LinhaFunil[] = []

  for (const [influencerId, nome] of nomes) {
    const base = { influencerId, nome }
    const contratos = d.contracts.filter((c) => c.influencerId === influencerId)
    // A API manda do mais antigo ao mais novo: o último que não foi cancelado é o trabalho atual.
    const c = contratos.filter((x) => x.status !== "Cancelled").at(-1)

    if (!c) {
      if (contratos.length > 0) {
        linhas.push({ ...base, etapa: "Contrato cancelado", tom: "ok", acao: null })
        continue
      }
      // Sem contrato: vale o convite, com o aceito na frente do mais recente.
      const convites = (d.invites ?? []).filter((i) => i.influencerId === influencerId)
      const convite = convites.find((i) => i.accepted) ?? convites[0]
      if (convite?.accepted) {
        linhas.push({ ...base, etapa: "Aceitou — sem contrato", tom: "atencao", acao: { label: "Criar contrato", to: `/operations/contracts?novo=1&campanha=${d.campaignId}&criador=${influencerId}` } })
      } else if (convite?.expired) {
        linhas.push({ ...base, etapa: "Convite vencido", tom: "neutro", acao: null })
      } else {
        linhas.push({ ...base, etapa: "Convite enviado", tom: "neutro", acao: null })
      }
      continue
    }

    const contrato = `/operations/contracts/${c.contractId}`
    const fila = `/operations/deliveries?campanha=${d.campaignId}&contrato=${c.contractId}`

    if (c.status === "Draft") {
      linhas.push({ ...base, etapa: "Rascunho do contrato", tom: "atencao", acao: { label: "Revisar e enviar", to: contrato } })
      continue
    }
    if (c.status === "SentForSignature") {
      linhas.push({ ...base, etapa: "Aguardando assinatura", tom: "neutro", acao: { label: "Ver contrato", to: contrato } })
      continue
    }

    // Assinado. O que o dinheiro diz vem antes da entrega quando já encerrou ou travou.
    if (c.escrowState === "Released") {
      linhas.push({ ...base, etapa: "Pago", tom: "ok", acao: null })
      continue
    }
    if (c.escrowState === "Refunded") {
      linhas.push({ ...base, etapa: "Reembolsado", tom: "ok", acao: null })
      continue
    }
    if (c.escrowState === "Disputed") {
      linhas.push({ ...base, etapa: "Em disputa", tom: "alerta", acao: { label: "Ver custódia", to: "/operations/escrow" } })
      continue
    }

    const ultima = d.deliveries
      .filter((x) => x.contractId === c.contractId)
      .sort((a, b) => b.submissionAttempt - a.submissionAttempt)[0]

    if (ultima) {
      if (ultima.status === "Submitted" || ultima.status === "UnderReview") {
        linhas.push({ ...base, etapa: "Entrega esperando revisão", tom: "atencao", acao: { label: "Revisar entrega", to: fila } })
      } else if (ultima.status === "ReworkRequested") {
        linhas.push({ ...base, etapa: "Correção pedida — vez do criador", tom: "neutro", acao: { label: "Ver entrega", to: fila } })
      } else if (ultima.status === "Rejected") {
        linhas.push({ ...base, etapa: "Entrega recusada", tom: "alerta", acao: { label: "Ver entrega", to: fila } })
      } else if (c.escrowState === "Releasable" && contaNaoPronta.has(influencerId)) {
        // Liberável, mas a vez é do criador: o pagamento espera a conta dele. Mandar a marca à
        // custódia a fazia procurar um clique que não resolve nada.
        linhas.push({
          ...base,
          etapa: "Aprovada — pagamento esperando a conta do criador",
          tom: "neutro",
          acao: { label: "Ver criador", to: `/operations/influencers?criador=${influencerId}` },
        })
      } else if (c.escrowState === "Releasable") {
        linhas.push({ ...base, etapa: "Aprovada — pagamento liberável", tom: "atencao", acao: { label: "Ver custódia", to: "/operations/escrow" } })
      } else {
        linhas.push({ ...base, etapa: "Entrega aprovada", tom: "ok", acao: null })
      }
      continue
    }

    if (c.usesEscrow && !c.escrowState) {
      linhas.push({ ...base, etapa: "Assinado — custódia não aberta", tom: "atencao", acao: { label: "Abrir custódia", to: contrato } })
    } else if (c.escrowState === "PendingDeposit") {
      linhas.push({ ...base, etapa: "Aguardando o depósito", tom: "neutro", acao: { label: "Ver contrato", to: contrato } })
    } else {
      linhas.push({ ...base, etapa: "Em produção", tom: "neutro", acao: null })
    }
  }

  // sort é estável: dentro do mesmo tom, a ordem de chegada se mantém.
  return linhas.sort((a, b) => ORDEM[a.tom] - ORDEM[b.tom])
}
