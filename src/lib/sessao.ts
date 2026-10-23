import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { Papel } from '../tipos/firestore';

export interface Sessao {
  carregando: boolean;
  usuario: User | null;
  /** null quando o usuário não tem documento em `usuarios/{uid}`. */
  papel: Papel | null;
  nome: string | null;
}

export const SessaoContexto = createContext<Sessao>({
  carregando: true,
  usuario: null,
  papel: null,
  nome: null,
});

export const useSessao = () => useContext(SessaoContexto);

/** Tela inicial de cada papel. */
export function rotaInicial(papel: Papel | null): string {
  if (papel === 'tv') return '/tv';
  if (papel === 'operador') return '/bipar';
  if (papel === 'admin') return '/admin';
  return '/login';
}
