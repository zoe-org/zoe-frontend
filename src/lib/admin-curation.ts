import type { AdminBrand } from "@/lib/api/admin"

/**
 * Lógica pura da edição de curadoria pós-verificação.
 *
 * Editar alias canônico e canal oficial mexe em dado **global**: entra na
 * análise base de todos os tenants que assinam a marca. Salvar sem o curador ver
 * o que vai mudar é o pior resultado possível desta tela — daí o diff ser
 * calculado e mostrado antes, e não depois.
 */

export type CurationDiff = {
  aliasesAdded: string[]
  aliasesRemoved: string[]
  channelsAdded: string[]
  channelsRemoved: string[]
  hasChanges: boolean
}

/**
 * Compara alias com case-insensitive e canal com case-sensitive — exatamente
 * como o domínio faz (`SanitizeAliases` usa OrdinalIgnoreCase,
 * `NormalizeOfficialChannelIds` usa Ordinal). Divergir aqui mostraria "removeu
 * e adicionou" para uma troca de maiúscula que o backend trata como no-op.
 */
export function diffCuration(
  before: { canonicalAliases: readonly string[]; officialChannelIds: readonly string[] },
  after: { canonicalAliases: readonly string[]; officialChannelIds: readonly string[] },
): CurationDiff {
  const aliasesAdded = missingFrom(after.canonicalAliases, before.canonicalAliases, true)
  const aliasesRemoved = missingFrom(before.canonicalAliases, after.canonicalAliases, true)
  const channelsAdded = missingFrom(after.officialChannelIds, before.officialChannelIds, false)
  const channelsRemoved = missingFrom(before.officialChannelIds, after.officialChannelIds, false)

  return {
    aliasesAdded,
    aliasesRemoved,
    channelsAdded,
    channelsRemoved,
    hasChanges:
      aliasesAdded.length > 0 || aliasesRemoved.length > 0 ||
      channelsAdded.length > 0 || channelsRemoved.length > 0,
  }
}

function missingFrom(source: readonly string[], reference: readonly string[], ignoreCase: boolean): string[] {
  const known = new Set(reference.map((v) => (ignoreCase ? v.toLowerCase() : v)))
  return source.filter((v) => !known.has(ignoreCase ? v.toLowerCase() : v))
}

/** Frase do botão/confirmação: o que exatamente vai acontecer ao salvar. */
export function describeCurationDiff(diff: CurationDiff): string {
  if (!diff.hasChanges) return "Nenhuma alteração"

  const parts: string[] = []
  if (diff.aliasesAdded.length) parts.push(plural(diff.aliasesAdded.length, "alias adicionado", "aliases adicionados"))
  if (diff.aliasesRemoved.length) parts.push(plural(diff.aliasesRemoved.length, "alias removido", "aliases removidos"))
  if (diff.channelsAdded.length) parts.push(plural(diff.channelsAdded.length, "canal adicionado", "canais adicionados"))
  if (diff.channelsRemoved.length) parts.push(plural(diff.channelsRemoved.length, "canal removido", "canais removidos"))

  return parts.join(" · ")
}

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`
}

/**
 * Remover canal oficial rebaixa análises de `owned` para `third_party` — muda
 * número que o cliente já viu no Owned Reaction. Merece confirmação explícita,
 * ao contrário de adicionar, que só promove.
 */
export function needsChannelRemovalConfirmation(diff: CurationDiff): boolean {
  return diff.channelsRemoved.length > 0
}

/**
 * Declarou canal oficial, tem análise, e nenhuma ficou owned. Mesmo predicado do
 * `ChannelRelationReclassification.LooksMisconfigured` no backend — que só
 * existia no audit log. Aqui ele fica visível para quem pode corrigir.
 */
export function looksMisconfigured(brand: Pick<AdminBrand,
  "officialChannelIds" | "analysesCount" | "ownedAnalysesCount">): boolean {
  return brand.officialChannelIds.length > 0
    && brand.analysesCount > 0
    && brand.ownedAnalysesCount === 0
}

/**
 * Alias novo digitado à mão. Espelha o descarte do domínio (`BrandName.NormalizeAliasOrNull`)
 * no que dá para espelhar no cliente: vazio e só-espaço não viram alias. O resto
 * da normalização (invisíveis, controle) é do backend — o cliente não é a
 * autoridade, só evita o round-trip óbvio.
 */
export function normalizeAliasInput(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** Já está na lista? Case-insensitive, igual ao domínio. */
export function containsAlias(aliases: readonly string[], candidate: string): boolean {
  return aliases.some((a) => a.toLowerCase() === candidate.toLowerCase())
}
