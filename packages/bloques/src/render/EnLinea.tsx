// Contenido en línea del documento: texto con las marcas de la lista permitida (enlace, negrita, cursiva, subrayado,
// tachado, resaltado, código, superíndice y subíndice) y saltos de línea. Genera elementos React, nunca HTML: todo
// sale escapado (RF-003). Un enlace inseguro se muestra como texto.
import type { ReactNode } from 'react';
import type { Inline, Marca } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { CLASES_RESALTADO, CLASES_SUBRAYADO } from './clases';
import { atributosEnlace, CLASE_ENLACE, esExterno, hrefSeguro } from './enlaces';

type Etiqueta = 'strong' | 'em' | 'u' | 's' | 'mark' | 'code' | 'sup' | 'sub';

const ETIQUETAS: Partial<Record<string, { etiqueta: Etiqueta; clases?: string }>> = {
  bold: { etiqueta: 'strong' },
  italic: { etiqueta: 'em' },
  underline: { etiqueta: 'u', clases: CLASES_SUBRAYADO },
  strike: { etiqueta: 's' },
  highlight: { etiqueta: 'mark', clases: CLASES_RESALTADO },
  code: { etiqueta: 'code' },
  superscript: { etiqueta: 'sup' },
  subscript: { etiqueta: 'sub' },
};

/**
 * Un texto con sus marcas de formato (sin el enlace), de afuera hacia adentro en el orden canónico. Una marca que
 * no está en la lista permitida no se dibuja (§VI.2), aunque una validación anterior la hubiera dejado pasar. Un
 * enlace ya va subrayado: el subrayado de un texto con enlace no agrega una segunda línea (D31 U9).
 */
function conMarcas(texto: string, marcas: readonly Marca[], clave: number): ReactNode {
  const conEnlace = marcas.some((marca) => marca.type === 'link');
  return marcas.reduceRight<ReactNode>((interior, marca) => {
    const formato = Object.hasOwn(ETIQUETAS, marca.type) ? ETIQUETAS[marca.type] : undefined;
    if (!formato || (conEnlace && marca.type === 'underline')) return interior;
    const { etiqueta: Nombre, clases } = formato;
    return (
      <Nombre key={clave} className={clases}>
        {interior}
      </Nombre>
    );
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
