// Contenido en línea del documento: texto con las marcas bold, italic, code y link, y saltos de línea. Genera
// elementos React, nunca HTML: todo sale escapado (RF-003). Un enlace inseguro se muestra como texto.
import type { ReactNode } from 'react';
import type { Inline, Marca } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { atributosEnlace, CLASE_ENLACE, esExterno, hrefSeguro } from './enlaces';

const ETIQUETAS = { bold: 'strong', italic: 'em', code: 'code' } as const;

/**
 * Un texto con sus marcas de formato (sin el enlace), de afuera hacia adentro en el orden canónico. Una marca que
 * no está en la lista permitida no se dibuja (§VI.2), aunque una validación anterior la hubiera dejado pasar.
 */
function conMarcas(texto: string, marcas: readonly Marca[], clave: number): ReactNode {
  return marcas.reduceRight<ReactNode>((interior, marca) => {
    const Etiqueta = (ETIQUETAS as Partial<Record<string, (typeof ETIQUETAS)[keyof typeof ETIQUETAS]>>)[marca.type];
    return Etiqueta ? <Etiqueta key={clave}>{interior}</Etiqueta> : interior;
  }, texto);
}

const destinoDe = (nodo: Inline) =>
  nodo.type === 'text' ? nodo.marks?.find((marca) => marca.type === 'link')?.attrs.href : undefined;

/** Los nodos seguidos con el mismo destino forman un solo enlace. */
function tramos(contenido: readonly Inline[]) {
  const salida: { href: string | undefined; nodos: Inline[] }[] = [];
  for (const nodo of contenido) {
    const href = destinoDe(nodo);
    const anterior = salida.at(-1);
    if (anterior && href !== undefined && anterior.href === href) anterior.nodos.push(nodo);
    else salida.push({ href, nodos: [nodo] });
  }
  return salida;
}

export function EnLinea({ contenido }: { contenido: readonly Inline[] | undefined }) {
  return (
    <>
      {tramos(contenido ?? []).map(({ href, nodos }, i) => {
        const interior = nodos.map((nodo, j) =>
          nodo.type === 'hardBreak' ? <br key={j} /> : conMarcas(nodo.text, nodo.marks ?? [], j),
        );
        if (href === undefined) return interior;
        const seguro = hrefSeguro(href);
        return seguro ? (
          <a key={i} {...atributosEnlace(seguro)} className={CLASE_ENLACE}>
            {interior}
            {esExterno(seguro) && <AvisoOtraPestania />}
          </a>
        ) : (
          <span key={i}>{interior}</span>
        );
      })}
    </>
  );
}
