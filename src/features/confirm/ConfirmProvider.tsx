import { useCallback, useRef, useState } from "react"
import { AlertDialog } from "radix-ui"
import { AlertTriangle, HelpCircle } from "lucide-react"
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from "@/features/confirm/context"

/**
 * Confirmação da plataforma no lugar do `window.confirm` do navegador.
 *
 * AlertDialog, não Dialog: clique fora não fecha e o foco começa no "Cancelar",
 * então um Enter apressado não confirma a ação destrutiva.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  // Resolve uma vez só: o clique no botão e o onOpenChange chegam os dois.
  const settle = useCallback((ok: boolean) => {
    const resolve = resolver.current
    resolver.current = null
    resolve?.(ok)
    setOpen(false)
  }, [])

  const confirm = useCallback<ConfirmFn>((next) => {
    resolver.current?.(false)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setOptions(next)
      setOpen(true)
    })
  }, [])

  const danger = options?.tone === "danger"
  const accent = danger ? "var(--color-neg)" : "var(--color-teal-500)"
  const Icon = danger ? AlertTriangle : HelpCircle

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={open} onOpenChange={(o) => { if (!o) settle(false) }}>
        <AlertDialog.Portal>
          {/* Acima dos modais da app (z-90) e dos selects portalados neles (z-100). */}
          <AlertDialog.Overlay className="fixed inset-0 z-[120] bg-black/45 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <AlertDialog.Content
            className="fixed left-1/2 top-1/2 z-[120] -translate-x-1/2 -translate-y-1/2 w-[min(440px,calc(100vw-2rem))] rounded-[18px] border border-border-soft p-6 shadow-2xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
              >
                <Icon className="w-5 h-5" style={{ color: accent }} />
              </div>
              <div className="min-w-0 pt-0.5">
                <AlertDialog.Title
                  className="font-display m-0"
                  style={{ fontSize: 20, lineHeight: 1.25, color: "var(--ink)" }}
                >
                  {options?.title}
                </AlertDialog.Title>
                {options?.description && (
                  <AlertDialog.Description className="text-[13.5px] text-ink-muted leading-relaxed mt-2 mb-0">
                    {options.description}
                  </AlertDialog.Description>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <AlertDialog.Cancel
                onClick={() => settle(false)}
                className="h-9 px-4 rounded-lg text-[13px] font-medium border border-border-soft hover:bg-hover transition-colors"
              >
                {options?.cancelLabel ?? "Cancelar"}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() => settle(true)}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: accent }}
              >
                {options?.confirmLabel ?? "Confirmar"}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  )
}
