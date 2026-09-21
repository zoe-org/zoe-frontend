import type { ReactNode } from "react"
import { InfoHint } from "@/components/ui/info-hint"

/**
 * Número de apoio: rótulo, valor e uma linha de contexto embaixo.
 *
 * Nasceu no rail de Influenciadores e virou primitiva quando o Share of Voice
 * precisou do mesmo bloco — as duas cópias já divergiam no corpo do número (27
 * contra 26) e no rótulo (`eyebrow` contra texto mudo).
 *
 * O número é deliberadamente menor que uma manchete: estes blocos apoiam a
 * leitura principal da faixa, não competem com ela. Ressalva longa vai em
 * `hint`, nunca em parágrafo solto — texto embaixo de número custa três linhas
 * de altura cada e empurra o conteúdo real pra baixo da dobra.
 */
export function Stat({ label, hint, color, foot, children }: {
  label: string
  hint?: string
  color?: string
  /** Linha sob o número: variação, rótulo do sentimento, unidade. */
  foot?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="eyebrow inline-flex items-center gap-1 mb-2">
        {label}
        {hint && <InfoHint text={hint} />}
      </div>
      <div
        className="font-display leading-none truncate"
        style={{ fontSize: 27, color: color ?? "var(--ink)" }}
      >
        {children}
      </div>
      {foot && <div className="text-[11.5px] text-ink-muted-2 mt-1.5">{foot}</div>}
    </div>
  )
}
