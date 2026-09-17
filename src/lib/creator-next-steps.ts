import { workLabel, type CreatorWorkspace } from "@/lib/api/creator"

/**
 * Um passo que depende do criador. O destino diz onde a tela leva: a um trabalho na aba de
 * campanhas, a um contrato na aba de contratos, a um card desta página ou a outra rota.
 */
export type NextStep = {
  key: string
  title: string
  detail: string
  target:
    | { tab: "campaigns" | "contracts"; contractId: string }
    | { anchor: string }
    | { route: string }
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
export function nextSteps(w: CreatorWorkspace): NextStep[] {
  const steps: NextStep[] = []

  for (const e of w.engagements) {
    const work = `${workLabel(e.campaignName)} · ${e.brandName}`
    const inCampaignsTab = { tab: "campaigns" as const, contractId: e.contractId }

    if (e.contractStatus === "SentForSignature") {
      steps.push({
        key: `assinar-${e.contractId}`,
        title: "Assinar o contrato",
        detail: `${work} — o link de assinatura foi para o seu e-mail.`,
        target: { tab: "contracts", contractId: e.contractId },
      })
      continue
    }

    if (!e.canSubmitDelivery) continue

    if (e.requiresDraftApproval && !e.draft) {
      steps.push({
        key: `corte-${e.contractId}`,
        title: "Enviar o corte para aprovação",
        detail: `${work} — a marca vê o vídeo antes de você publicar.`,
        target: inCampaignsTab,
      })
      continue
    }

    if (e.draft?.status === "ChangesRequested") {
      steps.push({
        key: `refazer-${e.contractId}`,
        title: "Refazer o corte",
        detail: e.draft.decisionNotes ? `${work} — ${e.draft.decisionNotes}` : work,
        target: inCampaignsTab,
      })
      continue
    }

    // Corte ainda em revisão: a vez é da marca.
    const draftReleased = !e.requiresDraftApproval || e.draft?.status === "Approved"
    if (!draftReleased) continue

    const latest = [...e.deliveries].sort((a, b) => b.submissionAttempt - a.submissionAttempt)[0]
    if (!latest) {
      steps.push({
        key: `publicar-${e.contractId}`,
        title: "Publicar e mandar o link",
        detail: e.requiresDraftApproval ? `${work} — o corte foi aprovado.` : work,
        target: inCampaignsTab,
      })
    } else if (latest.status === "ReworkRequested") {
      steps.push({
        key: `corrigir-${e.contractId}`,
        title: "Corrigir a publicação e reenviar o link",
        detail: latest.decisionNotes ? `${work} — ${latest.decisionNotes}` : work,
        target: inCampaignsTab,
      })
    }
  }

  if (!w.taxId) {
    steps.push({
      key: "documento",
      title: "Informar seu CPF ou CNPJ",
      detail: "É o que identifica você como parte no contrato.",
      target: { anchor: "documento" },
    })
  }

  // Título pelo estado da conta: mandar "conectar" a quem já conectou e só espera o provedor
  // fazia a pessoa refazer o que já fez. O motivo vem pronto da API.
  if (!w.canReceivePayout && w.payoutBlockedReason) {
    steps.push({
      key: "recebimento",
      title: w.kycStatus === "Rejected"
        ? "Revisar os dados da conta de recebimento"
        : w.kycStatus === "Pending"
          ? "Conta de recebimento em verificação"
          : "Conectar a conta de recebimento",
      detail: w.payoutBlockedReason,
      target: { route: "/creator/payout" },
    })
  }

  return steps
}
