import { useState, type FormEvent } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Config } from '../tipos/firestore';

interface Props {
  config: Config;
  onFechar: () => void;
}

/** Dias para a nota ir à Urgência. Vale na hora para a TV. */
export function Ajustes({ config, onFechar }: Props) {
  const [diasUrgencia, setDiasUrgencia] = useState(String(config.diasUrgencia));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const urgencia = Number(diasUrgencia);
    if (!Number.isInteger(urgencia) || urgencia < 1 || urgencia > 60) {
      setErro('Urgência: de 1 a 60 dias.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await setDoc(doc(db, 'config', 'geral'), { diasUrgencia: urgencia });
      onFechar();
    } catch {
      setErro('Não foi possível salvar. Tente de novo.');
      setSalvando(false);
    }
  }

  return (
    <form className="ajustes" onSubmit={salvar}>
      <label>
        <span>Vai para <strong>Urgência</strong> com quantos dias parada?</span>
        <input type="number" min={1} max={60} inputMode="numeric" value={diasUrgencia}
          onChange={(e) => setDiasUrgencia(e.target.value)} />
      </label>
      {erro && <p className="erro">{erro}</p>}
      <div className="ajustes-botoes">
        <button type="button" className="botao-secundario" onClick={onFechar}>Cancelar</button>
        <button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
