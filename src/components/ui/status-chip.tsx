import { tEnum, type EnumKind } from "@/i18n/enums"

/** Chip de status com rótulo do i18n pelo <code>kind</code>; status sem tradução mostra o valor cru. */
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
