import type { TenantBrandSummary } from "@/lib/api/brands"

/**
 * Como as telas falam DA marca ativa.
 *
 * Existe porque o produto passou a deixar concorrente virar marca ativa: o dado dele
 * já foi pago em minutos e ele consome slot, então esconder a análise tira valor sem
 * ganhar nada (ADR-035 D6, emenda). O que não pode continuar é a copy — escrita em
 * primeira pessoa ("sua marca", "seu próprio canal") — descrever o concorrente como
 * se fosse do cliente. Alguém tira print para um deck e o slide mente.
 *
 * Um lugar só, e não um ternário em cada tela: a próxima superfície que falar da
 * marca ativa nasce com o enquadramento certo em vez de herdar o errado.
 */
export type BrandVoice = {
  /** Marca própria ou parceira. Falso = concorrente. */
  isOwn: boolean
  name: string
  /** "sua marca" · "a marca Nubank" */
  aMarca: string
  /** "seu próprio canal" · "o canal da Nubank" */
  oCanalProprio: string
  /** "sua" · "dela" — para "a participação {x}" */
  possessivo: string
}

export function brandVoice(active: TenantBrandSummary | null | undefined): BrandVoice {
  const name = active?.displayName ?? active?.brandName ?? "esta marca"
  const isOwn = active?.relationship !== "Competitor"

  return isOwn
    ? { isOwn, name, aMarca: "sua marca", oCanalProprio: "seu próprio canal", possessivo: "sua" }
    : {
        isOwn,
        name,
        aMarca: `a marca ${name}`,
        oCanalProprio: `o canal da ${name}`,
        possessivo: "dela",
      }
}
