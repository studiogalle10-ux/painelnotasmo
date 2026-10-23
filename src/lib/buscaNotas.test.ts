import { describe, expect, it } from 'vitest';
import { lerChave } from './chaveAcesso';
import { chaveDaBusca, filtrarNotas, gerarCsv, normalizar } from './buscaNotas';
import type { NotaPainel } from './painel';
import type { Config } from '../tipos/firestore';

const AGORA = new Date('2026-10-23T15:00:00Z');
const HORA = 60 * 60 * 1000;
const CONFIG: Config = { diasUrgencia: 5, horasEmRotaNaTv: 24 };

function nota(chave: string, recebidaHa: number, saidaHa?: number): NotaPainel {
  const r = lerChave(chave);
  if (!r.ok) throw new Error(r.erro);
  return {
    dados: r.dados,
    status: saidaHa === undefined ? 'preparacao' : 'em_rota',
    recebidaEm: new Date(AGORA.getTime() - recebidaHa * HORA),
    saidaEm: saidaHa === undefined ? null : new Date(AGORA.getTime() - saidaHa * HORA),
  };
}

// NF 274.914, CNPJ 02.745.352/0001-00 (SP)
const MARZO = nota('35261002745352000100550010002749141153853870', 2);
// NF 12.345, CNPJ 11.222.333/0001-81, há 6 dias (urgência)
const EXEMPLO = nota('35261011222333000181550010000123451123456784', 6 * 24);
// NF 12.345, CPF 529.982.247-25 (MG), em rota
const PRODUTOR = nota('31261000052998224725550010000123451123456787', 30, 3);
const TODAS = [MARZO, EXEMPLO, PRODUTOR];
const NOMES = { '02745352000100': 'Marzo Vitorino Móveis', '11222333000181': 'Exemplo Distribuidora' };

const buscar = (texto: string, situacao: Parameters<typeof filtrarNotas>[1]['situacao'] = 'todas') =>
  filtrarNotas(TODAS, { texto, situacao }, NOMES, AGORA, CONFIG).map((n) => n.dados.cnpjEmitente);

describe('filtrarNotas: texto', () => {
  it('sem texto, traz tudo, da mais recente para a mais antiga', () => {
    expect(buscar('')).toEqual(['02745352000100', '00052998224725', '11222333000181']);
  });

  it('acha pelo número da NF, com ou sem zeros e pontos', () => {
    expect(buscar('274914')).toEqual(['02745352000100']);
    expect(buscar('274.914')).toEqual(['02745352000100']);
    expect(buscar('000274914')).toEqual(['02745352000100']);
    expect(buscar('12345')).toEqual(['00052998224725', '11222333000181']);
  });

  it('acha pelo CNPJ, com ou sem pontuação', () => {
    expect(buscar('02.745.352/0001-00')).toEqual(['02745352000100']);
    expect(buscar('11222333')).toEqual(['11222333000181']);
  });

  it('acha pelo nome do emissor, sem diferença de acento e maiúscula', () => {
    expect(buscar('moveis')).toEqual(['02745352000100']);
    expect(buscar('EXEMPLO dist')).toEqual(['11222333000181']);
  });

  it('não acha o que não existe', () => {
    expect(buscar('transportadora')).toEqual([]);
    expect(buscar('999999')).toEqual([]);
  });
});

describe('filtrarNotas: situação', () => {
  it('separa preparação, urgência e em rota', () => {
    expect(buscar('', 'preparacao')).toEqual(['02745352000100']);
    expect(buscar('', 'urgencia')).toEqual(['11222333000181']);
    expect(buscar('', 'em_rota')).toEqual(['00052998224725']);
  });

  it('junta situação e texto', () => {
    expect(buscar('12345', 'urgencia')).toEqual(['11222333000181']);
  });
});

describe('chaveDaBusca', () => {
  it('reconhece a chave completa, mesmo com espaços', () => {
    expect(chaveDaBusca('3526 1002 7453 5200 0100 5500 1000 2749 1411 5385 3870'))
      .toBe('35261002745352000100550010002749141153853870');
  });

  it('não confunde número de NF com chave', () => {
    expect(chaveDaBusca('274914')).toBeNull();
  });
});

describe('normalizar', () => {
  it('tira acentos e maiúsculas', () => {
    expect(normalizar('  São Paulo MÓVEIS ')).toBe('sao paulo moveis');
  });
});

describe('gerarCsv', () => {
  const csv = gerarCsv([MARZO, PRODUTOR], NOMES, AGORA, CONFIG);
  const linhas = csv.slice(1).split('\r\n');

  it('começa com BOM e usa ; como separador', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(linhas[0]).toBe(
      'NF;Série;Emissor;CNPJ/CPF;UF;Situação;Recebida em;Dias parada;Saída em;Chave de acesso');
  });

  it('escreve uma linha por nota, com a chave protegida como texto', () => {
    expect(linhas).toHaveLength(3);
    const marzo = linhas[1].split(';');
    expect(marzo.slice(0, 8)).toEqual([
      '274.914', '1', 'Marzo Vitorino Móveis', '02.745.352/0001-00', 'SP', 'Preparação',
      '23/10/2026, 10:00', '0',
    ]);
    expect(marzo[9]).toBe('"=""35261002745352000100550010002749141153853870"""');
  });

  it('nota em rota tem saída e não tem dias parada; CPF sai formatado', () => {
    const produtor = linhas[2].split(';');
    expect(produtor[3]).toBe('529.982.247-25');
    expect(produtor[5]).toBe('Em rota');
    expect(produtor[7]).toBe('');
    expect(produtor[8]).toBe('23/10/2026, 09:00');
  });

  it('protege texto com ; e aspas', () => {
    const csv2 = gerarCsv([MARZO], { '02745352000100': 'Loja "A"; Filial' }, AGORA, CONFIG);
    expect(csv2).toContain('"Loja ""A""; Filial"');
  });
});
