// Separa um MP3 único (as 16 falas lidas em sequência) em vozes/01.mp3 … 16.mp3.
// Alinha as frases do roteiro às pausas do áudio pelo tamanho de cada frase (programação dinâmica).
// Uso: node separar.mjs "<arquivo.mp3>"            → mostra os cortes
//      node separar.mjs "<arquivo.mp3>" --gravar   → grava os 16 arquivos
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import { CENAS } from './roteiro.mjs';

const [arquivo, opcao] = process.argv.slice(2);
if (!arquivo) throw new Error('Informe o MP3.');

const analise = spawnSync(ffmpeg, ['-hide_banner', '-i', arquivo, '-af', 'silencedetect=noise=-40dB:d=0.18', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const total = (() => { const [, h, m, s] = /Duration: (\d+):(\d+):([\d.]+)/.exec(analise); return +h * 3600 + +m * 60 + +s; })();
const inicios = [...analise.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const fins = [...analise.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const pausas = inicios.map((s, i) => ({ s, e: fins[i] ?? total })).filter((p) => p.s > 0.3 && p.e < total - 0.3);
const falaIni = fins[0] && inicios[0] < 0.05 ? fins[0] : 0; // silêncio no começo
const falaFim = inicios.at(-1) && (fins.at(-1) ?? total) >= total - 0.05 ? inicios.at(-1) : total;

// Frases do roteiro, marcando onde termina cada fala.
const frases = [];
CENAS.forEach((c, i) => {
  const partes = c.fala.split(/(?<=[.!?:])\s+/);
  partes.forEach((t, j) => frases.push({ letras: t.length, fala: i, ultima: j === partes.length - 1 }));
});
const letras = frases.reduce((t, f) => t + f.letras, 0);
const somPorLetra = (falaFim - falaIni - pausas.reduce((t, p) => t + p.e - p.s, 0) * 0.5) / letras;

// dp[k][j]: melhor custo com a frase k terminando na pausa j.
const N = frases.length, P = pausas.length;
const custoFrase = (dur, f) => { const esp = f.letras * somPorLetra; return (dur - esp) ** 2 / esp; };
const bonusPausa = (p) => -0.8 * Math.log(p.e - p.s);
const dp = Array.from({ length: N }, () => new Array(P).fill(Infinity));
const de = Array.from({ length: N }, () => new Array(P).fill(-1));
for (let j = 0; j < P; j++) dp[0][j] = custoFrase(pausas[j].s - falaIni, frases[0]) + bonusPausa(pausas[j]);
for (let k = 1; k < N - 1; k++) {
  for (let j = k; j < P; j++) {
    for (let i = k - 1; i < j; i++) {
      if (dp[k - 1][i] === Infinity) continue;
      const c = dp[k - 1][i] + custoFrase(pausas[j].s - pausas[i].e, frases[k]) + bonusPausa(pausas[j]);
      if (c < dp[k][j]) { dp[k][j] = c; de[k][j] = i; }
    }
  }
}
// Última frase vai até o fim do áudio.
let melhor = Infinity, jFim = -1;
for (let j = 0; j < P; j++) {
  const c = dp[N - 2][j] + custoFrase(falaFim - pausas[j].e, frases[N - 1]);
  if (c < melhor) { melhor = c; jFim = j; }
}
const fimDaFrase = new Array(N);
fimDaFrase[N - 2] = jFim;
for (let k = N - 2; k > 0; k--) fimDaFrase[k - 1] = de[k][fimDaFrase[k]];

// Cortes das falas: no meio da pausa depois da última frase de cada fala.
const cortes = [0];
frases.forEach((f, k) => {
  if (f.ultima && k < N - 1) { const p = pausas[fimDaFrase[k]]; cortes.push((p.s + p.e) / 2); }
});
cortes.push(total);

fs.mkdirSync('vozes', { recursive: true });
CENAS.forEach((c, i) => {
  const ini = cortes[i], fim = cortes[i + 1];
  const esp = c.fala.length * somPorLetra;
  console.log(`${String(i + 1).padStart(2, '0')} ${c.id.padEnd(11)} ${ini.toFixed(2).padStart(7)} → ${fim.toFixed(2).padStart(7)}  (${(fim - ini).toFixed(1)}s, esperado ~${esp.toFixed(1)}s)`);
  if (opcao === '--gravar') {
    spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', arquivo, '-ss', ini.toFixed(3), '-to', fim.toFixed(3),
      '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
      '-c:a', 'libmp3lame', '-b:a', '160k', path.join('vozes', `${String(i + 1).padStart(2, '0')}.mp3`)]);
  }
});
