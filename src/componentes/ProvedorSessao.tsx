import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { SessaoContexto, type Sessao } from '../lib/sessao';
import type { Usuario } from '../tipos/firestore';

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao>({
    carregando: true,
    usuario: null,
    papel: null,
    nome: null,
  });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (usuario) => {
        if (!usuario) {
          setSessao({ carregando: false, usuario: null, papel: null, nome: null });
          return;
        }
        setSessao((s) => ({ ...s, carregando: true }));
        try {
          const snap = await getDoc(doc(db, 'usuarios', usuario.uid));
          const dados = snap.exists() ? (snap.data() as Usuario) : null;
          setSessao({
            carregando: false,
            usuario,
            papel: dados?.papel ?? null,
            nome: dados?.nome ?? null,
          });
        } catch {
          setSessao({ carregando: false, usuario, papel: null, nome: null });
        }
      }),
    [],
  );

  return <SessaoContexto.Provider value={sessao}>{children}</SessaoContexto.Provider>;
}
