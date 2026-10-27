// Formato dos documentos no Firestore (ver docs/especificacao.md, seção 6).
import type { Timestamp } from 'firebase/firestore';

/**
 * `preparacao` = está no galpão (colunas Depósito, Em Ocorrência ou Urgência na TV).
 * `em_rota` = saiu (2ª bipagem); não aparece mais na TV.
 * Urgência e ocorrência não são status: a coluna sai de `ocorrencia` e dos dias parada.
 */
export type StatusNota = 'preparacao' | 'em_rota';

/** destino = destino gravado/alterado; ocorrencia = motivo gravado/alterado; resolucao = motivo retirado. */
export type TipoEvento = 'entrada' | 'saida' | 'destino' | 'ocorrencia' | 'resolucao';

/** notas/{chave de 44 caracteres} */
export interface Nota {
  uf: string;
  aamm: string;
  cnpjEmitente: string;
  modelo: '55';
  serie: string;
  numero: string;
  tpEmis: string;
  codigoNumerico: string;
  status: StatusNota;
  recebidaEm: Timestamp;
  recebidaPor: string;
  saidaEm?: Timestamp;
  saidaPor?: string;
  /** Destino da entrega (obrigatório na tela; vem da lista do IBGE). */
  destinoCidade?: string;
  destinoUf?: string;
  destinoIbge?: number;
  /** Motivo de espera escrito pelo operador: a nota vai para "Em Ocorrência". */
  ocorrencia?: string;
  ocorrenciaEm?: Timestamp;
  /** Evento gravado junto com a última alteração (exigido pelas regras). */
  ultimoEventoId: string;
}

/** eventos/{id automático} */
export interface Evento {
  chave: string;
  tipo: TipoEvento;
  usuario: string;
  aparelho: string;
  /** Destino ("Campinas – SP") ou texto da ocorrência, para o histórico. */
  detalhe?: string;
  criadoEm: Timestamp;
}

/** emitentes/{cnpj}: cache da BrasilAPI. */
export interface Emitente {
  razaoSocial: string;
  nomeFantasia?: string | null;
  consultadoEm: Timestamp;
}

/** config/geral */
export interface Config {
  /** Dias parada (sem ocorrência) para ir à coluna Urgência. */
  diasUrgencia: number;
}

export const CONFIG_PADRAO: Config = { diasUrgencia: 4 };
