import type { CSSProperties } from "react"
import { Input } from "@/components/ui/input"
import { centsToBRLInput, parseBRLToCents } from "@/lib/money"

/**
 * Campo de valor em reais. Aceita o que a pessoa digitar ("15000", "15.000,5", "R$ 15.000") e, ao
 * sair do campo, mostra no formato brasileiro com centavos ("15.000,50") — é assim que ela confere
 * que o número ficou certo antes de salvar.
 *
 * <p>Formata só ao sair, nunca enquanto digita: máscara que reescreve a cada tecla move o cursor e
 * atrapalha quem corrige um dígito no meio. Valor ilegível fica como está, e quem salva decide o
 * que dizer.</p>
 */
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
