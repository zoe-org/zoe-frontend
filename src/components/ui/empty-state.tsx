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
      <h3 className="text-lg font-semibold text-[--color-midnight] mb-1">{title}</h3>
      {description && <p className="text-sm text-[#6B7280] mb-4 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-[--color-ember] hover:bg-[--color-ember]/90 text-white">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
