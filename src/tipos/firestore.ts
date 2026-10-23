// Formato dos documentos no Firestore (ver docs/especificacao.md, seção 6).
import type { Timestamp } from 'firebase/firestore';

/** "inativo" = acesso retirado: o login existe, mas não lê nem grava nada. */
export type Papel = 'admin' | 'operador' | 'tv' | 'inativo';

/** Urgência não é status: é calculada no front a partir de recebidaEm. */
export type StatusNota = 'preparacao' | 'em_rota';

export type TipoEvento = 'entrada' | 'saida' | 'estorno' | 'exclusao';

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
  /** Evento gravado junto com a última alteração (exigido pelas regras). */
  ultimoEventoId: string;
}

/** eventos/{id automático}; exclusão usa `${ultimoEventoId}_exclusao`. */
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
  horasEmRotaNaTv: number;
  atualizadoEm?: Timestamp;
  atualizadoPor?: string;
}

export const CONFIG_PADRAO: Config = { diasUrgencia: 5, horasEmRotaNaTv: 24 };

/** usuarios/{uid do Auth} */
export interface Usuario {
  nome: string;
  papel: Papel;
  /** Cópia do e-mail do login, para o admin ver a lista (o navegador não lê o Auth de outros). */
  email?: string;
}
