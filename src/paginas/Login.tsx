import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, emailDoUsuario } from '../lib/firebase';
import { useSessao } from '../lib/sessao';
import { LogoVart } from '../componentes/LogoVart';
import { Rodape } from '../componentes/Rodape';

const ERRO_CREDENCIAIS = 'Usuário ou senha incorretos.';

function mensagemErro(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') return ERRO_CREDENCIAIS;
    if (e.code === 'auth/too-many-requests') {
      return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    }
    if (e.code === 'auth/network-request-failed') return 'Sem conexão com a internet.';
  }
  return 'Não foi possível entrar. Tente de novo.';
}

/** Usuário e senha do painel. Depois de entrar, o aparelho fica conectado. */
export function Login() {
  const { carregando, usuario } = useSessao();
  const local = useLocation();
  const [nome, setNome] = useState('');
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
    const email = emailDoUsuario(nome);
    if (!email) {
      setErro(ERRO_CREDENCIAIS);
      return;
    }
    setEnviando(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <LogoVart className="logo-login" slogan />
      <h1>Painel de NFs</h1>
      <form onSubmit={entrar}>
        <label>
          Usuário
          <input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={nome} autoFocus onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" value={senha}
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
