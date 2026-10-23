import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useSessao } from '../lib/sessao';
import { AbaNotas } from '../componentes/admin/AbaNotas';
import { AbaConfiguracoes } from '../componentes/admin/AbaConfiguracoes';
import { AbaUsuarios } from '../componentes/admin/AbaUsuarios';
import { CONFIG_PADRAO, type Config, type Usuario } from '../tipos/firestore';

type Aba = 'notas' | 'config' | 'usuarios';

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'notas', rotulo: 'Notas' },
  { id: 'config', rotulo: 'Configurações' },
  { id: 'usuarios', rotulo: 'Usuários' },
];

export function Admin() {
  const { nome, usuario } = useSessao();
  const [aba, setAba] = useState<Aba>('notas');
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  const [usuarios, setUsuarios] = useState<Record<string, Usuario>>({});

  useEffect(() => onSnapshot(
    doc(db, 'config', 'geral'),
    (s) => setConfig(s.exists() ? { ...CONFIG_PADRAO, ...(s.data() as Partial<Config>) } : CONFIG_PADRAO),
    () => {},
  ), []);

  // Usado para mostrar o nome de quem fez cada ação, e na aba Usuários.
  useEffect(() => onSnapshot(
    collection(db, 'usuarios'),
    (s) => setUsuarios(Object.fromEntries(s.docs.map((d) => [d.id, d.data() as Usuario]))),
    () => {},
  ), []);

  return (
    <main className="admin">
      <header className="topo">
        <div className="topo-usuario"><strong>Administração</strong><span>{nome ?? usuario?.email}</span></div>
        <nav className="topo-acoes">
          <Link to="/bipar">Bipar</Link>
          <Link to="/tv">TV</Link>
          <button className="botao-secundario" onClick={() => signOut(auth)}>Sair</button>
        </nav>
      </header>

      <nav className="abas" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id}
            className={aba === a.id ? 'aba aba-ativa' : 'aba'} onClick={() => setAba(a.id)}>
            {a.rotulo}
          </button>
        ))}
      </nav>

      {aba === 'notas' && <AbaNotas config={config} usuarios={usuarios} />}
      {/* key: reabre o formulário com os valores atuais quando a config muda em outro lugar. */}
      {aba === 'config' && (
        <AbaConfiguracoes key={`${config.diasUrgencia}-${config.horasEmRotaNaTv}`}
          config={config} usuarios={usuarios} />
      )}
      {aba === 'usuarios' && <AbaUsuarios usuarios={usuarios} />}
    </main>
  );
}
