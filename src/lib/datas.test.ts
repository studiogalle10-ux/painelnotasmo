import { describe, expect, it } from 'vitest';
import { diasDesde, formatarData, formatarDataHora, formatarHora } from './datas';

// São Paulo está em UTC−3 o ano todo (sem horário de verão desde 2019). As datas abaixo
// são em UTC, então o resultado não depende do fuso do computador que roda o teste.
describe('formatação no fuso de São Paulo', () => {
  it('converte de UTC para o horário de São Paulo', () => {
    const d = new Date('2026-10-23T13:36:00Z');
    expect(formatarHora(d)).toBe('10:36');
    expect(formatarData(d)).toBe('23/10/2026');
    expect(formatarDataHora(d)).toMatch(/^23\/10\/2026,? 10:36$/);
  });

  it('mostra o dia certo perto da meia-noite', () => {
    // 02:00 de 24/10 em UTC ainda é 23:00 de 23/10 em São Paulo.
    const d = new Date('2026-10-24T02:00:00Z');
    expect(formatarData(d)).toBe('23/10/2026');
    expect(formatarHora(d)).toBe('23:00');
  });
});

describe('diasDesde', () => {
  const bipagem = new Date('2026-10-18T13:00:00Z');
  const depois = (dias: number, horas = 0, minutos = 0) =>
    new Date(bipagem.getTime() + ((dias * 24 + horas) * 60 + minutos) * 60 * 1000);

  it('conta 0 no mesmo dia', () => {
    expect(diasDesde(bipagem, bipagem)).toBe(0);
    expect(diasDesde(bipagem, depois(0, 23, 59))).toBe(0);
  });

  it('conta 4 com 4 dias e 23 h (ainda não é urgência com limite de 5)', () => {
    expect(diasDesde(bipagem, depois(4, 23, 59))).toBe(4);
  });

  it('conta 5 com 5 dias exatos', () => {
    expect(diasDesde(bipagem, depois(5))).toBe(5);
  });

  it('nunca fica negativo (relógio do aparelho atrasado)', () => {
    expect(diasDesde(bipagem, depois(0, -2))).toBe(0);
  });
});
