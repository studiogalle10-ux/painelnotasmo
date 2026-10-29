import { useId } from 'react';

interface Props {
  className?: string;
  /** Mostra "Tecnologia que impulsiona o seu amanhã" embaixo (só no login). */
  slogan?: boolean;
}

/** Logo da VART em vetor (nítida em qualquer tamanho, inclusive na TV). */
export function LogoVart({ className, slogan = false }: Props) {
  const id = useId();
  return (
    <div className={`logo-vart ${className ?? ''}`}>
      <svg viewBox="0 0 280 64" role="img" aria-label="VART">
        <defs>
          <linearGradient id={`${id}-claro`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#c9cdd4" />
          </linearGradient>
          <linearGradient id={`${id}-azul`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        {/* Símbolo: perna clara do V e perna azul por cima. */}
        <polygon points="4,4 30,4 63,60 49,60" fill={`url(#${id}-claro)`}
          stroke={`url(#${id}-claro)`} strokeWidth="3" strokeLinejoin="round" />
        <polygon points="82,4 108,4 63,60 49,60" fill={`url(#${id}-azul)`}
          stroke={`url(#${id}-azul)`} strokeWidth="3" strokeLinejoin="round" />
        {/* VART: o A sem a barra, como no manual. */}
        <path d="M128 14 L144 50 L160 14 M168 50 L184 14 L200 50 M211 50 V14 H226 A9 9 0 0 1 226 32 H211 M223 32 L236 50 M242 14 H274 M258 14 V50"
          fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="miter" />
      </svg>
      {slogan && <p className="logo-slogan">Tecnologia que impulsiona<br />o seu amanhã.</p>}
    </div>
  );
}
