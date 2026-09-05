/**
 * Círculo com a inicial de uma pessoa/canal, cor derivada do nome.
 *
 * Irmão do `BrandAvatar` (que é quadrado e vem de paleta fixa): aqui a fonte não
 * dá avatar — nem o canal na lista de vídeos, nem o autor do comentário — e uma
 * fila de círculos idênticos não ajuda ninguém a distinguir quem falou. O hue
 * derivado do nome é determinístico, então o mesmo autor tem sempre a mesma cor.
 */
function gradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `linear-gradient(135deg, hsl(${hue} 62% 62%), hsl(${(hue + 40) % 360} 58% 45%))`
}

/**
 * Primeira letra "de verdade": autor do YouTube vem como "@LeviMendes-c8m", e um
 * círculo com "@" não distingue ninguém de ninguém. Emoji e pontuação no começo
 * do nome caem na mesma regra.
 */
function initial(name: string): string {
  const match = name.match(/\p{L}|\p{N}/u)
  return (match?.[0] ?? "?").toUpperCase()
}

export function PersonAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const label = (name || "?").trim()
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center text-white font-semibold"
      style={{
        width: size,
        height: size,
        background: gradient(label),
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden
    >
      {initial(label)}
    </div>
  )
}
