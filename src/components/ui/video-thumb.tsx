import { useState } from "react"
import { Play } from "lucide-react"

/**
 * Thumbnail de um vídeo do YouTube.
 *
 * A URL é DETERMINÍSTICA a partir do id (`i.ytimg.com/vi/<id>/…`): não custa
 * quota da Data API, não exige campo novo no backend e não precisa de chave.
 * Por isso a tela ganha thumbnail sem nenhuma mudança de contrato.
 *
 * `mqdefault` (320×180) sempre existe — ao contrário de `maxresdefault`, que só
 * é gerado para vídeos em HD e devolveria 404 numa fração do feed.
 */
function thumbUrl(youtubeVideoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeVideoId)}/mqdefault.jpg`
}

/** Cor estável por vídeo para o placeholder — evita cinza morto no fallback. */
function placeholderColor(seed: string): string {
  const palette = ["#1F2A44", "#2A3F5F", "#3A2E55", "#14343A", "#3D2B2B"]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

/** `durationSeconds` → `m:ss` ou `h:mm:ss`. 0/ausente vira null (não renderiza). */
export function formatDuration(totalSeconds: number | null | undefined): string | null {
  if (!totalSeconds || totalSeconds <= 0) return null
  const s = Math.floor(totalSeconds % 60)
  const m = Math.floor((totalSeconds / 60) % 60)
  const h = Math.floor(totalSeconds / 3600)
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function VideoThumb({
  youtubeVideoId,
  durationSeconds,
  className = "",
  playSize = 22,
}: {
  youtubeVideoId: string
  durationSeconds?: number | null
  /** Dimensões vêm de fora (linha usa 110×62, grade usa aspect-video). */
  className?: string
  playSize?: number
}) {
  // Vídeo removido/privado devolve uma imagem "sem thumb" — cair no placeholder
  // é melhor do que exibir o cinza genérico do YouTube.
  const [failed, setFailed] = useState(false)
  const duration = formatDuration(durationSeconds)

  return (
    <div
      className={`relative overflow-hidden rounded-md shrink-0 ${className}`}
      style={{ background: placeholderColor(youtubeVideoId) }}
    >
      {!failed && (
        <img
          src={thumbUrl(youtubeVideoId)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <Play
          width={playSize}
          height={playSize}
          className="drop-shadow-sm"
          style={{ color: "rgba(255,255,255,0.92)" }}
          fill="rgba(255,255,255,0.92)"
        />
      </div>
      {duration && (
        <span className="font-mono-zoe absolute bottom-1 right-1 px-1 py-px rounded-sm text-[9.5px] text-white bg-black/70">
          {duration}
        </span>
      )}
    </div>
  )
}
