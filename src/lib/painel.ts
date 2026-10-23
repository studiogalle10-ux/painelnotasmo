// Separação das notas nas colunas da TV. Urgência não é gravada: sai daqui, a partir da
// data da 1ª bipagem e de `config/geral`.
import type { ChaveNFe } from './chaveAcesso';
import { diasDesde } from './datas';
import type { Config, StatusNota } from '../tipos/firestore';

export interface NotaPainel {
  dados: ChaveNFe;
  status: StatusNota;
  recebidaEm: Date;
  saidaEm: Date | null;
}

export interface ItemPainel extends NotaPainel {
  /** Dias completos desde a 1ª bipagem. */
  dias: number;
  /** Em preparação, a um dia de virar urgência (amarelo). */
  alerta: boolean;
}

export interface Colunas {
  preparacao: ItemPainel[];
  urgencia: ItemPainel[];
  emRota: ItemPainel[];
}

export type TipoColuna = 'preparacao' | 'urgencia' | 'em_rota';

/** Altura fixa de cada card na TV, em % da altura da tela (a paginação conta com ela). */
export const ALTURA_CARTAO_VH: Record<TipoColuna, number> = {
  preparacao: 12.5,
  urgencia: 12.5,
  em_rota: 8.5,
};

const HORA_MS = 60 * 60 * 1000;

export function separarColunas(notas: NotaPainel[], agora: Date, config: Config): Colunas {
  const colunas: Colunas = { preparacao: [], urgencia: [], emRota: [] };
  const limiteEmRota = agora.getTime() - config.horasEmRotaNaTv * HORA_MS;

  for (const nota of notas) {
    const dias = diasDesde(nota.recebidaEm, agora);
    if (nota.status === 'em_rota') {
      // Sem hora de saída ainda (gravação pendente): está saindo agora.
      const saida = nota.saidaEm?.getTime() ?? agora.getTime();
      if (saida > limiteEmRota) colunas.emRota.push({ ...nota, dias, alerta: false });
    } else if (dias >= config.diasUrgencia) {
      colunas.urgencia.push({ ...nota, dias, alerta: false });
    } else {
      colunas.preparacao.push({ ...nota, dias, alerta: dias >= config.diasUrgencia - 1 });
    }
  }

  const maisAntigaPrimeiro = (a: ItemPainel, b: ItemPainel) =>
    a.recebidaEm.getTime() - b.recebidaEm.getTime();
  colunas.preparacao.sort(maisAntigaPrimeiro);
  colunas.urgencia.sort(maisAntigaPrimeiro);
  colunas.emRota.sort((a, b) =>
    (b.saidaEm?.getTime() ?? agora.getTime()) - (a.saidaEm?.getTime() ?? agora.getTime()));
  return colunas;
}

/** Situação para o admin: igual à TV, mas nota em rota continua "em rota" depois das 24 h. */
export function situacaoNota(nota: NotaPainel, agora: Date, config: Config): TipoColuna {
  if (nota.status === 'em_rota') return 'em_rota';
  return diasDesde(nota.recebidaEm, agora) >= config.diasUrgencia ? 'urgencia' : 'preparacao';
}

export const ROTULO_SITUACAO: Record<TipoColuna, string> = {
  preparacao: 'Preparação',
  urgencia: 'Urgência',
  em_rota: 'Em rota',
};

export function textoDias(dias: number): string {
  if (dias <= 0) return 'hoje';
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
