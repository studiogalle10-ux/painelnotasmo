// Monta o vídeo tutorial: cenas (HTML → PNG), narração (voz do Windows) e animação (ffmpeg).
// Uso: depois de `npm run telas` → npm run video  (saída: saida/tutorial-painel-nfs.mp4)
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import puppeteer from 'puppeteer-core';
import ffmpeg from 'ffmpeg-static';
import { CENAS } from './roteiro.mjs';

const NAVEGADOR = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAIDA = path.resolve('saida');
const TELAS = path.join(SAIDA, 'telas');
const CENAS_DIR = path.join(SAIDA, 'cenas');
const FINAL = path.join(SAIDA, 'tutorial-painel-nfs.mp4');
const FPS = 30;
const ANTES = 0.4; // silêncio antes da fala
const DEPOIS = 0.7; // respiro depois da fala
const caixas = JSON.parse(fs.readFileSync(path.join(TELAS, 'caixas.json'), 'utf8'));

fs.rmSync(CENAS_DIR, { recursive: true, force: true });
fs.mkdirSync(CENAS_DIR, { recursive: true });

// ---------- Narração ----------
fs.writeFileSync(path.join(CENAS_DIR, 'falas.json'), JSON.stringify(CENAS.map(({ id, fala }) => ({ id, fala }))), 'utf8');
rodar('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'narrar.ps1', path.join(CENAS_DIR, 'falas.json'), CENAS_DIR]);

// Voz gravada em outro site (vozes/01.mp3 … 16.mp3, na ordem do roteiro) substitui a do Windows.
const VOZES = path.resolve('vozes');
CENAS.forEach((cena, i) => {
  const numero = String(i + 1).padStart(2, '0');
  const gravada = ['mp3', 'wav', 'm4a'].map((ext) => path.join(VOZES, `${numero}.${ext}`)).find((a) => fs.existsSync(a));
  if (!gravada) return;
  rodar(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', gravada,
    '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', path.join(CENAS_DIR, `${cena.id}.wav`)]);
  console.log(`voz gravada: ${numero} (${cena.id})`);
});

/** Duração de um WAV PCM (lê o cabeçalho). */
function duracaoWav(arquivo) {
  const b = fs.readFileSync(arquivo);
  const bytesPorSeg = b.readUInt32LE(28);
  let i = 12;
  while (i < b.length - 8) {
    const id = b.toString('ascii', i, i + 4);
    const tam = b.readUInt32LE(i + 4);
    if (id === 'data') return tam / bytesPorSeg;
    i += 8 + tam;
  }
  throw new Error(`WAV sem dados: ${arquivo}`);
}

// ---------- Cenas em HTML ----------
const AZUL = '#3b82f6';
const FUNDO = '#0f1117';

function logo(largura) {
  return `<svg viewBox="0 0 280 64" style="width:${largura}px;color:#e5e7eb;display:block">
    <defs>
      <linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9cdd4"/></linearGradient>
      <linearGradient id="a" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
    </defs>
    <polygon points="4,4 30,4 63,60 49,60" fill="url(#c)" stroke="url(#c)" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="82,4 108,4 63,60 49,60" fill="url(#a)" stroke="url(#a)" stroke-width="3" stroke-linejoin="round"/>
    <path d="M128 14 L144 50 L160 14 M168 50 L184 14 L200 50 M211 50 V14 H226 A9 9 0 0 1 226 32 H211 M223 32 L236 50 M242 14 H274 M258 14 V50" fill="none" stroke="currentColor" stroke-width="7"/>
  </svg>`;
}
const iconeV = (t) => `<svg viewBox="0 0 64 64" style="width:${t}px;height:${t}px;display:block"><defs><linearGradient id="ic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9cdd4"/></linearGradient><linearGradient id="ia" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><rect width="64" height="64" rx="12" fill="#0f1117"/><g transform="translate(3 15.5) scale(0.52)"><polygon points="4,4 30,4 63,60 49,60" fill="url(#ic)"/><polygon points="82,4 108,4 63,60 49,60" fill="url(#ia)"/></g></svg>`;

const BASE_CSS = `*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;color:#e5e7eb}
.fundo{position:absolute;inset:0;background:radial-gradient(1200px 700px at 75% 15%,rgba(59,130,246,.16),transparent 60%),radial-gradient(900px 600px at 10% 100%,rgba(59,130,246,.10),transparent 60%),${FUNDO}}
.painel{position:absolute;border-radius:18px;overflow:hidden;border:1px solid #2a2f3d;box-shadow:0 30px 80px rgba(0,0,0,.55)}
.painel img{display:block;width:100%;height:100%}
.destaque{position:absolute;border:5px solid ${AZUL};border-radius:14px;box-shadow:0 0 0 8px rgba(59,130,246,.28),0 0 40px rgba(59,130,246,.55)}`;

const AREA = { x: 120, y: 165, w: 1680, h: 740 };

/** Base de cena com tela capturada: posição do painel e das caixas em px do slide. */
function layoutTela(nome) {
  const c = caixas[nome];
  const s = Math.min(AREA.w / c.largura, AREA.h / c.altura);
  const w = c.largura * s, h = c.altura * s;
  const x = (1920 - w) / 2, y = AREA.y + (AREA.h - h) / 2;
  const caixa = (k) => {
    const b = c.caixas[k];
    if (!b) throw new Error(`Caixa ${k} não existe na tela ${nome}`);
    return { x: x + b.x * s, y: y + b.y * s, w: b.w * s, h: b.h * s };
  };
  return { x, y, w, h, caixa };
}

function htmlTela(cena) {
  const l = layoutTela(cena.tela);
  const folga = 10;
  const destaques = (cena.destaques ?? []).map((k) => {
    const b = l.caixa(k);
    return `<div class="destaque" style="left:${b.x - folga}px;top:${b.y - folga}px;width:${b.w + 2 * folga}px;height:${b.h + 2 * folga}px"></div>`;
  }).join('');
  const img = pathToFileURL(path.join(TELAS, `${cena.tela}.png`)).href;
  return {
    html: `<div class="fundo"></div><div class="painel" style="left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px"><img src="${img}"></div>${destaques}`,
    foco: cena.foco ? l.caixa(cena.foco) : null,
  };
}

function htmlAbertura() {
  return { html: `<div class="fundo"></div>
    <div style="position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:34px;text-align:center">
      ${logo(820)}
      <div style="font-size:30px;letter-spacing:.42em;color:#9ca3af;text-transform:uppercase">Tecnologia que impulsiona o seu amanhã</div>
      <div style="margin-top:40px;font-size:76px;font-weight:700">Painel de NFs</div>
      <div style="font-size:40px;color:#9ca3af">Como usar · MO Transportes</div>
    </div>` };
}

function htmlFim() {
  return { html: `<div class="fundo"></div>
    <div style="position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:30px;text-align:center">
      ${logo(560)}
      <div style="margin-top:50px;font-size:60px;font-weight:700">Dúvidas? Fale com o suporte</div>
      <div style="font-size:48px;color:${AZUL};font-weight:600">sac.vart@hotmail.com</div>
      <div style="font-size:48px;color:${AZUL};font-weight:600">vart.tecn@gmail.com</div>
      <div style="margin-top:30px;font-size:32px;color:#9ca3af">Vart Soluções em Tecnologia e Eficiência</div>
    </div>` };
}

function htmlInstalar() {
  const tela = pathToFileURL(path.join(TELAS, 'bipar.png')).href;
  const icone = { x: 1574, y: 266, w: 64, h: 56 };
  return {
    foco: { x: 1200, y: 266, w: 520, h: 420 },
    html: `<div class="fundo"></div>
    <div class="painel" style="left:200px;top:190px;width:1520px;height:720px;background:#1f2330">
      <div style="height:56px;background:#14161d;display:flex;align-items:flex-end;padding-left:16px">
        <div style="height:44px;width:380px;background:#1f2330;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px;padding:0 16px;font-size:22px">${iconeV(26)} Painel de NFs — VART</div>
      </div>
      <div style="height:76px;display:flex;align-items:center;gap:16px;padding:0 20px;border-bottom:1px solid #2a2f3d">
        <div style="font-size:30px;color:#9ca3af">←&nbsp; →&nbsp; ⟳</div>
        <div style="flex:1;height:52px;border-radius:26px;background:#14161d;display:flex;align-items:center;padding:0 24px;font-size:26px;gap:14px"><span style="color:#9ca3af">🔒</span> painelmotnsp.web.app<span style="color:#9ca3af">/bipar</span></div>
      </div>
      <img src="${tela}" style="width:100%;height:auto;opacity:.35">
    </div>
    <div style="position:absolute;left:${icone.x}px;top:${icone.y}px;width:${icone.w}px;height:${icone.h}px;display:grid;place-items:center">
      <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#e5e7eb" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 7v6M9 10l3 3 3-3M8 20h8"/></svg>
    </div>
    <div class="destaque" style="left:${icone.x - 8}px;top:${icone.y - 8}px;width:${icone.w + 16}px;height:${icone.h + 16}px"></div>
    <div style="position:absolute;left:1200px;top:350px;width:520px;padding:30px;border-radius:16px;background:#262b38;box-shadow:0 20px 60px rgba(0,0,0,.6);display:grid;gap:22px">
      <div style="font-size:32px;font-weight:600">Instalar app?</div>
      <div style="display:flex;gap:18px;align-items:center">${iconeV(64)}<div><div style="font-size:28px">Painel de NFs — VART</div><div style="font-size:22px;color:#9ca3af">painelmotnsp.web.app</div></div></div>
      <div style="display:flex;justify-content:flex-end;gap:14px;font-size:24px">
        <span style="padding:12px 26px;border-radius:24px;background:${AZUL};color:#fff;font-weight:600;box-shadow:0 0 0 6px rgba(59,130,246,.3)">Instalar</span>
        <span style="padding:12px 26px;border-radius:24px;border:1px solid #4b5563">Cancelar</span>
      </div>
    </div>`,
  };
}

function htmlFixar() {
  const menu = { x: 700, y: 330, w: 560, h: 470 };
  const item = (txt, extra = '') => `<div style="padding:16px 24px;font-size:28px;display:flex;gap:16px;align-items:center;border-radius:10px;${extra}">${txt}</div>`;
  return {
    foco: menu,
    html: `<div class="fundo"></div>
    <div style="position:absolute;left:${menu.x}px;top:${menu.y}px;width:${menu.w}px;padding:12px;border-radius:16px;background:#262b38;box-shadow:0 20px 60px rgba(0,0,0,.6)">
      <div style="padding:10px 24px;font-size:22px;color:#9ca3af">Tarefas</div>
      ${item(`${iconeV(34)} Bipar`)}
      ${item(`${iconeV(34)} Abrir TV`)}
      <div style="height:1px;background:#3a4050;margin:8px 0"></div>
      ${item(`${iconeV(34)} Painel de NFs`)}
      ${item('📌&nbsp; Fixar na barra de tarefas', `background:rgba(59,130,246,.22);outline:4px solid ${AZUL};font-weight:600`)}
      ${item('✕&nbsp; Fechar janela', 'color:#9ca3af')}
    </div>
    <div style="position:absolute;left:0;right:0;top:830px;height:84px;background:rgba(20,22,29,.92);border-top:1px solid #2a2f3d;display:flex;justify-content:center;align-items:center;gap:26px">
      <div style="width:56px;height:56px;border-radius:10px;background:#1f2a44;display:grid;place-items:center;font-size:34px;color:#60a5fa">⊞</div>
      <div style="width:56px;height:56px;border-radius:10px;background:#262b38;display:grid;place-items:center;font-size:28px">🔍</div>
      <div style="width:56px;height:56px;border-radius:10px;background:#262b38;display:grid;place-items:center;font-size:28px">📁</div>
      <div style="width:66px;height:66px;border-radius:12px;display:grid;place-items:center;outline:4px solid ${AZUL};box-shadow:0 0 30px rgba(59,130,246,.6)">${iconeV(54)}</div>
    </div>`,
  };
}

/** Moldura fixa por cima da animação: título, número do passo e legenda. */
function htmlMoldura(cena, n, total) {
  const topo = cena.titulo ? `
    <div style="position:absolute;left:0;right:0;top:0;height:160px;background:linear-gradient(${FUNDO} 70%,rgba(15,17,23,0))"></div>
    <div style="position:absolute;left:120px;top:44px;display:flex;align-items:center;gap:26px">
      ${iconeV(64)}
      <div style="font-size:52px;font-weight:700">${cena.titulo}</div>
    </div>
    <div style="position:absolute;right:120px;top:58px;font-size:30px;color:#9ca3af">${n} / ${total}</div>` : '';
  const legenda = cena.legenda ? `
    <div style="position:absolute;left:0;right:0;bottom:0;height:200px;background:linear-gradient(rgba(15,17,23,0),${FUNDO} 45%)"></div>
    <div style="position:absolute;left:50%;bottom:46px;transform:translateX(-50%);white-space:nowrap;padding:18px 40px;border-radius:999px;background:rgba(24,27,37,.95);border:2px solid ${AZUL};font-size:38px;font-weight:600">${cena.legenda}</div>` : '';
  return topo + legenda;
}

const pagina = (corpo, transparente) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${transparente ? 'body{background:transparent}' : `body{background:${FUNDO}}`}</style></head><body>${corpo}</body></html>`;

// ---------- Renderização ----------
const navegador = await puppeteer.launch({
  executablePath: NAVEGADOR, headless: true, userDataDir: path.join(SAIDA, 'perfil-montagem'),
  args: ['--allow-file-access-from-files'],
});
const aba = await navegador.newPage();
await aba.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

async function png(html, arquivo, transparente) {
  const h = path.join(CENAS_DIR, arquivo.replace('.png', '.html'));
  fs.writeFileSync(h, pagina(html, transparente), 'utf8');
  await aba.goto(pathToFileURL(h).href, { waitUntil: 'load' });
  await aba.screenshot({ path: path.join(CENAS_DIR, arquivo), omitBackground: transparente });
}

const comPasso = CENAS.filter((c) => c.titulo);
const clipes = [];
for (const cena of CENAS) {
  const montada = cena.tipo === 'abertura' ? htmlAbertura()
    : cena.tipo === 'fim' ? htmlFim()
    : cena.tipo === 'instalar' ? htmlInstalar()
    : cena.tipo === 'fixar' ? htmlFixar()
    : htmlTela(cena);
  await png(montada.html, `${cena.id}-base.png`, false);
  await png(htmlMoldura(cena, comPasso.indexOf(cena) + 1, comPasso.length), `${cena.id}-moldura.png`, true);

  const fala = duracaoWav(path.join(CENAS_DIR, `${cena.id}.wav`));
  const dur = +(ANTES + fala + DEPOIS).toFixed(2);

  // Câmera: aproxima devagar do foco (ou um leve zoom no centro).
  let Z = 1.05, fx = 0.5, fy = 0.5;
  if (montada.foco) {
    const f = montada.foco;
    Z = Math.max(1.06, Math.min(1.5, 1500 / (f.w + 160), 640 / (f.h + 160)));
    fx = (f.x + f.w / 2) / 1920;
    fy = (f.y + f.h / 2) / 1080;
  }
  const T = Math.round(2.4 * FPS), atraso = Math.round(0.6 * FPS);
  const z = `1+${(Z - 1).toFixed(3)}*(1-cos(PI*min(max(on-${atraso}\\,0)/${T}\\,1)))/2`;
  const x = `max(0\\,min(iw-iw/zoom\\,${fx.toFixed(4)}*iw-iw/zoom/2))`;
  const y = `max(0\\,min(ih-ih/zoom\\,${fy.toFixed(4)}*ih-ih/zoom/2))`;
  const saida = path.join(CENAS_DIR, `${cena.id}.mp4`);
  const filtro = [
    `[0:v]scale=3840:2160,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=1920x1080:fps=${FPS}[cam]`,
    `[cam][1:v]overlay=0:0,fade=t=in:st=0:d=0.45:c=0x0f1117,fade=t=out:st=${(dur - 0.45).toFixed(2)}:d=0.45:c=0x0f1117,format=yuv420p[v]`,
    `[2:a]adelay=${ANTES * 1000}:all=1,apad[a]`,
  ].join(';');
  rodar(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-loop', '1', '-framerate', String(FPS), '-i', path.join(CENAS_DIR, `${cena.id}-base.png`),
    '-loop', '1', '-framerate', String(FPS), '-i', path.join(CENAS_DIR, `${cena.id}-moldura.png`),
    '-i', path.join(CENAS_DIR, `${cena.id}.wav`),
    '-filter_complex', filtro, '-map', '[v]', '-map', '[a]', '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', saida,
  ]);
  clipes.push(saida);
  console.log(`cena ${cena.id}: ${dur}s`);
}
await navegador.close();

// ---------- Junta tudo ----------
const lista = path.join(CENAS_DIR, 'lista.txt');
fs.writeFileSync(lista, clipes.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n'));
rodar(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista,
  '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
  '-movflags', '+faststart', FINAL]);
console.log('vídeo:', FINAL);

function rodar(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} falhou (${r.status})`);
}
