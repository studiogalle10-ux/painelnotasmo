import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface Sessao {
  carregando: boolean;
  usuario: User | null;
}

export const SessaoContexto = createContext<Sessao>({ carregando: true, usuario: null });

export const useSessao = () => useContext(SessaoContexto);
