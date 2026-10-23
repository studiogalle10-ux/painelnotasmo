import { describe, expect, it } from 'vitest';
import { criarFiltroRepeticao } from './repeticao';

function relogio() {
  let t = 0;
  return { agora: () => t, avancar: (ms: number) => { t += ms; } };
}

describe('criarFiltroRepeticao', () => {
  it('deixa passar a primeira leitura e ignora a repetição dentro de 10 s', () => {
    const r = relogio();
    const filtro = criarFiltroRepeticao(10_000, r.agora);
    expect(filtro.ehRepeticao('A')).toBe(false);
    r.avancar(9_999);
    expect(filtro.ehRepeticao('A')).toBe(true);
  });

  it('deixa passar de novo depois de 10 s', () => {
    const r = relogio();
    const filtro = criarFiltroRepeticao(10_000, r.agora);
    filtro.ehRepeticao('A');
    r.avancar(10_000);
    expect(filtro.ehRepeticao('A')).toBe(false);
  });

  it('repetir não renova o prazo', () => {
    const r = relogio();
    const filtro = criarFiltroRepeticao(10_000, r.agora);
    filtro.ehRepeticao('A');
    r.avancar(6_000);
    expect(filtro.ehRepeticao('A')).toBe(true);
    r.avancar(4_000);
    expect(filtro.ehRepeticao('A')).toBe(false);
  });

  it('trata cada chave separadamente', () => {
    const r = relogio();
    const filtro = criarFiltroRepeticao(10_000, r.agora);
    expect(filtro.ehRepeticao('A')).toBe(false);
    expect(filtro.ehRepeticao('B')).toBe(false);
    expect(filtro.ehRepeticao('A')).toBe(true);
  });

  it('esquecer deixa a próxima leitura passar (gravação que falhou)', () => {
    const r = relogio();
    const filtro = criarFiltroRepeticao(10_000, r.agora);
    filtro.ehRepeticao('A');
    filtro.esquecer('A');
    expect(filtro.ehRepeticao('A')).toBe(false);
  });
});
