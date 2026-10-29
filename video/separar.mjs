// Separa um MP3 único (as 16 falas lidas em sequência) em vozes/01.mp3 … 16.mp3.
// Usa a transcrição com tempo por palavra (node transcrever.mjs) para achar onde cada fala começa e
// termina. Se a voz leu também os títulos do FALAS.md ("01. Abertura, arquivo 01.mp3"), eles ficam de fora.
// Uso: node separar.mjs "<arquivo.mp3>"            → mostra os cortes
//      node separar.mjs "<arquivo.mp3>" --gravar   → grava os 16 arquivos
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import { CENAS } from './roteiro.mjs';

const [arquivo, opcao] = process.argv.slice(2);
if (!arquivo) throw new Error('Informe o MP3.');
const palavras = JSON.parse(fs.readFileSync('saida/palavras.json', 'utf8'));
const normal = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Silêncios, para encostar os cortes nas pausas.
const analise = spawnSync(ffmpeg, ['-hide_banner', '-i', arquivo, '-af', 'silencedetect=noise=-40dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const total = (() => { const [, h, m, s] = /Duration: (\d+):(\d+):([\d.]+)/.exec(analise); return +h * 3600 + +m * 60 + +s; })();
const sIni = [...analise.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const sFim = [...analise.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const silencios = sIni.map((s, i) => ({ s, e: sFim[i] ?? total }));

// Onde a voz leu "arquivo NN.mp3": a fala começa logo depois.
const titulos = palavras.flatMap((p, i) => (/mp3/i.test(p.texto) ? [i] : []));
if (titulos.length !== CENAS.length) {
  throw new Error(`Achei ${titulos.length} leituras de "arquivo NN.mp3"; esperava ${CENAS.length}.`);
}
const inicioTitulo = (k) => { // a palavra "arquivo" antes do NN.mp3, voltando até o número do título
  let i = titulos[k];
  while (i > 0 && !/^arquivo/i.test(palavras[i].texto)) i--;
  return i;
};

const cortes = CENAS.map((cena, k) => {
  const primeira = titulos[k] + 1;
  // Última palavra da fala: procura o fim do texto do roteiro antes do próximo título.
  const ultimaDoRoteiro = normal(cena.fala.split(/\s+/).at(-1));
  let ultima;
  if (k === CENAS.length - 1) ultima = palavras.length - 1;
  else {
    const limite = inicioTitulo(k + 1);
    ultima = limite - 1;
    for (let i = limite - 1; i > primeira; i--) {
      if (normal(palavras[i].texto).endsWith(ultimaDoRoteiro.slice(-5))) { ultima = i; break; }
    }
  }
  const ini = palavras[primeira].ini, fim = palavras[ultima].fim;
  // Encosta nas pausas: começa no fim do silêncio antes da 1ª palavra, termina no início do silêncio depois da última.
  // Antes: a maior pausa entre o "mp3" e a 2ª palavra (o tempo da 1ª palavra às vezes vem adiantado).
  const segunda = palavras[primeira + 1]?.ini ?? ini + 1;
  const antes = silencios.filter((s) => s.s >= palavras[titulos[k]].ini + 0.3 && s.e <= segunda)
    .sort((a, b) => (b.e - b.s) - (a.e - a.s))[0];
  const depois = silencios.find((s) => s.s >= fim - 0.25);
  return {
    ini: antes ? Math.max(0, antes.e - 0.05) : ini - 0.1,
    fim: depois ? Math.min(total, depois.s + 0.12) : fim + 0.15,
    texto: palavras.slice(primeira, ultima + 1).map((p) => p.texto).join(' '),
  };
});

fs.mkdirSync('vozes', { recursive: true });
cortes.forEach((c, i) => {
  const n = String(i + 1).padStart(2, '0');
  console.log(`${n} ${c.ini.toFixed(2).padStart(7)} → ${c.fim.toFixed(2).padStart(7)}  ${c.texto}`);
  if (opcao === '--gravar') {
    spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', arquivo, '-ss', c.ini.toFixed(3), '-to', c.fim.toFixed(3),
      '-af', 'afade=t=in:d=0.03,areverse,afade=t=in:d=0.06,areverse', '-c:a', 'libmp3lame', '-b:a', '160k',
      path.join('vozes', `${n}.mp3`)]);
  }
});
