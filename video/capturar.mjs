// Tira as telas do vídeo no ambiente de TESTE (Emulator + `npm run dev`), nunca no site real.
// Uso: com o Emulator semeado (npm run emuladores:semear) e o Vite em :5173 → npm run telas
import fs from 'fs';
import puppeteer from 'puppeteer-core';

const SITE = 'http://localhost:5173';
const SAIDA = 'saida/telas';
const NAVEGADOR = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CHAVE = '35261002745352000100550010002749141153853870'; // NF 274.914 (não está na semente)
const OUTRA = '35261011222333000181550010000123451123456784';

// Conta de teste do Emulator: a mesma da semente.
const semente = fs.readFileSync('../scripts/semear-emulador.mjs', 'utf8');
const USUARIO = 'motransportes';
const SENHA = /senha: '([^']+)'/.exec(semente)[1];

fs.mkdirSync(SAIDA, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const caixas = {};

/** Retângulo (px da tela) do primeiro elemento do seletor; com `texto`, o que contém o texto. */
function retangulo(pagina, seletor, texto) {
  return pagina.evaluate((s, t) => {
    const el = [...document.querySelectorAll(s)].find((e) => !t || e.textContent.includes(t));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, seletor, texto ?? null);
}

async function foto(pagina, nome, alvos = {}) {
  await espera(500);
  await pagina.screenshot({ path: `${SAIDA}/${nome}.png` });
  const vp = pagina.viewport();
  const r = { largura: vp.width, altura: vp.height, caixas: {} };
  for (const [k, [sel, texto]] of Object.entries(alvos)) {
    r.caixas[k] = await retangulo(pagina, sel, texto);
    if (!r.caixas[k]) console.warn(`  ! ${nome}: não achei ${k}`);
  }
  caixas[nome] = r;
  console.log('tela', nome);
}

async function rolarAte(pagina, seletor) {
  await pagina.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), seletor);
  await espera(300);
}

const navegador = await puppeteer.launch({ executablePath: NAVEGADOR, headless: true, userDataDir: fs.realpathSync('.') + '/saida/perfil-navegador', args: ['--lang=pt-BR', '--no-first-run'] });
try {
  const bipar = await navegador.newPage();
  await bipar.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });

  // Login
  await bipar.goto(`${SITE}/login`, { waitUntil: 'domcontentloaded' });
  await bipar.waitForSelector('input[type=password]');
  await bipar.type('input[type=text]', USUARIO, { delay: 20 });
  await bipar.type('input[type=password]', SENHA, { delay: 20 });
  await foto(bipar, 'login', {
    usuario: ['label', 'Usuário'], senha: ['label', 'Senha'], entrar: ['button[type=submit]'],
  });
  await bipar.click('button[type=submit]');
  await bipar.waitForSelector('.campo-leitura');
  await espera(2500);
  if (await bipar.$('.ativar-som')) await bipar.click('.ativar-som');

  // Tela de bipar
  await foto(bipar, 'bipar', {
    campo: ['.campo-leitura'], abrirTv: ['button', 'Abrir TV'], digitar: ['button', 'Código danificado'],
  });

  // 1ª bipagem (leitor = teclas rápidas + Enter)
  await bipar.focus('.campo-leitura');
  await bipar.keyboard.type(CHAVE, { delay: 3 });
  await bipar.keyboard.press('Enter');
  await bipar.waitForSelector('.quadro');
  await espera(3000); // nome do emissor (BrasilAPI)
  await foto(bipar, 'entrada', { resultado: ['.resultado'], quadro: ['.quadro'] });

  // Destino
  await bipar.keyboard.type('campinas', { delay: 120 });
  await bipar.waitForSelector('.cidade-sugestoes');
  await foto(bipar, 'cidade', { campo: ['.campo-cidade input'], lista: ['.cidade-sugestoes'] });
  await bipar.keyboard.press('Enter');

  // Ocorrência
  await bipar.click('.quadro textarea');
  await bipar.keyboard.type('Falta volume, aguardando fornecedor', { delay: 70 });
  await foto(bipar, 'ocorrencia', {
    escolhido: ['.quadro-escolhido'], ocorrencia: ['.quadro textarea'], salvar: ['.quadro button[type=submit]'],
  });

  // Bipagem com o quadro aberto: não conta
  await bipar.keyboard.type(OUTRA, { delay: 3 });
  await bipar.keyboard.press('Enter');
  await espera(800);
  await foto(bipar, 'bloqueio', { resultado: ['.resultado'], quadro: ['.quadro'] });

  // Salva e mostra a lista "No depósito"
  await bipar.click('.quadro button[type=submit]');
  await bipar.waitForSelector('.quadro', { hidden: true });
  await rolarAte(bipar, '.ultimas');
  await foto(bipar, 'salvo', {
    lista: ['.ultimas'],
    semDestino: ['li.deposito', 'SEM DESTINO'],
    comOcorrencia: ['li.deposito', 'Falta volume'],
  });

  // TV
  const tv = await navegador.newPage();
  await tv.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await tv.goto(`${SITE}/tv`, { waitUntil: 'domcontentloaded' });
  await tv.waitForSelector('li.cartao');
  await espera(3500);
  await foto(tv, 'tv', {
    colOcorrencia: ['.coluna-ocorrencia'], colDeposito: ['.coluna-deposito'], colUrgencia: ['.coluna-urgencia'],
    cartaoNormal: ['li.cartao', '1.201'], cartaoAlerta: ['li.cartao-alerta'],
  });

  // 2ª bipagem
  await bipar.bringToFront();
  await bipar.evaluate(() => window.scrollTo(0, 0));
  await bipar.focus('.campo-leitura');
  await espera(11000); // a mesma chave em menos de 10 s é ignorada (repetição do leitor)
  await bipar.keyboard.type(CHAVE, { delay: 3 });
  await bipar.keyboard.press('Enter');
  await bipar.waitForSelector('.resultado-saida');
  await espera(1500);
  await foto(bipar, 'saida', { resultado: ['.resultado'] });

  fs.writeFileSync(`${SAIDA}/caixas.json`, JSON.stringify(caixas, null, 2));
} finally {
  await navegador.close();
}
