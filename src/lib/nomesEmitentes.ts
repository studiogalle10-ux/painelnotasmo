import { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { nomeExibicao } from './emitentes';
import type { ChaveNFe } from './chaveAcesso';
import type { Emitente } from '../tipos/firestore';

/**
 * Nomes dos emissores das notas, lidos só do cache `emitentes` (quem consulta a BrasilAPI e
 * grava o cache é a bipagem). CNPJ sem cache é tentado de novo quando a lista muda.
 */
export function useNomesEmitentes(notas: { dados: ChaveNFe }[]): Record<string, string> {
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const buscados = useRef(new Set<string>());

  useEffect(() => {
    for (const n of notas) {
      const cnpj = n.dados.cnpjEmitente;
      if (n.dados.tipoDocEmitente !== 'cnpj' || buscados.current.has(cnpj)) continue;
      buscados.current.add(cnpj);
      getDoc(doc(db, 'emitentes', cnpj))
        .then((s) => {
          if (s.exists()) setNomes((m) => ({ ...m, [cnpj]: nomeExibicao(s.data() as Emitente) }));
          else buscados.current.delete(cnpj);
        })
        .catch(() => buscados.current.delete(cnpj));
    }
  }, [notas]);

  return nomes;
}
