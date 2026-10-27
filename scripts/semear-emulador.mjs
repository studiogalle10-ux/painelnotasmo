// Prepara o Emulator com a conta do painel e notas de teste. NÃO usar no projeto real.
// Uso: com `npm run emuladores` rodando, em outro terminal: npm run emuladores:semear
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
import { calcularDV } from '../src/lib/chaveAcesso.ts';

const PROJETO = 'demo-painel-nf-mo';
const AUTH = 'http://127.0.0.1:9099';

// Conta do painel (mesmo e-mail de EMAIL_PAINEL em src/lib/firebase.ts). Só existe no Emulator.
const PAINEL = { uid: 'painel', email: 'painel@painelmotnsp.firebaseapp.com', senha: 'teste123' };

async function auth(caminho, metodo, corpo) {
  const r = await fetch(`${AUTH}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error(`Auth Emulator ${metodo} ${caminho}: ${r.status} ${await r.text()}`);
}

const chave = (cnpj, numero) => {
  const base = `352610${cnpj}55001${String(numero).padStart(9, '0')}1${String(numero).padStart(8, '0')}`;
  return base + calcularDV(base);
};

const HORA = 60 * 60 * 1000;
const agora = Date.now();
const ha = (horas) => Timestamp.fromMillis(agora - horas * HORA);

const CAMPINAS = ['Campinas', 'SP', 3509502];
const CURITIBA = ['Curitiba', 'PR', 4106902];
const BH = ['Belo Horizonte', 'MG', 3106200];

// recebidaHa / saidaHa em horas; destino [cidade, UF, IBGE]; sem destino = esqueceram de preencher.
const NOTAS = [
  { cnpj: '02745352000100', numero: 274915, recebidaHa: 2, destino: CAMPINAS },
  { cnpj: '11222333000181', numero: 1201, recebidaHa: 30, destino: CURITIBA },
  { cnpj: '02745352000100', numero: 274880, recebidaHa: 3 * 24 + 3, destino: BH },
  { cnpj: '11222333000181', numero: 1150, recebidaHa: 6 * 24, destino: CAMPINAS },
  { cnpj: '02745352000100', numero: 274850, recebidaHa: 8 * 24, destino: CURITIBA,
    ocorrencia: 'Aguardando agendamento do cliente' },
  { cnpj: '11222333000181', numero: 1160, recebidaHa: 5 },
  { cnpj: '11222333000181', numero: 1190, recebidaHa: 26, saidaHa: 1 },
  { cnpj: '02745352000100', numero: 274700, recebidaHa: 3 * 24, saidaHa: 30 },
];

await auth(`/emulator/v1/projects/${PROJETO}/accounts`, 'DELETE');
await auth(`/identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts`, 'POST', {
  localId: PAINEL.uid, email: PAINEL.email, password: PAINEL.senha,
});

const env = await initializeTestEnvironment({
  projectId: PROJETO,
  firestore: { host: '127.0.0.1', port: 8080 },
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'config', 'geral'), { diasUrgencia: 4 });
  await setDoc(doc(db, 'emitentes', '11222333000181'), {
    razaoSocial: 'DISTRIBUIDORA EXEMPLO LTDA', nomeFantasia: 'Exemplo Distribuidora', consultadoEm: ha(0),
  });

  for (const n of NOTAS) {
    const c = chave(n.cnpj, n.numero);
    const entrada = `semente-${n.numero}-entrada`;
    const saida = `semente-${n.numero}-saida`;
    await setDoc(doc(db, 'eventos', entrada), {
      chave: c, tipo: 'entrada', usuario: 'painel', aparelho: 'semente', criadoEm: ha(n.recebidaHa),
    });
    const nota = {
      uf: '35', aamm: '2610', cnpjEmitente: n.cnpj, modelo: '55', serie: '001',
      numero: c.slice(25, 34), tpEmis: '1', codigoNumerico: c.slice(35, 43),
      status: 'preparacao', recebidaEm: ha(n.recebidaHa), recebidaPor: 'painel',
      ultimoEventoId: entrada,
      ...(n.destino ? { destinoCidade: n.destino[0], destinoUf: n.destino[1], destinoIbge: n.destino[2] } : {}),
      ...(n.ocorrencia ? { ocorrencia: n.ocorrencia, ocorrenciaEm: ha(1) } : {}),
    };
    if (n.saidaHa !== undefined) {
      await setDoc(doc(db, 'eventos', saida), {
        chave: c, tipo: 'saida', usuario: 'painel', aparelho: 'semente', criadoEm: ha(n.saidaHa),
      });
      Object.assign(nota, {
        status: 'em_rota', saidaEm: ha(n.saidaHa), saidaPor: 'painel', ultimoEventoId: saida,
      });
    }
    await setDoc(doc(db, 'notas', c), nota);
  }
});
await env.cleanup();

console.log(`Emulator preparado: conta do painel e ${NOTAS.length} notas.`);
console.log('Senha: a que está em scripts/semear-emulador.mjs');
