import { useState } from "react"
import { AlertTriangle, Check, Loader2, Plus, ShieldCheck, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BrandAvatar } from "@/components/ui/brand-avatar"
import { apiMessage } from "@/lib/api-error"
import { useUpdateCuration, type AdminBrand } from "@/lib/api/admin"
import type { CurationDiff } from "@/lib/admin-curation"
import {
  describeCurationDiff, diffCuration, looksMisconfigured, needsChannelRemovalConfirmation,
} from "@/lib/admin-curation"
import { useCurationDraft, type CurationDraft } from "@/components/admin/curation-draft"

/**
 * Edição de marca já verificada, em três passos (`src-admin/brand-edit-modal.jsx`).
 *
 * O passo a passo é do design e existe por um motivo de produto, não de estética:
 * o terceiro passo obriga o curador a olhar o impacto antes de salvar. Mexer
 * aqui muda a análise base de **todos** os tenants inscritos.
 *
 * ## Onde diverge do design, e por quê
 *
 * | Design | Aqui |
 * |---|---|
 * | Editar nome e slug | Somente leitura — identidade tem mecanismo próprio (merge), e slug muda link publicado |
 * | Escopo "só as análises afetadas" | Não existe: o backend reprocessa a marca inteira ou nada |
 * | Custo estimado em R$ | Não há fonte de preço na API — número inventado num aviso de custo é pior que omitir |
 * | Concorrência otimista com diff | Last-write-wins, com antes/depois no audit log |
 */
const STEPS = ["Identidade e canais", "Aliases canônicos", "Impacto e reprocessamento"] as const

export function BrandEditModal({ brand, onClose }: { brand: AdminBrand; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState(brand.category ?? "")
  const [notes, setNotes] = useState("")
  const [reprocess, setReprocess] = useState(false)

  const draft = useCurationDraft()
  const save = useUpdateCuration(brand.brandId)

  // Semeadura única — o modal monta por marca e não é reaproveitado entre elas.
  const [seeded, setSeeded] = useState(false)
  if (!seeded) {
    setSeeded(true)
    draft.reset(brand.canonicalAliases, brand.officialChannelIds)
  }

  const diff = diffCuration(brand, { canonicalAliases: draft.aliases, officialChannelIds: draft.channels })
  const categoryChanged = (brand.category ?? "") !== category.trim()
  const hasChanges = diff.hasChanges || categoryChanged
  const isLast = step === STEPS.length - 1

  const commit = () => {
    save.mutate({
      canonicalAliases: draft.aliases,
      officialChannelIds: draft.channels,
      category: categoryChanged ? category.trim() : undefined,
      notes: notes.trim() || undefined,
      reprocessExisting: reprocess,
    }, { onSuccess: onClose })
  }

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.32)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border-soft shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal="true"
        aria-label={`Editar marca verificada ${brand.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <div className="eyebrow mb-2">Editar marca verificada</div>
              <div className="flex items-center gap-3">
                <BrandAvatar name={brand.name} seed={brand.slug} size={30} radius={8} />
                <h2 className="font-display m-0 truncate" style={{ fontSize: 23, color: "var(--ink)" }}>{brand.name}</h2>
                <span className="font-mono-zoe text-[11px] text-ink-muted shrink-0">{brand.slug}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] cursor-pointer shrink-0"
              aria-label="Fechar"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Trilha de passos: clicável só para voltar. Avançar exige o botão,
              que é onde o rótulo muda conforme o que vai acontecer. */}
          <div className="flex gap-2 mb-4">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => i < step && setStep(i)}
                className={`flex-1 text-left ${i < step ? "cursor-pointer" : "cursor-default"}`}
              >
                <div
                  className="h-[3px] rounded-sm mb-1.5"
                  style={{ background: i <= step ? "var(--color-teal-500)" : "var(--border-soft)" }}
                />
                <div
                  className="text-[11px] font-semibold"
                  style={{ color: i === step ? "var(--color-teal-700)" : "var(--ink-muted)" }}
                >
                  {s}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-7 pb-6 overflow-y-auto flex-1">
          {step === 0 && (
            <IdentityStep brand={brand} category={category} onCategory={setCategory} draft={draft} />
          )}
          {step === 1 && <AliasStep brand={brand} draft={draft} removed={diff.aliasesRemoved} />}
          {step === 2 && (
            <ImpactStep
              brand={brand}
              diff={diff}
              hasChanges={hasChanges}
              reprocess={reprocess}
              onReprocess={setReprocess}
              notes={notes}
              onNotes={setNotes}
            />
          )}

          {save.isError && (
            <p className="text-[13px] text-neg mt-4">{apiMessage(save.error, "Não foi possível salvar.")}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-7 py-3.5 border-t border-border-soft shrink-0">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="h-9 px-3.5 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors cursor-pointer"
            >
              Voltar
            </button>
          ) : (
            <button onClick={onClose} className="h-9 px-3 text-[13px] text-ink-muted hover:text-ink cursor-pointer">
              Cancelar
            </button>
          )}

          <div className="flex items-center gap-3">
            <span className="text-[12px] text-ink-muted">{describeCurationDiff(diff)}</span>
            {isLast ? (
              <button
                onClick={commit}
                disabled={!hasChanges || save.isPending}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {reprocess ? "Salvar e reprocessar" : "Salvar alterações"}
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="h-9 px-4 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors cursor-pointer"
              >
                Continuar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Passo 1 ────────────────────────────────────────────────────────────

function IdentityStep({
  brand, category, onCategory, draft,
}: {
  brand: AdminBrand
  category: string
  onCategory: (v: string) => void
  draft: CurationDraft
}) {
  return (
    <>
      <div className="flex gap-2.5 rounded-lg px-3.5 py-3 mb-5" style={{ background: "var(--color-teal-50)" }}>
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-teal-600)" }} />
        <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {brand.verifiedAt && (
            <>Verificada {formatDistanceToNow(new Date(brand.verifiedAt), { addSuffix: true, locale: ptBR })} · </>
          )}
          {brand.subscriberTenantsCount} {brand.subscriberTenantsCount === 1 ? "tenant inscrito" : "tenants inscritos"} ·{" "}
          {brand.analysesCount.toLocaleString("pt-BR")} {brand.analysesCount === 1 ? "análise base" : "análises base"}.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-2">
        <ReadOnlyField label="Nome canônico" value={brand.name} />
        <ReadOnlyField label="Slug" value={brand.slug} mono />
      </div>
      {/* O design permite renomear aqui. A API não: identidade de marca tem
          mecanismo próprio (merge), e trocar o slug quebra link já publicado. */}
      <p className="text-[11.5px] text-ink-muted-2 mb-5 leading-snug">
        Nome e slug não se editam por aqui — são a identidade da marca global. Marca duplicada resolve-se por merge,
        que preserva o histórico.
      </p>

      <label className="block text-[12px] text-ink-muted mb-1.5">Categoria</label>
      <input
        value={category}
        onChange={(e) => onCategory(e.target.value)}
        placeholder="Fintech, Varejo…"
        maxLength={60}
        className="w-full h-9 px-3 text-[13px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500 mb-6"
      />

      <div className="eyebrow mb-2">Canais oficiais</div>
      <p className="text-[12px] text-ink-muted-2 mb-3 leading-snug">
        Autoridade de owned vs. earned. Remover um canal devolve os vídeos dele para o bolo de menções de terceiros —
        e isso muda números que o cliente já viu.
      </p>
      <ChannelField draft={draft} />
    </>
  )
}

function ReadOnlyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <label className="block text-[12px] text-ink-muted mb-1.5">{label}</label>
      <div
        className={`h-9 px-3 flex items-center text-[13px] rounded-lg border border-border-soft truncate ${mono ? "font-mono-zoe" : ""}`}
        style={{ color: "var(--ink-muted)" }}
      >
        {value}
      </div>
    </div>
  )
}

function ChannelField({ draft }: { draft: CurationDraft }) {
  return (
    <>
      <div className="flex gap-2">
        <input
          value={draft.channelDraft}
          onChange={(e) => { draft.setChannelDraft(e.target.value); draft.setChannelError(null) }}
          onKeyDown={(e) => { if (e.key === "Enter" && !draft.resolvingChannel) { e.preventDefault(); draft.addChannel() } }}
          placeholder="link youtube.com/@marca, @handle ou UCxxxxxxxx…"
          disabled={draft.resolvingChannel}
          className="flex-1 h-9 px-3 text-[13px] font-mono-zoe rounded-lg border bg-transparent outline-none focus:border-teal-500 disabled:opacity-50"
          style={{ borderColor: draft.channelError ? "var(--color-neg)" : "var(--border-soft)" }}
        />
        <button
          type="button"
          onClick={draft.addChannel}
          disabled={!draft.channelDraft.trim() || draft.resolvingChannel}
          className="h-9 px-3 rounded-lg border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Adicionar canal"
        >
          {draft.resolvingChannel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
      {draft.channelError && <p className="text-[11.5px] text-neg mt-1.5">{draft.channelError}</p>}
      {draft.channels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {draft.channels.map((ch) => (
            <span
              key={ch}
              title={ch}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md text-[12px] font-mono-zoe bg-[#F3F4F6] dark:bg-[#1A1D2D]"
              style={{ color: "var(--ink-2)" }}
            >
              {draft.channelTitles[ch] ? <span className="font-sans">{draft.channelTitles[ch]}</span> : ch}
              <button
                onClick={() => draft.removeChannel(ch)}
                aria-label={`Remover ${ch}`}
                className="text-ink-muted hover:text-neg cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  )
}

// ── Passo 2 ────────────────────────────────────────────────────────────

function AliasStep({
  brand, draft, removed,
}: {
  brand: AdminBrand
  draft: CurationDraft
  removed: string[]
}) {
  const isNew = (a: string) => !brand.canonicalAliases.some((x) => x.toLowerCase() === a.toLowerCase())

  return (
    <>
      <p className="text-[13px] text-ink-muted leading-relaxed mb-4">
        Estes aliases parametrizam a detecção da marca na análise base — a camada compartilhada por todos os tenants
        inscritos. As palavras-chave que cada tenant cria no próprio workspace são outra camada e não aparecem aqui.
      </p>

      <div className="flex gap-2 mb-3.5">
        <input
          value={draft.aliasDraft}
          onChange={(e) => draft.setAliasDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); draft.commitAliasDraft() } }}
          placeholder="novo alias canônico"
          className="flex-1 h-9 px-3 text-[13px] font-mono-zoe rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500"
        />
        <button
          type="button"
          onClick={draft.commitAliasDraft}
          disabled={!draft.aliasDraft.trim()}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {draft.aliases.length === 0 && (
          <span className="text-[12.5px] text-ink-muted-2 italic">
            Nenhum alias — a marca é detectada só pelo nome.
          </span>
        )}
        {draft.aliases.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md text-[12.5px] font-mono-zoe border"
            style={isNew(a)
              ? { background: "var(--pos-bg)", borderColor: "rgba(22,163,74,.3)", color: "var(--color-pos)" }
              : { background: "#F3F4F6", borderColor: "transparent", color: "var(--ink-2)" }}
          >
            {`"${a}"`}
            <button
              onClick={() => draft.removeAlias(a)}
              aria-label={`Remover ${a}`}
              className="text-ink-muted hover:text-neg cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {removed.length > 0 && (
        <div className="rounded-lg border p-3.5" style={{ borderColor: "rgba(220,38,38,.25)", background: "var(--neg-bg)" }}>
          <div className="eyebrow mb-2.5" style={{ color: "var(--color-neg)" }}>Removidos nesta edição</div>
          {removed.map((a) => (
            <div key={a} className="flex items-center gap-2.5 py-1">
              <span className="font-mono-zoe text-[12.5px] flex-1 line-through" style={{ color: "var(--color-neg)" }}>
                {`"${a}"`}
              </span>
              <button
                onClick={() => draft.restoreAlias(a)}
                className="text-[12px] underline cursor-pointer"
                style={{ color: "var(--color-neg)" }}
              >
                restaurar
              </button>
            </div>
          ))}
          <p className="text-[11.5px] mt-2 leading-snug" style={{ color: "var(--color-neg)" }}>
            Menções encontradas só por estes termos deixam de ser atribuídas à marca daqui pra frente. O que já foi
            analisado só muda se você reprocessar.
          </p>
        </div>
      )}
    </>
  )
}

// ── Passo 3 ────────────────────────────────────────────────────────────

function ImpactStep({
  brand, diff, hasChanges, reprocess, onReprocess, notes, onNotes,
}: {
  brand: AdminBrand
  diff: CurationDiff
  hasChanges: boolean
  reprocess: boolean
  onReprocess: (v: boolean) => void
  notes: string
  onNotes: (v: string) => void
}) {
  const aliasesChanged = diff.aliasesAdded.length > 0 || diff.aliasesRemoved.length > 0
  const channelsChanged = diff.channelsAdded.length > 0 || diff.channelsRemoved.length > 0

  if (!hasChanges) {
    return (
      <div className="rounded-lg border border-border-soft p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <Check className="w-4 h-4" style={{ color: "var(--color-pos)" }} />
          <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Nada a salvar</div>
        </div>
        <p className="text-[12.5px] text-ink-muted leading-relaxed m-0">
          Nenhum campo mudou. Volte aos passos anteriores para editar aliases, canais ou categoria.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-border-soft grid grid-cols-3 mb-4">
        {[
          { l: "Tenants inscritos", v: brand.subscriberTenantsCount.toLocaleString("pt-BR") },
          { l: "Análises da marca", v: brand.analysesCount.toLocaleString("pt-BR") },
          { l: "Hoje classificadas owned", v: brand.ownedAnalysesCount.toLocaleString("pt-BR") },
        ].map((m, i) => (
          <div key={m.l} className={`px-4 py-3.5 ${i < 2 ? "border-r border-border-soft" : ""}`}>
            <div className="eyebrow">{m.l}</div>
            <div className="font-display mt-1.5" style={{ fontSize: 24, color: "var(--ink)" }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Canal e alias têm consequências DIFERENTES, e confundir as duas é o erro
          caro aqui: canal reclassifica sozinho e de graça; alias não. */}
      {channelsChanged && (
        <div className="flex gap-2.5 rounded-lg px-3.5 py-3 mb-3" style={{ background: "var(--color-teal-50)" }}>
          <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-teal-600)" }} />
          <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            A mudança de canais reclassifica owned/earned de todas as análises da marca automaticamente ao salvar,
            sem custo de reanálise.
          </div>
        </div>
      )}

      {needsChannelRemovalConfirmation(diff) && (
        <div
          className="flex gap-2.5 rounded-lg border px-3.5 py-3 mb-3"
          style={{ background: "var(--neg-bg)", borderColor: "rgba(220,38,38,.25)" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-neg)" }} />
          <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--color-neg)" }}>
            <strong>
              {diff.channelsRemoved.length === 1 ? "Um canal oficial sai" : `${diff.channelsRemoved.length} canais oficiais saem`} da marca.
            </strong>{" "}
            Os vídeos publicados por {diff.channelsRemoved.length === 1 ? "ele" : "eles"} deixam de contar como mídia
            própria e voltam a entrar em Share of Voice e evolução de sentimento — números que o cliente já viu vão mudar.
          </div>
        </div>
      )}

      {aliasesChanged && (
        <>
          <div className="flex gap-2.5 rounded-lg px-3.5 py-3 mb-4" style={{ background: "var(--warn-bg)" }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-warn)" }} />
            <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--color-warn)" }}>
              Sem reprocessar, as análises antigas continuam com os aliases anteriores e as novas usam os atuais — os
              dois conjuntos convivem no mesmo dashboard sem nada sinalizar a diferença.
            </div>
          </div>

          <div className="eyebrow mb-2.5">Reprocessamento</div>
          {/* O design oferece "só as análises afetadas". A API não sabe quais
              seriam sem re-rodar o modelo, então a escolha honesta é binária. */}
          {[
            {
              on: false,
              t: "Não reprocessar agora",
              d: "Os aliases novos valem para as próximas análises. Dá para reprocessar depois, por esta mesma tela.",
            },
            {
              on: true,
              t: "Reprocessar a marca inteira",
              d: `${brand.analysesCount.toLocaleString("pt-BR")} ${brand.analysesCount === 1 ? "análise volta" : "análises voltam"} para a fila e ${brand.analysesCount === 1 ? "é reanalisada" : "são reanalisadas"} com os aliases novos. Cada uma passa pelo modelo de novo — isso custa.`,
            },
          ].map((o) => (
            <label
              key={String(o.on)}
              className="flex items-start gap-3 p-3.5 rounded-lg border mb-2 cursor-pointer transition-colors"
              style={{
                borderColor: reprocess === o.on ? "var(--color-teal-500)" : "var(--border-soft)",
                background: reprocess === o.on ? "var(--color-teal-50)" : "transparent",
              }}
            >
              <input
                type="radio"
                checked={reprocess === o.on}
                onChange={() => onReprocess(o.on)}
                className="accent-teal-500 mt-0.5"
              />
              <div>
                <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{o.t}</div>
                <div className="text-[12px] text-ink-muted mt-0.5 leading-snug">{o.d}</div>
              </div>
            </label>
          ))}
        </>
      )}

      <label className="block text-[12px] text-ink-muted mt-5 mb-1.5">Nota da correção (opcional)</label>
      <textarea
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        rows={2}
        placeholder="Por que mudou — fica no histórico da marca."
        className="w-full px-3 py-2 text-[13px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500 resize-y"
      />

      {looksMisconfigured(brand) && (
        <p className="text-[11.5px] text-ink-muted-2 mt-3 leading-snug">
          Lembrete: esta marca declara canal oficial mas não tem nenhuma análise classificada como mídia própria — se o
          objetivo é corrigir isso, confira o channel id no primeiro passo.
        </p>
      )}
    </>
  )
}
