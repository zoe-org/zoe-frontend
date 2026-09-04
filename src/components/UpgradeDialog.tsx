import { useEffect, useState } from "react"
import { Dialog } from "radix-ui"
import { Lock, Sparkles, X } from "lucide-react"
import { upsellCopy } from "@/features/features/upsell"
import { onFeatureBlocked } from "@/features/features/featureBlocked"
import { useOpenSettings } from "@/components/settings/useSettings"

/**
 * Modal de upgrade que dispara no 403 de feature paga, com o texto da feature que
 * faltou (RN-I-012: nenhum limite atingido em silêncio).
 *
 * Por que escutar o cache do react-query em vez de tratar erro em cada tela: o 403
 * pode vir de qualquer query ou mutação, e espalhar o tratamento faria a próxima
 * superfície gated nascer sem ele. As telas que já mostram upsell de página inteira
 * (o SoV, por exemplo) continuam mostrando — este modal é para a AÇÃO que falha no
 * meio do caminho, onde trocar a tela inteira perderia o que o usuário estava fazendo.
 */

export function UpgradeDialog() {
  const [slug, setSlug] = useState<string | null>(null)
  const openSettings = useOpenSettings()

  useEffect(() => onFeatureBlocked(setSlug), [])

  const copy = slug ? upsellCopy(slug) : null

  return (
    <Dialog.Root open={slug !== null} onOpenChange={(o) => { if (!o) setSlug(null) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(460px,calc(100vw-2rem))] rounded-[18px] border border-border-soft px-7 py-7 shadow-2xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
          style={{ background: "var(--surface)", color: "var(--ink)" }}
        >
          <Dialog.Close
            aria-label="Fechar"
            className="absolute right-4 top-4 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D2D] transition-colors"
          >
            <X className="w-4 h-4" />
          </Dialog.Close>

          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "var(--color-teal-50)" }}
          >
            <Lock className="w-5 h-5" style={{ color: "var(--color-teal-500)" }} />
          </div>

          <div className="eyebrow mb-2">Fora do seu plano</div>
          <Dialog.Title
            className="font-display m-0 mb-2.5"
            style={{ fontSize: 22, lineHeight: 1.2, color: "var(--ink)" }}
          >
            {copy?.name ?? "Recurso premium"}
          </Dialog.Title>
          <Dialog.Description className="text-[13.5px] text-ink-muted leading-relaxed m-0">
            {copy?.pitch}
          </Dialog.Description>

          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={() => { setSlug(null); openSettings("plano") }}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: "var(--color-teal-500)" }}
            >
              <Sparkles className="w-3.5 h-3.5" /> Ver planos
            </button>
            <button
              onClick={() => setSlug(null)}
              className="h-9 px-4 rounded-lg text-[13px] font-medium text-ink-muted hover:bg-[#FBFCFD] dark:hover:bg-[#1A1D2D] transition-colors"
            >
              Agora não
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
