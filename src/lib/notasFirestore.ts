import type { QuerySnapshot } from 'firebase/firestore';
import { lerChave } from './chaveAcesso';
import type { NotaPainel } from './painel';
import type { Nota } from '../tipos/firestore';

/** Documentos de `notas` → notas para as telas (o ID é a chave de acesso). */
export function paraNotas(snap: QuerySnapshot): NotaPainel[] {
  return snap.docs.flatMap((d) => {
    const lida = lerChave(d.id);
    if (!lida.ok) return [];
    // Gravação recém-feita ainda sem hora do servidor: usa a estimativa local.
    const n = d.data({ serverTimestamps: 'estimate' }) as Nota;
    return [{
      dados: lida.dados,
      status: n.status,
      recebidaEm: n.recebidaEm.toDate(),
      saidaEm: n.saidaEm?.toDate() ?? null,
    }];
  });
}
