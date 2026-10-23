import { useEffect, useMemo, useState } from 'react';
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatarDataExtenso, formatarHora } from '../lib/datas';
import { separarColunas, type NotaPainel } from '../lib/painel';
import { useOnline } from '../lib/conexao';
import { useNomesEmitentes } from '../lib/nomesEmitentes';
import { paraNotas } from '../lib/notasFirestore';
import { ColunaTv } from '../componentes/ColunaTv';
import { CONFIG_PADRAO, type Config } from '../tipos/firestore';

const HORA_MS = 60 * 60 * 1000;
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
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  const [preparacao, setPreparacao] = useState<NotaPainel[]>([]);
  const [emRota, setEmRota] = useState<NotaPainel[]>([]);
  const [doCache, setDoCache] = useState({ preparacao: true, emRota: true });
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [contador, setContador] = useState(0);

  const falhou = () => setErro('Sem acesso aos dados. Confira o login da TV.');

  useEffect(() => onSnapshot(
    doc(db, 'config', 'geral'),
    (s) => setConfig(s.exists() ? { ...CONFIG_PADRAO, ...(s.data() as Partial<Config>) } : CONFIG_PADRAO),
    () => {}, // Sem a config, segue com o padrão.
  ), []);

  useEffect(() => onSnapshot(
    query(collection(db, 'notas'), where('status', '==', 'preparacao'), orderBy('recebidaEm')),
    { includeMetadataChanges: true },
    (s) => {
      setPreparacao(paraNotas(s));
      setDoCache((c) => ({ ...c, preparacao: s.metadata.fromCache }));
      if (!s.metadata.fromCache) setAtualizadoEm(new Date());
      setErro(null);
    },
    falhou,
  ), []);

  // A janela de "Em rota" é fixada ao assinar; o recorte exato é refeito a cada minuto.
  useEffect(() => {
    const inicio = Timestamp.fromMillis(Date.now() - config.horasEmRotaNaTv * HORA_MS);
    return onSnapshot(
      query(collection(db, 'notas'), where('status', '==', 'em_rota'),
        where('saidaEm', '>=', inicio), orderBy('saidaEm', 'desc')),
      { includeMetadataChanges: true },
      (s) => {
        setEmRota(paraNotas(s));
        setDoCache((c) => ({ ...c, emRota: s.metadata.fromCache }));
        if (!s.metadata.fromCache) setAtualizadoEm(new Date());
        setErro(null);
      },
      falhou,
    );
  }, [config.horasEmRotaNaTv]);

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
        // Nem todo navegador permite; o Fully Kiosk também mantém a tela ligada.
      }
    };
    void pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      document.removeEventListener('visibilitychange', pedir);
      void trava?.release();
    };
  }, []);

  const colunas = useMemo(
    () => separarColunas([...preparacao, ...emRota], agora, config),
    [preparacao, emRota, agora, config],
  );

  const todas = useMemo(() => [...preparacao, ...emRota], [preparacao, emRota]);
  const nomes = useNomesEmitentes(todas);

  const reconectando = doCache.preparacao || doCache.emRota;
  const estado = !online ? 'Sem internet' : reconectando ? 'Reconectando…' : 'Online';

  return (
    <main className="tv">
      <header className="tv-topo">
        <div className="tv-marca">
          <strong>MO Transportes</strong>
          <span>Painel de NFs</span>
        </div>
        <Relogio />
        <div className="tv-estado">
          <span className={`conexao ${estado === 'Online' ? 'conexao-ok' : 'conexao-off'}`}>{estado}</span>
          {atualizadoEm && <span className="tv-atualizado">Atualizado às {formatarHora(atualizadoEm)}</span>}
        </div>
      </header>

      {erro && <p className="tv-erro">{erro}</p>}

      <div className="tv-colunas">
        <ColunaTv titulo="Preparação" coluna="preparacao" itens={colunas.preparacao}
          contador={contador} nomes={nomes} vazio="Nenhuma nota em preparação" />
        <ColunaTv titulo="Urgência" coluna="urgencia" itens={colunas.urgencia}
          contador={contador} nomes={nomes} vazio={`Nenhuma nota com ${config.diasUrgencia}+ dias`} />
        <ColunaTv titulo="Em rota" coluna="em_rota" itens={colunas.emRota}
          contador={contador} nomes={nomes} vazio={`Nenhuma saída nas últimas ${config.horasEmRotaNaTv} h`} />
      </div>
    </main>
  );
}
