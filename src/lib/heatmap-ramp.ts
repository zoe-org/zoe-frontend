/**
 * Rampa do heatmap: do "sem menção" ao pico.
 *
 * A rampa clara SOBE a partir do branco. No fundo escuro isso fazia a célula vazia
 * — que é a maioria — virar um bloco branco, e o mapa lia como um tabuleiro aceso
 * onde não há nada. No escuro ela sobe a partir da própria superfície, então
 * ausência parece ausência e a intensidade cresce em direção ao teal.
 *
 * Fica fora do arquivo de componentes por dois motivos: a legenda "menos → mais"
 * precisa consumir a MESMA fonte (escrita à mão na tela, ela contradizia o mapa),
 * e exportar não-componente ao lado de componente quebra o fast refresh.
 */
export function heatmapRamp(isDark: boolean): string[] {
  return isDark
    ? ["#161A27", "#173D3C", "#12655C", "#00A799", "#2EC48A", "#5DE0D4", "#99F2E8"]
    : ["#F0FDFB", "#CCFBF4", "#99F2E8", "#5DE0D4", "#2EC48A", "#00A799", "#006B60"]
}
