import { formatarNumeroNF, semZerosEsquerda } from '../lib/chaveAcesso';
import { formatarDiaHora, formatarHora } from '../lib/datas';
import { ALTURA_CARTAO_VH, textoDias, type ItemPainel, type TipoColuna } from '../lib/painel';

interface Props {
  item: ItemPainel;
  coluna: TipoColuna;
  emissor: string;
}

export function CartaoNota({ item, coluna, emissor }: Props) {
  const classe = ['cartao', `cartao-${coluna}`, item.alerta ? 'cartao-alerta' : ''].join(' ');
  const nf = `NF ${formatarNumeroNF(item.dados.numero)}`;

  if (coluna === 'em_rota') {
    return (
      <li className={classe} style={{ height: `${ALTURA_CARTAO_VH.em_rota}vh` }}>
        <div className="cartao-linha">
          <span className="cartao-nf">{nf}</span>
          <span className="cartao-saida">
            {item.saidaEm ? `Saiu ${formatarHora(item.saidaEm)}` : 'Saindo'}
          </span>
        </div>
        <div className="cartao-emissor">{emissor}</div>
      </li>
    );
  }

  return (
    <li className={classe} style={{ height: `${ALTURA_CARTAO_VH[coluna]}vh` }}>
      <div className="cartao-linha">
        <span className="cartao-nf">
          {nf}
          <span className="cartao-serie"> · Série {semZerosEsquerda(item.dados.serie)}</span>
        </span>
        <span className="cartao-dias">{textoDias(item.dias)}</span>
      </div>
      <div className="cartao-emissor">{emissor} · {item.dados.siglaUf}</div>
      <div className="cartao-recebida">Recebida {formatarDiaHora(item.recebidaEm)}</div>
    </li>
  );
}
