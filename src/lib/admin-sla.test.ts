import { describe, expect, it } from "vitest"
import {
  SLA_DUE_SOON_HOURS, SLA_WINDOW_HOURS,
  describeQueueHeadline, describeSlaCountdown, describeSubscribers, slaHoursRemaining,
} from "@/lib/admin-sla"

describe("constantes do SLA", () => {
  // Divergir do backend faria a tela mostrar um cronômetro que não bate com o
  // badge que o próprio backend calculou.
  it("espelha BrandVerificationSla (72h de janela, 24h de folga)", () => {
    expect(SLA_WINDOW_HOURS).toBe(72)
    expect(SLA_DUE_SOON_HOURS).toBe(24)
  })
})

describe("slaHoursRemaining", () => {
  it("conta a partir da idade que o SERVIDOR mandou, não do relógio local", () => {
    expect(slaHoursRemaining(0)).toBe(72)
    expect(slaHoursRemaining(48)).toBe(24)
    expect(slaHoursRemaining(80)).toBe(-8)
  })
})

describe("describeSlaCountdown", () => {
  it("mostra dias enquanto falta mais de um", () => {
    expect(describeSlaCountdown(0)).toBe("3d restantes")
    expect(describeSlaCountdown(12)).toBe("2d 12h restantes")
  })

  it("mostra horas dentro do último dia — a faixa que importa pro admin", () => {
    expect(describeSlaCountdown(48)).toBe("1d restantes")
    expect(describeSlaCountdown(64)).toBe("8h restantes")
    expect(describeSlaCountdown(71)).toBe("1h restantes")
  })

  it("cai pra minutos na última hora", () => {
    expect(describeSlaCountdown(71.5)).toBe("30min restantes")
  })

  it("no limite exato diz 'vence agora' — '0min fora do SLA' seria ruído", () => {
    expect(describeSlaCountdown(72)).toBe("vence agora")
  })

  it("inverte a frase quando o prazo estourou", () => {
    expect(describeSlaCountdown(75)).toBe("3h fora do SLA")
    expect(describeSlaCountdown(120)).toBe("2d fora do SLA")
  })

  it("não produz '1d 24h' por arredondamento", () => {
    // 24,4h restantes: arredondar as horas do resto daria 24 e viraria "1d 24h".
    expect(describeSlaCountdown(SLA_WINDOW_HOURS - 47.7)).toBe("2d restantes")
  })
})

describe("describeSubscribers", () => {
  it("singulariza e trata a marca sem assinante", () => {
    expect(describeSubscribers(0)).toBe("sem assinantes")
    expect(describeSubscribers(1)).toBe("1 tenant assinando")
    expect(describeSubscribers(12)).toBe("12 tenants assinando")
  })
})

describe("describeQueueHeadline", () => {
  const summary = { total: 137, ok: 100, dueSoon: 30, breached: 7 }

  it("usa o total do backlog, não o tamanho da página", () => {
    expect(describeQueueHeadline(summary, 50)).toBe("137 marcas aguardando")
  })

  it("cai pra contagem da página quando o summary não carregou", () => {
    expect(describeQueueHeadline(undefined, 3)).toBe("3 marcas aguardando")
    expect(describeQueueHeadline(undefined, 1)).toBe("1 marca aguardando")
  })

  it("fila vazia tem frase própria", () => {
    expect(describeQueueHeadline({ total: 0, ok: 0, dueSoon: 0, breached: 0 }, 0))
      .toBe("Nenhuma marca aguardando verificação.")
    expect(describeQueueHeadline(undefined, 0)).toBe("Nenhuma marca aguardando verificação.")
  })
})
