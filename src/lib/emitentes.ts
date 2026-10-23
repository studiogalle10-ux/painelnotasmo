// Nome do emissor: cache em `emitentes/{cnpj}`; se não houver, a BrasilAPI é consultada
// direto do navegador e o resultado vai para o cache. Se falhar, a tela mostra o CNPJ
// formatado e tenta de novo na próxima nota desse CNPJ.
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { TipoDocEmitente } from './chaveAcesso';
import type { Emitente } from '../tipos/firestore';

export interface DadosEmitente {
  razaoSocial: string;
  nomeFantasia: string | null;
}

/** Nome fantasia; se não houver, razão social. */
export function nomeExibicao(e: { razaoSocial: string; nomeFantasia?: string | null }): string {
  return e.nomeFantasia?.trim() || e.razaoSocial;
}

export async function consultarBrasilApi(
  cnpj: string,
  buscar: typeof fetch = fetch,
): Promise<DadosEmitente | null> {
  try {
    const resposta = await buscar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!resposta.ok) return null;
    const json = (await resposta.json()) as { razao_social?: unknown; nome_fantasia?: unknown };
    if (typeof json.razao_social !== 'string' || !json.razao_social.trim()) return null;
    const fantasia = typeof json.nome_fantasia === 'string' ? json.nome_fantasia.trim() : '';
    return {
      razaoSocial: json.razao_social.trim().slice(0, 200),
      nomeFantasia: fantasia ? fantasia.slice(0, 200) : null,
    };
  } catch {
    return null;
  }
}

// Consultas em andamento, para várias notas do mesmo CNPJ não dispararem várias consultas.
const emAndamento = new Map<string, Promise<string | null>>();

/**
 * Devolve o nome do emissor, consultando e gravando o cache quando preciso.
 * `null` quando não deu para descobrir (CPF, CNPJ inválido, BrasilAPI fora do ar).
 */
export function nomeDoEmitente(
  db: Firestore,
  cnpj: string,
  tipo: TipoDocEmitente,
  buscar: typeof fetch = fetch,
): Promise<string | null> {
  if (tipo !== 'cnpj') return Promise.resolve(null);
  const andamento = emAndamento.get(cnpj);
  if (andamento) return andamento;

  const promessa = (async () => {
    const ref = doc(db, 'emitentes', cnpj);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) return nomeExibicao(snap.data() as Emitente);
    } catch {
      // Sem cache disponível: tenta a BrasilAPI mesmo assim.
    }

    const dados = await consultarBrasilApi(cnpj, buscar);
    if (!dados) return null;
    try {
      await setDoc(ref, { ...dados, consultadoEm: serverTimestamp() });
    } catch {
      // O nome aparece nesta sessão mesmo se o cache não for gravado.
    }
    return nomeExibicao(dados);
  })().finally(() => emAndamento.delete(cnpj));

  emAndamento.set(cnpj, promessa);
  return promessa;
}
