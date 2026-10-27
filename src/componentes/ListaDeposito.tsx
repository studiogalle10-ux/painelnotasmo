import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/firebase';
import { definirOcorrencia, textoDestino, type Autor } from '../lib/bipagem';
import { formatarDocEmitente, formatarNumeroNF } from '../lib/chaveAcesso';
import { diasDesde } from '../lib/datas';
import { nomeDoEmitente } from '../lib/emitentes';
import { textoDias, type NotaPainel } from '../lib/painel';
import { useNotasGalpao } from '../lib/notasGalpao';
import type { NotaAberta } from './QuadroNota';

interface Props {
  autor: Autor;
  onAbrir: (nota: NotaAberta) => void;
}

/** Tudo que está no galpão (o que a TV mostra), para completar destino e ocorrência. */
export function ListaDeposito({ autor, onAbrir }: Props) {
  const { notas, erro: erroLeitura } = useNotasGalpao();
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [resolvendo, setResolvendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora] = useState(() => new Date());
  const tentados = useRef(new Set<string>());

  useEffect(() => {
    for (const { dados } of notas ?? []) {
      const cnpj = dados.cnpjEmitente;
      if (cnpj in nomes || tentados.current.has(cnpj)) continue;
      tentados.current.add(cnpj);
      void nomeDoEmitente(db, cnpj, dados.tipoDocEmitente).then((nome) => {
        if (nome) setNomes((m) => ({ ...m, [cnpj]: nome }));
      });
    }
  }, [notas, nomes]);

  async function resolver(n: NotaPainel) {
    const nf = formatarNumeroNF(n.dados.numero);
    if (!window.confirm(`Ocorrência da NF ${nf} resolvida? Ela volta para o Depósito.`)) return;
    setResolvendo(n.dados.chave);
    setErro(null);
    try {
      await definirOcorrencia(db, n.dados.chave, null, autor);
    } catch {
      setErro(`Não foi possível resolver a NF ${nf}. Tente de novo.`);
    } finally {
      setResolvendo(null);
    }
  }

  if (erroLeitura) return <p className="ultimas-aviso">Não foi possível carregar as notas do depósito.</p>;
  if (!notas) return <p className="ultimas-aviso">Carregando…</p>;
  if (notas.length === 0) return <p className="ultimas-aviso">Nenhuma nota no depósito.</p>;

  // Sem destino primeiro (precisam ser completadas), depois as mais recentes.
  const ordem = [...notas].sort((a, b) =>
    Number(!!a.destino) - Number(!!b.destino) || b.recebidaEm.getTime() - a.recebidaEm.getTime());

  return (
    <>
      {erro && <p className="erro">{erro}</p>}
      <ol className="ultimas">
        {ordem.map((n) => (
          <li key={n.dados.chave}
            className={`ultima deposito ${n.ocorrencia ? 'deposito-ocorrencia' : ''} ${n.destino ? '' : 'deposito-sem-destino'}`}>
            <span className="ultima-hora">{textoDias(diasDesde(n.recebidaEm, agora))}</span>
            <span className="ultima-nf">
              NF {formatarNumeroNF(n.dados.numero)}
              <span className={n.destino ? 'deposito-destino' : 'deposito-destino deposito-falta'}>
                {n.destino ? `→ ${textoDestino(n.destino)}` : 'SEM DESTINO'}
              </span>
            </span>
            <span className="ultima-emissor">
              {n.ocorrencia
                ? <span className="deposito-motivo">⚠ {n.ocorrencia}</span>
                : nomes[n.dados.cnpjEmitente] ?? formatarDocEmitente(n.dados.cnpjEmitente, n.dados.tipoDocEmitente)}
            </span>
            <span className="deposito-botoes">
              <button className={n.destino ? 'botao-secundario' : ''}
                onClick={() => onAbrir({ dados: n.dados, destino: n.destino, ocorrencia: n.ocorrencia })}>
                {n.destino ? (n.ocorrencia ? 'Editar' : 'Ocorrência') : 'Informar destino'}
              </button>
              {n.ocorrencia && (
                <button className="botao-secundario" disabled={resolvendo === n.dados.chave}
                  onClick={() => void resolver(n)}>
                  {resolvendo === n.dados.chave ? 'Resolvendo…' : 'Resolver'}
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
