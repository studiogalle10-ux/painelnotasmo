// Leitura do código de barras do DANFE (CODE-128) pela câmera.
// Carregado sob demanda (React.lazy): o ZXing só é baixado quando a câmera é aberta.
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatOneDReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

interface Props {
  onLer: (texto: string) => void;
  onFechar: () => void;
}

function mensagemErro(e: unknown): string {
  const nome = e instanceof DOMException ? e.name : '';
  if (nome === 'NotAllowedError') return 'Permita o acesso à câmera nas configurações do navegador.';
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'Nenhuma câmera encontrada.';
  if (nome === 'NotReadableError') return 'A câmera está sendo usada por outro aplicativo.';
  if (!window.isSecureContext) return 'A câmera só funciona em endereço seguro (https).';
  return 'Não foi possível abrir a câmera.';
}

export default function LeitorCamera({ onLer, onFechar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Guarda as funções mais recentes sem reabrir a câmera a cada renderização.
  const callbacks = useRef({ onLer, onFechar });
  useEffect(() => {
    callbacks.current = { onLer, onFechar };
  });

  useEffect(() => {
    let controles: IScannerControls | null = null;
    let encerrado = false;
    const dicas = new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    const leitor = new BrowserMultiFormatOneDReader(dicas);

    leitor
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } } },
        video.current!,
        (resultado, _erro, c) => {
          if (!resultado || encerrado) return;
          encerrado = true;
          c.stop();
          callbacks.current.onLer(resultado.getText());
          callbacks.current.onFechar();
        },
      )
      .then((c) => {
        controles = c;
        if (encerrado) c.stop();
      })
      .catch((e) => setErro(mensagemErro(e)));

    return () => {
      encerrado = true;
      controles?.stop();
    };
  }, []);

  return (
    <div className="camera" role="dialog" aria-label="Leitura pela câmera">
      <video ref={video} className="camera-video" muted playsInline />
      <div className="camera-guia" aria-hidden="true" />
      <p className="camera-texto">
        {erro ?? 'Aponte para o código de barras do DANFE, com o celular deitado.'}
      </p>
      <button className="camera-fechar" onClick={onFechar}>Fechar câmera</button>
    </div>
  );
}
