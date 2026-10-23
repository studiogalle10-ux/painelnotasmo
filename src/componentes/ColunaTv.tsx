import { useEffect, useRef, useState } from 'react';
import { formatarDocEmitente } from '../lib/chaveAcesso';
import { paginar, quantosCabem } from '../lib/paginacao';
import { ALTURA_CARTAO_VH, type ItemPainel, type TipoColuna } from '../lib/painel';
import { CartaoNota } from './CartaoNota';

const ESPACO_VH = 1.2;

interface Props {
  titulo: string;
  coluna: TipoColuna;
  itens: ItemPainel[];
  /** Cresce a cada troca de página (o mesmo para as três colunas). */
  contador: number;
  nomes: Record<string, string>;
  vazio: string;
}

export function ColunaTv({ titulo, coluna, itens, contador, nomes, vazio }: Props) {
  const corpo = useRef<HTMLOListElement>(null);
  const [porPagina, setPorPagina] = useState(1);

  // Quantos cards cabem inteiros na altura da coluna (muda com o tamanho da TV).
  useEffect(() => {
    const el = corpo.current;
    if (!el) return;
    const medir = () => {
      const vh = window.innerHeight / 100;
      setPorPagina(quantosCabem(el.clientHeight, ALTURA_CARTAO_VH[coluna] * vh, ESPACO_VH * vh));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [coluna]);

  const pagina = paginar(itens, porPagina, contador);

  return (
    <section className={`coluna coluna-${coluna}`}>
      <header className="coluna-topo">
        <h2>{titulo}</h2>
        <span className="coluna-contador">{itens.length}</span>
      </header>
      <ol ref={corpo} className="coluna-corpo" style={{ gap: `${ESPACO_VH}vh` }}>
        {itens.length === 0 && <li className="coluna-vazia">{vazio}</li>}
        {pagina.itens.map((item) => (
          <CartaoNota
            key={item.dados.chave}
            item={item}
            coluna={coluna}
            emissor={nomes[item.dados.cnpjEmitente]
              ?? formatarDocEmitente(item.dados.cnpjEmitente, item.dados.tipoDocEmitente)}
          />
        ))}
      </ol>
      {pagina.total > 1 && (
        <footer className="coluna-pagina">Página {pagina.numero} de {pagina.total}</footer>
      )}
    </section>
  );
}
