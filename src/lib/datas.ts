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

const fmtDiaHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const fmtExtenso = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** 20/10 09:15 */
export function formatarDiaHora(d: Date): string {
  const p = Object.fromEntries(fmtDiaHora.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

/** sexta-feira, 23 de outubro */
export const formatarDataExtenso = (d: Date) => fmtExtenso.format(d);

const fmtIso = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data no formato AAAA-MM-DD (o do <input type="date">), no fuso de São Paulo. */
export const dataIsoSP = (d: Date) => fmtIso.format(d);

/**
 * Meia-noite em São Paulo do dia AAAA-MM-DD. São Paulo está em UTC−3 o ano todo
 * (sem horário de verão desde 2019).
 */
export const inicioDoDiaSP = (iso: string) => new Date(`${iso}T00:00:00-03:00`);
