export interface Pagina<T> {
  itens: T[];
  /** Começa em 1. */
  numero: number;
  total: number;
}

/**
 * Página `contador` (que só cresce, um a cada troca) de uma lista. Volta à primeira depois
 * da última; com a lista mudando de tamanho, continua numa página que existe.
 */
export function paginar<T>(itens: T[], porPagina: number, contador: number): Pagina<T> {
  const tamanho = Math.max(1, Math.floor(porPagina));
  const total = Math.max(1, Math.ceil(itens.length / tamanho));
  const indice = ((contador % total) + total) % total;
  return {
    itens: itens.slice(indice * tamanho, (indice + 1) * tamanho),
    numero: indice + 1,
    total,
  };
}

/** Quantos cards de altura fixa cabem na altura disponível (pelo menos 1). */
export function quantosCabem(alturaDisponivel: number, alturaCartao: number, espaco: number): number {
  if (alturaCartao <= 0) return 1;
  return Math.max(1, Math.floor((alturaDisponivel + espaco) / (alturaCartao + espaco)));
}
