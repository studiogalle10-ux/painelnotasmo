import { describe, expect, it } from 'vitest';
import { lerChave } from './chaveAcesso';
import { separarColunas, textoDias, type NotaPainel } from './painel';
import type { Config } from '../tipos/firestore';

const CHAVE = '35261002745352000100550010002749141153853870';
const leitura = lerChave(CHAVE);
if (!leitura.ok) throw new Error(leitura.erro);
const dados = leitura.dados;

const AGORA = new Date('2026-10-23T15:00:00Z');
const HORA = 60 * 60 * 1000;
const antes = (horas: number) => new Date(AGORA.getTime() - horas * HORA);
const CONFIG: Config = { diasUrgencia: 5, horasEmRotaNaTv: 24 };

const preparacao = (horas: number, id = horas): NotaPainel => ({
  dados: { ...dados, numero: String(id) },
  status: 'preparacao',
  recebidaEm: antes(horas),
  saidaEm: null,
});

const emRota = (saidaHa: number | null, id = saidaHa ?? -1): NotaPainel => ({
  dados: { ...dados, numero: String(id) },
  status: 'em_rota',
  recebidaEm: antes(48),
  saidaEm: saidaHa === null ? null : antes(saidaHa),
});

const numeros = (itens: { dados: { numero: string } }[]) => itens.map((i) => Number(i.dados.numero));

describe('separarColunas', () => {
  it('4 dias e 23 h ainda é Preparação; 5 dias exatos já é Urgência', () => {
    const c = separarColunas([preparacao(4 * 24 + 23), preparacao(5 * 24)], AGORA, CONFIG);
    expect(numeros(c.preparacao)).toEqual([4 * 24 + 23]);
    expect(numeros(c.urgencia)).toEqual([5 * 24]);
  });

  it('amarelo a partir de 4 dias completos (um dia antes da urgência)', () => {
    const c = separarColunas([preparacao(3 * 24 + 23), preparacao(4 * 24)], AGORA, CONFIG);
    const porNumero = Object.fromEntries(c.preparacao.map((i) => [Number(i.dados.numero), i.alerta]));
    expect(porNumero[3 * 24 + 23]).toBe(false);
    expect(porNumero[4 * 24]).toBe(true);
  });

  it('nota em rota há 23 h aparece; há 25 h some', () => {
    const c = separarColunas([emRota(23), emRota(25)], AGORA, CONFIG);
    expect(numeros(c.emRota)).toEqual([23]);
  });

  it('nota em rota sem hora de saída (gravação pendente) aparece no topo', () => {
    const c = separarColunas([emRota(2), emRota(null, 999)], AGORA, CONFIG);
    expect(numeros(c.emRota)).toEqual([999, 2]);
  });

  it('Preparação e Urgência: mais antigas primeiro; Em rota: mais recentes primeiro', () => {
    const c = separarColunas(
      [preparacao(1), preparacao(50), preparacao(10), preparacao(200), preparacao(130),
        emRota(5), emRota(1), emRota(12)],
      AGORA,
      CONFIG,
    );
    expect(numeros(c.preparacao)).toEqual([50, 10, 1]);
    expect(numeros(c.urgencia)).toEqual([200, 130]);
    expect(numeros(c.emRota)).toEqual([1, 5, 12]);
  });

  it('segue a configuração do admin', () => {
    const config: Config = { diasUrgencia: 3, horasEmRotaNaTv: 12 };
    const c = separarColunas([preparacao(2 * 24), preparacao(3 * 24), emRota(13)], AGORA, config);
    expect(numeros(c.urgencia)).toEqual([3 * 24]);
    expect(c.preparacao[0].alerta).toBe(true);
    expect(c.emRota).toHaveLength(0);
  });

  it('calcula os dias parada', () => {
    const c = separarColunas([preparacao(6 * 24 + 5)], AGORA, CONFIG);
    expect(c.urgencia[0].dias).toBe(6);
  });
});

describe('textoDias', () => {
  it('escreve hoje, 1 dia e N dias', () => {
    expect(textoDias(0)).toBe('hoje');
    expect(textoDias(1)).toBe('1 dia');
    expect(textoDias(6)).toBe('6 dias');
  });
});
