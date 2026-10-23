import { useState, type FormEvent } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSessao } from '../../lib/sessao';
import { formatarDataHora } from '../../lib/datas';
import type { Config, Usuario } from '../../tipos/firestore';

interface Props {
  config: Config;
  usuarios: Record<string, Usuario>;
}

export function AbaConfiguracoes({ config, usuarios }: Props) {
  const { usuario } = useSessao();
  const [dias, setDias] = useState(String(config.diasUrgencia));
  const [horas, setHoras] = useState(String(config.horasEmRotaNaTv));
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const diasNum = Number(dias);
  const horasNum = Number(horas);
  const valido = Number.isInteger(diasNum) && diasNum >= 1 && diasNum <= 60
    && Number.isInteger(horasNum) && horasNum >= 1 && horasNum <= 168;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setSalvando(true);
    setMensagem(null);
    try {
      await setDoc(doc(db, 'config', 'geral'), {
        diasUrgencia: diasNum,
        horasEmRotaNaTv: horasNum,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: usuario!.uid,
      });
      setMensagem({ ok: true, texto: 'Configuração salva. A TV atualiza sozinha.' });
    } catch {
      setMensagem({ ok: false, texto: 'Não foi possível salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="aba-config" onSubmit={salvar}>
      <label>
        Dias para a nota ir para Urgência
        <input type="number" min={1} max={60} step={1} value={dias} onChange={(e) => setDias(e.target.value)} />
        <small>Contados da 1ª bipagem. Com {Number.isInteger(diasNum) && diasNum > 1 ? diasNum - 1 : '—'} dia(s) o card fica amarelo.</small>
      </label>
      <label>
        Horas que a nota em rota fica na TV
        <input type="number" min={1} max={168} step={1} value={horas} onChange={(e) => setHoras(e.target.value)} />
        <small>Depois disso some da TV, mas continua na busca.</small>
      </label>
      {!valido && <p className="erro">Dias de 1 a 60 e horas de 1 a 168, só números inteiros.</p>}
      {mensagem && <p className={mensagem.ok ? 'aviso-ok' : 'erro'}>{mensagem.texto}</p>}
      <button type="submit" disabled={!valido || salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      {config.atualizadoEm && (
        <p className="ultimas-aviso">
          Última alteração: {formatarDataHora(config.atualizadoEm.toDate())}
          {config.atualizadoPor && ` por ${usuarios[config.atualizadoPor]?.nome ?? config.atualizadoPor}`}
        </p>
      )}
    </form>
  );
}
