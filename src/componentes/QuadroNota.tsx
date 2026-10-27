import { useRef, useState, type FormEvent } from 'react';
import { db } from '../lib/firebase';
import { definirDestino, definirOcorrencia, textoDestino, type Autor, type Destino } from '../lib/bipagem';
import { formatarNumeroNF, type ChaveNFe } from '../lib/chaveAcesso';
import { pareceBipagem } from '../lib/cidades';
import { criarDetectorLeitor } from '../lib/leitor';
import { CampoCidade } from './CampoCidade';

const LIMITE_OCORRENCIA = 300;

export interface NotaAberta {
  dados: ChaveNFe;
  destino: Destino | null;
  ocorrencia: string | null;
}

interface Props {
  nota: NotaAberta;
  autor: Autor;
  /** Acabou de entrar: título "Nova nota" e sem botão Cancelar (o destino é obrigatório). */
  nova: boolean;
  onFechar: () => void;
  onBipagemNoCampo: () => void;
}

/** Destino (obrigatório) e ocorrência (só quando a nota tem que aguardar algo). */
export function QuadroNota({ nota, autor, nova, onFechar, onBipagemNoCampo }: Props) {
  const [destino, setDestino] = useState<Destino | null>(nota.destino);
  const [ocorrencia, setOcorrencia] = useState(nota.ocorrencia ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [detector] = useState(() => criarDetectorLeitor<string>());
  const ultimoAviso = useRef(0);
  const nf = `NF ${formatarNumeroNF(nota.dados.numero)}`;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!destino) {
      setErro('Escolha a cidade de destino na lista.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const mudouDestino = !nota.destino || nota.destino.ibge !== destino.ibge;
      if (mudouDestino) await definirDestino(db, nota.dados.chave, destino, autor);
      const motivo = ocorrencia.trim() || null;
      if (motivo !== (nota.ocorrencia ?? null)) await definirOcorrencia(db, nota.dados.chave, motivo, autor);
      onFechar();
    } catch (err) {
      setErro(err instanceof Error && err.message === 'A nota já saiu.'
        ? 'Essa nota já saiu; não dá mais para alterar.'
        : 'Não foi possível salvar. Confira a internet e tente de novo.');
      setSalvando(false);
    }
  }

  function avisar() {
    const agora = Date.now();
    if (agora - ultimoAviso.current < 2000) return;
    ultimoAviso.current = agora;
    onBipagemNoCampo();
  }

  function digitarOcorrencia(texto: string) {
    // Leitor sem Enter no fim: tira a sequência longa de números que ele "digitou".
    if (pareceBipagem(texto)) {
      texto = texto.replace(/\d{20,}/g, '').trimEnd();
      avisar();
    }
    setOcorrencia(texto.slice(0, LIMITE_OCORRENCIA));
  }

  return (
    <form className="quadro" onSubmit={salvar}>
      <h2 className="quadro-titulo">
        {nova ? `${nf} entrou · informe o destino` : `${nf} · destino e ocorrência`}
      </h2>

      <label className="quadro-campo">
        <span>Destino da entrega <strong>(obrigatório)</strong></span>
        <CampoCidade valor={destino} onEscolher={setDestino} onBipagemNoCampo={onBipagemNoCampo} autoFocus />
      </label>
      {destino && <p className="quadro-escolhido">✓ {textoDestino(destino)}</p>}

      <label className="quadro-campo">
        <span>Ocorrência <em>(só se a nota tiver que aguardar algo)</em></span>
        <textarea rows={2} value={ocorrencia} maxLength={LIMITE_OCORRENCIA}
          placeholder="Ex.: aguardando agendamento do cliente"
          onChange={(e) => digitarOcorrencia(e.target.value)}
          onKeyDown={(e) => {
            const leitor = detector.tecla(e.key, ocorrencia);
            if (leitor) {
              // Enter do leitor: desfaz o que ele digitou aqui e não salva.
              e.preventDefault();
              setOcorrencia(leitor.restaurar);
              avisar();
              return;
            }
            // Enter salva; Shift+Enter quebra a linha.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
          }} />
      </label>

      {erro && <p className="erro">{erro}</p>}
      <div className="quadro-botoes">
        {!nova && <button type="button" className="botao-secundario" onClick={onFechar}>Cancelar</button>}
        <button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
