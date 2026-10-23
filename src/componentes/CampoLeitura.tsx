import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { lerChave } from '../lib/chaveAcesso';

interface Props {
  onLer: (texto: string) => void;
  /** Mostra o teclado numérico para digitar a chave à mão. */
  digitando: boolean;
}

/**
 * Campo único da bipagem. O leitor de código de barras "digita" a chave e manda Enter
 * (ou Tab). Se não mandar, a leitura dispara ao completar uma chave válida.
 */
export function CampoLeitura({ onLer, digitando }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState('');

  // Mantém o foco no campo enquanto a tela estiver em uso.
  useEffect(() => {
    const focar = () => {
      const ativo = document.activeElement;
      if (ativo === ref.current) return;
      // Não rouba o foco de outro campo ou de um botão em uso.
      if (ativo instanceof HTMLInputElement || ativo instanceof HTMLTextAreaElement) return;
      ref.current?.focus({ preventScroll: true });
    };
    focar();
    const intervalo = window.setInterval(focar, 500);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [digitando]);

  function enviar(texto: string) {
    setValor('');
    if (texto.trim()) onLer(texto);
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      enviar(valor);
    }
  }

  function aoMudar(texto: string) {
    // Chave completa e válida: não espera o Enter (leitores configurados sem sufixo).
    if (lerChave(texto).ok) enviar(texto);
    else setValor(texto);
  }

  return (
    <input
      ref={ref}
      className="campo-leitura"
      aria-label="Chave de acesso"
      placeholder={digitando ? 'Digite os 44 números da chave' : 'Bipe o código de barras do DANFE'}
      inputMode={digitando ? 'numeric' : 'none'}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="characters"
      spellCheck={false}
      enterKeyHint="done"
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      onKeyDown={aoTeclar}
    />
  );
}
