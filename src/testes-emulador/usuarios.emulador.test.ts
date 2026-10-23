// Criação de usuários pelo admin (segunda conexão), contra os Emuladores de Auth e Firestore.
// Rodar com: npm run test:emulador
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import regras from '../../firebase/firestore.rules?raw';
import { auth, db, URL_EMULADOR_AUTH } from '../lib/firebase';
import { alterarUsuario, criarUsuario, mensagemErroUsuario } from '../lib/usuarios';

const PROJETO = 'demo-painel-nf-mo';
let env: RulesTestEnvironment;
let uidAdmin: string;

async function limparAuth() {
  const r = await fetch(`${URL_EMULADOR_AUTH}/emulator/v1/projects/${PROJETO}/accounts`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`Não limpou o Auth Emulator: ${r.status}`);
}

/** Tenta entrar pela API do Auth Emulator, sem mexer na sessão do app. */
async function consegueEntrar(email: string, senha: string): Promise<boolean> {
  const r = await fetch(
    `${URL_EMULADOR_AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=teste`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
    },
  );
  return r.ok;
}

const lerUsuario = async (uid: string) => {
  let dados: unknown;
  await env.withSecurityRulesDisabled(async (ctx) => {
    dados = (await getDoc(doc(ctx.firestore() as unknown as Firestore, 'usuarios', uid))).data();
  });
  return dados;
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJETO,
    firestore: { rules: regras, host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await signOut(auth);
  await env?.cleanup();
});

beforeEach(async () => {
  await signOut(auth);
  await limparAuth();
  await env.clearFirestore();
  // O admin entra pela conexão principal do app, como na tela.
  uidAdmin = (await createUserWithEmailAndPassword(auth, 'admin@teste.local', 'teste123')).user.uid;
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'usuarios', uidAdmin),
      { nome: 'Admin', papel: 'admin', email: 'admin@teste.local' });
  });
});

describe('criarUsuario', () => {
  it('cria o login e o papel, sem derrubar a sessão do admin', async () => {
    const uid = await criarUsuario(db, {
      nome: '  Operador Novo ', email: 'Operador.Novo@Teste.local', senha: 'abc123', papel: 'operador',
    });

    expect(auth.currentUser?.uid).toBe(uidAdmin);
    expect(uid).not.toBe(uidAdmin);
    expect(await lerUsuario(uid)).toEqual({
      nome: 'Operador Novo', papel: 'operador', email: 'operador.novo@teste.local',
    });
    expect(await consegueEntrar('operador.novo@teste.local', 'abc123')).toBe(true);
  });

  it('recusa e-mail já cadastrado, com mensagem clara', async () => {
    await criarUsuario(db, { nome: 'TV', email: 'tv@teste.local', senha: 'abc123', papel: 'tv' });
    const erro = await criarUsuario(db, { nome: 'TV 2', email: 'tv@teste.local', senha: 'abc123', papel: 'tv' })
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(FirebaseError);
    expect(mensagemErroUsuario(erro)).toMatch(/Já existe um login com esse e-mail/);
    expect(auth.currentUser?.uid).toBe(uidAdmin);
  });

  it('recusa senha curta', async () => {
    const erro = await criarUsuario(db, { nome: 'X', email: 'x@teste.local', senha: '123', papel: 'operador' })
      .catch((e: unknown) => e);
    expect(mensagemErroUsuario(erro)).toMatch(/pelo menos 6 caracteres/);
  });

  it('operador não consegue criar usuário (o papel não é gravado)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'usuarios', uidAdmin),
        { nome: 'Admin', papel: 'operador' });
    });
    const erro = await criarUsuario(db, { nome: 'Y', email: 'y@teste.local', senha: 'abc123', papel: 'admin' })
      .catch((e: unknown) => e);
    expect((erro as FirebaseError).code).toBe('permission-denied');
  });
});

describe('alterarUsuario', () => {
  it('admin muda o papel de outro, mas não o próprio', async () => {
    const uid = await criarUsuario(db, { nome: 'Op', email: 'op@teste.local', senha: 'abc123', papel: 'operador' });
    await alterarUsuario(db, uid, { papel: 'inativo' });
    expect(await lerUsuario(uid)).toMatchObject({ papel: 'inativo' });

    const erro = await alterarUsuario(db, uidAdmin, { papel: 'operador' }).catch((e: unknown) => e);
    expect((erro as FirebaseError).code).toBe('permission-denied');
  });
});
