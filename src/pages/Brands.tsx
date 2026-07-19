import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Plus, X, Check, AlertCircle, ExternalLink, ShieldCheck, Clock } from "lucide-react"
import { useAuth } from "@/features/auth/AuthContext"
import { ApiError } from "@/lib/api"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  useTenantBrands, useBrandKeywords, useBrandMutations, useSubscribeFlow,
  resolveOutcome, type TenantBrandSummary,
} from "@/lib/api/brands"
import { useDashboardSummary } from "@/lib/api/dashboard"

// Paleta do design (brand-modal.jsx) para o seletor de cor.
const PALETTE = ["#00A799", "#8B5CF6", "#EF4444", "#2563EB", "#F59E0B", "#14B8A6", "#EC4899"]

/** Categorias do design. Livre no backend (string), lista fechada na UI. */
const CATEGORIES = ["Fintech", "Delivery", "Beleza", "Varejo", "Bebidas", "Tecnologia", "Alimentos", "Outro"]

/**
 * z-index para popovers do Radix abertos DE DENTRO do modal.
 *
 * O `SelectContent` é portalado no `document.body` com `z-50` fixo; o modal vive
 * em `z-90`. Sem sobrescrever, o dropdown renderiza ATRÁS do modal (invisível) e
 * o clique ainda cai no backdrop, fechando tudo. `cn` usa tailwind-merge, então
 * esta classe vence o `z-50` do componente.
 *
 * Vale para QUALQUER popover Radix adicionado ao modal (select, dropdown, popover).
 */
const SELECT_IN_MODAL_Z = "z-[100]"

/** Fallback determinístico quando o tenant ainda não escolheu cor. */
function derivedColor(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** Cor efetiva: a escolhida pelo tenant, senão a derivada do slug. */
function brandColor(brand: { color: string | null; brandSlug: string }): string {
  return brand.color ?? derivedColor(brand.brandSlug)
}

/**
 * Gate de gerenciamento com semântica RESILIENTE: só esconde quando sabemos
 * positivamente que o role não pode gerenciar (Manager/Viewer). Se o role não
 * resolveu (null, caixa inesperada, enum numérico), MOSTRA os controles e deixa
 * o backend decidir — a policy `TenantAdmin` é a autoridade e devolve 403, que
 * a UI trata com mensagem específica.
 *
 * Motivo: esconder por role não-resolvido produz tela morta (um Owner sem
 * nenhum botão pra assinar marca, que é a única entrada desse fluxo). Errar
 * mostrando custa um 403 explicado; errar escondendo trava o usuário.
 */
function canManageBrands(role: string | null): boolean {
  if (role == null || role === "") return true // desconhecido → backend decide
  const r = String(role).trim().toLowerCase()
  if (r === "manager" || r === "viewer" || r === "2" || r === "3") return false
  return true // Owner/Admin (ou valor inesperado → backend decide)
}

const RELATIONSHIPS = [
  { value: "OwnBrand", label: "Marca própria" },
  { value: "Competitor", label: "Concorrente" },
  { value: "Partner", label: "Parceira" },
]
const STATUSES = [
  { value: "Active", label: "Ativa" },
  { value: "Paused", label: "Pausada" },
]

export default function BrandsPage() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const canManage = canManageBrands(role)

  const brands = useTenantBrands()
  const items = useMemo(() => brands.data?.items ?? [], [brands.data])

  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((b) => (b.displayName ?? b.brandName).toLowerCase().includes(q))
  }, [items, query])

  const selected = items.find((b) => b.tenantBrandId === selectedId) ?? filtered[0] ?? items[0] ?? null
  const totalVideos = items.reduce((a, b) => a + b.videoCount30d, 0)

  if (brands.isLoading) return <PageSkeleton />
  if (brands.isError) return <ErrorState onRetry={() => brands.refetch()} />

  if (items.length === 0) {
    return (
      <>
        {/* CTA SEMPRE presente: esta é a única tela onde se assina uma marca —
            esconder o botão deixaria o usuário sem saída. Permissão é validada
            pelo backend (403 tratado no fluxo). */}
        <EmptyState
          title="Nenhuma marca monitorada"
          description="Assine sua primeira marca para começar a monitorar menções em vídeo, áudio e comentários."
          actionLabel="Nova marca"
          onAction={() => setNewOpen(true)}
        />
        <BrandModal open={newOpen} onClose={() => setNewOpen(false)} />
      </>
    )
  }

  return (
    <div className="-m-6 border-t border-border-soft" style={{ color: "var(--ink)" }}>
      {/* Hero */}
      <section className="px-8 pt-7 pb-5 border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="eyebrow mb-2.5">Gestão · Workspace</div>
            <h1 className="font-display m-0" style={{ fontSize: 34, lineHeight: 1.1, color: "var(--ink)" }}>Marcas</h1>
            <div className="text-[14px] text-ink-muted mt-1.5 max-w-140">
              {items.length} {items.length === 1 ? "marca monitorada" : "marcas monitoradas"} ·{" "}
              <span className="font-mono-zoe">{totalVideos}</span> vídeos analisados nos últimos 30 dias.
            </div>
          </div>
          <button
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-md text-white bg-teal-500 hover:bg-teal-600 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Nova marca
          </button>
        </div>
      </section>

      {/* Master–detail */}
      <div className="grid" style={{ gridTemplateColumns: "340px 1fr", minHeight: "calc(100vh - 200px)" }}>
        {/* Lista */}
        <div className="border-r border-border-soft" style={{ background: "var(--surface)" }}>
          <div className="px-4 py-3 border-b border-border-soft sticky top-15 z-5" style={{ background: "var(--surface)" }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar marca…"
                className="w-full h-8 pl-8 pr-3 text-[13px] rounded-md border border-border-soft bg-transparent outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-ink-muted">Nenhuma marca encontrada.</div>
          ) : (
            filtered.map((b) => {
              const active = selected?.tenantBrandId === b.tenantBrandId
              return (
                <button
                  key={b.tenantBrandId}
                  onClick={() => setSelectedId(b.tenantBrandId)}
                  className="block w-full text-left px-4 py-3.5 border-b border-border-soft transition-colors hover:bg-[#FAFBFC] dark:hover:bg-[#181B28]"
                  style={{
                    background: active ? "var(--color-teal-50)" : "transparent",
                    borderLeft: `3px solid ${active ? "var(--color-teal-500)" : "transparent"}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={b.brandName} slug={b.brandSlug} color={b.color} size={36} radius={8} font={14} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                          {b.displayName ?? b.brandName}
                        </span>
                        {b.status !== "Active" && <span className="chip chip-warn text-[10px]">pausada</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11.5px] text-ink-muted mt-0.5">
                        <span className="font-mono-zoe">{b.videoCount30d} vídeos</span>
                        {!b.brandVerified && <span className="chip text-[10px]">em verificação</span>}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Detalhe */}
        {selected && (
          <BrandDetail
            key={selected.tenantBrandId}
            brand={selected}
            canManage={canManage}
            onOpenDashboard={() => navigate(`/dashboard?brand=${selected.brandId}`)}
            onUnsubscribed={() => setSelectedId(null)}
          />
        )}
      </div>

      <BrandModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}

// ── Detalhe da marca ────────────────────────────────────────────────────

function BrandDetail({ brand, canManage, onOpenDashboard, onUnsubscribed }: {
  brand: TenantBrandSummary
  canManage: boolean
  onOpenDashboard: () => void
  onUnsubscribed: () => void
}) {
  const summary = useDashboardSummary(brand.brandId)
  const keywords = useBrandKeywords(brand.tenantBrandId)
  const m = useBrandMutations(brand.tenantBrandId)
  const [newKeyword, setNewKeyword] = useState("")

  const s = summary.data
  const metrics = [
    { label: "Vídeos · 30d", value: String(brand.videoCount30d) },
    { label: "Menções · 30d", value: s ? String(s.totalMentions) : "—" },
    { label: "Score médio", value: s ? s.avgScore.toFixed(2) : "—" },
    { label: "Variação · 30d", value: s ? `${s.deltaPct30d >= 0 ? "+" : ""}${s.deltaPct30d}%` : "—", kind: s ? (s.deltaPct30d >= 0 ? "pos" : "neg") : undefined },
  ]

  const submitKeyword = (e: React.FormEvent) => {
    e.preventDefault()
    const k = newKeyword.trim()
    if (!k) return
    m.addKeyword.mutate(k, { onSuccess: () => setNewKeyword("") })
  }

  return (
    <div className="p-8 overflow-y-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-7">
        <Avatar name={brand.brandName} slug={brand.brandSlug} color={brand.color} size={64} radius={14} font={26} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="font-display m-0" style={{ fontSize: 28, lineHeight: 1, color: "var(--ink)" }}>
              {brand.displayName ?? brand.brandName}
            </h2>
            {brand.category && <span className="chip chip-primary">{brand.category}</span>}
            <span className="chip">
              {RELATIONSHIPS.find((r) => r.value === brand.relationship)?.label ?? brand.relationship}
            </span>
            {brand.brandVerified ? (
              <span className="chip chip-pos"><ShieldCheck className="w-3 h-3" /> verificada</span>
            ) : (
              <span className="chip chip-warn"><Clock className="w-3 h-3" /> em verificação</span>
            )}
          </div>
          <div className="text-[13px] text-ink-muted">
            Assinada em {new Date(brand.subscribedAt).toLocaleDateString("pt-BR")} · {brand.brandSlug}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={onOpenDashboard}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors shrink-0"
        >
          Ver no dashboard <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Métricas */}
      <div className="border border-border-soft rounded-xl mb-5 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {metrics.map((met, i) => (
            <div key={met.label} className={`px-5 py-5 ${i < metrics.length - 1 ? "lg:border-r" : ""} border-border-soft ${i < 2 ? "border-b lg:border-b-0" : ""} ${i === 0 ? "border-r lg:border-r" : ""}`}>
              <div className="eyebrow">{met.label}</div>
              {summary.isLoading && met.value === "—" ? (
                <div className="h-8 w-20 mt-2 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
              ) : (
                <div className="font-display mt-2" style={{ fontSize: 34, lineHeight: 1, color: "var(--ink)" }}>{met.value}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Keywords + Assinatura */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5">
        {/* Palavras-chave */}
        <div className="border border-border-soft rounded-xl p-5">
          <div className="eyebrow mb-3.5">Palavras-chave monitoradas</div>
          {keywords.isLoading ? (
            <div className="h-8 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D] animate-pulse" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(keywords.data?.items ?? []).map((k) => (
                <span
                  key={k.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-mono-zoe bg-[#F3F4F6] dark:bg-[#1A1D2D]"
                  style={{ color: "var(--ink-2)" }}
                >
                  “{k.keyword}”
                  {k.isNegative && <span className="chip chip-neg text-[9.5px]">neg</span>}
                  {canManage && (
                    <button
                      onClick={() => m.removeKeyword.mutate(k.id)}
                      aria-label={`Remover ${k.keyword}`}
                      className="text-ink-muted hover:text-neg transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {(keywords.data?.items.length ?? 0) === 0 && (
                <span className="text-[13px] text-ink-muted">Nenhuma palavra-chave ainda.</span>
              )}
            </div>
          )}

          {canManage && (
            <form onSubmit={submitKeyword} className="flex items-center gap-2 mt-4">
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="adicionar palavra-chave…"
                className="flex-1 h-8 px-3 text-[12.5px] rounded-md border border-border-soft bg-transparent outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={!newKeyword.trim() || m.addKeyword.isPending}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> {m.addKeyword.isPending ? "..." : "adicionar"}
              </button>
            </form>
          )}
          {m.addKeyword.isError && (
            <p className="text-[12px] text-neg mt-2">Não foi possível adicionar. Tente outro termo.</p>
          )}
        </div>

        {/* Assinatura */}
        <div className="border border-border-soft rounded-xl p-5">
          <div className="eyebrow mb-3.5">Assinatura</div>
          <div className="flex flex-col gap-3.5">
            <Field label="Relacionamento">
              <Select
                value={brand.relationship}
                disabled={!canManage}
                onValueChange={(v) => m.update.mutate({ relationship: v })}
              >
                <SelectTrigger className="h-8 text-[12.5px] w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={brand.status}
                disabled={!canManage}
                onValueChange={(v) => m.update.mutate({ status: v })}
              >
                <SelectTrigger className="h-8 text-[12.5px] w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((st) => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cor de identificação">
              <div className="flex items-center gap-2">
                {PALETTE.map((c) => {
                  const active = brandColor(brand).toUpperCase() === c.toUpperCase()
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={!canManage}
                      onClick={() => m.update.mutate({ color: c })}
                      aria-label={`Cor ${c}`}
                      aria-pressed={active}
                      className="w-6 h-6 rounded-md transition-shadow disabled:opacity-60"
                      style={{
                        background: c,
                        border: active ? "2px solid var(--ink)" : "2px solid transparent",
                        boxShadow: active ? `0 0 0 2px var(--surface), 0 0 0 3px ${c}` : "none",
                      }}
                    />
                  )
                })}
              </div>
            </Field>
          </div>

          {canManage && (
            <>
              <div className="h-px bg-border-soft my-4" />
              <button
                onClick={() => {
                  if (confirm(`Deixar de monitorar "${brand.displayName ?? brand.brandName}"?`)) {
                    m.unsubscribe.mutate(undefined, { onSuccess: onUnsubscribed })
                  }
                }}
                disabled={m.unsubscribe.isPending}
                className="text-[12.5px] text-neg hover:underline disabled:opacity-50"
              >
                {m.unsubscribe.isPending ? "Removendo..." : "Deixar de monitorar esta marca"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── "Nova marca": modal multi-passo (fiel ao design) ────────────────────
// Passos adaptados ao domínio real: o design tinha Identidade / Palavras-chave /
// Plataformas / Equipe. Plataformas (MVP é YouTube-only) e Equipe (acesso é por
// TENANT, não por marca) não existem no modelo. Em troca entra "Vincular" — o
// passo `resolve` da API, que evita criar marca duplicada e reaproveita o
// histórico de uma marca global já existente.
const STEPS = ["Identidade", "Vincular", "Palavras-chave"] as const

function BrandModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const flow = useSubscribeFlow()
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [relationship, setRelationship] = useState("OwnBrand")
  const [category, setCategory] = useState("")
  const [color, setColor] = useState(PALETTE[0])
  const [channels, setChannels] = useState<string[]>([])
  const [channelDraft, setChannelDraft] = useState("")
  const [pick, setPick] = useState<string | "new" | null>(null)
  const [keywords, setKeywords] = useState<string[]>([])
  const [draft, setDraft] = useState("")

  const result = flow.resolve.data
  const outcome = result ? resolveOutcome(result.outcome) : null

  // 403 = falta de permissão (policy TenantAdmin). Mensagem específica, não erro
  // genérico — o usuário precisa saber que é permissão, não falha do sistema.
  const forbidden = [flow.resolve.error, flow.link.error, flow.create.error]
    .some((e) => e instanceof ApiError && e.status === 403)

  const close = useCallback(() => {
    setStep(0); setName(""); setRelationship("OwnBrand"); setPick(null)
    setCategory(""); setColor(PALETTE[0]); setChannels([]); setChannelDraft("")
    setKeywords([]); setDraft("")
    flow.resolve.reset(); flow.link.reset(); flow.create.reset()
    onClose()
  }, [flow, onClose])

  // Escape fecha — a11y mínima de modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Se um popover do Radix (select aberto) já tratou o Esc, ele marca o
      // evento — não fechamos o modal junto: Esc fecha o dropdown primeiro.
      if (e.key !== "Escape" || e.defaultPrevented) return
      close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, close])

  if (!open) return null

  const addKeyword = () => {
    const v = draft.trim().toLowerCase()
    if (v && !keywords.includes(v)) setKeywords([...keywords, v])
    setDraft("")
  }

  const submitting = flow.link.isPending || flow.create.isPending
  const isLast = step === STEPS.length - 1

  const finish = () => {
    const payload = { relationship, monitoredKeywords: keywords, color }
    // `category` só no create: no link a brand global já existe e seu segmento
    // é verdade compartilhada — quem assina não redefine.
    if (pick && pick !== "new") flow.link.mutate({ brandId: pick, ...payload }, { onSuccess: close })
    else flow.create.mutate(
      { name: name.trim(), ...payload, category: category || undefined, officialChannelIds: channels },
      { onSuccess: close })
  }

  const canAdvance =
    step === 0 ? name.trim().length >= 2 && !flow.resolve.isPending
      : step === 1 ? pick !== null
        : true

  const next = () => {
    if (step === 0) {
      // Passo 1 da API: descobre se a marca já existe (não muta estado).
      flow.resolve.mutate({ name: name.trim(), officialChannelIds: channels }, {
        onSuccess: (r) => {
          const o = resolveOutcome(r.outcome)
          setPick(o === "AutoLink" ? r.autoLinkBrandId : o === "NoMatch" ? "new" : null)
          setStep(1)
        },
      })
      return
    }
    setStep(step + 1)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-80 bg-[rgba(7,9,26,0.32)] backdrop-blur-[2px]"
        onClick={close}
        aria-hidden
      />
      <div className="fixed inset-0 z-90 flex items-center justify-center pointer-events-none p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nova marca"
          className="pointer-events-auto w-160 max-w-full max-h-[88vh] flex flex-col overflow-hidden rounded-xl border border-border-soft shadow-2xl"
          style={{ background: "var(--surface)" }}
        >
          {/* Header */}
          <div className="px-7 pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="eyebrow mb-1.5">Nova marca</div>
                <h2 className="font-display m-0" style={{ fontSize: 24, color: "var(--ink)" }}>
                  Adicionar marca ao workspace
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Fechar"
                className="p-1.5 rounded-md text-ink-muted hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Indicador de passos */}
            <div className="flex gap-2 mb-5">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => i < step && setStep(i)}
                  className="flex-1 text-left"
                  style={{ cursor: i < step ? "pointer" : "default" }}
                >
                  <div
                    className="h-[3px] rounded-sm mb-1.5 transition-colors"
                    style={{ background: i <= step ? "var(--color-teal-500)" : "#E5E7EB" }}
                  />
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: i === step ? "var(--color-teal-700)" : i < step ? "var(--muted)" : "var(--muted-2)" }}
                  >
                    {s}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Corpo */}
          <div className="px-7 pb-7 pt-1 overflow-y-auto flex-1">
            {forbidden ? (
              <div className="border border-border-soft rounded-lg p-4">
                <div className="eyebrow mb-1.5">Sem permissão</div>
                <p className="text-[13px] text-ink-muted">
                  Só Owner ou Admin do workspace podem assinar marcas. Peça a um administrador
                  para adicionar esta marca.
                </p>
              </div>
            ) : (
              <>
                {step === 0 && (
                  <div className="space-y-4">
                    <Field label="Nome da marca">
                      <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && canAdvance) next() }}
                        placeholder="Ex: Nubank"
                        className="w-full h-10 px-3.5 text-[14px] rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500"
                      />
                    </Field>
                    <Field label="Relacionamento">
                      <Select value={relationship} onValueChange={setRelationship}>
                        <SelectTrigger className="h-10 w-full text-[14px]"><SelectValue /></SelectTrigger>
                        {/* z acima do modal: o SelectContent é PORTALADO no body
                            com z-50 e o modal está em z-90 — sem isto o dropdown
                            abre ATRÁS do modal (e o clique cai no backdrop). */}
                        <SelectContent className={SELECT_IN_MODAL_Z}>
                          {RELATIONSHIPS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-[11.5px] text-ink-muted mt-1.5">
                        Concorrentes entram no Share of Voice; marcas próprias, no seu painel principal.
                      </p>
                    </Field>
                    <Field label="Categoria">
                      <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
                        <SelectTrigger className="h-10 w-full text-[14px]">
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent className={SELECT_IN_MODAL_Z}>
                          <SelectItem value="none">Sem categoria</SelectItem>
                          {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-[11.5px] text-ink-muted mt-1.5">
                        Segmento da marca. Nossa equipe confirma na verificação.
                      </p>
                    </Field>
                    <Field label="Canais oficiais no YouTube (opcional)">
                      <div className="flex gap-2">
                        <input
                          value={channelDraft}
                          onChange={(e) => setChannelDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return
                            e.preventDefault()
                            const v = channelDraft.trim()
                            if (v && !channels.includes(v)) setChannels([...channels, v])
                            setChannelDraft("")
                          }}
                          placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
                          className="flex-1 h-10 px-3.5 text-[13px] font-mono-zoe rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500"
                        />
                        <button
                          type="button"
                          disabled={!channelDraft.trim()}
                          onClick={() => {
                            const v = channelDraft.trim()
                            if (v && !channels.includes(v)) setChannels([...channels, v])
                            setChannelDraft("")
                          }}
                          className="h-10 px-3.5 text-[13px] rounded-lg border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {channels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {channels.map((ch) => (
                            <span
                              key={ch}
                              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md text-[12px] font-mono-zoe bg-[#F3F4F6] dark:bg-[#1A1D2D]"
                              style={{ color: "var(--ink-2)" }}
                            >
                              {ch}
                              <button
                                type="button"
                                onClick={() => setChannels(channels.filter((x) => x !== ch))}
                                aria-label={`Remover ${ch}`}
                                className="text-ink-muted hover:text-neg transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[11.5px] text-ink-muted mt-1.5">
                        Informar o canal é o jeito mais confiável de a Zoe reconhecer a marca certa —
                        evita cadastro duplicado e vincula ao histórico existente.
                      </p>
                    </Field>
                    <Field label="Cor de identificação">
                      <div className="flex items-center gap-2">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            aria-label={`Cor ${c}`}
                            aria-pressed={color === c}
                            className="w-7.5 h-7.5 rounded-lg transition-shadow"
                            style={{
                              background: c,
                              border: color === c ? "2px solid var(--ink)" : "2px solid transparent",
                              boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 3px ${c}` : "none",
                            }}
                          />
                        ))}
                      </div>
                    </Field>
                    {flow.resolve.isError && (
                      <p className="text-[12.5px] text-neg">Não foi possível buscar. Tente novamente.</p>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-3">
                    <p className="text-[13px] text-ink-muted leading-relaxed">
                      Verificamos se essa marca já existe na Zoe — vincular a uma existente traz o
                      histórico de análises junto, em vez de começar do zero.
                    </p>

                    {outcome === "AutoLink" && result?.autoLinkBrandId && (
                      <label className="flex items-center gap-3 border border-border-soft rounded-lg px-3.5 py-3 cursor-pointer">
                        <input
                          type="radio"
                          checked={pick === result.autoLinkBrandId}
                          onChange={() => setPick(result.autoLinkBrandId)}
                          className="accent-teal-500"
                        />
                        <div>
                          <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                            Marca encontrada por canal oficial
                          </div>
                          <div className="text-[11.5px] text-ink-muted">Vincular à marca existente (recomendado)</div>
                        </div>
                      </label>
                    )}

                    {outcome === "Candidates" && result!.candidates.map((c) => (
                      <label key={c.brandId} className="flex items-center gap-3 border border-border-soft rounded-lg px-3.5 py-3 cursor-pointer">
                        <input
                          type="radio"
                          checked={pick === c.brandId}
                          onChange={() => setPick(c.brandId)}
                          className="accent-teal-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{c.name}</div>
                          <div className="text-[11.5px] text-ink-muted">
                            {c.verified ? "verificada" : "em verificação"} · {c.slug}
                          </div>
                        </div>
                      </label>
                    ))}

                    {/* Criar nova é sempre uma opção — inclusive quando há candidatas. */}
                    <label className="flex items-center gap-3 border border-border-soft rounded-lg px-3.5 py-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={pick === "new"}
                        onChange={() => setPick("new")}
                        className="accent-teal-500"
                      />
                      <div>
                        <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                          Criar “{name.trim()}” como marca nova
                        </div>
                        <div className="text-[11.5px] text-ink-muted">Entra em verificação pela nossa equipe</div>
                      </div>
                    </label>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="text-[13px] text-ink-muted leading-relaxed mb-3.5">
                      Termos que a Zoe deve monitorar em vídeos, áudios e comentários — variações do
                      nome, produtos e apelidos. Dá para ajustar depois.
                    </p>
                    <div className="flex gap-2 mb-3.5">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword() } }}
                        placeholder="Ex: ultravioleta"
                        className="flex-1 h-10 px-3.5 text-[14px] font-mono-zoe rounded-lg border border-border-soft bg-transparent outline-none focus:border-teal-500"
                      />
                      <button
                        onClick={addKeyword}
                        disabled={!draft.trim()}
                        className="inline-flex items-center gap-1.5 h-10 px-4 text-[13px] font-medium rounded-lg text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {keywords.length === 0 && (
                        <span className="text-[12.5px] text-ink-muted">Nenhuma palavra-chave ainda.</span>
                      )}
                      {keywords.map((k) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-md text-[12.5px] font-mono-zoe bg-[#F3F4F6] dark:bg-[#1A1D2D]"
                          style={{ color: "var(--ink-2)" }}
                        >
                          “{k}”
                          <button
                            onClick={() => setKeywords(keywords.filter((x) => x !== k))}
                            aria-label={`Remover ${k}`}
                            className="text-ink-muted hover:text-neg transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    {(flow.link.isError || flow.create.isError) && (
                      <p className="text-[12.5px] text-neg mt-3">Não foi possível assinar. Tente novamente.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-7 py-4 border-t border-border-soft">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="h-9 px-4 text-[13px] rounded-lg border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
              >
                Voltar
              </button>
            ) : (
              <button onClick={close} className="h-9 px-4 text-[13px] rounded-lg text-ink-muted hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors">
                Cancelar
              </button>
            )}

            {!isLast ? (
              <button
                onClick={next}
                disabled={!canAdvance || forbidden}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50"
              >
                {flow.resolve.isPending ? "Buscando..." : "Continuar"}
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={submitting || forbidden}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-medium rounded-lg text-white bg-teal-500 hover:bg-teal-600 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> {submitting ? "Assinando..." : "Assinar marca"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Primitivos locais ───────────────────────────────────────────────────

function Avatar({ name, slug, color, size, radius, font }: {
  name: string; slug: string; color: string | null; size: number; radius: number; font: number
}) {
  return (
    <div
      className="flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, borderRadius: radius, background: brandColor({ color, brandSlug: slug }), fontSize: font }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] text-ink-muted mb-1.5">{label}</div>
      {children}
    </div>
  )
}

// ── Estados ─────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="-m-6 animate-pulse">
      <div className="px-8 pt-7 pb-5 border-b border-border-soft"><div className="h-9 w-48 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" /></div>
      <div className="grid" style={{ gridTemplateColumns: "340px 1fr" }}>
        <div className="border-r border-border-soft p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" />)}
        </div>
        <div className="p-8"><div className="h-24 rounded bg-[#F3F4F6] dark:bg-[#1A1D2D]" /></div>
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="w-10 h-10 text-neg mb-3" />
      <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>Não foi possível carregar</h3>
      <p className="text-sm text-ink-muted mb-4">Tente novamente em instantes.</p>
      <button onClick={onRetry} className="h-9 px-4 text-[13px] rounded-md border border-border-soft hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors">
        Tentar de novo
      </button>
    </div>
  )
}
