// O leitor de código de barras "digita" a chave muito mais rápido que uma pessoa e termina
// com Enter. Nos campos do quadro de destino isso não pode virar texto nem salvar o quadro.

/** Intervalo máximo entre teclas para contar como leitor (pessoa digitando leva bem mais). */
export const INTERVALO_LEITOR_MS = 40;
/** Teclas rápidas seguidas para concluir que é o leitor. */
export const TECLAS_LEITOR = 8;

export interface DetectorLeitor<T> {
  /**
   * Chamar no keydown, com o valor do campo antes da tecla. Devolve o valor de antes da
   * rajada quando a tecla é o Enter do leitor (o campo deve voltar a esse valor); senão null.
   */
  tecla(key: string, valorAtual: T, agora?: number): { restaurar: T } | null;
}

export function criarDetectorLeitor<T>(): DetectorLeitor<T> {
  let ultima = -Infinity;
  let rapidas = 0;
  let antes: T | undefined;
  return {
    tecla(key, valorAtual, agora = performance.now()) {
      if (agora - ultima <= INTERVALO_LEITOR_MS) {
        rapidas++;
      } else {
        rapidas = 0;
        antes = valorAtual;
      }
      ultima = agora;
      if ((key === 'Enter' || key === 'Tab') && rapidas >= TECLAS_LEITOR) {
        rapidas = 0;
        return { restaurar: antes as T };
      }
      return null;
    },
  };
}
