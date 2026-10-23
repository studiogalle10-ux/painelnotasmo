// Identificador do aparelho (celular, computador, coletor), gravado em cada evento.
// Fica salvo no navegador; se o armazenamento estiver bloqueado, vale só para esta aba.

const CHAVE_ARMAZENAMENTO = 'painel-nf-mo:aparelho';

let idDaSessao: string | null = null;

export function idAparelho(): string {
  try {
    let id = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CHAVE_ARMAZENAMENTO, id);
    }
    return id;
  } catch {
    idDaSessao ??= crypto.randomUUID();
    return idDaSessao;
  }
}
