import { useEffect, useRef, useState } from 'react';
import { Timestamp, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { darBaixa, type Autor } from '../lib/bipagem';
import { formatarDocEmitente, formatarNumeroNF, lerChave, type ChaveNFe } from '../lib/chaveAcesso';
import { formatarDiaHora } from '../lib/datas';
import { nomeDoEmitente } from '../lib/emitentes';
import type { Nota } from '../tipos/firestore';

const DIA_MS = 24 * 60 * 60 * 1000;

interface Linha {
  dados: ChaveNFe;
  saidaEm: Date | null;
}

interface Props {
  autor: Autor;
  diasEmRotaNaTv: number;
}

/** O que está na coluna "Em rota" da TV agora, com o botão de baixa. */
export function EmRotaNaTv({ autor, diasEmRotaNaTv }: Props) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [baixando, setBaixando] = useState<string | null>(null);
  const tentados = useRef(new Set<string>());

  useEffect(() => {
    const inicio = Timestamp.fromMillis(Date.now() - diasEmRotaNaTv * DIA_MS);
    return onSnapshot(
      query(collection(db, 'notas'), where('status', '==', 'em_rota'),
        where('saidaEm', '>=', inicio), orderBy('saidaEm', 'desc')),
      (s) => {
        setErro(null);
        setLinhas(s.docs.flatMap((d) => {
          const lida = lerChave(d.id);
          if (!lida.ok) return [];
          const n = d.data({ serverTimestamps: 'estimate' }) as Nota;
          return [{ dados: lida.dados, saidaEm: n.saidaEm?.toDate() ?? null }];
        }));
      },
      () => setErro('Não foi possível carregar as notas em rota.'),
    );
  }, [diasEmRotaNaTv]);

  useEffect(() => {
    for (const { dados } of linhas ?? []) {
      const cnpj = dados.cnpjEmitente;
      if (cnpj in nomes || tentados.current.has(cnpj)) continue;
      tentados.current.add(cnpj);
      void nomeDoEmitente(db, cnpj, dados.tipoDocEmitente).then((nome) => {
        if (nome) setNomes((m) => ({ ...m, [cnpj]: nome }));
      });
    }
  }, [linhas, nomes]);

  async function baixar(d: ChaveNFe) {
    if (!window.confirm(`Dar baixa na NF ${formatarNumeroNF(d.numero)}? Ela sai da TV.`)) return;
    setBaixando(d.chave);
    setErro(null);
    try {
      await darBaixa(db, d.chave, autor);
    } catch {
      setErro(`Não foi possível dar baixa na NF ${formatarNumeroNF(d.numero)}. Tente de novo.`);
    } finally {
      setBaixando(null);
    }
  }

  if (!linhas) return <p className="ultimas-aviso">{erro ?? 'Carregando…'}</p>;

  return (
    <>
      {erro && <p className="erro">{erro}</p>}
      {linhas.length === 0
        ? <p className="ultimas-aviso">Nenhuma nota em rota na TV.</p>
        : (
          <ol className="ultimas">
            {linhas.map(({ dados, saidaEm }) => (
              <li key={dados.chave} className="ultima ultima-saida ultima-com-botao">
                <span className="ultima-hora">{saidaEm ? formatarDiaHora(saidaEm) : 'agora'}</span>
                <span className="ultima-nf">NF {formatarNumeroNF(dados.numero)}</span>
                <span className="ultima-emissor">
                  {nomes[dados.cnpjEmitente] ?? formatarDocEmitente(dados.cnpjEmitente, dados.tipoDocEmitente)}
                </span>
                <button className="botao-secundario ultima-botao" disabled={baixando === dados.chave}
                  onClick={() => void baixar(dados)}>
                  {baixando === dados.chave ? 'Dando baixa…' : 'Dar baixa'}
                </button>
              </li>
            ))}
          </ol>
        )}
      <p className="ultimas-aviso">
        Sai sozinha da TV {diasEmRotaNaTv === 1 ? '1 dia' : `${diasEmRotaNaTv} dias`} depois da saída.
      </p>
    </>
  );
}
