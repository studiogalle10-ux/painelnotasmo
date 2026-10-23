import { describe, expect, it, vi } from 'vitest';
import { consultarBrasilApi, nomeExibicao } from './emitentes';

const resposta = (status: number, corpo: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch;

describe('consultarBrasilApi', () => {
  it('lê razão social e nome fantasia', async () => {
    const buscar = resposta(200, { razao_social: ' EMPRESA TESTE LTDA ', nome_fantasia: 'TESTE' });
    expect(await consultarBrasilApi('02745352000100', buscar)).toEqual({
      razaoSocial: 'EMPRESA TESTE LTDA',
      nomeFantasia: 'TESTE',
    });
    expect(buscar).toHaveBeenCalledWith('https://brasilapi.com.br/api/cnpj/v1/02745352000100');
  });

  it('nome fantasia vazio vira null', async () => {
    const buscar = resposta(200, { razao_social: 'EMPRESA TESTE LTDA', nome_fantasia: '' });
    expect((await consultarBrasilApi('02745352000100', buscar))?.nomeFantasia).toBeNull();
  });

  it('CNPJ não encontrado ou resposta sem razão social dá null', async () => {
    expect(await consultarBrasilApi('11222333000181', resposta(404, { message: 'não encontrado' })))
      .toBeNull();
    expect(await consultarBrasilApi('11222333000181', resposta(200, {}))).toBeNull();
  });

  it('falha de rede dá null', async () => {
    const buscar = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await consultarBrasilApi('11222333000181', buscar as unknown as typeof fetch)).toBeNull();
  });
});

describe('nomeExibicao', () => {
  it('prefere o nome fantasia', () => {
    expect(nomeExibicao({ razaoSocial: 'EMPRESA LTDA', nomeFantasia: 'EMPRESA' })).toBe('EMPRESA');
  });

  it('usa a razão social sem nome fantasia', () => {
    expect(nomeExibicao({ razaoSocial: 'EMPRESA LTDA', nomeFantasia: null })).toBe('EMPRESA LTDA');
    expect(nomeExibicao({ razaoSocial: 'EMPRESA LTDA', nomeFantasia: '  ' })).toBe('EMPRESA LTDA');
  });
});
