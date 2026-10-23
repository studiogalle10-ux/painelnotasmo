import { describe, expect, it } from 'vitest';
import {
  calcularDV,
  cnpjValido,
  cpfValido,
  formatarCnpj,
  formatarCpf,
  formatarDocEmitente,
  identificarDocEmitente,
  lerChave,
  semZerosEsquerda,
  type ResultadoChave,
} from './chaveAcesso';

// Chaves fixas com o DV calculado fora do parser, para o teste não conferir o código
// com ele mesmo. Formato: UF + AAMM + documento + modelo + série 001 + número
// 000012345 + tpEmis + código 12345678 + DV.
const CHAVES = {
  /** DANFE real (SP, out/2026). */
  real: '35261002745352000100550010002749141153853870',
  numerico: '35261011222333000181550010000123451123456784',
  alfanumerico: '35261012ABC34501DE35550010000123451123456785',
  cpf: '31261000052998224725550010000123451123456787',
  /** Banco do Brasil: CNPJ real que começa com 000. */
  bancoBrasil: '53261000000000000191550010000123451123456782',
  docInvalido: '35261011222333000199550010000123451123456787',
  modelo65: '35261011222333000181650010000123451123456787',
  uf99: '99261011222333000181550010000123451123456781',
  mes13: '35261311222333000181550010000123451123456785',
  mes00: '35260011222333000181550010000123451123456781',
  tpEmis0: '35261011222333000181550010000123450123456786',
  tpEmis8: '35261011222333000181550010000123458123456781',
};

const ERRO_DV = 'Dígito verificador inválido. Bipe novamente.';
const ERRO_CAMPOS = 'Chave inválida. Bipe novamente.';
const ERRO_MODELO = 'Não é uma NF-e (modelo 55).';
const ERRO_TAMANHO = 'A chave precisa ter 44 caracteres.';
const ERRO_CARACTERES = 'Caracteres inválidos na chave.';

function dados(r: ResultadoChave) {
  if (!r.ok) throw new Error(`esperava chave válida, veio: ${r.erro}`);
  return r.dados;
}

function erro(r: ResultadoChave) {
  if (r.ok) throw new Error('esperava erro, veio chave válida');
  return r.erro;
}

/** Troca o caractere da posição (1 a 44). */
function trocar(chave: string, posicao: number, c: string) {
  return chave.slice(0, posicao - 1) + c + chave.slice(posicao);
}

describe('lerChave: chaves válidas', () => {
  it('lê a chave de um DANFE real e separa os campos', () => {
    expect(dados(lerChave(CHAVES.real))).toEqual({
      chave: CHAVES.real,
      uf: '35',
      siglaUf: 'SP',
      aamm: '2610',
      cnpjEmitente: '02745352000100',
      tipoDocEmitente: 'cnpj',
      modelo: '55',
      serie: '001',
      numero: '000274914',
      tpEmis: '1',
      codigoNumerico: '15385387',
      dv: '0',
    });
  });

  it('aceita CNPJ numérico', () => {
    const d = dados(lerChave(CHAVES.numerico));
    expect(d.cnpjEmitente).toBe('11222333000181');
    expect(d.tipoDocEmitente).toBe('cnpj');
  });

  it('ignora espaços, pontos e hífens (chave como impressa no DANFE)', () => {
    const impressa = CHAVES.real.replace(/(.{4})/g, '$1 ').trim();
    expect(impressa).toBe('3526 1002 7453 5200 0100 5500 1000 2749 1411 5385 3870');
    expect(dados(lerChave(impressa)).chave).toBe(CHAVES.real);
    expect(dados(lerChave(`  ${CHAVES.real}\n`)).chave).toBe(CHAVES.real);
    expect(dados(lerChave('3526.1002-7453 5200.0100-5500 1000 2749 1411 5385 3870')).chave)
      .toBe(CHAVES.real);
  });
});

describe('lerChave: dígito verificador', () => {
  it('rejeita um dígito trocado no meio da chave', () => {
    expect(erro(lerChave(trocar(CHAVES.real, 30, '8')))).toBe(ERRO_DV);
  });

  it('rejeita dois dígitos vizinhos invertidos', () => {
    const invertida = CHAVES.real.slice(0, 30) + CHAVES.real[31] + CHAVES.real[30]
      + CHAVES.real.slice(32);
    expect(invertida).not.toBe(CHAVES.real);
    expect(erro(lerChave(invertida))).toBe(ERRO_DV);
  });

  it('rejeita o próprio DV errado', () => {
    for (const dv of '123456789') {
      expect(erro(lerChave(trocar(CHAVES.real, 44, dv)))).toBe(ERRO_DV);
    }
  });

  it('confere o DV calculado das chaves fixas', () => {
    for (const chave of Object.values(CHAVES)) {
      expect(calcularDV(chave.slice(0, 43))).toBe(Number(chave[43]));
    }
  });

  // Limitação do módulo 11: restos 0 e 1 viram o mesmo DV (0), então algumas trocas de um
  // dígito passam. Aqui a série 001 vira 901 e a chave continua "válida".
  it('limitação conhecida: algumas trocas de um dígito não são detectadas', () => {
    const trocada = trocar(CHAVES.real, 23, '9');
    expect(dados(lerChave(trocada)).serie).toBe('901');
  });
});

describe('lerChave: modelo', () => {
  it('rejeita NFC-e (modelo 65) com DV correto', () => {
    expect(erro(lerChave(CHAVES.modelo65))).toBe(ERRO_MODELO);
  });

  it('confere o DV antes do modelo: leitura falha pede nova leitura', () => {
    expect(erro(lerChave(trocar(CHAVES.modelo65, 44, '0')))).toBe(ERRO_DV);
  });
});

describe('lerChave: tamanho e caracteres', () => {
  it('rejeita 43 e 45 caracteres', () => {
    expect(erro(lerChave(CHAVES.real.slice(0, 43)))).toBe(ERRO_TAMANHO);
    expect(erro(lerChave(CHAVES.real + '0'))).toBe(ERRO_TAMANHO);
  });

  it('rejeita entrada vazia', () => {
    expect(erro(lerChave(''))).toBe(ERRO_TAMANHO);
    expect(erro(lerChave('   '))).toBe(ERRO_TAMANHO);
  });

  it('rejeita chave com texto a mais', () => {
    expect(erro(lerChave(`NF ${CHAVES.real}`))).toBe(ERRO_TAMANHO);
  });

  it('rejeita letra fora das posições do CNPJ', () => {
    expect(erro(lerChave(trocar(CHAVES.real, 1, 'A')))).toBe(ERRO_CARACTERES);
    expect(erro(lerChave(trocar(CHAVES.real, 30, 'A')))).toBe(ERRO_CARACTERES);
  });

  it('rejeita letra nos dois dígitos verificadores do CNPJ (posições 19 e 20)', () => {
    expect(erro(lerChave(trocar(CHAVES.alfanumerico, 19, 'A')))).toBe(ERRO_CARACTERES);
    expect(erro(lerChave(trocar(CHAVES.alfanumerico, 20, 'A')))).toBe(ERRO_CARACTERES);
  });

  it('rejeita outros símbolos', () => {
    expect(erro(lerChave(trocar(CHAVES.real, 30, '/')))).toBe(ERRO_CARACTERES);
  });
});

describe('lerChave: CNPJ alfanumérico', () => {
  // PENDENTE: confirmar na NT 2025.001 que o DV da chave usa ASCII − 48 para letras.
  it('aceita a chave com o CNPJ de exemplo da Receita (12.ABC.345/01DE-35)', () => {
    const d = dados(lerChave(CHAVES.alfanumerico));
    expect(d.cnpjEmitente).toBe('12ABC34501DE35');
    expect(d.tipoDocEmitente).toBe('cnpj');
  });

  it('aceita letras minúsculas', () => {
    expect(dados(lerChave(CHAVES.alfanumerico.toLowerCase())).chave).toBe(CHAVES.alfanumerico);
  });
});

describe('lerChave: campos impossíveis', () => {
  it('rejeita UF inexistente', () => {
    expect(erro(lerChave(CHAVES.uf99))).toBe(ERRO_CAMPOS);
  });

  it('rejeita mês 00 e 13', () => {
    expect(erro(lerChave(CHAVES.mes00))).toBe(ERRO_CAMPOS);
    expect(erro(lerChave(CHAVES.mes13))).toBe(ERRO_CAMPOS);
  });

  it('rejeita tipo de emissão 0 e 8', () => {
    expect(erro(lerChave(CHAVES.tpEmis0))).toBe(ERRO_CAMPOS);
    expect(erro(lerChave(CHAVES.tpEmis8))).toBe(ERRO_CAMPOS);
  });
});

describe('lerChave: documento do emitente', () => {
  it('identifica CPF (produtor rural) completado com zeros', () => {
    const d = dados(lerChave(CHAVES.cpf));
    expect(d.tipoDocEmitente).toBe('cpf');
    expect(d.siglaUf).toBe('MG');
  });

  it('mantém como CNPJ um CNPJ real que começa com 000', () => {
    const d = dados(lerChave(CHAVES.bancoBrasil));
    expect(d.tipoDocEmitente).toBe('cnpj');
    expect(d.siglaUf).toBe('DF');
  });

  it('aceita a nota com documento inválido, só marcando como invalido', () => {
    expect(dados(lerChave(CHAVES.docInvalido)).tipoDocEmitente).toBe('invalido');
  });
});

describe('validação de CNPJ e CPF', () => {
  it('cnpjValido', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('02745352000100')).toBe(true);
    expect(cnpjValido('12ABC34501DE35')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false);
  });

  it('cpfValido', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('52998224726')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('00000000000')).toBe(false);
    expect(cpfValido('5299822472')).toBe(false);
  });

  it('identificarDocEmitente', () => {
    expect(identificarDocEmitente('11222333000181')).toBe('cnpj');
    expect(identificarDocEmitente('00052998224725')).toBe('cpf');
    expect(identificarDocEmitente('00000000000191')).toBe('cnpj');
    expect(identificarDocEmitente('11222333000199')).toBe('invalido');
  });
});

describe('formatação', () => {
  it('formata CNPJ numérico e alfanumérico', () => {
    expect(formatarCnpj('02745352000100')).toBe('02.745.352/0001-00');
    expect(formatarCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  });

  it('formata CPF', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('formata o documento do emitente conforme o tipo', () => {
    expect(formatarDocEmitente('00052998224725', 'cpf')).toBe('529.982.247-25');
    expect(formatarDocEmitente('11222333000181', 'cnpj')).toBe('11.222.333/0001-81');
    expect(formatarDocEmitente('11222333000199', 'invalido')).toBe('11.222.333/0001-99');
  });

  it('tira zeros à esquerda de número e série', () => {
    expect(semZerosEsquerda('000274914')).toBe('274914');
    expect(semZerosEsquerda('001')).toBe('1');
    expect(semZerosEsquerda('000')).toBe('0');
    expect(semZerosEsquerda('100')).toBe('100');
  });
});
