import type { CampaignContract, CampaignDetail } from "@/lib/api/operations"

export type TomFunil = "alerta" | "atencao" | "neutro" | "ok"

/** Um criador da campanha: onde ele está e, quando a vez é da marca, o que fazer. */
export type LinhaFunil = {
  influencerId: string
  nome: string
  etapa: string
  tom: TomFunil
  acao: { label: string; to: string } | null
  /**
   * Outros contratos ativos do mesmo criador na campanha. A linha mostra o que mais precisa da
   * marca; sem este número, um segundo trabalho em andamento simplesmente sumia da tela.
   */
  outrosContratos: number
}

type Etapa = Pick<LinhaFunil, "etapa" | "tom" | "acao">

const ORDEM: Record<TomFunil, number> = { alerta: 0, atencao: 1, neutro: 2, ok: 3 }

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
    const base = { influencerId, nome, outrosContratos: 0 }
    const contratos = d.contracts.filter((c) => c.influencerId === influencerId)
    const ativos = contratos.filter((x) => x.status !== "Cancelled")

    if (ativos.length === 0) {
      if (contratos.length > 0) {
        linhas.push({ ...base, etapa: "Contrato cancelado", tom: "ok", acao: null })
        continue
      }
      // Sem contrato: vale o convite, com o aceito na frente do mais recente.
      const convites = (d.invites ?? []).filter((i) => i.influencerId === influencerId)
      const convite = convites.find((i) => i.accepted) ?? convites[0]
      if (convite?.accepted) {
        linhas.push({ ...base, etapa: "Aceitou — sem contrato", tom: "atencao", acao: { label: "Criar contrato", to: `/operations/contracts?new=1&campaign=${d.campaignId}&creator=${influencerId}` } })
      } else if (convite?.expired) {
        linhas.push({ ...base, etapa: "Convite vencido", tom: "neutro", acao: null })
      } else {
        linhas.push({ ...base, etapa: "Convite enviado", tom: "neutro", acao: null })
      }
      continue
    }

    // Mais de um trabalho com o mesmo criador: vale o que mais precisa da marca. No empate, o mais
    // antigo (a API manda do mais antigo ao mais novo) — é o que está esperando há mais tempo.
    let escolhida = etapaDoContrato(d, ativos[0], contaNaoPronta)
    for (const c of ativos.slice(1)) {
      const e = etapaDoContrato(d, c, contaNaoPronta)
      if (ORDEM[e.tom] < ORDEM[escolhida.tom]) escolhida = e
    }
    linhas.push({ ...base, ...escolhida, outrosContratos: ativos.length - 1 })
  }

  // sort é estável: dentro do mesmo tom, a ordem de chegada se mantém.
  return linhas.sort((a, b) => ORDEM[a.tom] - ORDEM[b.tom])
}

/** Etapa de um contrato não cancelado. */
function etapaDoContrato(
  d: CampaignDetail,
  c: CampaignContract,
  contaNaoPronta: ReadonlySet<string>,
): Etapa {
  const contrato = `/operations/contracts/${c.contractId}`
  const fila = `/operations/deliveries?campaign=${d.campaignId}&contract=${c.contractId}`

  if (c.status === "Draft") {
    return { etapa: "Rascunho do contrato", tom: "atencao", acao: { label: "Revisar e enviar", to: contrato } }
  }
  if (c.status === "SentForSignature") {
    return { etapa: "Aguardando assinatura", tom: "neutro", acao: { label: "Ver contrato", to: contrato } }
  }

  // Assinado. O que o dinheiro diz vem antes da entrega quando já encerrou ou travou.
  if (c.escrowState === "Released") return { etapa: "Pago", tom: "ok", acao: null }
  if (c.escrowState === "Refunded") return { etapa: "Reembolsado", tom: "ok", acao: null }
  if (c.escrowState === "Disputed") {
    return { etapa: "Em disputa", tom: "alerta", acao: { label: "Ver custódia", to: "/operations/escrow" } }
  }

  const ultima = d.deliveries
    .filter((x) => x.contractId === c.contractId)
    .sort((a, b) => b.submissionAttempt - a.submissionAttempt)[0]

  if (ultima) {
    if (ultima.status === "Submitted" || ultima.status === "UnderReview") {
      return { etapa: "Entrega esperando revisão", tom: "atencao", acao: { label: "Revisar entrega", to: fila } }
    }
    if (ultima.status === "ReworkRequested") {
      return { etapa: "Correção pedida — vez do criador", tom: "neutro", acao: { label: "Ver entrega", to: fila } }
    }
    if (ultima.status === "Rejected") {
      return { etapa: "Entrega recusada", tom: "alerta", acao: { label: "Ver entrega", to: fila } }
    }
    if (c.escrowState === "Releasable" && contaNaoPronta.has(c.influencerId)) {
      // Liberável, mas a vez é do criador: o pagamento espera a conta dele. Mandar a marca à
      // custódia a fazia procurar um clique que não resolve nada.
      return {
        etapa: "Aprovada — pagamento esperando a conta do criador",
        tom: "neutro",
        acao: { label: "Ver criador", to: `/operations/influencers?creator=${c.influencerId}` },
      }
    }
    if (c.escrowState === "Releasable") {
      return { etapa: "Aprovada — pagamento liberável", tom: "atencao", acao: { label: "Ver custódia", to: "/operations/escrow" } }
    }
    return { etapa: "Entrega aprovada", tom: "ok", acao: null }
  }

  // Sem entrega ainda: o corte diz em que pé está a produção. Corte esperando aprovação é a
  // etapa em que o criador mais fica parado, e o funil não a mostrava.
  if (c.draftStatus === "AwaitingReview") {
    return { etapa: "Corte esperando aprovação", tom: "atencao", acao: { label: "Revisar o corte", to: "/operations/deliveries?stage=drafts" } }
  }
  if (c.draftStatus === "ChangesRequested") {
    return { etapa: "Correção no corte — vez do criador", tom: "neutro", acao: null }
  }
  if (c.draftStatus === "Approved") {
    return { etapa: "Corte aprovado — aguardando publicar", tom: "neutro", acao: null }
  }

  if (c.usesEscrow && !c.escrowState) {
    return { etapa: "Assinado — custódia não aberta", tom: "atencao", acao: { label: "Abrir custódia", to: contrato } }
  }
  if (c.escrowState === "PendingDeposit") {
    return { etapa: "Aguardando o depósito", tom: "neutro", acao: { label: "Ver contrato", to: contrato } }
  }
  return { etapa: "Em produção", tom: "neutro", acao: null }
}
