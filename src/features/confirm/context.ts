import { createContext, useContext, type ReactNode } from "react"

export type ConfirmOptions = {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" para ação destrutiva: botão vermelho e ícone de alerta. */
  tone?: "default" | "danger"
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Substitui o `window.confirm`: `if (!(await confirm({ ... }))) return`. */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error("useConfirm precisa do ConfirmProvider (main.tsx).")
  return confirm
}
