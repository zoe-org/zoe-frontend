/**
 * Tabs em pill do design (`src/alertas.jsx`, `src-admin/*`): a ativa é sólida na
 * cor primária, as demais são texto mudo. Vive aqui, e não colada numa página,
 * porque duas telas com estilos de tab diferentes leem como dois produtos.
 */
export function TabPill({
  active, onClick, label, count, badge,
}: {
  active: boolean
  onClick: () => void
  label: string
  /** Contagem entre parênteses — some quando não faz sentido contar. */
  count?: number
  /** Pastilha de destaque (não lidos). Só renderiza acima de zero: um "0" fixo é ruído. */
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-[13.5px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
      style={{
        background: active ? "var(--color-teal-500)" : "transparent",
        color: active ? "#fff" : "var(--ink-muted)",
      }}
    >
      {label}
      {count !== undefined && (
        <span className="font-medium" style={{ opacity: active ? 0.8 : 0.6 }}>({count})</span>
      )}
      {badge !== undefined && badge > 0 && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: active ? "rgba(255,255,255,0.25)" : "var(--color-ember)", color: "#fff" }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
}
