// Regra 5 da bipagem: a mesma chave lida de novo em menos de 10 s no mesmo aparelho é
// ignorada (leitor que dispara duas vezes, operador que bipa duas vezes sem querer).

export const JANELA_REPETICAO_MS = 10_000;

/**
 * Devolve uma função que responde `true` quando a chave é repetição e deve ser ignorada.
 * A janela conta da primeira leitura: repetir não renova o prazo.
 */
export function criarFiltroRepeticao(
  janelaMs: number = JANELA_REPETICAO_MS,
  agora: () => number = Date.now,
): (chave: string) => boolean {
  const ultimaLeitura = new Map<string, number>();

  return (chave) => {
    const t = agora();
    for (const [k, quando] of ultimaLeitura) {
      if (t - quando >= janelaMs) ultimaLeitura.delete(k);
    }
    if (ultimaLeitura.has(chave)) return true;
    ultimaLeitura.set(chave, t);
    return false;
  };
}
