// Testa a transação de bipagem e as regras do Firestore no Emulator.
// Rodar com: npm run test:emulador (precisa do Java 21+).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import regras from '../../firebase/firestore.rules?raw';
import { biparNota, darBaixa } from '../lib/bipagem';
import { lerChave } from '../lib/chaveAcesso';
import { EMAIL_PAINEL } from '../lib/firebase';
import type { Evento } from '../tipos/firestore';

const CHAVE = '35261002745352000100550010002749141153853870';
const OUTRA_CHAVE = '35261011222333000181550010000123451123456784';
const APARELHO = 'aparelho-teste';
/** UID da conta única do painel (todos os computadores usam a mesma). */
const PAINEL = 'painel';

let env: RulesTestEnvironment;

/**
 * Firestore com login. Sem argumentos: a conta do painel. `email` diferente: alguém que
 * criou outra conta no Firebase. `null`: sem login. Instância compat usada pela API modular.
 */
const banco = (email: string | null = EMAIL_PAINEL, uid = PAINEL) =>
  (email === null ? env.unauthenticatedContext() : env.authenticatedContext(uid, { email }))
    .firestore() as unknown as Firestore;

const intruso = () => banco('qualquer@gmail.com', 'intruso');

const autor = (uid = PAINEL) => ({ uid, aparelho: APARELHO });

/** Lê sem passar pelas regras, para conferir o que ficou gravado. */
async function lerSemRegras<T>(fn: (db: Firestore) => Promise<T>): Promise<T> {
  let resultado!: T;
  await env.withSecurityRulesDisabled(async (ctx) => {
    resultado = await fn(ctx.firestore() as unknown as Firestore);
  });
  return resultado;
}

const lerNota = (chave = CHAVE) =>
  lerSemRegras(async (db) => (await getDoc(doc(db, 'notas', chave))).data());

const eventosDa = (chave = CHAVE) =>
  lerSemRegras(async (db) =>
    (await getDocs(query(collection(db, 'eventos'), where('chave', '==', chave))))
      .docs.map((d) => ({ id: d.id, ...(d.data() as Evento) })),
  );

/** Campos da nota como o front grava na entrada. */
function camposEntrada(chave: string, uid: string, ultimoEventoId: string) {
  const r = lerChave(chave);
  if (!r.ok) throw new Error(r.erro);
  const d = r.dados;
  return {
    uf: d.uf, aamm: d.aamm, cnpjEmitente: d.cnpjEmitente, modelo: d.modelo, serie: d.serie,
    numero: d.numero, tpEmis: d.tpEmis, codigoNumerico: d.codigoNumerico,
    status: 'preparacao', recebidaEm: serverTimestamp(), recebidaPor: uid, ultimoEventoId,
  };
}

const eventoDe = (chave: string, tipo: string, uid: string) => ({
  chave, tipo, usuario: uid, aparelho: APARELHO, criadoEm: serverTimestamp(),
});

/** Entrada gravada à mão (sem a função), em batch, para testar desvios das regras. */
function batchEntrada(
  db: Firestore,
  uid: string,
  muda: (nota: Record<string, unknown>) => void = () => {},
) {
  const refEvento = doc(collection(db, 'eventos'));
  const nota = camposEntrada(CHAVE, uid, refEvento.id) as Record<string, unknown>;
  muda(nota);
  const b = writeBatch(db);
  b.set(doc(db, 'notas', CHAVE), nota);
  b.set(refEvento, eventoDe(CHAVE, 'entrada', uid));
  return b;
}

/** Bipa duas vezes: a nota fica em rota. */
async function emRota(chave = CHAVE) {
  await biparNota(banco(), chave, autor());
  await biparNota(banco(), chave, autor());
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-painel-nf-mo',
    firestore: { rules: regras, host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('biparNota', () => {
  it('1ª bipagem cria a nota em preparação, com evento de entrada', async () => {
    const r = await biparNota(banco(), CHAVE, autor());
    expect(r.tipo).toBe('entrada');

    const nota = await lerNota();
    expect(nota).toMatchObject({
      status: 'preparacao', recebidaPor: PAINEL, numero: '000274914', cnpjEmitente: '02745352000100',
    });
    expect(nota?.recebidaEm).toBeInstanceOf(Timestamp);
    expect(nota?.saidaEm).toBeUndefined();

    const eventos = await eventosDa();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      id: nota?.ultimoEventoId, tipo: 'entrada', usuario: PAINEL, aparelho: APARELHO,
    });
  });

  it('2ª bipagem dá saída, com evento de saída', async () => {
    await biparNota(banco(), CHAVE, autor());
    const r = await biparNota(banco(), CHAVE, autor());
    expect(r.tipo).toBe('saida');

    const nota = await lerNota();
    expect(nota).toMatchObject({ status: 'em_rota', saidaPor: PAINEL });
    expect(nota?.saidaEm).toBeInstanceOf(Timestamp);
    expect((await eventosDa()).map((e) => e.tipo).sort()).toEqual(['entrada', 'saida']);
  });

  it('3ª bipagem só avisa que já foi despachada e não grava nada', async () => {
    await emRota();
    const antes = await lerNota();

    const r = await biparNota(banco(), CHAVE, autor());
    expect(r.tipo).toBe('ja_despachada');
    if (r.tipo === 'ja_despachada') expect(r.saidaEm).toBeInstanceOf(Date);
    expect(await lerNota()).toEqual(antes);
    expect(await eventosDa()).toHaveLength(2);
  });

  it('chave inválida volta sem gravar nada', async () => {
    const r = await biparNota(banco(), CHAVE.slice(0, 43) + '9', autor());
    expect(r).toEqual({ tipo: 'invalida', erro: 'Dígito verificador inválido. Bipe novamente.' });
    expect(await lerNota()).toBeUndefined();
    expect(await eventosDa()).toHaveLength(0);
  });

  it('duas bipagens ao mesmo tempo não duplicam a nota', async () => {
    const resultados = await Promise.all([
      biparNota(banco(), CHAVE, autor()),
      biparNota(banco(), CHAVE, { uid: PAINEL, aparelho: 'outro-computador' }),
    ]);
    // A transação faz a segunda enxergar a primeira: uma entrada e uma saída.
    expect(resultados.map((r) => r.tipo).sort()).toEqual(['entrada', 'saida']);
    expect((await eventosDa()).map((e) => e.tipo).sort()).toEqual(['entrada', 'saida']);
  });

  it('outra conta do Firebase e visitante sem login não conseguem bipar', async () => {
    await assertFails(biparNota(intruso(), CHAVE, autor('intruso')));
    await assertFails(biparNota(banco(null), CHAVE, autor('ninguem')));
    expect(await lerNota()).toBeUndefined();
  });
});

describe('darBaixa', () => {
  it('tira a nota em rota da TV, com evento de baixa', async () => {
    await emRota();
    await darBaixa(banco(), CHAVE, autor());

    const nota = await lerNota();
    expect(nota).toMatchObject({ status: 'baixada', baixadaPor: PAINEL });
    expect(nota?.baixadaEm).toBeInstanceOf(Timestamp);
    expect(nota?.saidaEm).toBeInstanceOf(Timestamp);
    expect((await eventosDa()).map((e) => e.tipo).sort()).toEqual(['baixa', 'entrada', 'saida']);
  });

  it('bipada de novo depois da baixa, só avisa que já foi despachada', async () => {
    await emRota();
    await darBaixa(banco(), CHAVE, autor());
    expect((await biparNota(banco(), CHAVE, autor())).tipo).toBe('ja_despachada');
    expect((await lerNota())?.status).toBe('baixada');
  });

  it('recusa baixa de nota que ainda está em preparação', async () => {
    await biparNota(banco(), CHAVE, autor());
    await expect(darBaixa(banco(), CHAVE, autor())).rejects.toThrow('A nota não está em rota.');
  });

  it('outra conta não consegue dar baixa', async () => {
    await emRota();
    await assertFails(darBaixa(intruso(), CHAVE, autor('intruso')));
    expect((await lerNota())?.status).toBe('em_rota');
  });
});

describe('regras: gravações feitas por fora das funções', () => {
  it('aceita a entrada montada corretamente (controle dos testes abaixo)', async () => {
    await assertSucceeds(batchEntrada(banco(), PAINEL).commit());
  });

  it('recusa nota sem o evento', async () => {
    await assertFails(setDoc(doc(banco(), 'notas', CHAVE), camposEntrada(CHAVE, PAINEL, 'qualquer')));
  });

  it('recusa evento sem a nota', async () => {
    await assertFails(setDoc(doc(collection(banco(), 'eventos')), eventoDe(CHAVE, 'entrada', PAINEL)));
  });

  it('recusa data de recebimento escolhida pelo computador', async () => {
    await assertFails(batchEntrada(banco(), PAINEL, (n) => {
      n.recebidaEm = Timestamp.fromDate(new Date('2026-01-01T12:00:00Z'));
    }).commit());
  });

  it('recusa campos que não batem com a chave', async () => {
    await assertFails(batchEntrada(banco(), PAINEL, (n) => { n.numero = '000000001'; }).commit());
  });

  it('recusa campo extra e recebidaPor de outra conta', async () => {
    await assertFails(batchEntrada(banco(), PAINEL, (n) => { n.urgente = true; }).commit());
    await assertFails(batchEntrada(banco(), PAINEL, (n) => { n.recebidaPor = 'outro'; }).commit());
  });

  it('recusa criar a nota já em rota ou baixada', async () => {
    await assertFails(batchEntrada(banco(), PAINEL, (n) => { n.status = 'em_rota'; }).commit());
    await assertFails(batchEntrada(banco(), PAINEL, (n) => { n.status = 'baixada'; }).commit());
  });

  it('recusa saída que mexe na data de recebimento', async () => {
    await biparNota(banco(), CHAVE, autor());
    const db = banco();
    const refEvento = doc(collection(db, 'eventos'));
    const b = writeBatch(db);
    b.update(doc(db, 'notas', CHAVE), {
      status: 'em_rota', saidaEm: serverTimestamp(), saidaPor: PAINEL, ultimoEventoId: refEvento.id,
      recebidaEm: serverTimestamp(),
    });
    b.set(refEvento, eventoDe(CHAVE, 'saida', PAINEL));
    await assertFails(b.commit());
  });

  it('recusa saída que reaproveita um evento antigo', async () => {
    await biparNota(banco(), CHAVE, autor());
    const { ultimoEventoId } = (await lerNota()) ?? {};
    await assertFails(updateDoc(doc(banco(), 'notas', CHAVE), {
      status: 'em_rota', saidaEm: serverTimestamp(), saidaPor: PAINEL, ultimoEventoId,
    }));
  });

  it('recusa voltar a nota de em rota para preparação', async () => {
    await emRota();
    const db = banco();
    const refEvento = doc(collection(db, 'eventos'));
    const b = writeBatch(db);
    b.update(doc(db, 'notas', CHAVE), { status: 'preparacao', ultimoEventoId: refEvento.id });
    b.set(refEvento, eventoDe(CHAVE, 'saida', PAINEL));
    await assertFails(b.commit());
  });

  it('nota não pode ser apagada', async () => {
    await biparNota(banco(), CHAVE, autor());
    await assertFails(deleteDoc(doc(banco(), 'notas', CHAVE)));
  });

  it('o histórico não pode ser alterado nem apagado', async () => {
    await biparNota(banco(), CHAVE, autor());
    const [ev] = await eventosDa();
    await assertFails(updateDoc(doc(banco(), 'eventos', ev.id), { detalhe: 'mudou' }));
    await assertFails(deleteDoc(doc(banco(), 'eventos', ev.id)));
  });
});

describe('regras: leitura', () => {
  beforeEach(async () => {
    await biparNota(banco(), CHAVE, autor());
  });

  it('a conta do painel lê notas e histórico', async () => {
    await assertSucceeds(getDoc(doc(banco(), 'notas', CHAVE)));
    await assertSucceeds(getDocs(collection(banco(), 'eventos')));
  });

  it('outra conta do Firebase e sem login não leem nada', async () => {
    await assertFails(getDoc(doc(intruso(), 'notas', CHAVE)));
    await assertFails(getDocs(collection(intruso(), 'eventos')));
    await assertFails(getDoc(doc(banco(null), 'notas', CHAVE)));
  });

  it('consultas da TV funcionam', async () => {
    await biparNota(banco(), OUTRA_CHAVE, autor());
    await biparNota(banco(), OUTRA_CHAVE, autor());
    const prep = await assertSucceeds(getDocs(
      query(collection(banco(), 'notas'), where('status', '==', 'preparacao')),
    ));
    expect(prep.size).toBe(1);
    const rota = await assertSucceeds(getDocs(query(collection(banco(), 'notas'),
      where('status', '==', 'em_rota'), where('saidaEm', '>=', Timestamp.fromMillis(Date.now() - 86_400_000)))));
    expect(rota.size).toBe(1);
  });
});

describe('regras: ajustes e emitentes', () => {
  it('ajustes: só o documento geral, com números válidos', async () => {
    await assertSucceeds(setDoc(doc(banco(), 'config', 'geral'), { diasUrgencia: 5, diasEmRotaNaTv: 2 }));
    await assertFails(setDoc(doc(banco(), 'config', 'geral'), { diasUrgencia: 'abc', diasEmRotaNaTv: 2 }));
    await assertFails(setDoc(doc(banco(), 'config', 'geral'), { diasUrgencia: 5, diasEmRotaNaTv: 0 }));
    await assertFails(setDoc(doc(banco(), 'config', 'geral'), { diasUrgencia: 5, diasEmRotaNaTv: 31 }));
    await assertFails(setDoc(doc(banco(), 'config', 'geral'),
      { diasUrgencia: 5, diasEmRotaNaTv: 2, outro: true }));
    await assertFails(setDoc(doc(banco(), 'config', 'outro'), { diasUrgencia: 5, diasEmRotaNaTv: 2 }));
    await assertFails(setDoc(doc(intruso(), 'config', 'geral'), { diasUrgencia: 5, diasEmRotaNaTv: 2 }));
    await assertSucceeds(getDoc(doc(banco(), 'config', 'geral')));
  });

  it('emitentes: grava o cache só com campos válidos', async () => {
    const valido = { razaoSocial: 'Empresa Teste Ltda', nomeFantasia: 'Teste', consultadoEm: serverTimestamp() };
    await assertSucceeds(setDoc(doc(banco(), 'emitentes', '02745352000100'), valido));
    await assertFails(setDoc(doc(banco(), 'emitentes', '123'), valido));
    await assertFails(setDoc(doc(banco(), 'emitentes', '02745352000100'),
      { ...valido, telefone: '11999999999' }));
    await assertFails(setDoc(doc(intruso(), 'emitentes', '02745352000100'), valido));
  });
});
