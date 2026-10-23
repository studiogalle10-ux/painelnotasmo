// Prepara o Emulator com usuários e notas de teste. NÃO usar no projeto real.
// Uso: com `npm run emuladores` rodando, em outro terminal: npm run emuladores:semear
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
import { calcularDV } from '../src/lib/chaveAcesso.ts';

const PROJETO = 'demo-painel-nf-mo';
const AUTH = 'http://127.0.0.1:9099';

// Usuários de teste (só existem no Emulator).
const USUARIOS = [
  { uid: 'admin-teste', email: 'admin@teste.local', senha: 'teste123', nome: 'Admin Teste', papel: 'admin' },
  { uid: 'operador-teste', email: 'operador@teste.local', senha: 'teste123', nome: 'Operador Teste', papel: 'operador' },
  { uid: 'tv-teste', email: 'tv@teste.local', senha: 'teste123', nome: 'TV Galpão', papel: 'tv' },
];

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

// recebidaHa / saidaHa em horas.
const NOTAS = [
  { cnpj: '02745352000100', numero: 274915, recebidaHa: 2 },
  { cnpj: '11222333000181', numero: 1201, recebidaHa: 30 },
  { cnpj: '02745352000100', numero: 274880, recebidaHa: 4 * 24 + 3 },
  { cnpj: '11222333000181', numero: 1150, recebidaHa: 6 * 24 },
  { cnpj: '02745352000100', numero: 274850, recebidaHa: 8 * 24 },
  { cnpj: '11222333000181', numero: 1190, recebidaHa: 26, saidaHa: 1 },
  { cnpj: '02745352000100', numero: 274700, recebidaHa: 3 * 24, saidaHa: 30 },
];

await auth(`/emulator/v1/projects/${PROJETO}/accounts`, 'DELETE');
for (const u of USUARIOS) {
  await auth(`/identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts`, 'POST', {
    localId: u.uid, email: u.email, password: u.senha, displayName: u.nome,
  });
}

const env = await initializeTestEnvironment({
  projectId: PROJETO,
  firestore: { host: '127.0.0.1', port: 8080 },
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const u of USUARIOS) {
    await setDoc(doc(db, 'usuarios', u.uid), { nome: u.nome, papel: u.papel, email: u.email });
  }
  await setDoc(doc(db, 'config', 'geral'), { diasUrgencia: 5, horasEmRotaNaTv: 24 });
  await setDoc(doc(db, 'emitentes', '11222333000181'), {
    razaoSocial: 'DISTRIBUIDORA EXEMPLO LTDA', nomeFantasia: 'Exemplo Distribuidora', consultadoEm: ha(0),
  });

  for (const n of NOTAS) {
    const c = chave(n.cnpj, n.numero);
    const entrada = `semente-${n.numero}-entrada`;
    const saida = `semente-${n.numero}-saida`;
    await setDoc(doc(db, 'eventos', entrada), {
      chave: c, tipo: 'entrada', usuario: 'operador-teste', aparelho: 'semente', criadoEm: ha(n.recebidaHa),
    });
    const nota = {
      uf: '35', aamm: '2610', cnpjEmitente: n.cnpj, modelo: '55', serie: '001',
      numero: c.slice(25, 34), tpEmis: '1', codigoNumerico: c.slice(35, 43),
      status: 'preparacao', recebidaEm: ha(n.recebidaHa), recebidaPor: 'operador-teste',
      ultimoEventoId: entrada,
    };
    if (n.saidaHa !== undefined) {
      await setDoc(doc(db, 'eventos', saida), {
        chave: c, tipo: 'saida', usuario: 'operador-teste', aparelho: 'semente', criadoEm: ha(n.saidaHa),
      });
      Object.assign(nota, {
        status: 'em_rota', saidaEm: ha(n.saidaHa), saidaPor: 'operador-teste', ultimoEventoId: saida,
      });
    }
    await setDoc(doc(db, 'notas', c), nota);
  }
});
await env.cleanup();

console.log(`Emulator preparado: ${USUARIOS.length} usuários e ${NOTAS.length} notas.`);
for (const u of USUARIOS) console.log(`  ${u.papel.padEnd(8)} ${u.email}`);
console.log('Senha de todos: a que está em scripts/semear-emulador.mjs');
