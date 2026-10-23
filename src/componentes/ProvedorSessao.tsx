import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { SessaoContexto, type Sessao } from '../lib/sessao';

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao>({ carregando: true, usuario: null });

  useEffect(
    () => onAuthStateChanged(auth, (usuario) => setSessao({ carregando: false, usuario })),
    [],
  );

  return <SessaoContexto.Provider value={sessao}>{children}</SessaoContexto.Provider>;
}
