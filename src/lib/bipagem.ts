// Gravações em `notas`, sempre por transação e sempre junto com o evento
// (as regras do Firestore recusam a nota sem o evento; ver firebase/firestore.rules).
import {
  collection,
  deleteField,
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
  type Firestore,
  type Transaction,
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

function evento(chave: string, tipo: TipoEvento, autor: Autor, detalhe?: string) {
  return {
    chave,
    tipo,
    usuario: autor.uid,
    aparelho: autor.aparelho,
    criadoEm: serverTimestamp(),
    ...(detalhe ? { detalhe: detalhe.slice(0, 500) } : {}),
  };
}

/**
 * Bipagem: 1ª leitura cria a nota no galpão, 2ª dá saída, depois só avisa que já saiu.
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

export interface Destino {
  cidade: string;
  uf: string;
  /** Código do município no IBGE. */
  ibge: number;
}

export const textoDestino = (d: { cidade: string; uf: string }) => `${d.cidade} – ${d.uf}`;

/** Lê a nota dentro da transação; só mexe em nota que ainda está no galpão. */
async function notaNoGalpao(t: Transaction, refNota: DocumentReference): Promise<Nota> {
  const snap = await t.get(refNota);
  if (!snap.exists()) throw new Error('Nota não encontrada.');
  const nota = snap.data() as Nota;
  if (nota.status !== 'preparacao') throw new Error('A nota já saiu.');
  return nota;
}

/** Grava (ou troca) o destino da entrega. */
export async function definirDestino(
  db: Firestore,
  chave: string,
  destino: Destino,
  autor: Autor,
): Promise<void> {
  const refNota = doc(db, 'notas', chave);
  await runTransaction(db, async (t) => {
    await notaNoGalpao(t, refNota);
    const refEvento = doc(collection(db, 'eventos'));
    t.update(refNota, {
      destinoCidade: destino.cidade,
      destinoUf: destino.uf,
      destinoIbge: destino.ibge,
      ultimoEventoId: refEvento.id,
    });
    t.set(refEvento, evento(chave, 'destino', autor, textoDestino(destino)));
  });
}

/** Grava o motivo de espera (vai para "Em Ocorrência") ou, com null, retira (ocorrência resolvida). */
export async function definirOcorrencia(
  db: Firestore,
  chave: string,
  texto: string | null,
  autor: Autor,
): Promise<void> {
  const motivo = texto?.trim() || null;
  const refNota = doc(db, 'notas', chave);
  await runTransaction(db, async (t) => {
    const nota = await notaNoGalpao(t, refNota);
    if (!motivo && !nota.ocorrencia) return;
    const refEvento = doc(collection(db, 'eventos'));
    if (motivo) {
      t.update(refNota, { ocorrencia: motivo, ocorrenciaEm: serverTimestamp(), ultimoEventoId: refEvento.id });
      t.set(refEvento, evento(chave, 'ocorrencia', autor, motivo));
    } else {
      t.update(refNota, { ocorrencia: deleteField(), ocorrenciaEm: deleteField(), ultimoEventoId: refEvento.id });
      t.set(refEvento, evento(chave, 'resolucao', autor, nota.ocorrencia));
    }
  });
}
