import { useState, type FormEvent } from 'react';
import { db } from '../../lib/firebase';
import { useSessao } from '../../lib/sessao';
import {
  alterarUsuario,
  criarUsuario,
  enviarRedefinicaoSenha,
  mensagemErroUsuario,
  type NovoUsuario,
} from '../../lib/usuarios';
import type { Papel, Usuario } from '../../tipos/firestore';

const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Admin',
  operador: 'Operador',
  tv: 'TV (só leitura)',
  inativo: 'Sem acesso',
};

const VAZIO: NovoUsuario = { nome: '', email: '', senha: '', papel: 'operador' };

export function AbaUsuarios({ usuarios }: { usuarios: Record<string, Usuario> }) {
  const { usuario } = useSessao();
  const [novo, setNovo] = useState<NovoUsuario>(VAZIO);
  const [criando, setCriando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const lista = Object.entries(usuarios).sort(([, a], [, b]) => a.nome.localeCompare(b.nome, 'pt-BR'));

  async function mudarPapel(uid: string, u: Usuario, papel: Papel) {
    setMensagem(null);
    try {
      await alterarUsuario(db, uid, { papel });
      setMensagem({ ok: true, texto: `${u.nome}: agora ${ROTULO_PAPEL[papel]}.` });
    } catch (e) {
      setMensagem({ ok: false, texto: mensagemErroUsuario(e) });
    }
  }

  async function redefinir(u: Usuario) {
    if (!u.email) return;
    setMensagem(null);
    try {
      await enviarRedefinicaoSenha(u.email);
      setMensagem({ ok: true, texto: `E-mail para redefinir a senha enviado para ${u.email}.` });
    } catch (e) {
      setMensagem({ ok: false, texto: mensagemErroUsuario(e) });
    }
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    setCriando(true);
    setMensagem(null);
    try {
      await criarUsuario(db, novo);
      setMensagem({ ok: true, texto: `Usuário ${novo.nome} criado. Passe o e-mail e a senha para a pessoa.` });
      setNovo(VAZIO);
    } catch (err) {
      setMensagem({ ok: false, texto: mensagemErroUsuario(err) });
    } finally {
      setCriando(false);
    }
  }

  return (
    <section className="aba-usuarios">
      {mensagem && <p className={mensagem.ok ? 'aviso-ok' : 'erro'}>{mensagem.texto}</p>}

      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th></th></tr></thead>
          <tbody>
            {lista.map(([uid, u]) => {
              const euMesmo = uid === usuario?.uid;
              return (
                <tr key={uid} className={u.papel === 'inativo' ? 'linha-inativa' : ''}>
                  <td>{u.nome}{euMesmo && ' (você)'}</td>
                  <td>{u.email ?? '—'}</td>
                  <td>
                    <select value={u.papel} disabled={euMesmo} aria-label={`Papel de ${u.nome}`}
                      title={euMesmo ? 'Você não pode mudar o próprio papel.' : undefined}
                      onChange={(e) => void mudarPapel(uid, u, e.target.value as Papel)}>
                      {(Object.keys(ROTULO_PAPEL) as Papel[]).map((p) => (
                        <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.email && (
                      <button className="botao-link" onClick={() => void redefinir(u)}>Redefinir senha</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ultimas-aviso">
        "Sem acesso" bloqueia tudo, mas mantém o login para reativar depois. Para apagar o login de vez,
        use o console do Firebase (Authentication).
      </p>

      <form className="novo-usuario" onSubmit={criar}>
        <h3>Novo usuário</h3>
        <label>Nome
          <input value={novo.nome} required maxLength={100}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
        </label>
        <label>E-mail
          <input type="email" value={novo.email} required autoComplete="off"
            onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
        </label>
        <label>Senha inicial
          <input type="text" value={novo.senha} required minLength={6} autoComplete="new-password"
            onChange={(e) => setNovo({ ...novo, senha: e.target.value })} />
        </label>
        <label>Papel
          <select value={novo.papel}
            onChange={(e) => setNovo({ ...novo, papel: e.target.value as NovoUsuario['papel'] })}>
            <option value="operador">Operador</option>
            <option value="tv">TV (só leitura)</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" disabled={criando}>{criando ? 'Criando…' : 'Criar usuário'}</button>
      </form>
    </section>
  );
}
