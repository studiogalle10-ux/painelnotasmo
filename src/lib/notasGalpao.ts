import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { lerChave } from './chaveAcesso';
import { paraNotaPainel, type NotaPainel } from './painel';
import type { Nota } from '../tipos/firestore';

export interface NotasGalpao {
  /** null enquanto carrega. */
  notas: NotaPainel[] | null;
  /** Dados ainda do cache local (sem confirmação do servidor). */
  doCache: boolean;
  atualizadoEm: Date | null;
  erro: boolean;
}

/** Notas que estão no galpão (status `preparacao`), em tempo real, mais antigas primeiro. */
export function useNotasGalpao(): NotasGalpao {
  const [estado, setEstado] = useState<NotasGalpao>({
    notas: null, doCache: true, atualizadoEm: null, erro: false,
  });

  useEffect(() => onSnapshot(
    query(collection(db, 'notas'), where('status', '==', 'preparacao'), orderBy('recebidaEm')),
    { includeMetadataChanges: true },
    (s) => {
      const notas = s.docs.flatMap((d) => {
        const lida = lerChave(d.id);
        // Gravação recém-feita ainda sem hora do servidor: usa a estimativa local.
        return lida.ok ? [paraNotaPainel(lida.dados, d.data({ serverTimestamps: 'estimate' }) as Nota)] : [];
      });
      setEstado((e) => ({
        notas,
        doCache: s.metadata.fromCache,
        atualizadoEm: s.metadata.fromCache ? e.atualizadoEm : new Date(),
        erro: false,
      }));
    },
    () => setEstado((e) => ({ ...e, erro: true })),
  ), []);

  return estado;
}
