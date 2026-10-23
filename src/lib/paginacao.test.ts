import { describe, expect, it } from 'vitest';
import { paginar, quantosCabem } from './paginacao';

const lista = Array.from({ length: 7 }, (_, i) => i + 1);

describe('paginar', () => {
  it('divide em páginas e volta à primeira depois da última', () => {
    expect(paginar(lista, 3, 0)).toEqual({ itens: [1, 2, 3], numero: 1, total: 3 });
    expect(paginar(lista, 3, 1)).toEqual({ itens: [4, 5, 6], numero: 2, total: 3 });
    expect(paginar(lista, 3, 2)).toEqual({ itens: [7], numero: 3, total: 3 });
    expect(paginar(lista, 3, 3)).toEqual({ itens: [1, 2, 3], numero: 1, total: 3 });
  });

  it('com tudo cabendo, fica sempre na página 1', () => {
    expect(paginar(lista, 10, 5)).toEqual({ itens: lista, numero: 1, total: 1 });
  });

  it('lista vazia tem uma página vazia', () => {
    expect(paginar([], 4, 2)).toEqual({ itens: [], numero: 1, total: 1 });
  });

  it('a lista encolhendo não deixa página inexistente', () => {
    expect(paginar(lista.slice(0, 4), 3, 5).numero).toBe(2);
  });

  it('nunca usa menos de 1 item por página', () => {
    expect(paginar(lista, 0, 0).itens).toEqual([1]);
  });
});

describe('quantosCabem', () => {
  it('conta os cards inteiros, com espaço entre eles', () => {
    expect(quantosCabem(500, 100, 10)).toBe(4);
    expect(quantosCabem(560, 100, 10)).toBe(5);
  });

  it('sempre cabe pelo menos 1', () => {
    expect(quantosCabem(50, 100, 10)).toBe(1);
  });
});
