import { describe, expect, it } from 'vitest';
import { criarDetectorLeitor } from './leitor';

/** Simula teclas com `ms` entre elas; devolve o resultado do Enter final. */
function digitar(texto: string, ms: number, valorInicial = 'Campinas') {
  const d = criarDetectorLeitor<string>();
  let t = 1000;
  let valor = valorInicial;
  for (const c of texto) {
    d.tecla(c, valor, t);
    valor += c;
    t += ms;
  }
  return d.tecla('Enter', valor, t);
}

describe('criarDetectorLeitor', () => {
  it('rajada rápida terminando em Enter é o leitor: volta ao valor de antes', () => {
    expect(digitar('35261002745352000100550010002749141153853870', 5)).toEqual({ restaurar: 'Campinas' });
  });

  it('pessoa digitando e apertando Enter não é o leitor', () => {
    expect(digitar('aguardando cliente', 150)).toBeNull();
  });

  it('poucas teclas rápidas (atalho, duas letras) não contam', () => {
    expect(digitar('ab', 5)).toBeNull();
  });
});
