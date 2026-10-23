// Busca do admin. O Firestore não busca por texto: a tela carrega as notas do período
// (poucas por dia) e o filtro de texto e de situação roda aqui, no navegador.
import { formatarCnpj, formatarDocEmitente, formatarNumeroNF, lerChave, semZerosEsquerda } from './chaveAcesso';
import { diasDesde, formatarDataHora } from './datas';
import { ROTULO_SITUACAO, situacaoNota, type NotaPainel, type TipoColuna } from './painel';
import type { Config } from '../tipos/firestore';

export type FiltroSituacao = 'todas' | TipoColuna;

/** Minúsculas e sem acentos, para "São" achar "sao". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** A busca é uma chave completa? Então abre a nota direto, de qualquer período. */
export function chaveDaBusca(texto: string): string | null {
  const r = lerChave(texto);
  return r.ok ? r.dados.chave : null;
}

function bateTexto(nota: NotaPainel, busca: string, nomes: Record<string, string>): boolean {
  const texto = normalizar(busca);
  if (!texto) return true;
  const d = nota.dados;

  // Só números e pontuação: NF (com ou sem zeros) ou parte do CNPJ.
  const digitos = texto.replace(/[\s./-]/g, '');
  if (/^\d+$/.test(digitos)) {
    if (semZerosEsquerda(d.numero).includes(semZerosEsquerda(digitos))) return true;
    return digitos.length >= 3 && d.cnpjEmitente.includes(digitos);
  }

  // Texto: nome do emissor, ou CNPJ alfanumérico.
  const nome = nomes[d.cnpjEmitente];
  if (nome && normalizar(nome).includes(texto)) return true;
  return d.cnpjEmitente.toLowerCase().includes(digitos);
}

export function filtrarNotas(
  notas: NotaPainel[],
  filtro: { texto: string; situacao: FiltroSituacao },
  nomes: Record<string, string>,
  agora: Date,
  config: Config,
): NotaPainel[] {
  return notas
    .filter((n) => filtro.situacao === 'todas' || situacaoNota(n, agora, config) === filtro.situacao)
    .filter((n) => bateTexto(n, filtro.texto, nomes))
    .sort((a, b) => b.recebidaEm.getTime() - a.recebidaEm.getTime());
}

// ---------- Planilha (CSV) ----------

function celula(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * Planilha separada por ";" (o Excel em português abre direto, com as colunas certas).
 * Começa com BOM para os acentos aparecerem corretos.
 */
export function gerarCsv(
  notas: NotaPainel[],
  nomes: Record<string, string>,
  agora: Date,
  config: Config,
): string {
  const cabecalho = ['NF', 'Série', 'Emissor', 'CNPJ/CPF', 'UF', 'Situação', 'Recebida em',
    'Dias parada', 'Saída em', 'Chave de acesso'];
  const linhas = notas.map((n) => {
    const d = n.dados;
    const situacao = situacaoNota(n, agora, config);
    return [
      formatarNumeroNF(d.numero),
      semZerosEsquerda(d.serie),
      nomes[d.cnpjEmitente] ?? '',
      d.tipoDocEmitente === 'cpf' ? formatarDocEmitente(d.cnpjEmitente, 'cpf') : formatarCnpj(d.cnpjEmitente),
      d.siglaUf,
      ROTULO_SITUACAO[situacao],
      formatarDataHora(n.recebidaEm),
      situacao === 'em_rota' ? '' : String(diasDesde(n.recebidaEm, agora)),
      n.saidaEm ? formatarDataHora(n.saidaEm) : '',
      // ="..." faz o Excel tratar como texto (senão mostra 3,5E+43 e perde dígitos).
      `="${d.chave}"`,
    ].map(celula).join(';');
  });
  return '﻿' + [cabecalho.join(';'), ...linhas].join('\r\n');
}
