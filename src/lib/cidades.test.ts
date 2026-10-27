import { describe, expect, it } from 'vitest';
import lista from '../dados/municipios.json';
import { buscarCidades, montarCidades, normalizar, pareceBipagem } from './cidades';

const cidades = montarCidades(lista as [number, string, string][]);
const nomes = (texto: string, maximo?: number) =>
  buscarCidades(cidades, texto, maximo).map((c) => `${c.cidade} – ${c.uf}`);

describe('lista do IBGE', () => {
  it('tem todas as cidades, com código e UF válidos', () => {
    expect(cidades.length).toBeGreaterThan(5560);
    expect(new Set(cidades.map((c) => c.uf)).size).toBe(27);
    expect(cidades.find((c) => c.cidade === 'Campinas' && c.uf === 'SP')?.ibge).toBe(3509502);
  });
});

describe('normalizar', () => {
  it('tira acento, maiúscula, hífen e espaço sobrando', () => {
    expect(normalizar('  São   José do Rio-Preto ')).toBe('sao jose do rio preto');
    expect(normalizar("Pau-d'Arco")).toBe('pau d arco');
  });
});

describe('buscarCidades', () => {
  it('acha pelo começo do nome, sem acento', () => {
    expect(nomes('sao jose do rio p')).toEqual(['São José do Rio Pardo – SP', 'São José do Rio Preto – SP']);
  });

  it('nome igual vem primeiro', () => {
    expect(nomes('campinas')[0]).toBe('Campinas – SP');
  });

  it('cidade com nome repetido aparece uma vez por estado', () => {
    expect(nomes('bom jesus', 20).filter((n) => n.startsWith('Bom Jesus –')))
      .toEqual(['Bom Jesus – PB', 'Bom Jesus – PI', 'Bom Jesus – RN', 'Bom Jesus – RS', 'Bom Jesus – SC']);
  });

  it('aceita a UF no fim para filtrar', () => {
    expect(nomes('bom jesus rs')[0]).toBe('Bom Jesus – RS');
    expect(nomes('bom jesus - rs').every((n) => n.endsWith('– RS'))).toBe(true);
  });

  it('acha por palavra do meio ("preto" → São José do Rio Preto)', () => {
    expect(nomes('rio preto', 50)).toContain('São José do Rio Preto – SP');
  });

  it('menos de 2 letras não sugere nada', () => {
    expect(nomes('s')).toEqual([]);
  });

  it('limita a quantidade de sugestões', () => {
    expect(nomes('sa')).toHaveLength(8);
  });
});

describe('pareceBipagem', () => {
  it('reconhece a chave caindo no campo, mas não um texto normal', () => {
    expect(pareceBipagem('3526100274535200010055')).toBe(true);
    expect(pareceBipagem('Aguardando 2 volumes da NF 1234')).toBe(false);
  });
});
