import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessao } from '../lib/sessao';

export function RotaProtegida({ children }: { children: ReactNode }) {
  const { carregando, usuario } = useSessao();
  const local = useLocation();

  if (carregando) return <p className="aviso">Carregando…</p>;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  return <>{children}</>;
}
