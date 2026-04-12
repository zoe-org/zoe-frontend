import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SentimentBadge } from "@/components/ui/sentiment-badge"
import type { Mention } from "@/lib/mock/monitoring"

type MentionDrawerProps = {
  mention: Mention | null
  open: boolean
  onClose: () => void
}

export function MentionDrawer({ mention, open, onClose }: MentionDrawerProps) {
  if (!mention) return null

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhe da Menção</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Video placeholder */}
          <div className="aspect-video bg-[#F3F4F6] rounded-lg flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center shadow">
              <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-[--color-midnight] ml-1" />
            </div>
          </div>

          {/* Title and meta */}
          <div>
            <h3 className="font-semibold text-[--color-midnight]">{mention.title}</h3>
            <p className="text-sm text-[#6B7280] mt-1">{mention.creator} · {mention.handle} · {mention.views} views · {mention.timeAgo}</p>
            <div className="flex gap-2 mt-2">
              <SentimentBadge sentiment={mention.sentiment} score={mention.sentimentScore} />
              {mention.hasLogo && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F0FDFA] text-[#00A799]">
                  Logo detectado
                </span>
              )}
            </div>
          </div>

          {/* Transcript */}
          {mention.transcript.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
                Transcrição (trechos com menção)
              </h4>
              <div className="space-y-3">
                {mention.transcript.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-xs font-mono text-[#00A799] shrink-0 pt-0.5">{t.timestamp}</span>
                    <p className="text-sm text-[--color-midnight]">
                      "{highlightBrand(t.text, t.highlightedBrand)}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logo frames */}
          {mention.logoFrames.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
                Logo detectado (frames)
              </h4>
              <div className="flex flex-wrap gap-2 mb-2">
                {mention.logoFrames.map((ts, i) => (
                  <span key={i} className="text-xs font-mono bg-[#F0FDFA] text-[#00A799] px-2 py-1 rounded">
                    {ts}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[#6B7280]">
                Exposição total: {mention.logoExposure} · Tamanho médio: {mention.logoAvgSize}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function highlightBrand(text: string, brand: string): React.ReactNode {
  const parts = text.split(new RegExp(`(${brand})`, "gi"))
  return parts.map((part, i) =>
    part.toLowerCase() === brand.toLowerCase()
      ? <span key={i} className="bg-[#00A799]/15 px-0.5 rounded font-medium">{part}</span>
      : part
  )
}
