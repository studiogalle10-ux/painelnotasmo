import { useEffect, useMemo, useState } from 'react';
import { Timestamp, collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatarDocEmitente, formatarNumeroNF, semZerosEsquerda } from '../../lib/chaveAcesso';
import { dataIsoSP, diasDesde, formatarDiaHora, inicioDoDiaSP } from '../../lib/datas';
import { chaveDaBusca, filtrarNotas, gerarCsv, type FiltroSituacao } from '../../lib/buscaNotas';
import { useNomesEmitentes } from '../../lib/nomesEmitentes';
import { paraNotas } from '../../lib/notasFirestore';
import { ROTULO_SITUACAO, situacaoNota, textoDias, type NotaPainel } from '../../lib/painel';
import type { Config, Usuario } from '../../tipos/firestore';
import { DetalheNota } from './DetalheNota';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Proteção do plano gratuito (leituras por dia); com ~5 notas/dia nunca deve chegar perto. */
const LIMITE_NOTAS = 2000;
const ATALHOS = [
  { rotulo: 'Hoje', dias: 0 },
  { rotulo: '7 dias', dias: 7 },
  { rotulo: '30 dias', dias: 30 },
  { rotulo: '90 dias', dias: 90 },
];

const diasAtras = (dias: number) => dataIsoSP(new Date(Date.now() - dias * DIA_MS));

interface Props {
  config: Config;
  usuarios: Record<string, Usuario>;
}

export function AbaNotas({ config, usuarios }: Props) {
  const [inicio, setInicio] = useState(() => diasAtras(90));
  const [fim, setFim] = useState(() => dataIsoSP(new Date()));
  const [texto, setTexto] = useState('');
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  // Notas guardadas junto com o período que as trouxe: ao mudar o período, volta a "Carregando…".
  const periodo = `${inicio}|${fim}`;
  const [carga, setCarga] = useState<{ periodo: string; notas: NotaPainel[] } | null>(null);
  const notas = carga?.periodo === periodo ? carga.notas : null;
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!inicio || !fim) return;
    const de = Timestamp.fromDate(inicioDoDiaSP(inicio));
    const ate = Timestamp.fromMillis(inicioDoDiaSP(fim).getTime() + DIA_MS);
    return onSnapshot(
      query(collection(db, 'notas'), where('recebidaEm', '>=', de), where('recebidaEm', '<', ate),
        orderBy('recebidaEm', 'desc'), limit(LIMITE_NOTAS)),
      (s) => { setCarga({ periodo: `${inicio}|${fim}`, notas: paraNotas(s) }); setErro(null); },
      () => setErro('Não foi possível carregar as notas.'),
    );
  }, [inicio, fim]);

  const nomes = useNomesEmitentes(useMemo(() => notas ?? [], [notas]));
  const chaveBuscada = chaveDaBusca(texto);
  const resultado = useMemo(
    () => filtrarNotas(notas ?? [], { texto, situacao }, nomes, agora, config),
    [notas, texto, situacao, nomes, agora, config],
  );

  function baixarPlanilha() {
    const csv = gerarCsv(resultado, nomes, new Date(), config);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas-${inicio}-a-${fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const aberta = selecionada ?? chaveBuscada;
  if (aberta) {
    return (
      <DetalheNota chave={aberta} usuarios={usuarios} config={config}
        onFechar={() => { setSelecionada(null); if (chaveBuscada) setTexto(''); }} />
    );
  }

  return (
    <section className="aba-notas">
      <div className="filtros">
        <label className="filtro-texto">
          Buscar
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="NF, CNPJ, emissor ou chave de acesso completa" />
        </label>
        <label>
          Situação
          <select value={situacao} onChange={(e) => setSituacao(e.target.value as FiltroSituacao)}>
            <option value="todas">Todas</option>
            <option value="preparacao">Preparação</option>
            <option value="urgencia">Urgência</option>
            <option value="em_rota">Em rota</option>
          </select>
        </label>
        <label>
          Recebidas de
          <input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          até
          <input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
        </label>
        <div className="atalhos">
          {ATALHOS.map((a) => (
            <button key={a.rotulo} className="botao-secundario"
              onClick={() => { setInicio(diasAtras(a.dias)); setFim(dataIsoSP(new Date())); }}>
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="resultado-barra">
        <span>
          {notas === null ? 'Carregando…' : `${resultado.length} nota${resultado.length === 1 ? '' : 's'}`}
          {notas && notas.length >= LIMITE_NOTAS && ` (mostrando as ${LIMITE_NOTAS} mais recentes; reduza o período)`}
        </span>
        <button onClick={baixarPlanilha} disabled={!resultado.length}>Baixar planilha</button>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>NF</th><th>Série</th><th>Emissor</th><th>UF</th><th>Situação</th>
              <th>Recebida</th><th>Parada</th><th>Saída</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((n) => {
              const s = situacaoNota(n, agora, config);
              return (
                <tr key={n.dados.chave} tabIndex={0} onClick={() => setSelecionada(n.dados.chave)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelecionada(n.dados.chave); }}>
                  <td className="tabela-nf">{formatarNumeroNF(n.dados.numero)}</td>
                  <td>{semZerosEsquerda(n.dados.serie)}</td>
                  <td>{nomes[n.dados.cnpjEmitente]
                    ?? formatarDocEmitente(n.dados.cnpjEmitente, n.dados.tipoDocEmitente)}</td>
                  <td>{n.dados.siglaUf}</td>
                  <td><span className={`etiqueta etiqueta-${s}`}>{ROTULO_SITUACAO[s]}</span></td>
                  <td>{formatarDiaHora(n.recebidaEm)}</td>
                  <td>{s === 'em_rota' ? '' : textoDias(diasDesde(n.recebidaEm, agora))}</td>
                  <td>{n.saidaEm ? formatarDiaHora(n.saidaEm) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {notas && resultado.length === 0 && <p className="ultimas-aviso">Nenhuma nota encontrada.</p>}
      </div>
    </section>
  );
}
