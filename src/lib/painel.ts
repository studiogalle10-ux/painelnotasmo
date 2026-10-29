// Separação das notas nas colunas da TV. Nem ocorrência nem urgência são status: saem
// daqui, a partir do motivo gravado, da data da 1ª bipagem e de `config/geral`.
import type { Destino } from './bipagem';
import type { ChaveNFe } from './chaveAcesso';
import { diasDesde } from './datas';
import type { Config, Nota } from '../tipos/firestore';

/** Nota que está no galpão (status `preparacao`), pronta para a TV. */
export interface NotaPainel {
  dados: ChaveNFe;
  recebidaEm: Date;
  /** null enquanto ninguém preencheu (aparece "SEM DESTINO"). */
  destino: Destino | null;
  ocorrencia: string | null;
}

export interface ItemPainel extends NotaPainel {
  /** Dias completos desde a 1ª bipagem. */
  dias: number;
  /** No Depósito, a um dia de virar urgência (amarelo). */
  alerta: boolean;
}

export interface Colunas {
  ocorrencia: ItemPainel[];
  deposito: ItemPainel[];
  urgencia: ItemPainel[];
}

export type TipoColuna = 'ocorrencia' | 'deposito' | 'urgencia';

/** Altura fixa de cada card na TV, em % da altura da tela (a paginação conta com ela). */
export const ALTURA_CARTAO_VH: Record<TipoColuna, number> = {
  ocorrencia: 17,
  deposito: 17,
  urgencia: 17,
};

/** Campos da nota que a TV e a tela de bipar usam. */
export function paraNotaPainel(dados: ChaveNFe, n: Nota): NotaPainel {
  return {
    dados,
    recebidaEm: n.recebidaEm.toDate(),
    destino: n.destinoCidade && n.destinoUf && n.destinoIbge
      ? { cidade: n.destinoCidade, uf: n.destinoUf, ibge: n.destinoIbge }
      : null,
    ocorrencia: n.ocorrencia ?? null,
  };
}

/**
 * Com ocorrência → Em Ocorrência (está esperando algo que não depende da MO, mesmo com
 * muitos dias). Sem ocorrência: `diasUrgencia`+ dias → Urgência; senão → Depósito.
 */
export function separarColunas(notas: NotaPainel[], agora: Date, config: Config): Colunas {
  const colunas: Colunas = { ocorrencia: [], deposito: [], urgencia: [] };

  for (const nota of notas) {
    const dias = diasDesde(nota.recebidaEm, agora);
    if (nota.ocorrencia) {
      colunas.ocorrencia.push({ ...nota, dias, alerta: false });
    } else if (dias >= config.diasUrgencia) {
      colunas.urgencia.push({ ...nota, dias, alerta: false });
    } else {
      colunas.deposito.push({ ...nota, dias, alerta: dias >= config.diasUrgencia - 1 });
    }
  }

  const maisAntigaPrimeiro = (a: ItemPainel, b: ItemPainel) =>
    a.recebidaEm.getTime() - b.recebidaEm.getTime();
  colunas.ocorrencia.sort(maisAntigaPrimeiro);
  colunas.deposito.sort(maisAntigaPrimeiro);
  colunas.urgencia.sort(maisAntigaPrimeiro);
  return colunas;
}

export function textoDias(dias: number): string {
  if (dias <= 0) return 'hoje';
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
