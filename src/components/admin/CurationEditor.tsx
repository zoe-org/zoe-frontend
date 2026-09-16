import { Check, Loader2, Plus, X } from "lucide-react"
import type { CurationDraft } from "@/components/admin/curation-draft"
import type { TenantAliasSuggestion } from "@/lib/api/admin"

/**
 * Bloco em card do painel de curadoria (o `.card` do design). O título vai em
 * `eyebrow` e pode ser numerado ("1 · Aliases…") — a numeração é o que dá ordem
 * de leitura a um painel com seis blocos empilhados.
 */
export function CurationCard({
  title, hint, tone, right, children,
}: {
  title: string
  hint?: string
  /** `warn` para o bloco de duplicatas, que pede atenção sem ser erro. */
  tone?: "warn"
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg border p-4 mb-4"
      style={{ borderColor: tone === "warn" ? "rgba(217,119,6,.3)" : "var(--border-soft)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="eyebrow">{title}</div>
        {right}
      </div>
      {hint && <p className="text-[12px] text-ink-muted-2 mt-1 mb-3 max-w-160 leading-snug">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  )
}

/**
 * Editor de curadoria: aliases canônicos e canais oficiais. Compartilhado pela
 * verificação (marca na fila) e pela correção (marca já verificada) — os campos
 * e as regras são os mesmos nos dois momentos; o que muda é a barra de ações,
 * que fica com quem chama.
 */
export function CurationEditor({
  draft,
  suggestions,
  aliasTitle = "Aliases canônicos",
  channelTitle = "Canais oficiais",
}: {
  draft: CurationDraft
  /** Sugestões dos tenants para promover. Marca verificada geralmente não tem — daí o alias manual. */
  suggestions?: TenantAliasSuggestion[]
  aliasTitle?: string
  channelTitle?: string
}) {
  return (
    <>
      <CurationCard
        title={aliasTitle}
        hint="Entram na análise base de TODOS os tenants que assinam a marca. Promova só o que é inequivocamente a marca."
        right={
          suggestions && suggestions.length > 0 ? (
            <span className="font-mono-zoe text-[11.5px] text-ink-muted shrink-0">
              {suggestions.filter((s) => draft.isPromoted(s.keyword)).length} de {suggestions.length} aprovados
            </span>
          ) : undefined
        }
      >
        {suggestions && suggestions.length > 0 && (
          <>
            <div className="text-[12px] text-ink-muted-2 mb-2">Sugeridos pelos tenants</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestions.map((s) => {
                const on = draft.isPromoted(s.keyword)
                return (
                  <button
                    key={`${s.tenantId}-${s.keyword}`}
                    onClick={() => draft.toggleAlias(s.keyword)}
                    title={`Sugerido por ${s.tenantName ?? "tenant"} · ${s.occurrences}×`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] border transition-colors cursor-pointer ${
                      on
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/25 text-teal-700 dark:text-teal-300"
                        : "border-border-soft text-ink-2 hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
                    }`}
                  >
                    {on ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {s.keyword}
                    <span className="font-mono-zoe text-[10.5px] text-ink-muted">{s.occurrences}×</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="flex gap-2">
          <input
            value={draft.aliasDraft}
            onChange={(e) => draft.setAliasDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); draft.commitAliasDraft() } }}
            placeholder="adicionar alias verificado"
            className="flex-1 h-9 px-3 text-[13px] font-mono-zoe rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500"
          />
          <button
            type="button"
            onClick={draft.commitAliasDraft}
            disabled={!draft.aliasDraft.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-lg border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>

        <div className="mt-3.5 text-[12px] text-ink-muted">
          Serão gravados:{" "}
          {draft.aliases.length === 0
            ? <span className="italic">nenhum alias</span>
            : draft.aliases.map((a) => (
                <span key={a} className="chip chip-primary mr-1.5 mb-1.5">
                  {a}
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
      </CurationCard>

      <CurationCard
        title={channelTitle}
        hint="Autoridade de owned vs. earned: vídeo publicado por um destes canais conta como mídia própria da marca, nunca como menção espontânea."
      >
        <div className="flex gap-2">
          <input
            value={draft.channelDraft}
            onChange={(e) => { draft.setChannelDraft(e.target.value); draft.setChannelError(null) }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !draft.resolvingChannel) { e.preventDefault(); draft.addChannel() }
            }}
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
        {draft.channels.length === 0 ? (
          <p className="text-[13px] text-ink-muted mt-3 leading-relaxed">
            Nenhum canal informado. Dá para verificar sem canal, mas o auto-link por canal deixa de funcionar na
            resolução de identidade — e nenhum vídeo é classificado como mídia própria.
          </p>
        ) : (
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
      </CurationCard>
    </>
  )
}
