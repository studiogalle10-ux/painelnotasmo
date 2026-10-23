// Gravações em `notas`, sempre por transação e sempre junto com o evento
// (as regras do Firestore recusam a nota sem o evento; ver firebase/firestore.rules).
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { lerChave, type ChaveNFe } from './chaveAcesso';
import type { Nota, TipoEvento } from '../tipos/firestore';

export interface Autor {
  uid: string;
  aparelho: string;
}

export type ResultadoBipagem =
  | { tipo: 'entrada'; dados: ChaveNFe }
  | { tipo: 'saida'; dados: ChaveNFe }
  | { tipo: 'ja_despachada'; dados: ChaveNFe; saidaEm: Date | null }
  | { tipo: 'invalida'; erro: string };

function evento(chave: string, tipo: TipoEvento, autor: Autor) {
  return {
    chave,
    tipo,
    usuario: autor.uid,
    aparelho: autor.aparelho,
    criadoEm: serverTimestamp(),
  };
}

/**
 * Bipagem: 1ª leitura cria em preparação, 2ª dá saída, depois só avisa (em rota ou baixada).
 * Chave inválida volta sem gravar nada. Erros do Firestore (sem permissão, sem conexão)
 * são lançados para a tela tratar.
 */
export async function biparNota(
  db: Firestore,
  entrada: string,
  autor: Autor,
): Promise<ResultadoBipagem> {
  const lida = lerChave(entrada);
  if (!lida.ok) return { tipo: 'invalida', erro: lida.erro };
  const { dados } = lida;
  const refNota = doc(db, 'notas', dados.chave);

  return runTransaction(db, async (t) => {
    const snap = await t.get(refNota);
    // ID novo a cada tentativa: a transação pode ser repetida pelo SDK.
    const refEvento = doc(collection(db, 'eventos'));

    if (!snap.exists()) {
      t.set(refNota, {
        uf: dados.uf,
        aamm: dados.aamm,
        cnpjEmitente: dados.cnpjEmitente,
        modelo: dados.modelo,
        serie: dados.serie,
        numero: dados.numero,
        tpEmis: dados.tpEmis,
        codigoNumerico: dados.codigoNumerico,
        status: 'preparacao',
        recebidaEm: serverTimestamp(),
        recebidaPor: autor.uid,
        ultimoEventoId: refEvento.id,
      });
      t.set(refEvento, evento(dados.chave, 'entrada', autor));
      return { tipo: 'entrada', dados } as const;
    }

    const nota = snap.data() as Nota;
    if (nota.status === 'preparacao') {
      t.update(refNota, {
        status: 'em_rota',
        saidaEm: serverTimestamp(),
        saidaPor: autor.uid,
        ultimoEventoId: refEvento.id,
      });
      t.set(refEvento, evento(dados.chave, 'saida', autor));
      return { tipo: 'saida', dados } as const;
    }

    return { tipo: 'ja_despachada', dados, saidaEm: nota.saidaEm?.toDate() ?? null } as const;
  });
}

/** Tira da TV uma nota em rota antes do prazo. */
export async function darBaixa(db: Firestore, chave: string, autor: Autor): Promise<void> {
  const refNota = doc(db, 'notas', chave);
  await runTransaction(db, async (t) => {
    const snap = await t.get(refNota);
    if (!snap.exists()) throw new Error('Nota não encontrada.');
    if ((snap.data() as Nota).status !== 'em_rota') throw new Error('A nota não está em rota.');

    const refEvento = doc(collection(db, 'eventos'));
    t.update(refNota, {
      status: 'baixada',
      baixadaEm: serverTimestamp(),
      baixadaPor: autor.uid,
      ultimoEventoId: refEvento.id,
    });
    t.set(refEvento, evento(chave, 'baixa', autor));
  });
}
