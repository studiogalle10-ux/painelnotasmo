// Datas sempre exibidas no fuso de São Paulo, qualquer que seja o fuso do aparelho.

export const FUSO = 'America/Sao_Paulo';

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  dateStyle: 'short',
  timeStyle: 'short',
});
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, timeStyle: 'short' });

export const formatarDataHora = (d: Date) => fmtDataHora.format(d);
export const formatarData = (d: Date) => fmtData.format(d);
export const formatarHora = (d: Date) => fmtHora.format(d);

const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * Dias completos desde `d` (corridos).
 * PENDENTE: a especificação ainda não decidiu entre dias corridos ou úteis.
 */
export function diasDesde(d: Date, agora: Date = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - d.getTime()) / MS_DIA));
}
