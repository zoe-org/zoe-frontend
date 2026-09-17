import { trabalhoLabel, type CreatorWorkspace } from "@/lib/api/creator"

/**
 * Um passo que depende do criador. O destino diz onde a tela leva: a um trabalho na aba de
 * campanhas, a um contrato na aba de contratos, a um card desta página ou a outra rota.
 */
export type ProximoPasso = {
  chave: string
  titulo: string
  detalhe: string
  destino:
    | { aba: "campanhas" | "contratos"; contractId: string }
    | { ancora: string }
    | { rota: string }
}

/**
 * O que o criador precisa fazer agora, na ordem do processo.
 *
 * <p>A área listava os trabalhos e cada card dizia o seu estado, mas a pergunta de quem abre —
 * sobretudo no celular — é "tem algo comigo?". Com três campanhas, a resposta ficava espalhada
 * em três cards e duas abas.</p>
 *
 * <p>Só entra o que é do criador. Corte em revisão e entrega aguardando são a vez da marca, e
 * listá-los aqui faria a pessoa procurar uma ação que não existe.</p>
 */
export function proximosPassos(w: CreatorWorkspace): ProximoPasso[] {
  const passos: ProximoPasso[] = []

  for (const e of w.engagements) {
    const trabalho = `${trabalhoLabel(e.campaignName)} · ${e.brandName}`
    const naCampanha = { aba: "campanhas" as const, contractId: e.contractId }

    if (e.contractStatus === "SentForSignature") {
      passos.push({
        chave: `assinar-${e.contractId}`,
        titulo: "Assinar o contrato",
        detalhe: `${trabalho} — o link de assinatura foi para o seu e-mail.`,
        destino: { aba: "contratos", contractId: e.contractId },
      })
      continue
    }

    if (!e.canSubmitDelivery) continue

    if (e.requiresDraftApproval && !e.draft) {
      passos.push({
        chave: `corte-${e.contractId}`,
        titulo: "Enviar o corte para aprovação",
        detalhe: `${trabalho} — a marca vê o vídeo antes de você publicar.`,
        destino: naCampanha,
      })
      continue
    }

    if (e.draft?.status === "ChangesRequested") {
      passos.push({
        chave: `refazer-${e.contractId}`,
        titulo: "Refazer o corte",
        detalhe: e.draft.decisionNotes ? `${trabalho} — ${e.draft.decisionNotes}` : trabalho,
        destino: naCampanha,
      })
      continue
    }

    // Corte ainda em revisão: a vez é da marca.
    const corteLiberado = !e.requiresDraftApproval || e.draft?.status === "Approved"
    if (!corteLiberado) continue

    const ultima = [...e.deliveries].sort((a, b) => b.submissionAttempt - a.submissionAttempt)[0]
    if (!ultima) {
      passos.push({
        chave: `publicar-${e.contractId}`,
        titulo: "Publicar e mandar o link",
        detalhe: e.requiresDraftApproval ? `${trabalho} — o corte foi aprovado.` : trabalho,
        destino: naCampanha,
      })
    } else if (ultima.status === "ReworkRequested") {
      passos.push({
        chave: `corrigir-${e.contractId}`,
        titulo: "Corrigir a publicação e reenviar o link",
        detalhe: ultima.decisionNotes ? `${trabalho} — ${ultima.decisionNotes}` : trabalho,
        destino: naCampanha,
      })
    }
  }

  if (!w.taxId) {
    passos.push({
      chave: "documento",
      titulo: "Informar seu CPF ou CNPJ",
      detalhe: "É o que identifica você como parte no contrato.",
      destino: { ancora: "documento" },
    })
  }

  // Título pelo estado da conta: mandar "conectar" a quem já conectou e só espera o provedor
  // fazia a pessoa refazer o que já fez. O motivo vem pronto da API.
  if (!w.canReceivePayout && w.payoutBlockedReason) {
    passos.push({
      chave: "recebimento",
      titulo: w.kycStatus === "Rejected"
        ? "Revisar os dados da conta de recebimento"
        : w.kycStatus === "Pending"
          ? "Conta de recebimento em verificação"
          : "Conectar a conta de recebimento",
      detalhe: w.payoutBlockedReason,
      destino: { rota: "/creator/payout" },
    })
  }

  return passos
}
