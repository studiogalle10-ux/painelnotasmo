import { describe, expect, it } from 'vitest';
import { criarFiltroRepeticao } from './repeticao';

function relogio() {
  let t = 0;
  return { agora: () => t, avancar: (ms: number) => { t += ms; } };
}

describe('criarFiltroRepeticao', () => {
  it('deixa passar a primeira leitura e ignora a repetição dentro de 10 s', () => {
    const r = relogio();
    const repetida = criarFiltroRepeticao(10_000, r.agora);
    expect(repetida('A')).toBe(false);
    r.avancar(9_999);
    expect(repetida('A')).toBe(true);
  });

  it('deixa passar de novo depois de 10 s', () => {
    const r = relogio();
    const repetida = criarFiltroRepeticao(10_000, r.agora);
    repetida('A');
    r.avancar(10_000);
    expect(repetida('A')).toBe(false);
  });

  it('repetir não renova o prazo', () => {
    const r = relogio();
    const repetida = criarFiltroRepeticao(10_000, r.agora);
    repetida('A');
    r.avancar(6_000);
    expect(repetida('A')).toBe(true);
    r.avancar(4_000);
    expect(repetida('A')).toBe(false);
  });

  it('trata cada chave separadamente', () => {
    const r = relogio();
    const repetida = criarFiltroRepeticao(10_000, r.agora);
    expect(repetida('A')).toBe(false);
    expect(repetida('B')).toBe(false);
    expect(repetida('A')).toBe(true);
  });
});
