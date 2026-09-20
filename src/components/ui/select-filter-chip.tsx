import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

export type FilterChipOption = { key: string; label: string }

/**
 * Filtro de valor, com um `Select` do Radix por trás — o mock só mostra o chevron,
 * mas aqui ele abre de verdade. Convenção: a chave vazia (`""`) é a opção
 * neutra/"todos" (inativo); qualquer outro valor deixa o chip ativo (borda + fundo
 * teal). Compartilhado por Monitoramento e Sentimento.
 *
 * Raio 8px como todo controle do app (botão, input, `Segmented`). Era `rounded-full`,
 * e a pílula destoava dos vizinhos na mesma barra: três raios diferentes lado a lado
 * leem como três origens diferentes.
 */
export function SelectFilterChip({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly FilterChipOption[]
  placeholder: string
}) {
  const active = value !== ""
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger
        aria-label={placeholder}
        className={`h-8 rounded-lg px-3.5 text-[13px] font-medium border transition-colors ${
          active
            ? "border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/25"
            : "border-border-soft text-ink-2 bg-transparent"
        }`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key || "__all"} value={o.key || "__all"}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
