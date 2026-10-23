import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useSessao } from '../lib/sessao';
import type { Papel } from '../tipos/firestore';

interface Props {
  papeis: Papel[];
  children: ReactNode;
}

export function RotaProtegida({ papeis, children }: Props) {
  const { carregando, usuario, papel } = useSessao();
  const local = useLocation();

  if (carregando) return <p className="aviso">Carregando…</p>;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;

  if (!papel || !papeis.includes(papel)) {
    return (
      <div className="aviso">
        <p>Seu usuário não tem permissão para esta tela.</p>
        <button onClick={() => signOut(auth)}>Sair</button>
      </div>
    );
  }

  return <>{children}</>;
}
