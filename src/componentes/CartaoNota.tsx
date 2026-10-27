import { textoDestino } from '../lib/bipagem';
import { formatarNumeroNF, semZerosEsquerda } from '../lib/chaveAcesso';
import { formatarDiaHora } from '../lib/datas';
import { ALTURA_CARTAO_VH, textoDias, type ItemPainel, type TipoColuna } from '../lib/painel';

interface Props {
  item: ItemPainel;
  coluna: TipoColuna;
  emissor: string;
}

/** Cartão da TV: NF e dias, destino em destaque, emissor e, por último, motivo ou recebimento. */
export function CartaoNota({ item, coluna, emissor }: Props) {
  const classe = ['cartao', `cartao-${coluna}`, item.alerta ? 'cartao-alerta' : ''].join(' ');

  return (
    <li className={classe} style={{ height: `${ALTURA_CARTAO_VH[coluna]}vh` }}>
      <div className="cartao-linha">
        <span className="cartao-nf">
          NF {formatarNumeroNF(item.dados.numero)}
          <span className="cartao-serie"> · Série {semZerosEsquerda(item.dados.serie)}</span>
        </span>
        <span className="cartao-dias">{textoDias(item.dias)}</span>
      </div>
      <div className={item.destino ? 'cartao-destino' : 'cartao-destino cartao-sem-destino'}>
        {item.destino ? `→ ${textoDestino(item.destino)}` : 'SEM DESTINO'}
      </div>
      <div className="cartao-emissor">{emissor} · {item.dados.siglaUf}</div>
      {item.ocorrencia
        ? <div className="cartao-motivo">⚠ {item.ocorrencia}</div>
        : <div className="cartao-recebida">Recebida {formatarDiaHora(item.recebidaEm)}</div>}
    </li>
  );
}
