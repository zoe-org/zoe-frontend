import { tEnum, type EnumKind } from "@/i18n/enums"

/**
 * Chip de status genérico. As telas de Operations tinham três cópias do mesmo
 * componente variando só o mapa de cor — é o padrão que a documentação técnica
 * dos protótipos já apontava para unificar.
 *
 * O rótulo sai do dicionário de i18n pelo `kind`, então um status novo aparece
 * traduzido sem tocar aqui, e um ainda sem tradução cai no valor cru em vez de
 * sumir da tela.
 */
export function StatusChip({
  status, kind, colors, small,
}: {
  status: string
  kind: EnumKind
  /** Cor por valor do enum. O primeiro par vira o fallback de valor desconhecido. */
  colors: Record<string, string>
  small?: boolean
}) {
  const color = colors[status] ?? Object.values(colors)[0] ?? "#6B7280"
  return (
    <span
      className="font-semibold whitespace-nowrap"
      style={{
        fontSize: small ? 10 : 12,
        padding: small ? "2px 7px" : "3px 10px",
        borderRadius: 6,
        background: `${color}15`,
        color,
      }}
    >
      {tEnum(kind, status)}
    </span>
  )
}
