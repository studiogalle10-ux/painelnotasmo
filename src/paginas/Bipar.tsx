import { useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, db } from '../lib/firebase';
import { useSessao } from '../lib/sessao';
import { useConfig } from '../lib/config';
import { useOnline } from '../lib/conexao';
import { idAparelho } from '../lib/aparelho';
import { biparNota } from '../lib/bipagem';
import { formatarDocEmitente, formatarNumeroNF, lerChave, semZerosEsquerda, type ChaveNFe } from '../lib/chaveAcesso';
import { formatarData, formatarHora } from '../lib/datas';
import { nomeDoEmitente } from '../lib/emitentes';
import { criarFiltroRepeticao } from '../lib/repeticao';
import { liberarSom, somLiberado, tocar } from '../lib/sons';
import { Ajustes } from '../componentes/Ajustes';
import { CampoLeitura } from '../componentes/CampoLeitura';
import { EmRotaNaTv } from '../componentes/EmRotaNaTv';
import { ResultadoBipagem, type Mensagem } from '../componentes/ResultadoBipagem';
import { UltimasBipagens } from '../componentes/UltimasBipagens';
import { Rodape } from '../componentes/Rodape';

function mensagemFalha(e: unknown): string {
  if (!navigator.onLine) return 'Sem internet. Bipe de novo quando a conexão voltar.';
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') return 'Este computador não está conectado ao painel. Saia e entre de novo.';
    if (e.code === 'unavailable' || e.code === 'deadline-exceeded') {
      return 'Sem conexão com o servidor. Bipe de novo.';
    }
  }
  return 'Erro ao registrar. Bipe de novo.';
}

const tituloNF = (d: ChaveNFe) => `NF ${formatarNumeroNF(d.numero)}`;
const detalheNF = (d: ChaveNFe, emissor?: string | null) =>
  [`Série ${semZerosEsquerda(d.serie)}`, emissor ?? formatarDocEmitente(d.cnpjEmitente, d.tipoDocEmitente), d.siglaUf]
    .join(' · ');

/** Abre o painel numa janela separada, para arrastar até a TV (segunda tela). */
function abrirTv() {
  window.open('/tv', 'painel-tv', 'popup,width=1280,height=720');
}

export function Bipar() {
  const { usuario } = useSessao();
  const config = useConfig();
  const online = useOnline();
  const [aparelho] = useState(idAparelho);
  const [filtro] = useState(() => criarFiltroRepeticao());
  const fila = useRef<Promise<void>>(Promise.resolve());
  const contador = useRef(0);

  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [digitando, setDigitando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [somOk, setSomOk] = useState(somLiberado());

  // O navegador só libera o som depois de um clique ou tecla (o leitor conta como tecla).
  useEffect(() => {
    if (somOk) return;
    const liberar = () => void liberarSom().then(setSomOk);
    window.addEventListener('pointerdown', liberar);
    window.addEventListener('keydown', liberar);
    return () => {
      window.removeEventListener('pointerdown', liberar);
      window.removeEventListener('keydown', liberar);
    };
  }, [somOk]);

  function mostrar(m: Omit<Mensagem, 'id'>): number {
    const id = ++contador.current;
    setMensagem({ id, ...m });
    return id;
  }

  /** Completa o detalhe com o nome do emissor, se a mensagem ainda for a mesma. */
  function completarEmissor(id: number, d: ChaveNFe) {
    void nomeDoEmitente(db, d.cnpjEmitente, d.tipoDocEmitente).then((emissor) => {
      if (!emissor) return;
      setMensagem((m) => (m?.id === id ? { ...m, detalhe: detalheNF(d, emissor) } : m));
    });
  }

  async function processar(texto: string) {
    const lida = lerChave(texto);
    if (!lida.ok) {
      mostrar({ tom: 'erro', titulo: 'Chave inválida', detalhe: lida.erro });
      tocar('erro');
      return;
    }
    const d = lida.dados;
    if (filtro.ehRepeticao(d.chave)) {
      mostrar({ tom: 'neutro', titulo: 'Leitura repetida ignorada', detalhe: tituloNF(d) });
      return;
    }

    mostrar({ tom: 'processando', titulo: 'Registrando…', detalhe: tituloNF(d) });
    try {
      const r = await biparNota(db, d.chave, { uid: usuario!.uid, aparelho });
      if (r.tipo === 'entrada') {
        completarEmissor(mostrar({ tom: 'entrada', titulo: `${tituloNF(d)} · Preparação`, detalhe: detalheNF(d) }), d);
        tocar('entrada');
      } else if (r.tipo === 'saida') {
        completarEmissor(mostrar({ tom: 'saida', titulo: `${tituloNF(d)} · Em rota`, detalhe: detalheNF(d) }), d);
        tocar('saida');
      } else if (r.tipo === 'ja_despachada') {
        mostrar({
          tom: 'aviso',
          titulo: `${tituloNF(d)} já foi despachada`,
          detalhe: r.saidaEm
            ? `Saiu em ${formatarData(r.saidaEm)} às ${formatarHora(r.saidaEm)}`
            : 'A nota já está em rota.',
        });
        tocar('aviso');
      } else {
        mostrar({ tom: 'erro', titulo: 'Chave inválida', detalhe: r.erro });
        tocar('erro');
      }
    } catch (e) {
      // Falhou: a próxima leitura dessa chave não pode ser tratada como repetição.
      filtro.esquecer(d.chave);
      mostrar({ tom: 'erro', titulo: `${tituloNF(d)} não foi registrada`, detalhe: mensagemFalha(e) });
      tocar('erro');
    }
  }

  /** Leituras em sequência: cada uma espera a anterior terminar. */
  function aoLer(texto: string) {
    fila.current = fila.current.then(() => processar(texto));
  }

  const autor = { uid: usuario!.uid, aparelho };

  return (
    <main className="bipar">
      <header className="topo">
        <div className="topo-usuario">
          <img className="logo logo-bipar" src="/logo-mo.png" alt="MO Transportes" />
          <strong>Painel de NFs</strong>
          <span className={online ? 'conexao conexao-ok' : 'conexao conexao-off'}>
            {online ? 'Online' : 'Sem internet'}
          </span>
        </div>
        <nav className="topo-acoes">
          <button onClick={abrirTv}>Abrir TV</button>
          <button className="botao-secundario" onClick={() => setAjustando((v) => !v)}>Ajustes</button>
          <button className="botao-secundario" onClick={() => signOut(auth)}>Sair</button>
        </nav>
      </header>

      {ajustando && <Ajustes config={config} onFechar={() => setAjustando(false)} />}

      {!somOk && (
        <button className="ativar-som" onClick={() => void liberarSom().then(setSomOk)}>
          Clique aqui para ativar o som
        </button>
      )}

      <ResultadoBipagem mensagem={mensagem} />

      <CampoLeitura onLer={aoLer} digitando={digitando} />

      <div className="bipar-acoes">
        <span className="ultimas-aviso">1ª bipagem: Preparação · 2ª bipagem: Em rota</span>
        <button className="botao-link" onClick={() => setDigitando((v) => !v)}>
          {digitando ? 'Voltar ao leitor' : 'Código danificado? Digitar chave'}
        </button>
      </div>

      <section className="bipar-ultimas">
        <h2>Em rota na TV</h2>
        <EmRotaNaTv autor={autor} diasEmRotaNaTv={config.diasEmRotaNaTv} />
      </section>

      <section className="bipar-ultimas">
        <h2>Últimas bipagens neste computador</h2>
        <UltimasBipagens aparelho={aparelho} />
      </section>
      <Rodape />
    </main>
  );
}
