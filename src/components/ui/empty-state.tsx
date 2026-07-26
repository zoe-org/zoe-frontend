import { Button } from "@/components/ui/button"
import { InboxIcon } from "lucide-react"

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-[#6B7280]">
        {icon ?? <InboxIcon className="w-12 h-12" />}
      </div>
      {/* Tailwind v4: usar os utilitários gerados pelo @theme. A sintaxe v3
          `bg-[--color-*]` NÃO gera CSS em v4 — o botão ficava com text-white
          sobre fundo inexistente (invisível).
          Cor: `.btn.primary` do design = var(--primary) #00A799 (teal-500),
          hover var(--t-600) — NÃO o --cta laranja. */}
      <h3 className="text-lg font-semibold text-midnight dark:text-[#E6E8EF] mb-1">{title}</h3>
      {description && <p className="text-sm text-[#6B7280] mb-4 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-teal-500 hover:bg-teal-600 text-white">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
