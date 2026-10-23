import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, EMAIL_PAINEL } from '../lib/firebase';
import { useSessao } from '../lib/sessao';
import { Rodape } from '../componentes/Rodape';

function mensagemErro(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') return 'Senha incorreta.';
    if (e.code === 'auth/too-many-requests') {
      return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    }
    if (e.code === 'auth/network-request-failed') return 'Sem conexão com a internet.';
  }
  return 'Não foi possível entrar. Tente de novo.';
}

/** Só a senha do painel. Depois de entrar, o aparelho fica conectado. */
export function Login() {
  const { carregando, usuario } = useSessao();
  const local = useLocation();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!carregando && usuario) {
    const de = (local.state as { de?: string } | null)?.de;
    return <Navigate to={de === '/tv' ? '/tv' : '/bipar'} replace />;
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await signInWithEmailAndPassword(auth, EMAIL_PAINEL, senha);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <img className="logo logo-login" src="/logo-mo.png" alt="MO Transportes" />
      <h1>Painel de NFs</h1>
      <form onSubmit={entrar}>
        <input type="email" autoComplete="username" value={EMAIL_PAINEL} readOnly hidden />
        <label>
          Senha do painel
          <input type="password" autoComplete="current-password" value={senha} autoFocus
            onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p className="login-dica">Digite só uma vez: este computador fica conectado.</p>
      </form>
      <Rodape />
    </main>
  );
}
