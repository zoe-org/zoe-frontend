import type { CSSProperties } from "react"

/**
 * Atraso em cascata para irmãos que entram juntos: `style={stagger(i)}` alimenta
 * a variável `--i` que as classes `.z-rise`, `.z-fade`, `.z-grow-x` e `.z-wipe` leem.
 *
 * Quem tem lista longa passa um teto (`Math.min(i, 12)`): sem isso o 40º item
 * entraria mais de dois segundos depois do primeiro.
 */
export function stagger(i: number): CSSProperties {
  return { "--i": i } as CSSProperties
}
