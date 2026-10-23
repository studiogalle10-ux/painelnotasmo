// Formato dos documentos no Firestore (ver docs/especificacao.md, seção 6).
import type { Timestamp } from 'firebase/firestore';

/** Urgência não é status: é calculada no front a partir de recebidaEm. */
export type StatusNota = 'preparacao' | 'em_rota' | 'baixada';

export type TipoEvento = 'entrada' | 'saida' | 'baixa';

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
  /** Baixa: tirada da TV antes do prazo de "Em rota". */
  baixadaEm?: Timestamp;
  baixadaPor?: string;
  /** Evento gravado junto com a última alteração (exigido pelas regras). */
  ultimoEventoId: string;
}

/** eventos/{id automático} */
export interface Evento {
  chave: string;
  tipo: TipoEvento;
  usuario: string;
  aparelho: string;
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
  diasUrgencia: number;
  /** Depois de quantos dias a nota "Em rota" sai sozinha da TV. */
  diasEmRotaNaTv: number;
}

export const CONFIG_PADRAO: Config = { diasUrgencia: 5, diasEmRotaNaTv: 1 };
