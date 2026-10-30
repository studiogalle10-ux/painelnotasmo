import { LogoVart } from './LogoVart';

const EMAILS = ['sac.vart@hotmail.com', 'vart.tecn@gmail.com'];

/** Contato do suporte. Na TV é só texto (ninguém clica lá). */
export function Rodape({ tv = false }: { tv?: boolean }) {
  return (
    <footer className={tv ? 'rodape rodape-tv' : 'rodape'}>
      {tv && <span className="rodape-marca">Desenvolvido por <LogoVart className="logo-rodape" /></span>}
      <span>
        Suporte:{' '}
        {EMAILS.map((e, i) => (
          <span key={e}>
            {i > 0 && ' · '}
            {tv ? e : <a href={`mailto:${e}`}>{e}</a>}
          </span>
        ))}
      </span>
      <strong>Vart Soluções em Tecnologia e Eficiência</strong>
    </footer>
  );
}
