import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { lerChave } from './chaveAcesso';
import { paraNotaPainel, separarColunas, textoDias, type NotaPainel } from './painel';
import type { Config, Nota } from '../tipos/firestore';

const CHAVE = '35261002745352000100550010002749141153853870';
const leitura = lerChave(CHAVE);
if (!leitura.ok) throw new Error(leitura.erro);
const dados = leitura.dados;

const AGORA = new Date('2026-10-23T15:00:00Z');
const HORA = 60 * 60 * 1000;
const antes = (horas: number) => new Date(AGORA.getTime() - horas * HORA);
const CONFIG: Config = { diasUrgencia: 4 };

const nota = (horas: number, ocorrencia: string | null = null, id = horas): NotaPainel => ({
  dados: { ...dados, numero: String(id) },
  recebidaEm: antes(horas),
  destino: { cidade: 'Campinas', uf: 'SP', ibge: 3509502 },
  ocorrencia,
});

const numeros = (itens: { dados: { numero: string } }[]) => itens.map((i) => Number(i.dados.numero));

describe('separarColunas', () => {
  it('3 dias e 23 h ainda é Depósito; 4 dias exatos já é Urgência', () => {
    const c = separarColunas([nota(3 * 24 + 23), nota(4 * 24)], AGORA, CONFIG);
    expect(numeros(c.deposito)).toEqual([3 * 24 + 23]);
    expect(numeros(c.urgencia)).toEqual([4 * 24]);
  });

  it('amarelo a partir de 3 dias completos (um dia antes da urgência)', () => {
    const c = separarColunas([nota(2 * 24 + 23), nota(3 * 24)], AGORA, CONFIG);
    const porNumero = Object.fromEntries(c.deposito.map((i) => [Number(i.dados.numero), i.alerta]));
    expect(porNumero[2 * 24 + 23]).toBe(false);
    expect(porNumero[3 * 24]).toBe(true);
  });

  it('nota com ocorrência fica em Em Ocorrência, mesmo com muitos dias', () => {
    const c = separarColunas([nota(1, 'Aguardando agendamento'), nota(10 * 24, 'Cliente fechado')], AGORA, CONFIG);
    expect(numeros(c.ocorrencia)).toEqual([10 * 24, 1]);
    expect(c.urgencia).toHaveLength(0);
    expect(c.deposito).toHaveLength(0);
    expect(c.ocorrencia[0].dias).toBe(10);
  });

  it('cada coluna mostra as mais antigas primeiro', () => {
    const c = separarColunas(
      [nota(1), nota(50), nota(10), nota(200), nota(130), nota(5, 'x'), nota(80, 'y')],
      AGORA,
      CONFIG,
    );
    expect(numeros(c.deposito)).toEqual([50, 10, 1]);
    expect(numeros(c.urgencia)).toEqual([200, 130]);
    expect(numeros(c.ocorrencia)).toEqual([80, 5]);
  });

  it('segue os ajustes', () => {
    const c = separarColunas([nota(1 * 24), nota(2 * 24)], AGORA, { diasUrgencia: 2 });
    expect(numeros(c.urgencia)).toEqual([2 * 24]);
    expect(c.deposito[0].alerta).toBe(true);
  });
});

describe('paraNotaPainel', () => {
  const base = { recebidaEm: Timestamp.fromDate(antes(2)) } as Nota;

  it('monta o destino e a ocorrência', () => {
    const n = paraNotaPainel(dados,
      { ...base, destinoCidade: 'Campinas', destinoUf: 'SP', destinoIbge: 3509502, ocorrencia: 'Falta volume' });
    expect(n.destino).toEqual({ cidade: 'Campinas', uf: 'SP', ibge: 3509502 });
    expect(n.ocorrencia).toBe('Falta volume');
  });

  it('sem destino e sem ocorrência: null', () => {
    const n = paraNotaPainel(dados, base);
    expect(n.destino).toBeNull();
    expect(n.ocorrencia).toBeNull();
  });
});

describe('textoDias', () => {
  it('escreve hoje, 1 dia e N dias', () => {
    expect(textoDias(0)).toBe('hoje');
    expect(textoDias(1)).toBe('1 dia');
    expect(textoDias(6)).toBe('6 dias');
  });
});
