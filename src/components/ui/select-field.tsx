import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"

export type SelectFieldOption = { key: string; label: string; disabled?: boolean }

/** Opções sob um rótulo — "Convidados para esta campanha" contra "Resto do elenco". */
export type SelectFieldGroup = { group: string; options: readonly SelectFieldOption[] }

function isGroup(o: SelectFieldOption | SelectFieldGroup): o is SelectFieldGroup {
  return "group" in o
}

/**
 * O Radix RECUSA `value=""` num item — ele lança, porque reserva a string vazia
 * para "nada selecionado". Mas "" é justamente como as telas representam a
 * opção neutra ("Todas as áreas", "Sem campanha"). A troca acontece aqui, uma
 * vez, em vez de cada chamada ter que lembrar de um sentinela próprio.
 */
const EMPTY = "__empty"
const toRadix = (v: string) => (v === "" ? EMPTY : v)
const fromRadix = (v: string) => (v === EMPTY ? "" : v)

/**
 * Campo de seleção de formulário com o visual da plataforma.
 *
 * O `<select>` nativo herda o menu do sistema operacional — realce azul do
 * Windows, fonte do sistema, nenhum dos tokens do app e nada de modo escuro.
 * Dentro de um formulário que segue o design, ele lê como um controle de outro
 * produto. Aqui embaixo é o mesmo `Select` do Radix que os filtros já usam, e o
 * menu passa a ser do app.
 *
 * Irmão do `SelectFilterChip`: aquele é recorte de lista (neutro/"todos" na
 * chave vazia, formato de chip); este é campo de formulário, com rótulo fora e
 * largura do container.
 */
export function SelectField({
  value, onChange, options, placeholder, id, ariaLabel, invalid, disabled, className,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly (SelectFieldOption | SelectFieldGroup)[]
  placeholder?: string
  id?: string
  ariaLabel?: string
  /** Mensagem de erro do campo: pinta a borda sem repetir o texto aqui. */
  invalid?: string
  disabled?: boolean
  /** Sobrescreve o visual do gatilho. A altura precisa vir como `data-[size=default]:h-*`. */
  className?: string
}) {
  return (
    <Select value={toRadix(value)} onValueChange={(v) => onChange(fromRadix(v))} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        className={
          className
          ?? `w-full data-[size=default]:h-9.5 px-3 text-[13.5px] rounded-[11px] ${
            invalid ? "border-[color:var(--color-neg)]" : "border-border-soft"
          }`
        }
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Acima dos overlays do app: o menu é portado pro body com `z-50` e o
          modal de regra vive em `z-90` — sem isto ele abre ATRÁS do modal. */}
      <SelectContent className="z-[100]">
        {options.map((o) => (isGroup(o) ? (
          <SelectGroup key={o.group}>
            <SelectLabel>{o.group}</SelectLabel>
            {o.options.map((i) => (
              <SelectItem key={i.key} value={toRadix(i.key)} disabled={i.disabled}>{i.label}</SelectItem>
            ))}
          </SelectGroup>
        ) : (
          <SelectItem key={o.key} value={toRadix(o.key)} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        )))}
      </SelectContent>
    </Select>
  )
}
