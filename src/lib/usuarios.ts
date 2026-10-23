// Gestão de usuários pelo admin, sem Cloud Functions (plano Spark).
// Criar um login pelo navegador entra automaticamente com o usuário novo. Para não derrubar
// a sessão do admin, o login é criado numa segunda conexão com o Firebase, só em memória,
// que é desfeita logo depois.
import { deleteApp, FirebaseError, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { app, auth, URL_EMULADOR_AUTH, usandoEmulador } from './firebase';
import type { Papel } from '../tipos/firestore';

export interface NovoUsuario {
  nome: string;
  email: string;
  senha: string;
  papel: Exclude<Papel, 'inativo'>;
}

export function mensagemErroUsuario(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'auth/email-already-in-use') {
      return 'Já existe um login com esse e-mail. Se o acesso foi retirado, reative na lista.';
    }
    if (e.code === 'auth/invalid-email') return 'E-mail inválido.';
    if (e.code === 'auth/weak-password') return 'A senha precisa ter pelo menos 6 caracteres.';
    if (e.code === 'auth/user-not-found') return 'Não existe login com esse e-mail.';
    if (e.code === 'permission-denied') return 'Sem permissão para esta alteração.';
    if (e.code === 'auth/network-request-failed') return 'Sem conexão com a internet.';
  }
  return 'Não foi possível concluir. Tente de novo.';
}

/** Cria o login e o documento `usuarios/{uid}`. Devolve o uid. */
export async function criarUsuario(db: Firestore, novo: NovoUsuario): Promise<string> {
  const appCriacao = initializeApp(app.options, `criacao-${Date.now()}`);
  try {
    const authCriacao = initializeAuth(appCriacao, { persistence: inMemoryPersistence });
    if (usandoEmulador) connectAuthEmulator(authCriacao, URL_EMULADOR_AUTH, { disableWarnings: true });

    const email = novo.email.trim().toLowerCase();
    const { user } = await createUserWithEmailAndPassword(authCriacao, email, novo.senha);
    await signOut(authCriacao);

    // Gravado pela conexão principal, com o login do admin (as regras exigem admin).
    await setDoc(doc(db, 'usuarios', user.uid), { nome: novo.nome.trim(), papel: novo.papel, email });
    return user.uid;
  } finally {
    await deleteApp(appCriacao);
  }
}

export function alterarUsuario(
  db: Firestore,
  uid: string,
  mudancas: { nome?: string; papel?: Papel },
): Promise<void> {
  return updateDoc(doc(db, 'usuarios', uid), mudancas);
}

export function enviarRedefinicaoSenha(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email);
}
