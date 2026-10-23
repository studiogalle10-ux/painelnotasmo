export type TomResultado = 'entrada' | 'saida' | 'aviso' | 'erro' | 'neutro' | 'processando';

export interface Mensagem {
  /** Muda a cada leitura, para a animação recomeçar mesmo com o mesmo texto. */
  id: number;
  tom: TomResultado;
  titulo: string;
  detalhe?: string;
}

export function ResultadoBipagem({ mensagem }: { mensagem: Mensagem | null }) {
  if (!mensagem) {
    return (
      <div className="resultado resultado-vazio" role="status">
        <p className="resultado-titulo">Pronto para bipar</p>
      </div>
    );
  }
  return (
    <div key={mensagem.id} className={`resultado resultado-${mensagem.tom}`} role="status" aria-live="assertive">
      <p className="resultado-titulo">{mensagem.titulo}</p>
      {mensagem.detalhe && <p className="resultado-detalhe">{mensagem.detalhe}</p>}
    </div>
  );
}
