import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { textoDestino, type Destino } from '../lib/bipagem';
import { buscarCidades, carregarCidades, type Cidade } from '../lib/cidades';
import { criarDetectorLeitor } from '../lib/leitor';

interface Props {
  valor: Destino | null;
  onEscolher: (d: Destino | null) => void;
  /** O leitor "digitou" uma chave aqui dentro: o campo descarta e avisa. */
  onBipagemNoCampo: () => void;
  autoFocus?: boolean;
}

/**
 * Digita parte do nome e escolhe na lista (setas + Enter, ou clique). Só aceita cidade da
 * lista do IBGE, e o estado vem junto: não tem como gravar cidade e UF que não combinam.
 */
export function CampoCidade({ valor, onEscolher, onBipagemNoCampo, autoFocus }: Props) {
  const id = useId();
  const [cidades, setCidades] = useState<Cidade[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [texto, setTexto] = useState(valor ? textoDestino(valor) : '');
  const [marcada, setMarcada] = useState(0);
  const [aberta, setAberta] = useState(false);
  const [detector] = useState(() => criarDetectorLeitor<null>());
  const ultimoAviso = useRef(0);
  const ultimoNumero = useRef(0);

  useEffect(() => {
    let ativo = true;
    carregarCidades().then((c) => { if (ativo) setCidades(c); }, () => { if (ativo) setFalhou(true); });
    return () => { ativo = false; };
  }, []);

  const sugestoes = cidades && aberta ? buscarCidades(cidades, texto) : [];

  /** Um aviso por leitura (a chave chega como dezenas de teclas). */
  function avisar() {
    const agora = Date.now();
    if (agora - ultimoAviso.current < 2000) return;
    ultimoAviso.current = agora;
    onBipagemNoCampo();
  }

  function digitar(novo: string) {
    // Nenhuma cidade tem número: número aqui é o leitor bipando dentro do campo.
    if (/\d/.test(novo)) {
      ultimoNumero.current = Date.now();
      setAberta(false);
      avisar();
      return;
    }
    setTexto(novo);
    setMarcada(0);
    setAberta(true);
    if (valor) onEscolher(null); // Mudou o texto: a cidade escolhida deixa de valer.
  }

  function escolher(c: Cidade) {
    const destino = { cidade: c.cidade, uf: c.uf, ibge: c.ibge };
    setTexto(textoDestino(destino));
    setAberta(false);
    onEscolher(destino);
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    // Leitor que cola o texto de uma vez (sem teclas): o Enter logo depois dos números é dele.
    const enterDoLeitor = e.key === 'Enter' && Date.now() - ultimoNumero.current < 1000;
    if (detector.tecla(e.key, null) || enterDoLeitor) {
      e.preventDefault(); // Enter do leitor: não escolhe cidade nem salva o quadro.
      setAberta(false);
      avisar();
      return;
    }
    if (!sugestoes.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMarcada((m) => (m + 1) % sugestoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMarcada((m) => (m - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      escolher(sugestoes[Math.min(marcada, sugestoes.length - 1)]);
    } else if (e.key === 'Escape') {
      setAberta(false);
    }
  }

  return (
    <div className="campo-cidade">
      <input
        id={id}
        role="combobox"
        aria-expanded={sugestoes.length > 0}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={falhou ? 'Não foi possível carregar as cidades. Recarregue a página.' : 'Digite a cidade (ex.: campinas)'}
        value={texto}
        disabled={falhou}
        onChange={(e) => digitar(e.target.value)}
        onKeyDown={aoTeclar}
        onBlur={() => setAberta(false)}
        onFocus={() => { if (!valor) setAberta(true); }}
      />
      {sugestoes.length > 0 && (
        <ul id={`${id}-lista`} role="listbox" className="cidade-sugestoes">
          {sugestoes.map((c, i) => (
            <li key={c.ibge} role="option" aria-selected={i === marcada}
              className={i === marcada ? 'cidade-sugestao cidade-marcada' : 'cidade-sugestao'}
              // mousedown: escolhe antes do blur fechar a lista.
              onMouseDown={(e) => { e.preventDefault(); escolher(c); }}
              onMouseEnter={() => setMarcada(i)}>
              <span>{c.cidade}</span> <strong>{c.uf}</strong>
            </li>
          ))}
        </ul>
      )}
      {aberta && cidades && texto.trim().length >= 2 && sugestoes.length === 0 && !valor && (
        <p className="cidade-nenhuma">Nenhuma cidade com esse nome.</p>
      )}
    </div>
  );
}
