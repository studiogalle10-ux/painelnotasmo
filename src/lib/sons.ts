// Sons gerados pelo navegador (Web Audio), sem arquivos. Os navegadores só liberam o áudio
// depois de um toque ou tecla na página: chame liberarSom() nesses eventos.

export type Som = 'entrada' | 'saida' | 'aviso' | 'erro';

let contexto: AudioContext | null = null;

function obterContexto(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  contexto ??= new AudioContext();
  return contexto;
}

export function somLiberado(): boolean {
  return contexto?.state === 'running';
}

export async function liberarSom(): Promise<boolean> {
  const ctx = obterContexto();
  if (!ctx) return false;
  try {
    if (ctx.state !== 'running') await ctx.resume();
  } catch {
    return false;
  }
  return ctx.state === 'running';
}

function tom(ctx: AudioContext, freq: number, inicio: number, duracao: number, onda: OscillatorType) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  const t0 = ctx.currentTime + inicio;
  osc.type = onda;
  osc.frequency.value = freq;
  // Rampa curta na entrada e na saída para não estalar.
  ganho.gain.setValueAtTime(0, t0);
  ganho.gain.linearRampToValueAtTime(0.35, t0 + 0.01);
  ganho.gain.setValueAtTime(0.35, t0 + duracao - 0.03);
  ganho.gain.linearRampToValueAtTime(0, t0 + duracao);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duracao);
}

const VIBRACAO: Record<Som, number | number[]> = {
  entrada: 80,
  saida: [80, 60, 80],
  aviso: 250,
  erro: [300, 100, 300],
};

export function tocar(som: Som): void {
  try {
    navigator.vibrate?.(VIBRACAO[som]);
  } catch {
    // Vibração é opcional.
  }

  const ctx = obterContexto();
  if (!ctx || ctx.state !== 'running') return;
  if (som === 'entrada') tom(ctx, 1320, 0, 0.15, 'sine');
  if (som === 'saida') {
    tom(ctx, 880, 0, 0.12, 'sine');
    tom(ctx, 1320, 0.16, 0.12, 'sine');
  }
  if (som === 'aviso') tom(ctx, 330, 0, 0.35, 'triangle');
  if (som === 'erro') {
    tom(ctx, 220, 0, 0.3, 'square');
    tom(ctx, 180, 0.35, 0.4, 'square');
  }
}
