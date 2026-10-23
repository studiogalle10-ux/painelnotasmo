import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSessao } from '../../lib/sessao';
import { idAparelho } from '../../lib/aparelho';
import { estornarSaida, excluirNota } from '../../lib/bipagem';
import {
  formatarDocEmitente,
  formatarNumeroNF,
  lerChave,
  semZerosEsquerda,
} from '../../lib/chaveAcesso';
import { diasDesde, formatarDataHora } from '../../lib/datas';
import { nomeDoEmitente } from '../../lib/emitentes';
import { ROTULO_SITUACAO, situacaoNota, textoDias } from '../../lib/painel';
import type { Config, Evento, Nota, TipoEvento, Usuario } from '../../tipos/firestore';
import { DialogoConfirmacao } from './DialogoConfirmacao';

const ROTULO_EVENTO: Record<TipoEvento, string> = {
  entrada: 'Entrada (1ª bipagem)',
  saida: 'Saída (em rota)',
  estorno: 'Estorno da saída',
  exclusao: 'Exclusão',
};

interface Props {
  chave: string;
  usuarios: Record<string, Usuario>;
  config: Config;
  onFechar: () => void;
}

function mensagemAcao(e: unknown): string {
  if (e instanceof FirebaseError && e.code === 'permission-denied') return 'Sem permissão para esta ação.';
  if (e instanceof Error && e.message) return e.message;
  return 'Não foi possível concluir.';
}

export function DetalheNota({ chave, usuarios, config, onFechar }: Props) {
  const { usuario } = useSessao();
  const lida = lerChave(chave);
  const dados = lida.ok ? lida.dados : null;
  const [nota, setNota] = useState<Nota | null | undefined>(undefined);
  const [eventos, setEventos] = useState<(Evento & { id: string })[] | null>(null);
  const [emissor, setEmissor] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<'estorno' | 'exclusao' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [agora] = useState(() => new Date());

  useEffect(() => onSnapshot(
    doc(db, 'notas', chave),
    (s) => setNota(s.exists() ? (s.data({ serverTimestamps: 'estimate' }) as Nota) : null),
    () => setNota(null),
  ), [chave]);

  useEffect(() => onSnapshot(
    query(collection(db, 'eventos'), where('chave', '==', chave), orderBy('criadoEm', 'desc')),
    (s) => setEventos(s.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Evento) }))),
    () => setEventos([]),
  ), [chave]);

  // O admin pode gravar o cache: se faltar o nome, consulta a BrasilAPI.
  const cnpj = dados?.cnpjEmitente;
  const tipoDoc = dados?.tipoDocEmitente;
  useEffect(() => {
    if (!cnpj || !tipoDoc) return;
    let ativo = true;
    void nomeDoEmitente(db, cnpj, tipoDoc).then((n) => {
      if (ativo) setEmissor(n);
    });
    return () => { ativo = false; };
  }, [cnpj, tipoDoc]);

  if (!dados) return null;
  const autor = { uid: usuario!.uid, aparelho: idAparelho() };
  const situacao = nota
    ? situacaoNota({ dados, status: nota.status, recebidaEm: nota.recebidaEm.toDate(), saidaEm: null }, agora, config)
    : null;
  const nomeUsuario = (uid: string) => usuarios[uid]?.nome ?? uid;

  return (
    <section className="detalhe">
      <header className="detalhe-topo">
        <div>
          <h2>NF {formatarNumeroNF(dados.numero)} · Série {semZerosEsquerda(dados.serie)}</h2>
          <p className="detalhe-emissor">
            {emissor ?? formatarDocEmitente(dados.cnpjEmitente, dados.tipoDocEmitente)} · {dados.siglaUf}
          </p>
        </div>
        <button className="botao-secundario" onClick={onFechar}>Voltar à lista</button>
      </header>

      {aviso && <p className="aviso-ok">{aviso}</p>}

      <dl className="detalhe-dados">
        <div><dt>Situação</dt><dd>
          {nota === undefined ? 'Carregando…' : nota === null ? 'Excluída (não está mais no painel)'
            : `${ROTULO_SITUACAO[situacao!]}${situacao !== 'em_rota' ? ` · ${textoDias(diasDesde(nota.recebidaEm.toDate(), agora))}` : ''}`}
        </dd></div>
        <div><dt>CNPJ/CPF do emitente</dt><dd>{formatarDocEmitente(dados.cnpjEmitente, dados.tipoDocEmitente)}</dd></div>
        <div><dt>Emissão (mês/ano)</dt><dd>{dados.aamm.slice(2)}/20{dados.aamm.slice(0, 2)}</dd></div>
        {nota && <div><dt>Recebida</dt><dd>{formatarDataHora(nota.recebidaEm.toDate())} · {nomeUsuario(nota.recebidaPor)}</dd></div>}
        {nota?.saidaEm && <div><dt>Saída</dt><dd>{formatarDataHora(nota.saidaEm.toDate())} · {nomeUsuario(nota.saidaPor ?? '')}</dd></div>}
        <div className="detalhe-chave"><dt>Chave de acesso</dt><dd>{dados.chave.replace(/(.{4})/g, '$1 ').trim()}</dd></div>
      </dl>

      {nota && (
        <div className="detalhe-acoes">
          {nota.status === 'em_rota' && (
            <button className="botao-secundario" onClick={() => setDialogo('estorno')}>Estornar saída</button>
          )}
          <button className="botao-perigo" onClick={() => setDialogo('exclusao')}>Excluir nota</button>
        </div>
      )}

      <h3>Histórico</h3>
      {eventos === null ? <p className="ultimas-aviso">Carregando…</p> : eventos.length === 0
        ? <p className="ultimas-aviso">Nenhum evento registrado.</p>
        : (
          <ol className="historico">
            {eventos.map((e) => (
              <li key={e.id} className={`historico-item historico-${e.tipo}`}>
                <strong>{ROTULO_EVENTO[e.tipo]}</strong>
                <span>{e.criadoEm ? formatarDataHora(e.criadoEm.toDate()) : ''} · {nomeUsuario(e.usuario)}</span>
                <span className="historico-aparelho">Aparelho {e.aparelho.slice(0, 8)}</span>
                {e.detalhe && <span className="historico-motivo">Motivo: {e.detalhe}</span>}
              </li>
            ))}
          </ol>
        )}

      {dialogo === 'estorno' && (
        <DialogoConfirmacao
          titulo="Estornar saída"
          texto="A nota volta para Preparação, mantendo a data de recebimento. A próxima bipagem dá saída de novo."
          rotuloConfirmar="Estornar"
          onCancelar={() => setDialogo(null)}
          onConfirmar={async (motivo) => {
            try {
              await estornarSaida(db, chave, autor, motivo);
            } catch (e) {
              throw new Error(mensagemAcao(e));
            }
            setDialogo(null);
            setAviso('Saída estornada. A nota voltou para Preparação.');
          }}
        />
      )}
      {dialogo === 'exclusao' && (
        <DialogoConfirmacao
          titulo="Excluir nota"
          texto="A nota sai do painel e da busca. O histórico continua guardado. Se for bipada de novo, entra como nota nova."
          rotuloConfirmar="Excluir"
          onCancelar={() => setDialogo(null)}
          onConfirmar={async (motivo) => {
            try {
              await excluirNota(db, chave, autor, motivo);
            } catch (e) {
              throw new Error(mensagemAcao(e));
            }
            setDialogo(null);
            setAviso('Nota excluída. O histórico continua abaixo.');
          }}
        />
      )}
    </section>
  );
}
