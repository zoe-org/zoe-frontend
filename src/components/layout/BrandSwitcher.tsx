import { ChevronDown, Check, Layers, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useActiveBrand } from "@/features/brands/context"

/** Paleta do design pro fallback de cor quando o tenant não escolheu uma. */
const PALETTE = ["#00A799", "#8B5CF6", "#EF4444", "#2563EB", "#F59E0B", "#14B8A6", "#EC4899"]
function brandColor(color: string | null, slug: string): string {
  if (color) return color
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/**
 * Seletor de marca ATIVA no header (posição que era do workspace). A marca é
 * global (BrandContext) — trocar aqui reflete em Dashboard/Monitoramento/
 * Sentimento. Sem marca assinada, não renderiza (as páginas mostram o empty).
 */
export function BrandSwitcher({ allowAll = false }: {
  /**
   * A rota atual sabe ler várias marcas de uma vez. Só Alertas, por enquanto:
   * as outras telas pedem um `brandId` à API e não têm modo agregado, então
   * oferecer "todas" nelas prometeria um recorte que não existe.
   */
  allowAll?: boolean
}) {
  const { brands, brandId, active, setBrand, allBrands, setAllBrands } = useActiveBrand()
  const todas = allowAll && allBrands

  // Concorrente ENTRA na lista. O dado dele já foi pago em minutos e ele consome
  // slot de marca — esconder a análise tirava valor sem ganhar nada. O que o WS-F4
  // queria evitar era o ENQUADRAMENTO: um dashboard que diz "sua marca" sobre um
  // concorrente. Isso agora é resolvido na copy (ver `brandVoice`), não no acesso.
  //
  // Próprias primeiro: é o caso comum, e a marca do cliente não pode ficar embaixo
  // da lista de rivais.
  const selecionaveis = [
    ...brands.filter((b) => b.relationship !== "Competitor"),
    ...brands.filter((b) => b.relationship === "Competitor"),
  ]

  if (selecionaveis.length === 0) return null

  const label = todas
    ? "Todas as marcas"
    : active ? (active.displayName ?? active.brandName) : "Selecione uma marca"
  const cor = active ? brandColor(active.color, active.brandSlug) : "var(--ink-muted-2)"
  const concorrente = !todas && active?.relationship === "Competitor"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-8 pl-1 pr-2.5 border border-border rounded-full flex items-center gap-2 text-[12.5px] text-ink hover:bg-hover transition-colors cursor-pointer"
          aria-label="Trocar marca ativa"
        >
          {todas ? (
            <span className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-tint text-ink-muted">
              <Layers className="w-3 h-3" />
            </span>
          ) : (
            <span
              className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
              style={{ backgroundColor: cor }}
            >
              {label.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="max-w-40 truncate font-medium">{label}</span>
          {/* O selo diz de quem é o dado ANTES de alguém ler os números da tela.
              No recorte agregado não há "de quem": o selo sai em vez de mentir. */}
          {!todas && (
            <span className={`chip h-4.5 text-[10px] ${concorrente ? "chip-warn" : "chip-primary"}`}>
              {concorrente ? "Concorrente" : "Própria"}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {allowAll && (
          <>
            <DropdownMenuItem
              onSelect={() => setAllBrands(true)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Todas as marcas</div>
                <div className="text-[11px] text-ink-muted">
                  {brands.length} {brands.length === 1 ? "marca" : "marcas"} de uma vez
                </div>
              </div>
              {todas && <Check className="w-4 h-4 text-teal-500 shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold">
          Marcas monitoradas
        </DropdownMenuLabel>

        {selecionaveis.map((b) => {
          const isActive = !todas && b.brandId === brandId
          return (
            <DropdownMenuItem
              key={b.brandId}
              onSelect={() => { if (!isActive) setBrand(b.brandId) }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: brandColor(b.color, b.brandSlug) }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{b.displayName ?? b.brandName}</span>
                  {/* Marcado, não escondido: quem troca precisa saber que está olhando
                      um concorrente antes de ler os números. */}
                  {b.relationship === "Competitor" && (
                    <span className="text-[9.5px] uppercase tracking-wide font-semibold text-ink-muted shrink-0">
                      concorrente
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-muted truncate">
                  {b.videoCount30d} {b.videoCount30d === 1 ? "vídeo" : "vídeos"} · 30d
                </div>
              </div>
              {isActive && <Check className="w-4 h-4 text-teal-500 shrink-0" />}
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/brands" className="flex items-center gap-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            Gerenciar marcas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
