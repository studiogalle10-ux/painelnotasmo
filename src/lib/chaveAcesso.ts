// Parser e validação da chave de acesso da NF-e (44 posições).
// PENDENTE: confirmar na NT 2025.001 (CNPJ alfanumérico) que o DV da chave usa
// valor = código ASCII − 48 para letras, como o DV do CNPJ.

export type TipoDocEmitente = 'cnpj' | 'cpf' | 'invalido';

export interface ChaveNFe {
  chave: string;
  uf: string;
  siglaUf: string;
  aamm: string;
  cnpjEmitente: string;
  /** Produtor rural emite com CPF nas posições do CNPJ, completado com zeros. */
  tipoDocEmitente: TipoDocEmitente;
  modelo: string;
  serie: string;
  numero: string;
  tpEmis: string;
  codigoNumerico: string;
  dv: string;
}

export type ResultadoChave =
  | { ok: true; dados: ChaveNFe }
  | { ok: false; erro: string };

/** Código IBGE da UF → sigla. */
export const UFS: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

/** Tipos de emissão da NF-e (8 não existe; 9 é só NFC-e, mas não atrapalha aceitar). */
const TIPOS_EMISSAO = new Set(['1', '2', '3', '4', '5', '6', '7', '9']);

/** Valor de um caractere: dígitos 0–9; letras pela regra ASCII − 48 (CNPJ alfanumérico). */
function valorCaractere(c: string): number {
  return c.toUpperCase().charCodeAt(0) - 48;
}

/** Módulo 11 da direita para a esquerda, pesos 2..pesoMax em ciclo; resto 0 ou 1 → 0. */
function modulo11(base: string, pesoMax: number): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += valorCaractere(base[i]) * peso;
    peso = peso === pesoMax ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function calcularDV(base43: string): number {
  return modulo11(base43, 9);
}

function todosIguais(s: string): boolean {
  return s.split('').every((c) => c === s[0]);
}

/** CNPJ numérico ou alfanumérico (12 alfanuméricos + 2 dígitos verificadores). */
export function cnpjValido(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || todosIguais(cnpj)) return false;
  const dv1 = modulo11(cnpj.slice(0, 12), 9);
  const dv2 = modulo11(cnpj.slice(0, 12) + dv1, 9);
  return cnpj.slice(12) === `${dv1}${dv2}`;
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || todosIguais(cpf)) return false;
  const dv1 = modulo11(cpf.slice(0, 9), 11);
  const dv2 = modulo11(cpf.slice(0, 9) + dv1, 11);
  return cpf.slice(9) === `${dv1}${dv2}`;
}

/** Na dúvida (os dois válidos), fica CNPJ: existem CNPJs reais que começam com 000. */
export function identificarDocEmitente(campo14: string): TipoDocEmitente {
  if (cnpjValido(campo14)) return 'cnpj';
  if (campo14.startsWith('000') && cpfValido(campo14.slice(3))) return 'cpf';
  return 'invalido';
}

export function lerChave(entrada: string): ResultadoChave {
  const chave = entrada.replace(/[\s.-]/g, '').toUpperCase();

  if (chave.length !== 44) return { ok: false, erro: 'A chave precisa ter 44 caracteres.' };
  // Posições 7–18 do CNPJ podem ter letras; o resto deve ser numérico.
  if (!/^\d{6}[0-9A-Z]{12}\d{26}$/.test(chave)) {
    return { ok: false, erro: 'Caracteres inválidos na chave.' };
  }

  // DV antes do resto: leitura falha deve pedir nova leitura, não dizer "não é NF-e".
  if (calcularDV(chave.slice(0, 43)) !== Number(chave[43])) {
    return { ok: false, erro: 'Dígito verificador inválido. Bipe novamente.' };
  }

  const uf = chave.slice(0, 2);
  const aamm = chave.slice(2, 6);
  const tpEmis = chave.slice(34, 35);
  const mes = Number(aamm.slice(2));
  if (!(uf in UFS) || mes < 1 || mes > 12 || !TIPOS_EMISSAO.has(tpEmis)) {
    return { ok: false, erro: 'Chave inválida. Bipe novamente.' };
  }

  const modelo = chave.slice(20, 22);
  if (modelo !== '55') return { ok: false, erro: 'Não é uma NF-e (modelo 55).' };

  const cnpjEmitente = chave.slice(6, 20);
  return {
    ok: true,
    dados: {
      chave,
      uf,
      siglaUf: UFS[uf],
      aamm,
      cnpjEmitente,
      tipoDocEmitente: identificarDocEmitente(cnpjEmitente),
      modelo,
      serie: chave.slice(22, 25),
      numero: chave.slice(25, 34),
      tpEmis,
      codigoNumerico: chave.slice(35, 43),
      dv: chave.slice(43, 44),
    },
  };
}

// ---------- Formatação para as telas ----------

export function semZerosEsquerda(s: string): string {
  return s.replace(/^0+(?=.)/, '');
}

/** Número da NF para exibir: 000274914 → 274.914. */
export function formatarNumeroNF(numero: string): string {
  return Number(numero).toLocaleString('pt-BR');
}

export function formatarCnpj(cnpj: string): string {
  return cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
}

export function formatarCpf(cpf: string): string {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/** CNPJ/CPF do emitente formatado, usado quando o nome ainda não está no cache. */
export function formatarDocEmitente(campo14: string, tipo: TipoDocEmitente): string {
  return tipo === 'cpf' ? formatarCpf(campo14.slice(3)) : formatarCnpj(campo14);
}
