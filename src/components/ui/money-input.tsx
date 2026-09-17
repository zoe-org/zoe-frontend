import type { CSSProperties } from "react"
import { Input } from "@/components/ui/input"
import { centsToBRLInput, parseBRLToCents } from "@/lib/money"

/** Valor em reais aceito em qualquer forma e formatado ao sair do campo, nunca durante a digitação. */
export function MoneyInput({
  value, onChange, placeholder, disabled, className, style, invalid,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  style?: CSSProperties
  /** Campo obrigatório ainda vazio — vira `aria-invalid`, como nos outros campos do formulário. */
  invalid?: boolean
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (!value.trim()) return
        const cents = parseBRLToCents(value)
        if (cents !== null) onChange(centsToBRLInput(cents))
      }}
      inputMode="decimal"
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={style}
      aria-invalid={invalid || undefined}
    />
  )
}
