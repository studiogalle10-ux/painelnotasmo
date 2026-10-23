import { useState, type FormEvent } from 'react';

interface Props {
  titulo: string;
  texto: string;
  rotuloConfirmar: string;
  /** Lança erro com mensagem para mostrar no diálogo. */
  onConfirmar: (motivo: string) => Promise<void>;
  onCancelar: () => void;
}

/** Confirmação de ação irreversível, com motivo obrigatório (fica no histórico). */
export function DialogoConfirmacao({ titulo, texto, rotuloConfirmar, onConfirmar, onCancelar }: Props) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const motivoValido = motivo.trim().length >= 3;

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!motivoValido) return;
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar(motivo.trim());
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : 'Não foi possível concluir.');
      setEnviando(false);
    }
  }

  return (
    <div className="dialogo-fundo" role="presentation" onClick={onCancelar}>
      <form className="dialogo" role="dialog" aria-modal="true" aria-label={titulo}
        onSubmit={confirmar} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        <p>{texto}</p>
        <label>
          Motivo (obrigatório, fica no histórico)
          <textarea value={motivo} maxLength={500} rows={3} autoFocus
            onChange={(e) => setMotivo(e.target.value)} />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <div className="dialogo-acoes">
          <button type="button" className="botao-secundario" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="botao-perigo" disabled={!motivoValido || enviando}>
            {enviando ? 'Salvando…' : rotuloConfirmar}
          </button>
        </div>
      </form>
    </div>
  );
}
