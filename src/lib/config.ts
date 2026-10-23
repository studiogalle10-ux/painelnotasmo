import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { CONFIG_PADRAO, type Config } from '../tipos/firestore';

/** Ajustes do painel (config/geral), em tempo real. Sem o documento, usa o padrão. */
export function useConfig(): Config {
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  useEffect(() => onSnapshot(
    doc(db, 'config', 'geral'),
    (s) => setConfig(s.exists() ? { ...CONFIG_PADRAO, ...(s.data() as Partial<Config>) } : CONFIG_PADRAO),
    () => {}, // Sem acesso, segue com o padrão.
  ), []);
  return config;
}
