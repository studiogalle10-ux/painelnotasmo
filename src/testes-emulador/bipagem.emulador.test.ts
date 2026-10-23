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
import { biparNota, estornarSaida, excluirNota } from '../lib/bipagem';
import { lerChave } from '../lib/chaveAcesso';
import type { Evento } from '../tipos/firestore';

const CHAVE = '35261002745352000100550010002749141153853870';
const OUTRA_CHAVE = '35261011222333000181550010000123451123456784';
const APARELHO = 'aparelho-teste';

let env: RulesTestEnvironment;

/** Firestore com o login de `uid` (ou sem login). Instância compat usada pela API modular. */
const banco = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext())
    .firestore() as unknown as Firestore;

const autor = (uid: string) => ({ uid, aparelho: APARELHO });

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
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'usuarios', 'admin'), { nome: 'Admin', papel: 'admin' });
    await setDoc(doc(db, 'usuarios', 'op'), { nome: 'Operador', papel: 'operador' });
    await setDoc(doc(db, 'usuarios', 'op2'), { nome: 'Operador 2', papel: 'operador' });
    await setDoc(doc(db, 'usuarios', 'tv'), { nome: 'TV', papel: 'tv' });
  });
});

describe('biparNota', () => {
  it('1ª bipagem cria a nota em preparação, com evento de entrada', async () => {
    const r = await biparNota(banco('op'), CHAVE, autor('op'));
    expect(r.tipo).toBe('entrada');

    const nota = await lerNota();
    expect(nota).toMatchObject({
      status: 'preparacao', recebidaPor: 'op', numero: '000274914', cnpjEmitente: '02745352000100',
    });
    expect(nota?.recebidaEm).toBeInstanceOf(Timestamp);
    expect(nota?.saidaEm).toBeUndefined();

    const eventos = await eventosDa();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      id: nota?.ultimoEventoId, tipo: 'entrada', usuario: 'op', aparelho: APARELHO,
    });
  });

  it('2ª bipagem dá saída, com evento de saída', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    const r = await biparNota(banco('op2'), CHAVE, autor('op2'));
    expect(r.tipo).toBe('saida');

    const nota = await lerNota();
    expect(nota).toMatchObject({ status: 'em_rota', saidaPor: 'op2', recebidaPor: 'op' });
    expect(nota?.saidaEm).toBeInstanceOf(Timestamp);
    expect((await eventosDa()).map((e) => e.tipo).sort()).toEqual(['entrada', 'saida']);
  });

  it('3ª bipagem só avisa que já foi despachada e não grava nada', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    await biparNota(banco('op'), CHAVE, autor('op'));
    const antes = await lerNota();

    const r = await biparNota(banco('op'), CHAVE, autor('op'));
    expect(r.tipo).toBe('ja_despachada');
    if (r.tipo === 'ja_despachada') expect(r.saidaEm).toBeInstanceOf(Date);
    expect(await lerNota()).toEqual(antes);
    expect(await eventosDa()).toHaveLength(2);
  });

  it('chave inválida volta sem gravar nada', async () => {
    const r = await biparNota(banco('op'), CHAVE.slice(0, 43) + '9', autor('op'));
    expect(r).toEqual({ tipo: 'invalida', erro: 'Dígito verificador inválido. Bipe novamente.' });
    expect(await lerNota()).toBeUndefined();
    expect(await eventosDa()).toHaveLength(0);
  });

  it('duas bipagens ao mesmo tempo não duplicam a nota', async () => {
    const resultados = await Promise.all([
      biparNota(banco('op'), CHAVE, autor('op')),
      biparNota(banco('op2'), CHAVE, autor('op2')),
    ]);
    // A transação faz a segunda enxergar a primeira: uma entrada e uma saída.
    expect(resultados.map((r) => r.tipo).sort()).toEqual(['entrada', 'saida']);
    expect((await eventosDa()).map((e) => e.tipo).sort()).toEqual(['entrada', 'saida']);
  });

  it('o admin também pode bipar', async () => {
    expect((await biparNota(banco('admin'), CHAVE, autor('admin'))).tipo).toBe('entrada');
  });

  it('TV, usuário sem papel e visitante sem login não conseguem bipar', async () => {
    await assertFails(biparNota(banco('tv'), CHAVE, autor('tv')));
    await assertFails(biparNota(banco('sem-papel'), CHAVE, autor('sem-papel')));
    await assertFails(biparNota(banco(), CHAVE, autor('ninguem')));
    expect(await lerNota()).toBeUndefined();
  });
});

describe('estornarSaida', () => {
  it('admin volta a nota para preparação, mantendo a data de recebimento', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    const recebidaEm = (await lerNota())?.recebidaEm;
    await biparNota(banco('op'), CHAVE, autor('op'));

    await estornarSaida(banco('admin'), CHAVE, autor('admin'), 'Saiu por engano');

    const nota = await lerNota();
    expect(nota?.status).toBe('preparacao');
    expect(nota?.saidaEm).toBeUndefined();
    expect(nota?.saidaPor).toBeUndefined();
    expect(nota?.recebidaEm).toEqual(recebidaEm);
    const estorno = (await eventosDa()).find((e) => e.tipo === 'estorno');
    expect(estorno).toMatchObject({ usuario: 'admin', detalhe: 'Saiu por engano' });

    // Depois do estorno, a próxima bipagem dá saída de novo.
    expect((await biparNota(banco('op'), CHAVE, autor('op'))).tipo).toBe('saida');
  });

  it('operador não consegue estornar', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    await biparNota(banco('op'), CHAVE, autor('op'));
    await assertFails(estornarSaida(banco('op'), CHAVE, autor('op')));
    expect((await lerNota())?.status).toBe('em_rota');
  });

  it('recusa estornar nota que não está em rota', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    await expect(estornarSaida(banco('admin'), CHAVE, autor('admin')))
      .rejects.toThrow('A nota não está em rota.');
  });
});

describe('excluirNota', () => {
  it('admin apaga a nota e o evento de exclusão fica no histórico', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    const { ultimoEventoId } = (await lerNota()) ?? {};

    await excluirNota(banco('admin'), CHAVE, autor('admin'), 'Nota de outra transportadora');

    expect(await lerNota()).toBeUndefined();
    const exclusao = (await eventosDa()).find((e) => e.tipo === 'exclusao');
    expect(exclusao).toMatchObject({
      id: `${ultimoEventoId}_exclusao`, usuario: 'admin', detalhe: 'Nota de outra transportadora',
    });

    // Bipada de novo, entra como nota nova.
    expect((await biparNota(banco('op'), CHAVE, autor('op'))).tipo).toBe('entrada');
  });

  it('operador não consegue excluir', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    await assertFails(excluirNota(banco('op'), CHAVE, autor('op')));
    expect(await lerNota()).toBeDefined();
  });
});

describe('regras: gravações feitas por fora das funções', () => {
  it('aceita a entrada montada corretamente (controle dos testes abaixo)', async () => {
    await assertSucceeds(batchEntrada(banco('op'), 'op').commit());
  });

  it('recusa nota sem o evento', async () => {
    const db = banco('op');
    await assertFails(setDoc(doc(db, 'notas', CHAVE), camposEntrada(CHAVE, 'op', 'qualquer')));
  });

  it('recusa evento sem a nota', async () => {
    const db = banco('op');
    await assertFails(setDoc(doc(collection(db, 'eventos')), eventoDe(CHAVE, 'entrada', 'op')));
  });

  it('recusa data de recebimento escolhida pelo aparelho', async () => {
    const db = banco('op');
    await assertFails(batchEntrada(db, 'op', (n) => {
      n.recebidaEm = Timestamp.fromDate(new Date('2026-01-01T12:00:00Z'));
    }).commit());
  });

  it('recusa campos que não batem com a chave', async () => {
    await assertFails(batchEntrada(banco('op'), 'op', (n) => { n.numero = '000000001'; }).commit());
  });

  it('recusa campo extra e recebidaPor de outra pessoa', async () => {
    await assertFails(batchEntrada(banco('op'), 'op', (n) => { n.urgente = true; }).commit());
    await assertFails(batchEntrada(banco('op'), 'op', (n) => { n.recebidaPor = 'op2'; }).commit());
  });

  it('recusa criar a nota já em rota', async () => {
    await assertFails(batchEntrada(banco('op'), 'op', (n) => { n.status = 'em_rota'; }).commit());
  });

  it('recusa saída que mexe na data de recebimento', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    const db = banco('op');
    const refEvento = doc(collection(db, 'eventos'));
    const b = writeBatch(db);
    b.update(doc(db, 'notas', CHAVE), {
      status: 'em_rota', saidaEm: serverTimestamp(), saidaPor: 'op', ultimoEventoId: refEvento.id,
      recebidaEm: serverTimestamp(),
    });
    b.set(refEvento, eventoDe(CHAVE, 'saida', 'op'));
    await assertFails(b.commit());
  });

  it('recusa saída que reaproveita um evento antigo', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    const { ultimoEventoId } = (await lerNota()) ?? {};
    await assertFails(updateDoc(doc(banco('op'), 'notas', CHAVE), {
      status: 'em_rota', saidaEm: serverTimestamp(), saidaPor: 'op', ultimoEventoId,
    }));
  });

  it('recusa evento de estorno gravado por operador', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    await biparNota(banco('op'), CHAVE, autor('op'));
    const db = banco('op');
    const refEvento = doc(collection(db, 'eventos'));
    const b = writeBatch(db);
    b.update(doc(db, 'notas', CHAVE), {
      status: 'preparacao', saidaEm: null, saidaPor: null, ultimoEventoId: refEvento.id,
    });
    b.set(refEvento, eventoDe(CHAVE, 'estorno', 'op'));
    await assertFails(b.commit());
  });

  it('o histórico não pode ser alterado nem apagado, nem pelo admin', async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
    const [ev] = await eventosDa();
    await assertFails(updateDoc(doc(banco('admin'), 'eventos', ev.id), { detalhe: 'mudou' }));
    await assertFails(deleteDoc(doc(banco('admin'), 'eventos', ev.id)));
  });
});

describe('regras: leitura', () => {
  beforeEach(async () => {
    await biparNota(banco('op'), CHAVE, autor('op'));
  });

  it('TV lê notas, mas não o histórico', async () => {
    await assertSucceeds(getDoc(doc(banco('tv'), 'notas', CHAVE)));
    await assertFails(getDocs(collection(banco('tv'), 'eventos')));
  });

  it('operador lê notas e histórico', async () => {
    await assertSucceeds(getDoc(doc(banco('op'), 'notas', CHAVE)));
    await assertSucceeds(getDocs(collection(banco('op'), 'eventos')));
  });

  it('sem login ou sem papel não lê nada', async () => {
    await assertFails(getDoc(doc(banco(), 'notas', CHAVE)));
    await assertFails(getDoc(doc(banco('sem-papel'), 'notas', CHAVE)));
  });

  it('consulta da TV por status funciona', async () => {
    await biparNota(banco('op'), OUTRA_CHAVE, autor('op'));
    const snap = await assertSucceeds(getDocs(
      query(collection(banco('tv'), 'notas'), where('status', '==', 'preparacao')),
    ));
    expect(snap.size).toBe(2);
  });
});

describe('regras: config, emitentes e usuários', () => {
  it('config: só admin, só o documento geral, com números válidos', async () => {
    await assertSucceeds(setDoc(doc(banco('admin'), 'config', 'geral'),
      { diasUrgencia: 5, horasEmRotaNaTv: 24 }));
    await assertFails(setDoc(doc(banco('admin'), 'config', 'geral'),
      { diasUrgencia: 'abc', horasEmRotaNaTv: 24 }));
    await assertFails(setDoc(doc(banco('admin'), 'config', 'outro'),
      { diasUrgencia: 5, horasEmRotaNaTv: 24 }));
    await assertFails(setDoc(doc(banco('op'), 'config', 'geral'),
      { diasUrgencia: 5, horasEmRotaNaTv: 24 }));
    await assertSucceeds(getDoc(doc(banco('tv'), 'config', 'geral')));
  });

  it('emitentes: operador grava o cache com campos válidos', async () => {
    const valido = { razaoSocial: 'Empresa Teste Ltda', nomeFantasia: 'Teste', consultadoEm: serverTimestamp() };
    await assertSucceeds(setDoc(doc(banco('op'), 'emitentes', '02745352000100'), valido));
    await assertFails(setDoc(doc(banco('op'), 'emitentes', '123'), valido));
    await assertFails(setDoc(doc(banco('op'), 'emitentes', '02745352000100'),
      { ...valido, telefone: '11999999999' }));
    await assertFails(setDoc(doc(banco('tv'), 'emitentes', '02745352000100'), valido));
  });

  it('usuários: operador não se promove; admin define papéis válidos', async () => {
    await assertFails(updateDoc(doc(banco('op'), 'usuarios', 'op'), { papel: 'admin' }));
    await assertSucceeds(getDoc(doc(banco('op'), 'usuarios', 'op')));
    await assertFails(getDoc(doc(banco('op'), 'usuarios', 'admin')));
    await assertSucceeds(setDoc(doc(banco('admin'), 'usuarios', 'novo'), { nome: 'Novo', papel: 'operador' }));
    await assertFails(setDoc(doc(banco('admin'), 'usuarios', 'novo'), { nome: 'Novo', papel: 'chefe' }));
  });
});
