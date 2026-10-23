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

/** Quem abre cada tela protegida. */
export const PAPEIS_POR_ROTA: Record<string, Papel[]> = {
  '/bipar': ['operador', 'admin'],
  '/tv': ['tv', 'admin'],
  '/admin': ['admin'],
};

export function podeAbrir(papel: Papel | null, rota: string): boolean {
  return !!papel && (PAPEIS_POR_ROTA[rota]?.includes(papel) ?? false);
}

/** Tela inicial de cada papel. */
export function rotaInicial(papel: Papel | null): string {
  if (papel === 'tv') return '/tv';
  if (papel === 'operador') return '/bipar';
  if (papel === 'admin') return '/admin';
  return '/login';
}
