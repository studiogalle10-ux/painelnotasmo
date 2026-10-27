// Cidades do IBGE (src/dados/municipios.json: [código, nome, UF]) e a busca do campo de destino.
// A lista vem junto com o site (baixada só ao abrir a tela de bipar), sem gastar leituras do banco.
import type { Destino } from './bipagem';

export interface Cidade extends Destino {
  /** Nome sem acento e em minúsculas, para a busca. */
  busca: string;
}

/** "São José" → "sao jose"; tira acento, hífen e apóstrofo duplicado de espaço. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function montarCidades(lista: [number, string, string][]): Cidade[] {
  return lista.map(([ibge, cidade, uf]) => ({ ibge, cidade, uf, busca: normalizar(cidade) }));
}

let carregando: Promise<Cidade[]> | null = null;

export function carregarCidades(): Promise<Cidade[]> {
  carregando ??= import('../dados/municipios.json')
    .then((m) => montarCidades(m.default as [number, string, string][]))
    .catch((e: unknown) => {
      carregando = null; // Deixa tentar de novo.
      throw e;
    });
  return carregando;
}

const UFS = new Set(['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB',
  'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']);

/**
 * Sugestões para o que foi digitado. Aceita a UF no fim ("campinas sp", "bom jesus - rs").
 * Ordem: nome igual, depois começa com o texto, depois alguma palavra começa com ele.
 */
export function buscarCidades(cidades: Cidade[], texto: string, maximo = 8): Cidade[] {
  let termo = normalizar(texto);
  let uf: string | null = null;
  const fim = termo.match(/^(.*\S)\s+([a-z]{2})$/);
  if (fim && UFS.has(fim[2].toUpperCase())) {
    termo = fim[1];
    uf = fim[2].toUpperCase();
  }
  if (termo.length < 2) return [];

  const iguais: Cidade[] = [];
  const comecam: Cidade[] = [];
  const palavras: Cidade[] = [];
  for (const c of cidades) {
    if (uf && c.uf !== uf) continue;
    if (c.busca === termo) iguais.push(c);
    else if (c.busca.startsWith(termo)) comecam.push(c);
    else if (c.busca.includes(` ${termo}`)) palavras.push(c);
  }
  return [...iguais, ...comecam, ...palavras].slice(0, maximo);
}

/** Leitor de código de barras "digitando" dentro de um campo de texto (sequência longa de números). */
export const pareceBipagem = (texto: string) => /\d{20,}/.test(texto);
