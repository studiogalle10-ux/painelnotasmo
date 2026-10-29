import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatarDataExtenso, formatarHora } from '../lib/datas';
import { nomeExibicao } from '../lib/emitentes';
import { separarColunas } from '../lib/painel';
import { useNotasGalpao } from '../lib/notasGalpao';
import { useOnline } from '../lib/conexao';
import { useConfig } from '../lib/config';
import { ColunaTv } from '../componentes/ColunaTv';
import { LogoVart } from '../componentes/LogoVart';
import { Rodape } from '../componentes/Rodape';
import type { Emitente } from '../tipos/firestore';

const TROCA_PAGINA_MS = 10_000;
const RECALCULO_MS = 60_000;
const RECARGA_MS = 30 * 60_000;

function Relogio() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="tv-relogio">
      <span className="tv-hora">{formatarHora(agora)}</span>
      <span className="tv-data">{formatarDataExtenso(agora)}</span>
    </div>
  );
}

export function Tv() {
  const online = useOnline();
  const config = useConfig();
  const galpao = useNotasGalpao();
  const [agora, setAgora] = useState(() => new Date());
  const [contador, setContador] = useState(0);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const nomesBuscados = useRef(new Set<string>());

  useEffect(() => {
    const recalculo = window.setInterval(() => setAgora(new Date()), RECALCULO_MS);
    const pagina = window.setInterval(() => setContador((c) => c + 1), TROCA_PAGINA_MS);
    return () => {
      window.clearInterval(recalculo);
      window.clearInterval(pagina);
    };
  }, []);

  // Recarga a cada 30 min, só com internet (senão a TV ficaria numa tela de erro).
  useEffect(() => {
    let pendente = false;
    const recarregar = () => {
      if (navigator.onLine) window.location.reload();
      else pendente = true;
    };
    const aoVoltar = () => { if (pendente) window.location.reload(); };
    const t = window.setInterval(recarregar, RECARGA_MS);
    window.addEventListener('online', aoVoltar);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('online', aoVoltar);
    };
  }, []);

  // Pede para a tela não apagar (o pedido cai quando a aba fica oculta; refaz ao voltar).
  useEffect(() => {
    let trava: WakeLockSentinel | null = null;
    const pedir = async () => {
      try {
        if (document.visibilityState === 'visible') trava = await navigator.wakeLock?.request('screen');
      } catch {
        // Nem todo navegador permite.
      }
    };
    void pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      document.removeEventListener('visibilitychange', pedir);
      void trava?.release();
    };
  }, []);

  const notas = galpao.notas;
  const colunas = useMemo(
    () => separarColunas(notas ?? [], agora, config),
    [notas, agora, config],
  );

  // Nomes dos emissores: a TV só lê o cache (quem grava é a tela de bipar).
  useEffect(() => {
    for (const n of notas ?? []) {
      const cnpj = n.dados.cnpjEmitente;
      if (n.dados.tipoDocEmitente !== 'cnpj' || nomesBuscados.current.has(cnpj)) continue;
      nomesBuscados.current.add(cnpj);
      getDoc(doc(db, 'emitentes', cnpj))
        .then((s) => {
          if (s.exists()) setNomes((m) => ({ ...m, [cnpj]: nomeExibicao(s.data() as Emitente) }));
          else nomesBuscados.current.delete(cnpj); // Tenta de novo quando a lista mudar.
        })
        .catch(() => nomesBuscados.current.delete(cnpj));
    }
  }, [notas]);

  const estado = !online ? 'Sem internet' : galpao.doCache ? 'Reconectando…' : 'Online';

  return (
    // Um clique na TV liga a tela cheia (o navegador só deixa com um clique).
    <main className="tv" onClick={() => { if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {}); }}>
      <header className="tv-topo">
        <div className="tv-marca">
          <LogoVart className="logo-tv" />
          <span>Painel de NFs<small>MO Transportes</small></span>
        </div>
        <Relogio />
        <div className="tv-estado">
          <span className={`conexao ${estado === 'Online' ? 'conexao-ok' : 'conexao-off'}`}>{estado}</span>
          {galpao.atualizadoEm && (
            <span className="tv-atualizado">Atualizado às {formatarHora(galpao.atualizadoEm)}</span>
          )}
        </div>
      </header>

      {galpao.erro && <p className="tv-erro">Sem acesso aos dados. Entre de novo com a senha do painel.</p>}

      <div className="tv-colunas">
        <ColunaTv titulo="Em Ocorrência" coluna="ocorrencia" itens={colunas.ocorrencia}
          contador={contador} nomes={nomes} vazio="Nenhuma nota aguardando" />
        <ColunaTv titulo="Depósito" coluna="deposito" itens={colunas.deposito}
          contador={contador} nomes={nomes} vazio="Nenhuma nota no depósito" />
        <ColunaTv titulo="Urgência" coluna="urgencia" itens={colunas.urgencia}
          contador={contador} nomes={nomes} vazio={`Nenhuma nota com ${config.diasUrgencia}+ dias`} />
      </div>
      <Rodape tv />
    </main>
  );
}
