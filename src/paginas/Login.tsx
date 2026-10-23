import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase';
import { rotaInicial, useSessao } from '../lib/sessao';

function mensagemErro(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
      return 'E-mail ou senha incorretos.';
    }
    if (e.code === 'auth/too-many-requests') {
      return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    }
    if (e.code === 'auth/network-request-failed') return 'Sem conexão com a internet.';
  }
  return 'Não foi possível entrar. Tente de novo.';
}

export function Login() {
  const { carregando, usuario, papel } = useSessao();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!carregando && usuario && papel) {
    const de = (local.state as { de?: string } | null)?.de;
    return <Navigate to={de ?? rotaInicial(papel)} replace />;
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <h1>Painel de NFs</h1>
      <form onSubmit={entrar}>
        <label>
          E-mail
          <input type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" value={senha}
            onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro && <p className="erro">{erro}</p>}
        {usuario && !papel && !carregando && (
          <p className="erro">Usuário sem papel cadastrado. Fale com o administrador.</p>
        )}
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
