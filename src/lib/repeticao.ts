// Regra 5 da bipagem: a mesma chave lida de novo em menos de 10 s no mesmo aparelho é
// ignorada (leitor que dispara duas vezes, operador que bipa duas vezes sem querer).

export const JANELA_REPETICAO_MS = 10_000;

export interface FiltroRepeticao {
  /** `true` quando a chave é repetição e deve ser ignorada. Repetir não renova o prazo. */
  ehRepeticao(chave: string): boolean;
  /** Esquece a chave, para a próxima leitura passar (usado quando a gravação falhou). */
  esquecer(chave: string): void;
}

export function criarFiltroRepeticao(
  janelaMs: number = JANELA_REPETICAO_MS,
  agora: () => number = Date.now,
): FiltroRepeticao {
  const ultimaLeitura = new Map<string, number>();

  return {
    ehRepeticao(chave) {
      const t = agora();
      for (const [k, quando] of ultimaLeitura) {
        if (t - quando >= janelaMs) ultimaLeitura.delete(k);
      }
      if (ultimaLeitura.has(chave)) return true;
      ultimaLeitura.set(chave, t);
      return false;
    },
    esquecer(chave) {
      ultimaLeitura.delete(chave);
    },
  };
}
