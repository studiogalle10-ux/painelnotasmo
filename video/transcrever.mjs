// Transcreve um áudio (Whisper, roda local) com o tempo de cada palavra → saida/palavras.json.
// O áudio vai em pedaços de até 25 s cortados nas pausas (o Whisper se perde em trechos longos).
// Uso: node transcrever.mjs "<arquivo.mp3>"
import fs from 'fs';
import { spawnSync } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import { pipeline } from '@huggingface/transformers';

const arquivo = process.argv[2];
if (!arquivo) throw new Error('Informe o áudio.');
const TAXA = 16000;

// Whisper quer 16 kHz, mono, float32.
const bruto = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', arquivo, '-ar', String(TAXA), '-ac', '1', '-f', 'f32le', '-'],
  { maxBuffer: 1 << 30 }).stdout;
const audio = new Float32Array(bruto.buffer.slice(bruto.byteOffset, bruto.byteOffset + bruto.byteLength));
const total = audio.length / TAXA;

const analise = spawnSync(ffmpeg, ['-hide_banner', '-i', arquivo, '-af', 'silencedetect=noise=-40dB:d=0.2', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const ini = [...analise.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const fim = [...analise.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const meios = ini.map((s, i) => (s + (fim[i] ?? total)) / 2);

// Pedaços: até 25 s, terminando no meio de uma pausa.
const pedacos = [];
let comeco = 0;
while (comeco < total - 0.5) {
  const candidatos = meios.filter((m) => m > comeco + 5 && m <= comeco + 25);
  const corte = comeco + 25 >= total ? total : (candidatos.at(-1) ?? comeco + 25);
  pedacos.push([comeco, corte]);
  comeco = corte;
}

const transcritor = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base_timestamped', { dtype: 'fp32' });
const palavras = [];
for (const [a, b] of pedacos) {
  const trecho = audio.subarray(Math.floor(a * TAXA), Math.floor(b * TAXA));
  const r = await transcritor(trecho, { language: 'portuguese', task: 'transcribe', return_timestamps: 'word' });
  for (const c of r.chunks) palavras.push({ texto: c.text.trim(), ini: a + c.timestamp[0], fim: a + (c.timestamp[1] ?? c.timestamp[0]) });
  console.log(`${a.toFixed(1)}–${b.toFixed(1)}: ${r.text.trim()}`);
}
fs.writeFileSync('saida/palavras.json', JSON.stringify(palavras, null, 1));
console.log(`${palavras.length} palavras`);
