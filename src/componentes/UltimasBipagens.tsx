import { useEffect, useRef, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  formatarDocEmitente,
  formatarNumeroNF,
  lerChave,
  type TipoDocEmitente,
} from '../lib/chaveAcesso';
import { formatarHora } from '../lib/datas';
import { nomeDoEmitente } from '../lib/emitentes';
import type { Evento, TipoEvento } from '../tipos/firestore';

const ROTULO: Record<TipoEvento, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  estorno: 'Estorno',
  exclusao: 'Exclusão',
};

interface Linha {
  id: string;
  tipo: TipoEvento;
  hora: string;
  numero: string;
  cnpj: string;
  tipoDoc: TipoDocEmitente;
  documento: string;
}

/** Últimas 10 bipagens deste aparelho, em tempo real. */
export function UltimasBipagens({ aparelho }: { aparelho: string }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState(false);
  const [nomes, setNomes] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(
      collection(db, 'eventos'),
      where('aparelho', '==', aparelho),
      orderBy('criadoEm', 'desc'),
      limit(10),
    );
    return onSnapshot(
      q,
      (snap) => {
        setErro(false);
        setLinhas(snap.docs.flatMap((d) => {
          // Evento recém-gravado ainda sem hora do servidor: usa a estimativa local.
          const ev = d.data({ serverTimestamps: 'estimate' }) as Evento;
          const lida = lerChave(ev.chave);
          if (!lida.ok) return [];
          return [{
            id: d.id,
            tipo: ev.tipo,
            hora: ev.criadoEm ? formatarHora(ev.criadoEm.toDate()) : '',
            numero: formatarNumeroNF(lida.dados.numero),
            cnpj: lida.dados.cnpjEmitente,
            tipoDoc: lida.dados.tipoDocEmitente,
            documento: formatarDocEmitente(lida.dados.cnpjEmitente, lida.dados.tipoDocEmitente),
          }];
        }));
      },
      () => setErro(true),
    );
  }, [aparelho]);

  // Busca o nome dos emissores que ainda não estão na tela. Cada evento tenta uma vez:
  // se falhar, a próxima bipagem desse CNPJ (evento novo) tenta de novo.
  const tentados = useRef(new Set<string>());
  useEffect(() => {
    for (const l of linhas ?? []) {
      if (l.cnpj in nomes || tentados.current.has(l.id)) continue;
      tentados.current.add(l.id);
      void nomeDoEmitente(db, l.cnpj, l.tipoDoc).then((nome) => {
        if (nome) setNomes((n) => ({ ...n, [l.cnpj]: nome }));
      });
    }
  }, [linhas, nomes]);

  if (erro) return <p className="ultimas-aviso">Não foi possível carregar as últimas bipagens.</p>;
  if (!linhas) return <p className="ultimas-aviso">Carregando…</p>;
  if (linhas.length === 0) return <p className="ultimas-aviso">Nenhuma bipagem neste aparelho ainda.</p>;

  return (
    <ol className="ultimas">
      {linhas.map((l) => (
        <li key={l.id} className={`ultima ultima-${l.tipo}`}>
          <span className="ultima-hora">{l.hora}</span>
          <span className="ultima-nf">NF {l.numero}</span>
          <span className="ultima-emissor">{nomes[l.cnpj] ?? l.documento}</span>
          <span className="ultima-tipo">{ROTULO[l.tipo]}</span>
        </li>
      ))}
    </ol>
  );
}
